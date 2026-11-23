/**
 * A capture's main conversation as a sequence diagram: who sent what, when, and how many round trips the handshake
 * took before the request could leave. The main conversation is the busiest TCP stream or QUIC connection; a
 * capture without one (DNS lookups, traceroute, joining a network) shows everything to and from the capturing host.
 */
import type { Capture, Packet } from "./types";

export interface Arrow {
  n: number;
  /** From the capturing host (left) to the other side (right). */
  out: boolean;
  /** Seconds since the conversation's first packet. */
  t: number;
  label: string;
  /** Who it is from or to, when the right-hand side is "the network". */
  peer?: string;
  encrypted: boolean;
  flagged: boolean;
}

export interface Phase {
  label: string;
  from: number;
  to: number;
}

export interface LadderModel {
  left: string;
  right: string;
  arrows: Arrow[];
  /** Packets of the capture not in this conversation. */
  omitted: number;
  /** The handshake's round-trip time, measured from its first exchange (seconds). */
  rtt?: number;
  phases: Phase[];
  /** The first packet from the client that carries the application's request, and the response's first byte. */
  request?: number;
  response?: number;
  /** What the round trips add up to, in a sentence. */
  summary: string;
}

const has = (p: Packet, proto: string) => p.protos.has(proto as never);

/** The short label on an arrow: the handshake step or message, not the whole Info line. */
export function arrowLabel(p: Packet): string {
  const flagged = p.analysis.map((a) => a.label.replace(/^TCP /, "")).join(", ");
  if (flagged && !has(p, "http")) return flagged;
  if (has(p, "quic")) {
    const parts = p.headers
      .filter((h) => h.proto === "quic")
      .map((h) => h.value.split(",")[0] ?? "");
    const kinds = parts.map((x) => (x.startsWith("1-RTT") ? "1-RTT" : x)).join(" + ");
    const hello = /Client Hello|Server Hello/.exec(p.info)?.[0];
    return hello ? `${kinds} · ${hello.replace(" ", "")}` : kinds;
  }
  if (has(p, "tls")) {
    return p.info
      .replace(/\(SNI=[^)]*\)/, "")
      .replace(/Client Hello/g, "ClientHello")
      .replace(/Server Hello/g, "ServerHello")
      .replace(/Change Cipher Spec/g, "CCS")
      .replace(/Application Data/g, "Encrypted")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (has(p, "http"))
    return p.info
      .replace(/^\[[^\]]*\]\s*/, "")
      .replace(/ HTTP\/1\.1$/, "")
      .replace(/^HTTP\/1\.1 /, "");
  if (has(p, "tcp"))
    return /\[([^\]]+)\]/.exec(p.info.replace(/^(\[[^\]]*\]\s*)+/, ""))?.[1] ?? "TCP";
  if (has(p, "dns")) {
    const q = /(A|AAAA|HTTPS|MX|TXT|NS|CNAME) (\S+)/.exec(p.info);
    if (p.info.includes("response"))
      return p.info.includes("NXDOMAIN") ? "NXDOMAIN" : `${q?.[1] ?? ""} answer`;
    return `${q?.[1] ?? ""}? ${q?.[2] ?? ""}`;
  }
  if (has(p, "dhcp")) return /DHCP (\w+)/.exec(p.info)?.[1] ?? "DHCP";
  if (has(p, "arp"))
    return p.info.startsWith("Who has")
      ? `ARP who-has`
      : p.info.includes("Announcement")
        ? "ARP announce"
        : "ARP reply";
  if (has(p, "icmpv6")) return p.info.replace(/ for .*| 2001.*/, "");
  if (has(p, "icmp")) {
    if (p.info.startsWith("Time-to-live")) return "Time Exceeded";
    if (p.info.includes("Port unreachable")) return "Port Unreachable";
    return p.info.replace(/ id=.*/, "");
  }
  if (p.info.includes("traceroute")) return `Probe TTL ${ttlOf(p)}`;
  return p.protocol;
}

function ttlOf(p: Packet): string {
  const ip = p.headers.find((h) => h.proto === "ip");
  return ip?.children?.find((f) => f.id === "ip.ttl")?.value ?? "?";
}

const isEncrypted = (p: Packet) =>
  p.headers.some(
    (h) => h.children?.some((f) => f.layer === "crypt" && f.length > 0) || h.layer === "crypt",
  );

function endpoints(p: Packet) {
  return p.flow?.sport !== undefined
    ? [`${p.flow.src}|${p.flow.sport}`, `${p.flow.dst}|${p.flow.dport}`]
    : [p.src, p.dst];
}

/** The capturing host: the address in the most packets (its MAC on Ethernet, so all its identities count once). */
function captureHost(packets: Packet[]): { mac?: string; ip?: string } {
  const macs = new Map<string, number>();
  const ips = new Map<string, number>();
  for (const p of packets) {
    const eth = p.headers.find((h) => h.proto === "eth");
    if (eth) {
      const [src = "", dst = ""] = eth.value.split(" → ");
      for (const m of [src, dst])
        if (!m.startsWith("ff:ff") && !m.startsWith("33:33") && !m.startsWith("01:00:5e"))
          macs.set(m, (macs.get(m) ?? 0) + 1);
    }
    if (p.flow) for (const a of [p.flow.src, p.flow.dst]) ips.set(a, (ips.get(a) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { mac: top(macs), ip: top(ips) };
}

const ladders = new WeakMap<Capture, LadderModel>();

/** A capture's ladder, worked out once per capture and kept. */
export function ladderOf(capture: Capture): LadderModel {
  let model = ladders.get(capture);
  if (!model) {
    model = buildLadder(capture);
    ladders.set(capture, model);
  }
  return model;
}

function buildLadder(capture: Capture): LadderModel {
  const packets = capture.packets;
  // The busiest TCP stream or QUIC conversation, if it has at least a handshake's worth of packets.
  const streams = new Map<string, Packet[]>();
  for (const p of packets) {
    if (!p.stream || (p.stream.transport === "udp" && !has(p, "quic"))) continue;
    const key = `${p.stream.transport}:${p.stream.index}`;
    streams.set(key, [...(streams.get(key) ?? []), p]);
  }
  const busiest = [...streams.values()].sort((a, b) => b.length - a.length)[0];
  if (busiest && busiest.length >= 3) return conversation(capture, busiest);
  return hostView(capture);
}

function conversation(capture: Capture, ps: Packet[]): LadderModel {
  const first = ps[0];
  const [client = "", server = ""] = first ? endpoints(first) : [];
  const t0 = first?.rel ?? 0;
  const arrows: Arrow[] = ps.map((p) => ({
    n: p.n,
    out: endpoints(p)[0] === client,
    t: p.rel - t0,
    label: arrowLabel(p),
    encrypted: isEncrypted(p),
    flagged: p.analysis.length > 0,
  }));
  const phases: Phase[] = [];
  let rtt: number | undefined;
  const at = (n: number) => ps.find((p) => p.n === n);
  const byLabel = (re: RegExp, out: boolean, after = 0) =>
    arrows.find((a) => a.out === out && a.n > after && re.test(a.label));
  const syn = byLabel(/^SYN$/, true);
  const synAck = syn && byLabel(/^SYN, ACK$/, false, syn.n);
  if (syn && synAck) {
    phases.push({ label: "TCP handshake", from: syn.n, to: synAck.n });
    rtt = synAck.t - syn.t;
  }
  let handshakeEnd = synAck?.n;
  const ch = byLabel(/ClientHello/, true);
  const sh = ch && byLabel(/ServerHello/, false, ch.n);
  const quic = ps.some((p) => has(p, "quic"));
  if (ch && sh) {
    const shPacket = at(sh.n);
    const v13 = shPacket?.protocol === "TLSv1.3" || quic;
    phases.push({
      label: quic ? "QUIC + TLS 1.3 handshake" : v13 ? "TLS 1.3 handshake" : "TLS handshake",
      from: ch.n,
      to: sh.n,
    });
    rtt ??= sh.t - ch.t;
    handshakeEnd = sh.n;
    if (!v13) {
      // TLS 1.2 needs a second round trip: the client's key exchange and Finished, then the server's Finished.
      const ccs = byLabel(/CCS/, false, sh.n);
      if (ccs) {
        phases.push({ label: "TLS 1.2: key exchange and Finished", from: sh.n, to: ccs.n });
        handshakeEnd = ccs.n;
      }
    }
  }
  // The request: the client's first packet with payload once the server's handshake reply has arrived.
  const after = handshakeEnd ?? 0;
  const request = ps.find((p) => p.n > after && endpoints(p)[0] === client && carries(p))?.n;
  const response = request
    ? ps.find((p) => p.n > request && endpoints(p)[0] !== client && carries(p))?.n
    : undefined;
  const reqArrow = arrows.find((a) => a.n === request);
  const resArrow = arrows.find((a) => a.n === response);
  let summary = `${ps.length} packets between ${client.replace("|", ":")} and ${server.replace("|", ":")}.`;
  if (reqArrow && rtt) {
    const rounds = phases.length;
    summary = `The request leaves after ${rounds} round trip${rounds === 1 ? "" : "s"}${rounds ? ` (${phases.map((p) => p.label).join(", then ")})` : ""}, at ${ms(reqArrow.t)}; RTT ${ms(rtt)}.`;
    if (resArrow)
      summary += ` The server's first bytes after it arrive at ${ms(resArrow.t)}, ${(resArrow.t / rtt).toFixed(1)} RTT in.`;
  }
  return {
    left: client.replace("|", ":"),
    right: server.replace("|", ":"),
    arrows,
    omitted: capture.packets.length - ps.length,
    rtt,
    phases,
    request,
    response,
    summary,
  };
}

/**
 * Carries the application's bytes. TLS 1.3's client Finished travels with the middlebox CCS, so the record after it
 * is the request; in QUIC the request is the first short-header (1-RTT) packet.
 */
function carries(p: Packet): boolean {
  if (has(p, "quic")) return p.info.includes("Protected Payload");
  if (has(p, "tls"))
    return p.info.includes("Application Data") && !p.info.includes("Change Cipher Spec");
  return has(p, "http") || has(p, "data");
}

function hostView(capture: Capture): LadderModel {
  const host = captureHost(capture.packets);
  const ps = capture.packets.filter((p) => {
    const eth = p.headers.find((h) => h.proto === "eth")?.value;
    if (host.mac && eth) return eth.includes(host.mac) || /→ (ff:ff|33:33|01:00:5e)/.test(eth);
    return host.ip !== undefined && (p.flow?.src === host.ip || p.flow?.dst === host.ip);
  });
  const t0 = ps[0]?.rel ?? 0;
  const arrows: Arrow[] = ps.map((p) => {
    const eth = p.headers.find((h) => h.proto === "eth")?.value ?? "";
    const out = host.mac ? eth.startsWith(host.mac) : p.flow?.src === host.ip;
    return {
      n: p.n,
      out,
      t: p.rel - t0,
      label: arrowLabel(p),
      peer: out ? p.dst : p.src,
      encrypted: isEncrypted(p),
      flagged: p.analysis.length > 0,
    };
  });
  const ips = new Map<string, number>();
  for (const p of ps)
    if (p.flow) for (const a of [p.flow.src, p.flow.dst]) ips.set(a, (ips.get(a) ?? 0) + 1);
  const me = [...ips.entries()]
    .filter(([a]) => !/^(0\.0\.0\.0|255\.)/.test(a))
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    left: me ?? host.mac ?? "This host",
    right: "The network",
    arrows,
    omitted: capture.packets.length - ps.length,
    phases: [],
    summary: `${ps.length} packets to and from ${me ?? "this host"}. Each answer's distance below its question is the time it took.`,
  };
}

/** Round trips on some paths people know, for scale. */
const PATHS: [string, number][] = [
  ["4G", 0.06],
  ["a transatlantic link", 0.09],
  ["geostationary satellite", 0.6],
];

const ms = (s: number) => `${Math.round(s * 1000)} ms`;
const trips = (n: number) => `${n} round trip${n === 1 ? "" : "s"}`;

/** What two ladders say side by side: how many round trips each takes before its request, and what that costs. */
export function compareLadders(
  a: { title: string; model: LadderModel },
  b: { title: string; model: LadderModel },
): string | undefined {
  const ra = a.model.request !== undefined ? a.model.phases.length : undefined;
  const rb = b.model.request !== undefined ? b.model.phases.length : undefined;
  if (ra === undefined || rb === undefined) return undefined;
  if (ra === rb) return `Both send their request after ${trips(ra)}.`;
  const [slow, fast] = ra > rb ? [a, b] : [b, a];
  const saved = Math.abs(ra - rb);
  const rtt = fast.model.rtt ?? slow.model.rtt ?? 0;
  return `${fast.title} sends its request after ${trips(Math.min(ra, rb))}; ${slow.title} after ${Math.max(ra, rb)}. ${saved === 1 ? "One round trip" : `${saved} round trips`} saved before the first byte of HTTP: ${ms(saved * rtt)} on this ${ms(rtt)} path, ${PATHS.map(([name, r]) => `${ms(saved * r)} on ${name}`).join(", ")}. QUIC folds the transport and TLS handshakes into one; TCP must finish its own before TLS can start.`;
}
