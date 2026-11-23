/**
 * Dissecting a whole capture, in order, since TCP streams, TLS records and QUIC connections carry state from packet
 * to packet. QUIC Initial packets are decrypted first (WebCrypto is asynchronous, the dissectors are not): a quick
 * pass finds UDP/443 datagrams, derives each connection's Initial keys from its first DCID and opens every Initial.
 * A packet that throws in a dissector is shown with the error, never taken down with it.
 */
import { ipv4, ipv6, Src } from "../bytes";
import { initialKeys, longType, openInitial, parseLong, type InitialKeys } from "../quic-crypto";
import { LINK, type RawFrame } from "../read";
import type { Packet } from "../types";
import { Session, type Ctx, type Out } from "./core";
import { dissectFrame } from "./link";

interface UdpAt {
  src: string;
  dst: string;
  sport: number;
  dport: number;
  at: number;
  len: number;
}

/** Just enough of link, IP and UDP to find a UDP payload, for the decryption pass. */
export function locateUdp(data: Uint8Array, linkType: number): UdpAt | undefined {
  const s = new Src(data);
  try {
    let at = 0;
    let type = 0;
    if (linkType === LINK.ETHERNET) {
      type = s.u16(12);
      at = 14;
      while (type === 0x8100 || type === 0x88a8) {
        type = s.u16(at + 2);
        at += 4;
      }
    } else if (linkType === LINK.SLL) {
      type = s.u16(14);
      at = 16;
    } else if (linkType === LINK.SLL2) {
      type = s.u16(0);
      at = 20;
    } else if (linkType === LINK.RAW || linkType === LINK.IPV4 || linkType === LINK.IPV6) {
      type = s.u8(0) >> 4 === 6 ? 0x86dd : 0x0800;
    } else if (linkType === LINK.NULL || linkType === LINK.LOOP) {
      type = s.u8(4) >> 4 === 6 ? 0x86dd : 0x0800;
      at = 4;
    } else return undefined;
    let src: string;
    let dst: string;
    if (type === 0x0800) {
      if (s.u8(at + 9) !== 17 || (s.u16(at + 6) & 0x1fff) !== 0) return undefined;
      src = ipv4(s.bytes(at + 12, 4));
      dst = ipv4(s.bytes(at + 16, 4));
      at += (s.u8(at) & 0x0f) * 4;
    } else if (type === 0x86dd) {
      if (s.u8(at + 6) !== 17) return undefined;
      src = ipv6(s.bytes(at + 8, 16));
      dst = ipv6(s.bytes(at + 24, 16));
      at += 40;
    } else return undefined;
    const len = Math.min(s.u16(at + 4), data.length - at) - 8;
    return { src, dst, sport: s.u16(at), dport: s.u16(at + 2), at: at + 8, len };
  } catch {
    return undefined;
  }
}

/** Decrypt every QUIC v1 Initial in the capture, keyed by packet number and the packet's offset in its frame. */
async function openInitials(frames: RawFrame[], session: Session) {
  const conns = new Map<string, { client: string; dcid: Uint8Array }>();
  const keyCache = new Map<string, Promise<InitialKeys>>();
  const keysFor = (dcid: Uint8Array, side: "client" | "server") => {
    const id = `${side}:${Array.from(dcid).join(",")}`;
    let k = keyCache.get(id);
    if (!k) {
      k = initialKeys(dcid, side);
      keyCache.set(id, k);
    }
    return k;
  };
  for (const [i, frame] of frames.entries()) {
    const u = locateUdp(frame.data, frame.linkType);
    if (!u || (u.sport !== 443 && u.dport !== 443) || u.len <= 0) continue;
    const payload = frame.data.subarray(u.at, u.at + u.len);
    const from = `${u.src}|${u.sport}`;
    const to = `${u.dst}|${u.dport}`;
    const flow = from < to ? `${from}|${to}` : `${to}|${from}`;
    let at = 0;
    while (at < payload.length && ((payload[at] ?? 0) & 0x80) !== 0) {
      let lh: ReturnType<typeof parseLong>;
      try {
        lh = parseLong(payload.subarray(at));
      } catch {
        break;
      }
      if (lh.version !== 1 || lh.end === undefined) break;
      if (longType(lh.first, lh.version) === "Initial") {
        let c = conns.get(flow);
        if (!c) {
          c = { client: from, dcid: lh.dcid.slice() };
          conns.set(flow, c);
        }
        const keys = await keysFor(c.dcid, from === c.client ? "client" : "server");
        session.opened.set(`${i + 1}:${u.at + at}`, await openInitial(payload.subarray(at), keys));
      }
      at += lh.end;
    }
  }
}

const blank = (): Out => ({
  headers: [],
  src: "",
  dst: "",
  protocol: "",
  info: "",
  protos: new Set(),
  analysis: [],
});

export async function dissectAll(
  frames: RawFrame[],
  onProgress?: (done: number) => void,
): Promise<Packet[]> {
  const session = new Session();
  await openInitials(frames, session);
  const first = frames[0]?.time ?? 0;
  const packets: Packet[] = [];
  for (const [i, frame] of frames.entries()) {
    const out = blank();
    const ctx: Ctx = { n: i + 1, frame: new Src(frame.data), out, session };
    const meta = {
      time: frame.time,
      rel: frame.time - first,
      delta: i ? frame.time - (frames[i - 1]?.time ?? frame.time) : 0,
      wireLength: frame.wireLength,
      linkType: frame.linkType,
      iface: frame.iface,
    };
    try {
      dissectFrame(ctx, meta);
    } catch (e) {
      // A dissector bug or a pathological packet: say so on this packet and go on with the rest.
      out.headers.push({
        id: "error",
        proto: "data",
        short: "Error",
        name: "Dissection stopped",
        value: e instanceof Error ? e.message : String(e),
        offset: 0,
        length: 0,
        extent: 0,
        layer: "app",
        warn: true,
        why: "This packet confused a dissector; the fields above it are still right.",
      });
      out.info ||= "Malformed packet";
    }
    packets.push({
      n: i + 1,
      time: frame.time,
      rel: meta.rel,
      data: frame.data,
      wireLength: frame.wireLength,
      linkType: frame.linkType,
      iface: frame.iface,
      headers: out.headers,
      plain: out.plain,
      src: out.src || "—",
      dst: out.dst || "—",
      protocol: out.protocol || "Frame",
      info: out.info,
      protos: out.protos,
      flow: out.flow,
      stream: out.stream,
      analysis: out.analysis,
    });
    // Thousands of packets: let the page paint and answer input between batches.
    if (i % 2000 === 1999) {
      onProgress?.(i + 1);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return packets;
}
