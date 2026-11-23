/**
 * The transport layer: UDP and TCP with their checksums checked, TCP's flags and options, sequence numbers relative
 * to each side's first, and Wireshark's analysis flags, per stream. Each hands its payload to the application
 * dissector its ports or its first bytes point to.
 */
import { hex16, onesSum, pseudoHeader, type Src } from "../bytes";
import { PORTS } from "../names";
import { TCP, type SegmentResult } from "../tcp-analysis";
import type { Field } from "../types";
import { data, header, top, type Ctx, type Fields } from "./core";
import { dissectDhcp } from "./dhcp";
import { dissectDns } from "./dns";
import { dissectHttp, looksLikeHttp } from "./http";
import { dissectQuic } from "./quic";
import { dissectTls, looksLikeTls } from "./tls";

const OFFLOAD =
  " Captured on the sending host, outgoing segments often show a wrong value: with checksum offload the NIC fills it in after the capture point.";

const portName = (p: number) => (PORTS[p] ? `${p} (${PORTS[p]})` : `${p}`);

function portWhy(port: number, other: number): string | undefined {
  if (port < 1024)
    return "A well-known port: the service's address on its host. The client side's port is the one that varies.";
  if (other < 1024 || port >= 32768) {
    return "An ephemeral port the OS picked for this socket (Linux 32768–60999, macOS and Windows 49152–65535). With NAT, the router may rewrite it.";
  }
  return undefined;
}

function checkField(F: Fields, i: number, stored: number, ok: boolean, why: string) {
  const f = F.f(
    "csum",
    "Checksum",
    `${hex16(stored)} ${ok ? "(correct)" : "(incorrect)"}`,
    i,
    2,
    `${why}${ok ? "" : OFFLOAD}`,
  );
  if (!ok) f.warn = true;
}

export function dissectUdp(ctx: Ctx, s: Src, src: Uint8Array, dst: Uint8Array) {
  let sport = 0;
  let dport = 0;
  let body: Src | undefined;
  header(
    ctx,
    {
      proto: "udp",
      short: "UDP",
      name: "User Datagram Protocol",
      layer: "transport",
      s,
      i: 0,
      n: 8,
    },
    (F, _size, h) => {
      sport = s.u16(0);
      dport = s.u16(2);
      const len = s.u16(4);
      const stored = s.u16(6);
      h.value = `${sport} → ${dport}`;
      h.why =
        "Ports and a length, nothing more: no connection, no ordering, no retransmission. DNS, DHCP and QUIC build what they need on top.";
      F.f("sport", "Source port", portName(sport), 0, 2, portWhy(sport, dport));
      F.f("dport", "Destination port", portName(dport), 2, 2, portWhy(dport, sport));
      F.f("len", "Length", `${len}`, 4, 2, "Header plus payload, in bytes.");
      if (stored === 0 && src.length === 4) {
        F.f(
          "csum",
          "Checksum",
          "0x0000 (none)",
          6,
          2,
          "Zero means the sender didn't compute one, which IPv4 allows; IPv6 requires it.",
        );
      } else {
        const ok =
          onesSum([pseudoHeader(src, dst, 17, len), s.bytes(0, Math.min(len, s.length))]) ===
          0xffff;
        checkField(
          F,
          6,
          stored,
          ok,
          "Covers a pseudo-header with both IP addresses, the UDP header and the payload.",
        );
      }
      body = s.sub(8, Math.max(0, Math.min(len, s.length) - 8));
    },
  );
  const flow = ctx.out.flow;
  if (flow) Object.assign(flow, { transport: "udp", sport, dport });
  const a = `${ctx.out.src}|${sport}`;
  const b = `${ctx.out.dst}|${dport}`;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  let index = ctx.session.udp.get(key);
  if (index === undefined) {
    index = ctx.session.udp.size;
    ctx.session.udp.set(key, index);
  }
  ctx.out.stream = { transport: "udp", index };
  top(ctx, "UDP", `${sport} → ${dport} Len=${body?.length ?? 0}`);
  if (!body || body.length === 0) return;
  const has = (p: number) => sport === p || dport === p;
  if (has(53) || has(5353) || has(5355))
    return dissectDns(ctx, body, has(5353) ? "mDNS" : has(5355) ? "LLMNR" : "DNS");
  if (has(67) || has(68)) return dissectDhcp(ctx, body);
  const first = body.b[0] ?? 0;
  if (has(443) && (first & 0x40) !== 0)
    return dissectQuic(ctx, body, `${ctx.out.src}|${sport}`, key);
  if (dport >= 33434 && dport <= 33534) {
    top(ctx, "UDP", `${sport} → ${dport} Len=${body.length} (traceroute probe)`);
    return data(
      ctx,
      body,
      0,
      "app",
      "traceroute's probe payload: nothing reads it. The destination port starts at 33434 and climbs with each probe, so the reply's quote says which probe it was.",
    );
  }
  data(ctx, body, 0, "app");
}

interface TcpOptions {
  text: string[];
  wsShift?: number;
  /** Raw SACK blocks, made relative once the stream's base is known. */
  sack?: [number, number][];
  sackField?: Field;
}

function options(F: Fields, s: Src, from: number, to: number): TcpOptions {
  const out: TcpOptions = { text: [] };
  if (to <= from) return out;
  F.group("options", "Options", `${to - from} bytes`, from, to - from, undefined, (G) => {
    let at = from;
    while (at < to) {
      const kind = s.u8(at);
      if (kind === 0) {
        G.f(`eol${at}`, "End of option list", "", at, 1);
        break;
      }
      if (kind === 1) {
        G.f(
          `nop${at}`,
          "No-operation (NOP)",
          "",
          at,
          1,
          "Padding, so the next option starts on a 4-byte boundary.",
        );
        at += 1;
        continue;
      }
      const len = s.u8(at + 1);
      if (len < 2) break;
      if (kind === 2) {
        const mss = s.u16(at + 2);
        out.text.push(`MSS=${mss}`);
        G.f(
          "mss",
          "Maximum segment size",
          `${mss} bytes`,
          at,
          len,
          "The largest segment this side accepts: its MTU minus 40 bytes of IP and TCP headers, so 1460 on Ethernet, 1452 on PPPoE. VPNs and routers clamp it to dodge fragmentation.",
        );
      } else if (kind === 3) {
        out.wsShift = s.u8(at + 2);
        out.text.push(`WS=${2 ** out.wsShift}`);
        G.f(
          "ws",
          "Window scale",
          `${out.wsShift} (multiply by ${2 ** out.wsShift})`,
          at,
          len,
          "Shift the 16-bit window left by this many bits (RFC 7323), so windows can pass 64 KB. Only on SYNs, and only used if both sides send it.",
        );
      } else if (kind === 4) {
        out.text.push("SACK_PERM");
        G.f(
          "sackperm",
          "SACK permitted",
          "",
          at,
          len,
          "This side understands selective acknowledgements: after a loss the receiver can say which blocks arrived, so only the gap is resent.",
        );
      } else if (kind === 5) {
        out.sack = [];
        for (let o = at + 2; o + 8 <= at + len; o += 8) out.sack.push([s.u32(o), s.u32(o + 4)]);
        out.sackField = G.f(
          "sack",
          "SACK",
          "",
          at,
          len,
          "Byte ranges received beyond the cumulative ACK, relative to the peer's first sequence number: the sender resends only what falls between them.",
        );
      } else if (kind === 8) {
        const val = s.u32(at + 2);
        const ecr = s.u32(at + 6);
        out.text.push(`TSval=${val} TSecr=${ecr}`);
        G.f(
          "ts",
          "Timestamps",
          `TSval ${val}, TSecr ${ecr}`,
          at,
          len,
          "Each side echoes the other's clock (RFC 7323): RTT measured on every ACK, and PAWS rejects stale segments once sequence numbers wrap at high speed. TSval's rate leaks the sender's uptime clock.",
        );
      } else if (kind === 30) {
        G.f(
          `mptcp${at}`,
          "Multipath TCP",
          `${len} bytes`,
          at,
          len,
          "MPTCP (RFC 8684): one connection over several paths, Wi-Fi and cellular at once. iOS uses it for Siri and Maps.",
        );
      } else if (kind === 34) {
        G.f(
          `tfo${at}`,
          "TCP Fast Open cookie",
          `${len - 2} bytes`,
          at,
          len,
          "TFO (RFC 7413): data in the SYN, saving a round trip on repeat visits. Middleboxes broke it enough that browsers turned it off.",
        );
      } else {
        G.f(`opt${at}`, `Option ${kind}`, `${len} bytes`, at, len);
      }
      at += len;
    }
  });
  return out;
}

const FLAG_NAMES: [number, string, string][] = [
  [TCP.CWR, "CWR", "Congestion window reduced: the sender answered an ECN echo by slowing down."],
  [
    TCP.ECE,
    "ECE",
    "ECN echo: on a SYN, this side speaks ECN; later, a router marked congestion and the receiver says so.",
  ],
  [TCP.URG, "URG", "Urgent pointer valid. Almost unused; telnet's interrupt was the use case."],
  [
    TCP.ACK,
    "ACK",
    "The acknowledgement number is valid: set on every segment after the first SYN.",
  ],
  [
    TCP.PSH,
    "PSH",
    "Deliver to the application now. Senders set it on a write's last segment; receivers mostly ignore it.",
  ],
  [
    TCP.RST,
    "RST",
    "Abort: no such connection, or the application closed with unread data. Firewalls and censors inject these to kill connections.",
  ],
  [
    TCP.SYN,
    "SYN",
    "Opens a connection and carries this side's initial sequence number, random per connection (RFC 6528) so nobody off-path can guess it.",
  ],
  [
    TCP.FIN,
    "FIN",
    "This side has nothing more to send. The other may keep sending: each direction closes on its own (a half-close).",
  ],
];

export function dissectTcp(ctx: Ctx, s: Src, src: Uint8Array, dst: Uint8Array) {
  let res: SegmentResult | undefined;
  let body: Src | undefined;
  let sport = 0;
  let dport = 0;
  let flagText = "";
  let opts: TcpOptions = { text: [] };
  header(
    ctx,
    {
      proto: "tcp",
      short: "TCP",
      name: "Transmission Control Protocol",
      layer: "transport",
      s,
      i: 0,
      n: 20,
    },
    (F, size, h) => {
      sport = s.u16(0);
      dport = s.u16(2);
      const seq = s.u32(4);
      const ack = s.u32(8);
      const off = (s.u8(12) >> 4) * 4;
      const flags = s.u16(12) & 0x01ff;
      const win = s.u16(14);
      size(off);
      // Wireshark's order in the Info line: lowest bit first, so [SYN, ACK] and [FIN, ACK].
      const names = FLAG_NAMES.filter(([bit]) => flags & bit)
        .map(([, name]) => name)
        .reverse();
      flagText = names.join(", ");
      F.f("sport", "Source port", portName(sport), 0, 2, portWhy(sport, dport));
      F.f("dport", "Destination port", portName(dport), 2, 2, portWhy(dport, sport));
      const seqField = F.f(
        "seq",
        "Sequence number",
        "",
        4,
        4,
        "Relative, as Wireshark shows it: the raw number minus this side's initial one, which is random. It counts bytes sent; SYN and FIN each use one.",
      );
      const ackField = F.f(
        "ack",
        "Acknowledgement number",
        "",
        8,
        4,
        "The next byte this side expects: everything before it arrived. Cumulative, so one missing segment holds it back until a retransmission or SACK fills the hole.",
      );
      F.f(
        "off",
        "Header length",
        `${off} bytes (${off / 4} words)`,
        12,
        1,
        off > 20 ? `20 fixed bytes and ${off - 20} of options.` : undefined,
      );
      F.group(
        "flags",
        "Flags",
        `${hex16(flags)} (${flagText || "none"})`,
        12,
        2,
        undefined,
        (G) => {
          for (const [bit, name, why] of FLAG_NAMES) {
            G.f(
              name.toLowerCase(),
              name,
              flags & bit ? "Set" : "Not set",
              13,
              1,
              flags & bit ? why : undefined,
            );
          }
        },
      );
      const winField = F.f(
        "win",
        "Window",
        `${win}`,
        14,
        2,
        "Receive window: how much more the other side may send before it must wait for an ACK. Throughput can't pass window ÷ RTT: 64 KB over 25 ms caps at 21 Mbit/s, which is why window scaling exists.",
      );
      const len = s.length - off;
      const stored = s.u16(16);
      const ok = onesSum([pseudoHeader(src, dst, 6, s.length), s.bytes(0, s.length)]) === 0xffff;
      checkField(
        F,
        16,
        stored,
        ok,
        "Covers a pseudo-header with both IP addresses, the header and the payload.",
      );
      F.f("urg", "Urgent pointer", `${s.u16(18)}`, 18, 2);
      opts = options(F, s, 20, off);
      res = ctx.session.tcp.segment({
        n: ctx.n,
        src: ctx.out.src,
        dst: ctx.out.dst,
        sport,
        dport,
        seq,
        ack,
        flags,
        window: win,
        len,
        wsShift: opts.wsShift,
      });
      seqField.value = `${res.relSeq} (raw ${seq})`;
      if (opts.sack && opts.sackField) {
        const base = res.peerBase ?? 0;
        const rel = opts.sack.map(([l, r]) => [(l - base) >>> 0, (r - base) >>> 0] as const);
        opts.sackField.value = rel.map(([l, r]) => `${l}–${r}`).join(", ");
        opts.text.push(...rel.map(([l, r]) => `SLE=${l} SRE=${r}`));
      }
      ackField.value = flags & TCP.ACK ? `${res.relAck} (raw ${ack})` : "0 (no ACK flag)";
      if (res.scale !== undefined && !(flags & TCP.SYN)) {
        winField.value = `${win} × ${res.scale} = ${res.window.toLocaleString("en")} bytes`;
      } else if (res.scale === undefined && !(flags & TCP.SYN)) {
        winField.value = `${win} (scaling unknown: the handshake was not captured)`;
      }
      h.value = `${sport} → ${dport} [${flagText}] Seq=${res.relSeq}${flags & TCP.ACK ? ` Ack=${res.relAck}` : ""} Len=${len}`;
      F.group("analysis", "SEQ/ACK analysis", `stream ${res.stream}`, 0, 0, undefined, (G) => {
        if (!res) return;
        G.note(
          "stream",
          "Stream index",
          `${res.stream}`,
          "Numbered in order of first appearance, as Wireshark's tcp.stream: filter on it to see one connection.",
        );
        G.note("len", "Segment length", `${len} bytes`);
        if (len > 0) G.note("next", "Next sequence number", `${res.nextRelSeq}`);
        for (const a of res.analysis) {
          const f = G.note(a.kind, a.label, "", a.why);
          f.warn = true;
        }
      });
      body = s.sub(off, Math.max(0, len));
    },
  );
  if (!res) return;
  const flow = ctx.out.flow;
  if (flow) Object.assign(flow, { transport: "tcp", sport, dport });
  ctx.out.stream = { transport: "tcp", index: res.stream };
  ctx.out.analysis = res.analysis;
  const prefix = res.analysis.map((a) => `[${a.label}] `).join("");
  const synOpts = opts.text.length ? ` ${opts.text.join(" ")}` : "";
  top(
    ctx,
    "TCP",
    `${prefix}${sport} → ${dport} [${flagText}] Seq=${res.relSeq}${flagText.includes("ACK") ? ` Ack=${res.relAck}` : ""} Win=${res.window} Len=${body?.length ?? 0}${synOpts}`,
  );
  if (!body || body.length === 0) return;
  if (!res.inOrder) {
    data(
      ctx,
      body,
      0,
      "app",
      res.analysis.some((a) => a.kind === "lost-segment")
        ? "Follows a gap in the stream, so where an application message starts can't be known: not dissected."
        : "Bytes already sent once: not dissected again.",
    );
    return;
  }
  const dirKey = `${res.stream}:${res.dir}`;
  const has = (p: number) => sport === p || dport === p;
  if (ctx.session.tls.has(dirKey) || has(443) || has(853) || looksLikeTls(body)) {
    return dissectTls(ctx, body, dirKey, prefix);
  }
  if (has(80) || has(8080) || looksLikeHttp(body) || ctx.session.httpBody.has(dirKey)) {
    return dissectHttp(ctx, body, dirKey, prefix);
  }
  data(ctx, body, 0, "app");
}
