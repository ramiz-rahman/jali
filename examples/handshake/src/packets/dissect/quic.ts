/**
 * QUIC (RFC 9000) on UDP: long headers (Initial, 0-RTT, Handshake, Retry, Version Negotiation), several coalesced in
 * one datagram, and short 1-RTT headers. Initial packets arrive here already decrypted (dissect/index.ts does that
 * first, with WebCrypto): their frames are read (CRYPTO, ACK, PADDING, PING, CONNECTION_CLOSE) and the TLS hello
 * inside CRYPTO is handed to the TLS reader, reassembled when it spans several packets. Everything else is
 * protected with keys from the handshake, and marked so.
 */
import { hex, Src, Truncated } from "../bytes";
import { named, QUIC_VERSIONS } from "../names";
import { longType, parseLong } from "../quic-crypto";
import type { Field } from "../types";
import { Fields, header, top, type Ctx, type QuicConn } from "./core";
import { handshakes, type HelloSummary } from "./tls";

const PROTECTED_WHY =
  "Protected with keys derived from the TLS key exchange: unlike Initial keys, nobody on the path can derive them, this tool included. The packet number is hidden too, by header protection.";

const SPIN_WHY =
  "The latency spin bit flips once per round trip, so an operator can measure RTT passively. It is the one signal QUIC chose to leave visible, and endpoints may disable it.";

const INITIAL_WHY =
  "Initial packets are encrypted with keys derived from the client's Destination Connection ID and a published salt (RFC 9001 §5.2): anyone can decrypt them, as this tool just did. It stops middleboxes from depending on the handshake's format, not eavesdroppers.";

const PADDING_WHY =
  "A client's Initial datagram must be at least 1200 bytes (RFC 9000 §14.1): it proves the path carries that much, and caps amplification, since a server may send at most three times what it received before the client's address is validated.";

const ACK_WHY =
  "Acknowledges packet numbers, not bytes. A retransmission goes in a new packet with a new number, so an ACK is never ambiguous about which copy arrived, unlike TCP's.";

const conn = (ctx: Ctx, flowKey: string): QuicConn | undefined => ctx.session.quic.get(flowKey);

export function dissectQuic(ctx: Ctx, s: Src, from: string, flowKey: string) {
  const infos: string[] = [];
  let at = 0;
  while (at < s.length) {
    const first = s.b[at] ?? 0;
    if (first === 0 && at > 0) {
      // Some stacks pad a datagram after its last packet with zeros instead of a PADDING frame.
      const n = s.length - at;
      const last = ctx.out.headers.at(-1);
      last?.children?.push({
        id: `${last.id}.trail`,
        name: "Datagram padding",
        value: `${n} bytes`,
        offset: s.span(at, n)[0],
        length: s.span(at, n)[1],
        layer: "transport",
      });
      break;
    }
    const next =
      first & 0x80
        ? long(ctx, s, at, from, flowKey, infos)
        : short(ctx, s, at, from, flowKey, infos);
    if (next <= at) break;
    at = next;
  }
  top(ctx, "QUIC", infos.join("; "));
}

/** One long-header packet from `at`; returns where the next coalesced packet starts. */
function long(
  ctx: Ctx,
  s: Src,
  at: number,
  from: string,
  flowKey: string,
  infos: string[],
): number {
  const pkt = s.sub(at, s.length - at);
  let end = s.length;
  header(
    ctx,
    { proto: "quic", short: "QUIC", name: "QUIC", layer: "transport", s: pkt, i: 0, n: pkt.length },
    (F, size, h) => {
      const lh = parseLong(pkt.b);
      const version = lh.version;
      const vname = named(QUIC_VERSIONS, version, "Version");
      if (version === 0) {
        h.value = "Version Negotiation";
        F.f("form", "Header form", "Long header (1)", 0, 1);
        F.f(
          "version",
          "Version",
          "0x00000000 (Version Negotiation)",
          1,
          4,
          "The server doesn't speak the client's version and lists the ones it does. Never encrypted or authenticated, so a client only trusts it to retry.",
        );
        ids(F, lh);
        const list: string[] = [];
        for (let i = lh.scidAt + lh.scid.length; i + 4 <= pkt.length; i += 4) {
          list.push(named(QUIC_VERSIONS, pkt.u32(i), `0x${pkt.u32(i).toString(16)}`));
          F.f(`sv${i}`, "Supported version", list.at(-1) ?? "", i, 4);
        }
        infos.push(`Version Negotiation: ${list.join(", ")}`);
        return;
      }
      const type = longType(lh.first, version);
      const opened = ctx.session.opened.get(`${ctx.n}:${s.span(at, 1)[0]}`);
      const decrypted = typeof opened === "object" ? opened : undefined;
      const firstPlain = decrypted?.first ?? lh.first;
      h.value = `${type}, ${vname}`;
      F.f(
        "form",
        "Header form",
        "Long header (1)",
        0,
        1,
        "Long headers carry both connection IDs and the version: used until the handshake is done.",
      );
      F.f(
        "fixed",
        "Fixed bit",
        `${(lh.first >> 6) & 1}`,
        0,
        1,
        "Always 1 (except with grease_quic_bit), so QUIC can share a port with other protocols that set it to 0.",
      );
      F.f(
        "type",
        "Packet type",
        `${type} (${(lh.first >> 4) & 3})`,
        0,
        1,
        type === "Initial" ? INITIAL_WHY : type === "Handshake" ? PROTECTED_WHY : undefined,
      );
      F.f(
        "bits",
        decrypted ? "Reserved and packet number length" : "Protected bits",
        decrypted
          ? `reserved ${(firstPlain >> 2) & 3}, packet number length ${(firstPlain & 3) + 1}`
          : "hidden by header protection",
        0,
        1,
        "Header protection (RFC 9001 §5.4) masks these bits and the packet number with a mask from the encrypted payload, so middleboxes can't read or rely on them.",
      );
      F.f(
        "version",
        "Version",
        `${vname} (0x${version.toString(16).padStart(8, "0")})`,
        1,
        4,
        version === 0x6b3343cf
          ? "QUIC v2 changes the salt and the packet type numbers on purpose, so nothing on the path can come to depend on v1's."
          : undefined,
      );
      ids(F, lh);
      const c = trackLong(ctx, flowKey, from, lh, type);
      if (lh.token !== undefined && lh.tokenAt !== undefined) {
        const tl = pkt.varint(lh.tokenAt);
        F.f("tokenlen", "Token length", `${lh.token.length}`, lh.tokenAt, tl.size);
        if (lh.token.length) {
          F.f(
            "token",
            "Token",
            hex(lh.token),
            lh.tokenAt + tl.size,
            lh.token.length,
            "Echoes a Retry or NEW_TOKEN from the server: proof the client owns its address, which lifts the 3× amplification limit at once.",
          );
        }
      }
      if (type === "Retry") {
        F.f(
          "token",
          "Retry token",
          `${pkt.length - (lh.scidAt + lh.scid.length) - 16} bytes`,
          lh.scidAt + lh.scid.length,
          pkt.length - (lh.scidAt + lh.scid.length) - 16,
          "The server asks the client to prove its address before it commits any state: one extra round trip, used under attack.",
        );
        F.f("tag", "Retry integrity tag", hex(pkt.bytes(pkt.length - 16, 16)), pkt.length - 16, 16);
        infos.push("Retry");
        return;
      }
      if (
        lh.lengthAt === undefined ||
        lh.pnAt === undefined ||
        lh.end === undefined ||
        lh.length === undefined
      )
        return;
      end = at + Math.min(lh.end, pkt.length);
      size(Math.min(lh.end, pkt.length));
      h.extent = Math.min(lh.end, pkt.length);
      F.f(
        "length",
        "Length",
        `${lh.length}`,
        lh.lengthAt,
        pkt.varint(lh.lengthAt).size,
        "Packet number plus payload. It is what lets several packets share a datagram: an Initial and a Handshake often travel together.",
      );
      const label = `${type}, DCID=${hex(lh.dcid) || "(empty)"}${lh.scid.length ? `, SCID=${hex(lh.scid)}` : ""}`;
      if (decrypted) {
        F.f(
          "pn",
          "Packet number",
          `${decrypted.pn}`,
          lh.pnAt,
          decrypted.pnLength,
          "Revealed by removing header protection with the Initial hp key. Each packet number space (Initial, Handshake, application) counts from 0.",
        );
        const body = pkt
          .sub(decrypted.payloadAt, decrypted.plaintext.length)
          .remap(decrypted.plaintext);
        const frames = framesOf(
          ctx,
          F.f(
            "frames",
            "Frames",
            "decrypted",
            decrypted.payloadAt,
            decrypted.plaintext.length,
            INITIAL_WHY,
          ),
          body,
          c,
          from,
        );
        F.f(
          "tag",
          "AEAD tag",
          hex(pkt.bytes(decrypted.payloadAt + decrypted.plaintext.length, 16)),
          decrypted.payloadAt + decrypted.plaintext.length,
          16,
          "AES-128-GCM's authentication tag over the header and payload: it verified, so these are the connection's real Initial keys.",
        );
        const [frameAt] = s.span(at, 1);
        const plain = ctx.out.plain ?? ctx.frame.b.slice();
        plain.set(decrypted.plain, frameAt);
        ctx.out.plain = plain;
        infos.push(
          `${label}, PKN: ${decrypted.pn}, ${frames.names.join(", ")}${frames.tls.length ? ` · ${frames.tls.join(", ")}` : ""}`,
        );
        return;
      }
      const n = Math.min(lh.end, pkt.length) - lh.pnAt;
      const why =
        type === "Initial"
          ? `Could not be decrypted: ${typeof opened === "string" ? opened : "no Initial keys for this connection"}`
          : PROTECTED_WHY;
      F.as(type === "Initial" ? "transport" : "crypt").f(
        "payload",
        "Protected payload",
        `${n.toLocaleString("en")} bytes (packet number and frames)`,
        lh.pnAt,
        n,
        why,
      );
      infos.push(label);
    },
  );
  return end;
}

function ids(F: Fields, lh: ReturnType<typeof parseLong>) {
  F.f("dcil", "DCID length", `${lh.dcid.length}`, lh.dcidAt - 1, 1);
  F.f(
    "dcid",
    "Destination Connection ID",
    hex(lh.dcid) || "(empty)",
    lh.dcidAt,
    lh.dcid.length,
    "Routes the packet to its connection, not its address: a phone changing networks keeps the connection. The client's first one is random and is what the Initial keys come from.",
  );
  F.f("scil", "SCID length", `${lh.scid.length}`, lh.scidAt - 1, 1);
  F.f(
    "scid",
    "Source Connection ID",
    hex(lh.scid) || "(empty)",
    lh.scidAt,
    lh.scid.length,
    "How this side wants to be addressed: the peer puts it in the DCID of everything it sends back.",
  );
}

/** Notes who the client is and the connection IDs each side chose, for reading short headers later. */
function trackLong(
  ctx: Ctx,
  flowKey: string,
  from: string,
  lh: ReturnType<typeof parseLong>,
  type: string,
): QuicConn {
  let c = conn(ctx, flowKey);
  if (!c) {
    c = { client: from, originalDcid: lh.dcid, cidLen: {}, crypto: {}, handshakeDone: {} };
    ctx.session.quic.set(flowKey, c);
  }
  if (type !== "Retry") c.cidLen[from] = lh.scid.length;
  return c;
}

function short(
  ctx: Ctx,
  s: Src,
  at: number,
  from: string,
  flowKey: string,
  infos: string[],
): number {
  const pkt = s.sub(at, s.length - at);
  const c = conn(ctx, flowKey);
  // The DCID is the receiver's choice: its length is what the receiver used as SCID. Unknown without the handshake.
  const receiver = c ? Object.keys(c.cidLen).find((k) => k !== from) : undefined;
  const known = receiver !== undefined && c ? c.cidLen[receiver] : undefined;
  const dcidLen = known ?? 8;
  header(
    ctx,
    {
      proto: "quic",
      short: "QUIC",
      name: "QUIC",
      layer: "transport",
      s: pkt,
      i: 0,
      n: 1 + dcidLen,
    },
    (F, _size, h) => {
      const first = pkt.u8(0);
      const dcid = pkt.bytes(1, dcidLen);
      h.value = "1-RTT, short header";
      F.f(
        "form",
        "Header form",
        "Short header (0)",
        0,
        1,
        "After the handshake: no version, no source ID, no length, just enough to route it. Always the last packet in a datagram.",
      );
      F.f("fixed", "Fixed bit", `${(first >> 6) & 1}`, 0, 1);
      F.f("spin", "Spin bit", `${(first >> 5) & 1}`, 0, 1, SPIN_WHY);
      F.f(
        "bits",
        "Protected bits",
        "reserved, key phase, packet number length: hidden",
        0,
        1,
        "Header protection masks the key phase bit too, so an observer can't even see when the keys change.",
      );
      F.f(
        "dcid",
        "Destination Connection ID",
        hex(dcid),
        1,
        dcidLen,
        known === undefined
          ? "Its length isn't in a short header: without the handshake in the capture, 8 bytes is a guess."
          : "Chosen by the receiver during the handshake. Endpoints rotate through several, so a path observer can't link a connection across a network change.",
      );
      F.as("crypt").f(
        "payload",
        "Protected payload",
        `${(pkt.length - 1 - dcidLen).toLocaleString("en")} bytes`,
        1 + dcidLen,
        pkt.length - 1 - dcidLen,
        `${PROTECTED_WHY} Inside: HTTP/3 frames on QUIC streams, ACKs, flow control. Not even which stream, nor whether it is a request, shows.`,
      );
      infos.push(`Protected Payload, DCID=${hex(dcid)}`);
    },
  );
  return s.length;
}

/** The frames in a decrypted Initial; returns their names, and the TLS messages in CRYPTO, for the Info line. */
function framesOf(
  ctx: Ctx,
  holder: Field,
  body: Src,
  c: QuicConn,
  from: string,
): { names: string[]; tls: string[] } {
  const names: string[] = [];
  const tls: string[] = [];
  const children: Field[] = [];
  holder.children = children;
  // The frames' fields read the plaintext, which sits where the ciphertext was.
  const G = new Fields(body, "transport", holder.id, children);
  try {
    let i = 0;
    while (i < body.length) {
      const type = body.u8(i);
      if (type === 0) {
        let j = i;
        while (j < body.length && body.b[j] === 0) j++;
        G.f(`pad${i}`, "PADDING", `${(j - i).toLocaleString("en")} bytes`, i, j - i, PADDING_WHY);
        if (names.at(-1) !== "PADDING") names.push("PADDING");
        i = j;
      } else if (type === 1) {
        G.f(
          `ping${i}`,
          "PING",
          "",
          i,
          1,
          "Elicits an ACK: keeps a connection, or a NAT's mapping for it, alive.",
        );
        names.push("PING");
        i += 1;
      } else if (type === 2 || type === 3) {
        const start = i;
        let k = i + 1;
        const largest = body.varint(k);
        k += largest.size;
        const delay = body.varint(k);
        k += delay.size;
        const count = body.varint(k);
        k += count.size;
        const firstRange = body.varint(k);
        k += firstRange.size;
        for (let r = 0; r < count.value; r++) {
          k += body.varint(k).size;
          k += body.varint(k).size;
        }
        if (type === 3) for (let e = 0; e < 3; e++) k += body.varint(k).size;
        G.group(
          `ack${start}`,
          "ACK",
          `largest ${largest.value}, ranges ${count.value + 1}`,
          start,
          k - start,
          ACK_WHY,
          (A) => {
            A.f("largest", "Largest acknowledged", `${largest.value}`, start + 1, largest.size);
            A.f(
              "delay",
              "ACK delay",
              `${delay.value} (scaled by 2^ack_delay_exponent µs)`,
              start + 1 + largest.size,
              delay.size,
              "How long the receiver held the ACK: the sender subtracts it, so the RTT sample excludes the peer's own delay.",
            );
            A.f(
              "first",
              "First ACK range",
              `${firstRange.value}`,
              k - firstRange.size,
              firstRange.size,
            );
          },
        );
        names.push("ACK");
        i = k;
      } else if (type === 6) {
        const start = i;
        const off = body.varint(i + 1);
        const len = body.varint(i + 1 + off.size);
        const dataAt = i + 1 + off.size + len.size;
        body.need(dataAt, len.value);
        const summary: HelloSummary = { info: [] };
        G.group(
          `crypto${start}`,
          "CRYPTO",
          `offset ${off.value}, ${len.value} bytes`,
          start,
          dataAt + len.value - start,
          "TLS handshake bytes, without TLS records: QUIC is the record layer. Each packet number space has its own CRYPTO stream.",
          (C) => {
            C.f(
              "offset",
              "Offset",
              `${off.value}`,
              start + 1,
              off.size,
              "Where these bytes sit in the CRYPTO stream: a ClientHello too big for one packet continues at a higher offset in the next.",
            );
            C.f("len", "Length", `${len.value}`, start + 1 + off.size, len.size);
            cryptoData(ctx, C.as("app"), body, dataAt, len.value, off.value, c, from, summary);
          },
        );
        names.push("CRYPTO");
        tls.push(...summary.info);
        i = dataAt + len.value;
      } else if (type === 0x1c || type === 0x1d) {
        const code = body.varint(i + 1);
        G.f(
          `close${i}`,
          "CONNECTION_CLOSE",
          `error ${code.value}`,
          i,
          body.length - i,
          "Ends the connection at once, with an error code; in an Initial it is sent before keys for anything else exist.",
        );
        names.push("CONNECTION_CLOSE");
        break;
      } else {
        G.f(
          `frame${i}`,
          `Frame type 0x${type.toString(16)}`,
          "not allowed in an Initial packet",
          i,
          body.length - i,
        );
        names.push(`0x${type.toString(16)}`);
        break;
      }
    }
  } catch (e) {
    if (!(e instanceof Truncated)) throw e;
    holder.warn = true;
    children.push({
      id: `${holder.id}.cut`,
      name: "Cut short",
      value: "A frame runs past the payload",
      offset: 0,
      length: 0,
      layer: "transport",
      warn: true,
    });
  }
  return { names, tls };
}

/**
 * CRYPTO data at stream offset `off`: the TLS handshake messages it holds. A ClientHello bigger than one packet
 * (any with a post-quantum key share) arrives in pieces: once the pieces from offset 0 are all here, it is read
 * whole, with the bytes from this packet highlighted and those from earlier ones noted.
 */
function cryptoData(
  ctx: Ctx,
  C: Fields,
  body: Src,
  at: number,
  len: number,
  off: number,
  c: QuicConn,
  from: string,
  summary: HelloSummary,
) {
  const pieces = (c.crypto[from] ??= new Map());
  pieces.set(off, { data: body.bytes(at, len).slice(), packet: ctx.n });
  const here = body.sub(at, len);
  if (off === 0) {
    const need = len >= 4 ? 4 + here.u24(1) : Infinity;
    if (need <= len) {
      handshakes(C, here, 0, len, summary);
      return;
    }
  }
  // Put together what is contiguous from offset 0.
  const parts: Uint8Array[] = [];
  const packets = new Set<number>();
  let total = 0;
  for (let piece = pieces.get(0); piece; piece = pieces.get(total)) {
    parts.push(piece.data);
    packets.add(piece.packet);
    total += piece.data.length;
  }
  const whole = new Uint8Array(total);
  let k = 0;
  for (const part of parts) {
    whole.set(part, k);
    k += part.length;
  }
  const need =
    total >= 4
      ? 4 + (((whole[1] ?? 0) << 16) | ((whole[2] ?? 0) << 8) | (whole[3] ?? 0))
      : Infinity;
  const complete = total >= need && pieces.has(off) && off + len <= total && off + len >= need;
  if (complete) {
    // Bytes from this packet map to their place in it; bytes from earlier packets have none here.
    const [base] = here.span(0, 1);
    const mapped = new Src(whole, (i) => (i >= off && i < off + len ? base + (i - off) : -1));
    C.note(
      "reassembled",
      "Reassembled",
      `from CRYPTO frames in packets ${[...packets].sort((a, b) => a - b).join(", ")}`,
      "The handshake message spans several Initial packets: it is read whole here. Fields from earlier packets have no bytes highlighted in this one.",
    );
    try {
      handshakes(C, mapped, 0, need, summary);
    } catch (e) {
      if (!(e instanceof Truncated)) throw e;
    }
    return;
  }
  if (off === 0) {
    handshakes(C, here, 0, len, summary);
    return;
  }
  C.f(
    "data",
    "Handshake data",
    `${len.toLocaleString("en")} bytes, continuing the message from offset ${off}`,
    at,
    len,
    "The middle or end of a handshake message begun in an earlier packet.",
  );
}
