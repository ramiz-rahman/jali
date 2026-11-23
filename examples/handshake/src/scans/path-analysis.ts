/**
 * Reads a traceroute the way a network engineer does: which hops are inside your home, your ISP's carrier NAT, or
 * the public internet; where latency jumps and whether the jump is real; and what `* * *` does and does not mean.
 */
import { ipv4Octets } from "./net";
import type { Hop, PathScan } from "./types";

export type IpClass =
  | "private"
  | "cgnat"
  | "documentation"
  | "loopback"
  | "link-local"
  | "benchmark"
  | "reserved"
  | "public";

export interface IpInfo {
  cls: IpClass;
  /** Short badge text. */
  label: string;
  /** One line on what the range is. */
  note: string;
}

const INFO: Record<IpClass, Omit<IpInfo, "cls">> = {
  private: {
    label: "Private",
    note: "RFC 1918 (10/8, 172.16/12, 192.168/16): only routable inside a network like yours.",
  },
  cgnat: {
    label: "CGNAT",
    note: "100.64.0.0/10 (RFC 6598): your ISP's carrier-grade NAT. Many subscribers share one public IPv4 address.",
  },
  documentation: {
    label: "Documentation",
    note: "192.0.2/24, 198.51.100/24 and 203.0.113/24 (RFC 5737) are reserved for examples. Real traffic never uses them: this is a made-up or redacted trace.",
  },
  loopback: { label: "Loopback", note: "127/8: this machine." },
  "link-local": {
    label: "Link-local",
    note: "169.254/16: self-assigned when DHCP fails; not routed.",
  },
  benchmark: {
    label: "Benchmark",
    note: "198.18/15 (RFC 2544): reserved for lab testing; some ISPs and VPNs use it internally.",
  },
  reserved: { label: "Reserved", note: "Multicast or otherwise not a normal unicast address." },
  public: {
    label: "Public",
    note: "A globally routable address: this hop belongs to your ISP, a transit network or the destination.",
  },
};

export function classifyIp(ip: string): IpInfo {
  const cls = ((): IpClass => {
    const o = ipv4Octets(ip);
    if (!o) {
      const t = ip.toLowerCase();
      if (/^f[cd]/.test(t)) return "private";
      if (t.startsWith("fe80")) return "link-local";
      if (t.startsWith("2001:db8")) return "documentation";
      if (t === "::1") return "loopback";
      return "public";
    }
    const [a = 0, b = 0, c = 0] = o;
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private";
    if (a === 100 && b >= 64 && b <= 127) return "cgnat";
    if (a === 127) return "loopback";
    if (a === 169 && b === 254) return "link-local";
    if (
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    )
      return "documentation";
    if (a === 198 && (b === 18 || b === 19)) return "benchmark";
    if (a >= 224) return "reserved";
    return "public";
  })();
  return { cls, ...INFO[cls] };
}

export interface HopRow {
  hop: Hop;
  /** Representative round trip: the median of the probes that answered (mtr: its average). */
  rtt?: number;
  /** Spread between the fastest and slowest probe. */
  spread?: number;
  /** Probes with no answer. */
  lost: number;
  probes: number;
  /** Every probe went unanswered. */
  silent: boolean;
  ip?: IpInfo;
  /** Increase over the previous answering hop, in ms, when it is large enough to look at. */
  jump?: number;
  /** The jump is higher than the hops after it: the router is slow to answer ICMP, not slow to forward. */
  jumpIsArtefact?: boolean;
  isGateway: boolean;
  isFirstPublic: boolean;
  isDestination: boolean;
  /** What to say about this hop, most important first. */
  notes: string[];
}

export interface PathSummary {
  rows: HopRow[];
  hops: number;
  reached: boolean;
  /** Round trip to the last answering hop. */
  endRtt?: number;
  /** Round trip to your router. */
  gatewayRtt?: number;
  gateway?: string;
  behindCgnat: boolean;
  silentHops: number;
  /** Loss that starts at a hop and carries to the end, which is real loss rather than ICMP rate limiting. */
  realLossFrom?: number;
}

const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

export const fmtMs = (ms: number): string =>
  ms < 1 ? "<1" : ms < 10 ? ms.toFixed(1) : String(Math.round(ms));

export function analysePath(scan: PathScan): PathSummary {
  const rows: HopRow[] = scan.hops.map((hop) => {
    const answered = hop.rtts.filter((r): r is number => r !== null);
    const probes = hop.mtr ? hop.mtr.sent : hop.rtts.length;
    const lost = hop.mtr
      ? Math.round((hop.mtr.lossPct / 100) * hop.mtr.sent)
      : hop.rtts.length - answered.length;
    const silent = hop.mtr ? hop.mtr.lossPct >= 100 : answered.length === 0;
    return {
      hop,
      rtt: hop.mtr && !silent ? hop.mtr.avg : median(answered),
      spread: hop.mtr
        ? hop.mtr.worst - hop.mtr.best
        : answered.length > 1
          ? Math.max(...answered) - Math.min(...answered)
          : undefined,
      lost,
      probes,
      silent,
      ip: hop.ip ? classifyIp(hop.ip) : undefined,
      isGateway: false,
      isFirstPublic: false,
      isDestination: false,
      notes: [],
    };
  });

  const gatewayRow = rows.find((r) => r.hop.n === (rows[0]?.hop.n ?? 1) && r.ip?.cls === "private");
  if (gatewayRow) gatewayRow.isGateway = true;
  const firstPublic = rows.find((r) => r.ip?.cls === "public" || r.ip?.cls === "documentation");
  if (firstPublic) firstPublic.isFirstPublic = true;
  const last = rows[rows.length - 1];
  const reached = !!last && !last.silent && (scan.targetIp ? last.hop.ip === scan.targetIp : true);
  if (reached && last) last.isDestination = true;

  // Latency jumps, against the previous hop that answered.
  let prev: HopRow | undefined;
  rows.forEach((r, i) => {
    if (r.rtt === undefined) return;
    if (prev?.rtt !== undefined) {
      const d = r.rtt - prev.rtt;
      if (d >= 20 && r.rtt >= prev.rtt * 2) {
        r.jump = d;
        const later = rows.slice(i + 1).find((x) => x.rtt !== undefined);
        r.jumpIsArtefact = later?.rtt !== undefined && later.rtt < r.rtt;
      }
    }
    prev = r;
  });

  // Where silence is harmless and where it is not.
  const answeringAfter = (i: number) => rows.slice(i + 1).some((r) => !r.silent);
  let realLossFrom: number | undefined;
  rows.forEach((r, i) => {
    if (!r.hop.mtr || r.hop.mtr.lossPct <= 0 || r.silent) return;
    const tailLossy = rows.slice(i).every((x) => !x.silent && (x.hop.mtr?.lossPct ?? 0) > 0);
    if (tailLossy && realLossFrom === undefined) realLossFrom = r.hop.n;
  });

  rows.forEach((r, i) => {
    const n = r.notes;
    if (r.isGateway)
      n.push(
        "Your router: the default gateway. Latency here is your Wi-Fi or cable to it, before the internet is involved.",
      );
    if (r.ip?.cls === "cgnat") {
      n.push(
        "Carrier-grade NAT. Your ISP translates many homes onto few public IPv4 addresses, so inbound connections (port forwarding, self-hosting) cannot reach you over IPv4. IPv6, if you have it, is not affected.",
      );
    }
    if (r.isFirstPublic)
      n.push(
        "First public address: your traffic has left your ISP's internal network, or reached its edge.",
      );
    if (r.ip?.cls === "documentation") n.push(INFO.documentation.note);
    if (r.silent) {
      n.push(
        answeringAfter(i)
          ? "No reply to any probe, yet later hops answer, so this router forwards your traffic fine. It just does not send ICMP Time Exceeded back: rate limiting or a firewall rule. Not a fault."
          : "No reply, and nothing after it answers either. Either a firewall drops probes from here on, or the destination does not answer them (many servers do not): `* * *` alone does not prove loss.",
      );
    } else if (r.lost > 0 && !r.hop.mtr) {
      n.push(
        `${r.lost} of ${r.probes} probes unanswered. Routers answer ICMP at low priority and drop some under load; this matters only if later hops lose probes too.`,
      );
    }
    if (r.hop.mtr && !r.silent && r.hop.mtr.lossPct > 0) {
      n.push(
        realLossFrom !== undefined && r.hop.n >= realLossFrom
          ? `${r.hop.mtr.lossPct}% loss here, and every hop after it loses probes too: this is real loss, starting at hop ${realLossFrom}.`
          : `${r.hop.mtr.lossPct}% loss here, but later hops are clean, so it is ICMP rate limiting at this router, not loss on the path.`,
      );
    }
    if (r.jump !== undefined) {
      n.push(
        r.jumpIsArtefact
          ? `+${Math.round(r.jump)} ms against the hop before, but the next hop is faster: this router is slow to answer probes, which says nothing about forwarding.`
          : `+${Math.round(r.jump)} ms against the hop before and it stays high: a long link (undersea or cross-country fibre, a satellite or radio hop) or a congested one. Light in fibre covers about 100 km per ms, one way.`,
      );
    }
    if (r.hop.alsoIps.length)
      n.push(
        `More than one address answered at this TTL (${[r.hop.ip, ...r.hop.alsoIps].join(", ")}): the path splits across equal-cost links here.`,
      );
    if (r.hop.note?.startsWith("!"))
      n.push(
        `Probe returned ${r.hop.note}: ${ANNOTATIONS[r.hop.note] ?? "an ICMP error from this router"}.`,
      );
    else if (r.hop.note && !r.silent) n.push(r.hop.note);
  });

  const answering = rows.filter((r) => !r.silent && r.rtt !== undefined);
  const lastAnswering = answering[answering.length - 1];
  return {
    rows,
    hops: rows.length,
    reached,
    endRtt: lastAnswering?.rtt,
    gatewayRtt: gatewayRow?.rtt,
    gateway: gatewayRow?.hop.ip,
    behindCgnat: rows.some((r) => r.ip?.cls === "cgnat"),
    silentHops: rows.filter((r) => r.silent).length,
    realLossFrom,
  };
}

const ANNOTATIONS: Record<string, string> = {
  "!H": "host unreachable",
  "!N": "network unreachable",
  "!P": "protocol unreachable",
  "!X": "administratively prohibited",
  "!F": "fragmentation needed",
  "!S": "source route failed",
};
