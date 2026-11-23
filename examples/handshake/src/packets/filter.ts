/**
 * A small display filter, in Wireshark's words where it has them: protocol names (`tcp`, `dns`, `quic`), fields
 * compared with == and != (`ip.addr==192.168.1.1`, `tcp.port==443`, `tcp.stream==0`), tcpdump's `port 443` and
 * `host 10.0.0.1`, the TCP analysis flags (`tcp.analysis.flags`, `tcp.analysis.retransmission`), combined with
 * `&&`/`and`, `||`/`or`, `!`/`not` and parentheses.
 */
import type { Packet, ProtoId } from "./types";

export type Filter = { ok: true; test: (p: Packet) => boolean } | { ok: false; error: string };

const PROTOS: Record<string, ProtoId[]> = {
  frame: ["frame"],
  eth: ["eth"],
  vlan: ["vlan"],
  sll: ["sll"],
  arp: ["arp"],
  ip: ["ip"],
  ipv6: ["ipv6"],
  icmp: ["icmp"],
  icmpv6: ["icmpv6"],
  udp: ["udp"],
  tcp: ["tcp"],
  dns: ["dns"],
  mdns: ["dns"],
  dhcp: ["dhcp"],
  bootp: ["dhcp"],
  http: ["http"],
  tls: ["tls"],
  ssl: ["tls"],
  quic: ["quic"],
  data: ["data"],
};

const ANALYSIS: Record<string, (p: Packet) => boolean> = {
  "tcp.analysis.flags": (p) => p.analysis.length > 0,
  "tcp.analysis.retransmission": (p) =>
    p.analysis.some((a) => a.kind === "retransmission" || a.kind === "fast-retransmission"),
  "tcp.analysis.fast_retransmission": (p) =>
    p.analysis.some((a) => a.kind === "fast-retransmission"),
  "tcp.analysis.duplicate_ack": (p) => p.analysis.some((a) => a.kind === "dup-ack"),
  "tcp.analysis.window_update": (p) => p.analysis.some((a) => a.kind === "window-update"),
  "tcp.analysis.zero_window": (p) => p.analysis.some((a) => a.kind === "zero-window"),
  "tcp.analysis.lost_segment": (p) => p.analysis.some((a) => a.kind === "lost-segment"),
};

type Getter = (p: Packet) => (string | number | undefined)[];

const FIELDS: Record<string, Getter> = {
  "ip.addr": (p) => [p.flow?.src, p.flow?.dst],
  "ipv6.addr": (p) => [p.flow?.src, p.flow?.dst],
  "ip.src": (p) => [p.flow?.src],
  "ip.dst": (p) => [p.flow?.dst],
  "ipv6.src": (p) => [p.flow?.src],
  "ipv6.dst": (p) => [p.flow?.dst],
  "eth.addr": (p) => [p.src, p.dst],
  "tcp.port": (p) => (p.flow?.transport === "tcp" ? [p.flow.sport, p.flow.dport] : []),
  "udp.port": (p) => (p.flow?.transport === "udp" ? [p.flow.sport, p.flow.dport] : []),
  "tcp.srcport": (p) => (p.flow?.transport === "tcp" ? [p.flow.sport] : []),
  "tcp.dstport": (p) => (p.flow?.transport === "tcp" ? [p.flow.dport] : []),
  "udp.srcport": (p) => (p.flow?.transport === "udp" ? [p.flow.sport] : []),
  "udp.dstport": (p) => (p.flow?.transport === "udp" ? [p.flow.dport] : []),
  "tcp.stream": (p) => (p.stream?.transport === "tcp" ? [p.stream.index] : []),
  "udp.stream": (p) => (p.stream?.transport === "udp" ? [p.stream.index] : []),
  "frame.number": (p) => [p.n],
  "frame.len": (p) => [p.wireLength],
};

/** Tokens: words (names, addresses, numbers), comparison operators, logic operators and parentheses. */
function tokens(text: string): string[] | string {
  const out: string[] = [];
  const re = /\s*(==|!=|&&|\|\||!|\(|\)|[A-Za-z0-9_.:/-]+)/y;
  let at = 0;
  while (at < text.length) {
    if (/^\s+$/.test(text.slice(at))) break;
    re.lastIndex = at;
    const m = re.exec(text);
    if (!m?.[1]) return `Unexpected "${text.slice(at).trim().slice(0, 12)}"`;
    out.push(m[1]);
    at = re.lastIndex;
  }
  return out;
}

const norm = (v: string | number | undefined) => (typeof v === "string" ? v.toLowerCase() : v);

export function parseFilter(text: string): Filter {
  const toks = tokens(text.trim());
  if (typeof toks === "string") return { ok: false, error: toks };
  if (toks.length === 0) return { ok: true, test: () => true };
  let i = 0;
  const peek = () => toks[i];
  const fail = (error: string): never => {
    throw new SyntaxError(error);
  };

  const atom = (): ((p: Packet) => boolean) => {
    const t = toks[i++];
    if (t === undefined) return fail("The filter ends too early");
    if (t === "(") {
      const inner = or();
      if (toks[i++] !== ")") fail("A ( is never closed");
      return inner;
    }
    const word = t.toLowerCase();
    if (word === "port" || word === "host") {
      const v = toks[i++];
      if (!v)
        return fail(
          `"${word}" needs a value: ${word === "port" ? "port 443" : "host 192.168.1.1"}`,
        );
      if (word === "port") {
        const n = Number(v);
        if (!Number.isInteger(n)) fail(`"${v}" is not a port number`);
        return (p) => p.flow?.sport === n || p.flow?.dport === n;
      }
      const host = v.toLowerCase();
      return (p) =>
        norm(p.flow?.src) === host ||
        norm(p.flow?.dst) === host ||
        p.src === host ||
        p.dst === host;
    }
    const analysis = ANALYSIS[word];
    if (analysis) return analysis;
    if (peek() === "==" || peek() === "!=") {
      const op = toks[i++];
      const v = toks[i++];
      const get = FIELDS[word];
      if (!get) return fail(`Unknown field "${t}". Try ip.addr, tcp.port, udp.port, tcp.stream`);
      if (v === undefined) return fail(`${t} ${op} needs a value`);
      const want = /^\d+$/.test(v) ? Number(v) : v.toLowerCase();
      // As in Wireshark, ip.addr != x is "no address equals x", not "some address differs".
      return op === "=="
        ? (p) => get(p).some((x) => norm(x) === want)
        : (p) => !get(p).some((x) => norm(x) === want);
    }
    const protos = PROTOS[word];
    if (protos)
      return (p) =>
        protos.some((x) => p.protos.has(x)) && (word !== "mdns" || p.protocol === "mDNS");
    if (FIELDS[word]) return fail(`${t} needs a comparison: ${t}==…`);
    return fail(`Unknown protocol or field "${t}"`);
  };

  const not = (): ((p: Packet) => boolean) => {
    const t = peek()?.toLowerCase();
    if (t === "!" || t === "not") {
      i++;
      const inner = not();
      return (p) => !inner(p);
    }
    return atom();
  };

  const and = () => {
    let left = not();
    while (peek()?.toLowerCase() === "&&" || peek()?.toLowerCase() === "and") {
      i++;
      const l = left;
      const r = not();
      left = (p) => l(p) && r(p);
    }
    return left;
  };

  function or(): (p: Packet) => boolean {
    let left = and();
    while (peek()?.toLowerCase() === "||" || peek()?.toLowerCase() === "or") {
      i++;
      const l = left;
      const r = and();
      left = (p) => l(p) || r(p);
    }
    return left;
  }

  try {
    const test = or();
    if (i < toks.length) return { ok: false, error: `Unexpected "${toks[i]}"` };
    return { ok: true, test };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
