/**
 * Path parsers: macOS/Linux `traceroute`, Windows `tracert`, and `mtr --report`. All yield hops with one entry per
 * probe, in ms, null where nothing answered (a `*`).
 */
import { isIpv4 } from "./net";
import { fail, ok, type Hop, type ParseResult, type PathScan } from "./types";

/** Unix traceroute header: `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets`. */
const headerOf = (text: string): { target?: string; targetIp?: string } => {
  const m = /^traceroute6? to (\S+) \(([^)]+)\)/m.exec(text);
  return { target: m?.[1], targetIp: m?.[2] };
};

/**
 * Tokens after the hop number: `*`, `name (ip)`, a bare ip, `12.3 ms`, annotations like `!H`. A new address
 * starts when a host or ip token appears; its times follow. Several addresses on one line are equal-cost paths.
 */
function parseUnixHop(n: number, rest: string): Hop {
  const tokens = rest.trim().split(/\s+/);
  const hop: Hop = { n, alsoIps: [], rtts: [] };
  const seen: string[] = [];
  const addAddress = (ip: string, name?: string) => {
    if (seen.includes(ip)) return;
    seen.push(ip);
    if (hop.ip === undefined) {
      hop.ip = ip;
      hop.name = name;
    } else hop.alsoIps.push(ip);
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? "";
    const next = tokens[i + 1] ?? "";
    if (t === "*") hop.rtts.push(null);
    else if (/^\(.+\)$/.test(next)) {
      addAddress(next.slice(1, -1), isIpv4(t) ? undefined : t);
      i++;
    } else if (/^[\d.]+$/.test(t) && next === "ms") {
      hop.rtts.push(Number(t));
      i++;
    } else if (isIpv4(t) || t.includes(":")) addAddress(t);
    else if (/^!\S*$/.test(t)) hop.note = hop.note ? `${hop.note} ${t}` : t;
  }
  return hop;
}

export function parseTraceroute(text: string): ParseResult<PathScan> {
  const hops: Hop[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d{1,3})\s+(.+?)\s*$/.exec(line);
    if (!m || !/(\*|\d\s*ms|\(\d)/.test(m[2] ?? "")) continue;
    hops.push(parseUnixHop(Number(m[1]), m[2] ?? ""));
  }
  return hops.length
    ? ok({ kind: "path", ...headerOf(text), hops })
    : fail("No hop lines found in this traceroute output.");
}

/** Windows `tracert`: `  4    12 ms    13 ms    12 ms  ae-1.r01.lon.example.net [203.0.113.5]`, `<1 ms`, `Request timed out.` */
export function parseTracert(text: string): ParseResult<PathScan> {
  const hops: Hop[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d{1,3})\s{2,}(.+?)\s*$/.exec(line);
    if (!m) continue;
    const body = m[2] ?? "";
    const probes = [...body.matchAll(/(<?\d+)\s*ms|(\*)/g)];
    const hop: Hop = { n: Number(m[1]), alsoIps: [], rtts: [] };
    if (probes.length < 1) {
      // `192.168.1.20  reports: Destination host unreachable.` has no times: the hop is the router that said so.
      const r = /^(\S+)\s+\S+:\s*(.+)$/.exec(body);
      if (r && isIpv4(r[1] ?? "")) hops.push({ ...hop, ip: r[1], note: r[2] });
      continue;
    }
    let lastEnd = 0;
    for (const p of probes) {
      // `<1 ms` means under a millisecond: half of it is the honest midpoint.
      hop.rtts.push(
        p[2]
          ? null
          : (p[1] ?? "").startsWith("<")
            ? Number((p[1] ?? "").slice(1)) / 2
            : Number(p[1]),
      );
      lastEnd = (p.index ?? 0) + p[0].length;
    }
    const tail = body.slice(lastEnd).trim();
    const named = /^(.+?)\s+\[([^\]]+)\]$/.exec(tail);
    if (named) {
      hop.name = named[1];
      hop.ip = named[2];
    } else if (isIpv4(tail) || /^[0-9a-f:]+$/i.test(tail)) hop.ip = tail;
    else if (tail && !/^Request timed out\.?$/i.test(tail)) {
      // A translated "Request timed out." or similar.
      hop.note = tail;
    }
    hops.push(hop);
  }
  const head = /^Tracing route to (\S+)(?: \[([^\]]+)\])?/m.exec(text);
  const target = head?.[1];
  const targetIp = head?.[2] ?? (target && isIpv4(target) ? target : undefined);
  return hops.length
    ? ok({ kind: "path", target, targetIp, hops })
    : fail("No hop lines found in this tracert output.");
}

/** `mtr --report`: `  3.|-- 10.20.0.1   0.0%   10   9.1   9.5   8.7  12.0   1.0`; `???` is a hop that never answered. */
export function parseMtr(text: string): ParseResult<PathScan> {
  const hops: Hop[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m =
      /^\s*(\d+)\.(?:\|--)?\s+(?:AS\S+\s+)?(\S+)\s+([\d.]+)%?\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/.exec(
        line,
      );
    if (!m) continue;
    const addr = m[2] ?? "";
    const silent = addr === "???";
    const [lossPct, sent, last, avg, best, worst, stdev] = [
      m[3],
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9],
    ].map(Number) as [number, number, number, number, number, number, number];
    const hop: Hop = {
      n: Number(m[1]),
      alsoIps: [],
      rtts: silent || lossPct >= 100 ? [null] : [avg],
      mtr: { lossPct, sent, last, avg, best, worst, stdev },
    };
    if (!silent) {
      if (isIpv4(addr) || addr.includes(":")) hop.ip = addr;
      else hop.name = addr;
    }
    hops.push(hop);
  }
  return hops.length ? ok({ kind: "path", hops }) : fail("No hop lines found in this mtr report.");
}
