/**
 * What every bundled capture script shares. The captures are written as scripts: who sends what, when, and which packet is which mark. A home network on
 * 192.168.1.0/24 and internet hosts in the documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24,
 * 2001:db8::/32), a 25 ms round trip to the internet, 2 ms to the router, the TCP options a current OS sends. The
 * capture point is the laptop, so its packets are stamped when sent and the replies when they arrive.
 *
 * A script builds its packets in order, so its marks are known at once (`captureMark` is synchronous); only the
 * QUIC Initials need WebCrypto to seal, so a packet's bytes may be a promise.
 */
import { ethernet, ipv4, tcp, TCPF, type Rng, type TcpOpt } from "../build";

export const HOSTS = {
  laptop: { mac: "3c:22:fb:4a:9e:01", ip: "192.168.1.23", ll: "fe80::3e22:fbff:fe4a:9e01" },
  router: { mac: "50:c7:bf:12:7c:10", ip: "192.168.1.1", ll: "fe80::1", global: "2001:db8:1::1" },
  web: "198.51.100.10",
  tls: "203.0.113.50",
  quic: "192.0.2.80",
} as const;

export const L = HOSTS.laptop;
export const R = HOSTS.router;
/** Monday 23 November 2026, 09:00 UTC: where every bundled capture's clock starts. */
const T0 = Date.UTC(2026, 10, 23, 9, 0, 0) / 1000;

export interface Script {
  /** Packets in order: when (seconds since the epoch) and the Ethernet frame. */
  frames: { time: number; bytes: Uint8Array | (() => Promise<Uint8Array>) }[];
  marks: Record<string, number>;
  format: "pcap" | "pcap-ns" | "pcapng";
}

/** Appends frames at times in milliseconds from the script's start, and names some of them. */
export class Tape {
  readonly script: Script;
  private readonly start: number;

  constructor(startOffset: number, format: Script["format"]) {
    this.start = T0 + startOffset;
    this.script = { frames: [], marks: {}, format };
  }

  add(ms: number, bytes: Uint8Array | (() => Promise<Uint8Array>), mark?: string) {
    this.script.frames.push({ time: this.start + ms / 1000, bytes });
    if (mark) this.script.marks[mark] = this.script.frames.length;
    return this.script.frames.length;
  }
}

/** The laptop's and the router's frames, IPv4 over Ethernet, with each host's own TTL and IP ID counter. */
export function v4(
  from: "laptop" | "router" | "internet",
  src: string,
  dst: string,
  proto: number,
  payload: Uint8Array,
  ids: Map<string, number> | number,
  ttl?: number,
) {
  const id = typeof ids === "number" ? ids : nextId(ids, src);
  const packet = ipv4(
    { src, dst, proto, ttl: ttl ?? (from === "laptop" ? 64 : from === "router" ? 64 : 52), id },
    payload,
  );
  const toLaptop = from !== "laptop";
  return ethernet(toLaptop ? L.mac : R.mac, toLaptop ? R.mac : L.mac, 0x0800, packet);
}

/** The next IP ID from `src`: each host counts up from its own start. */
export function nextId(ids: Map<string, number>, src: string): number {
  const id = (ids.get(src) ?? 0x3a10 + src.length * 97) + 1;
  ids.set(src, id);
  return id;
}

/**
 * One TCP connection, seen from the laptop. Tracks both sides' sequence numbers and timestamps, so a script says
 * what is sent and the numbers come out right. Times are milliseconds on the tape.
 */
export class Tcp {
  private seq: [number, number];
  private ack: [number, number] = [0, 0];
  private win: [number, number];
  private readonly ts: [number, number];
  private readonly ids = new Map<string, number>();
  private readonly tape: Tape;
  private readonly ends: [{ ip: string; port: number }, { ip: string; port: number }];
  /** Hops between the laptop and the server, for the replies' TTL. */
  private readonly hops: number;
  private lastTs: [number, number] = [0, 0];

  constructor(
    tape: Tape,
    r: Rng,
    client: { ip: string; port: number },
    server: { ip: string; port: number },
    hops: number,
  ) {
    this.tape = tape;
    this.ends = [client, server];
    this.seq = [r.int(2 ** 32), r.int(2 ** 32)];
    this.ts = [1_823_000_000 + r.int(1_000_000), 4_093_000_000 + r.int(1_000_000)];
    this.win = [65535, 65160];
    this.hops = hops;
  }

  /** Sends from side 0 (client) or 1 (server) at `ms`; `opts` replaces the timestamp option on a SYN. */
  send(
    side: 0 | 1,
    ms: number,
    flags: number,
    payload: Uint8Array = new Uint8Array(0),
    o: {
      mark?: string;
      opts?: TcpOpt[];
      win?: number;
      seq?: number;
      ack?: number;
      record?: boolean;
    } = {},
  ) {
    const other = side === 0 ? 1 : 0;
    const [from, to] = side === 0 ? this.ends : [this.ends[1], this.ends[0]];
    if (o.win !== undefined) this.win[side] = o.win;
    // TSval ticks at 1 kHz, as on Linux; TSecr echoes the latest value seen from the peer.
    const tsval = this.ts[side] + Math.round(ms);
    const tsecr = flags & TCPF.ACK || side === 1 ? this.lastTs[other] : 0;
    this.lastTs[side] = tsval;
    const opts = o.opts ?? [{ nop: true }, { nop: true }, { ts: [tsval, tsecr] }];
    const seq = o.seq ?? this.seq[side];
    const seg = tcp(
      from.ip,
      to.ip,
      {
        sport: from.port,
        dport: to.port,
        seq,
        ack: flags & TCPF.ACK ? (o.ack ?? this.ack[side]) : 0,
        flags,
        win: this.win[side],
        opts,
      },
      payload,
    );
    const internet = side === 1 ? "internet" : "laptop";
    const frame = v4(internet, from.ip, to.ip, 6, seg, this.ids, side === 1 ? 64 - this.hops : 64);
    if (o.seq === undefined) {
      const used = payload.length + (flags & TCPF.SYN ? 1 : 0) + (flags & TCPF.FIN ? 1 : 0);
      this.seq[side] = (this.seq[side] + used) >>> 0;
      this.ack[other] = this.seq[side];
    }
    if (o.record === false) return 0;
    return this.tape.add(ms, frame, o.mark);
  }

  /** The raw sequence number `side` sends next, for SACK blocks and retransmissions. */
  raw(side: 0 | 1) {
    return this.seq[side];
  }

  /** The timestamp option `side` would send at `ms`, to put before other options. */
  timestamps(side: 0 | 1, ms: number): TcpOpt[] {
    return [
      { nop: true },
      { nop: true },
      { ts: [this.ts[side] + Math.round(ms), this.lastTs[side === 0 ? 1 : 0]] },
    ];
  }

  /** The opening three packets, with the options a current Linux or macOS client and a Linux server send. */
  handshake(ms: number, rtt: number) {
    const c = this.ts[0] + Math.round(ms);
    this.lastTs[0] = c;
    this.send(0, ms, TCPF.SYN, undefined, {
      mark: "syn",
      opts: [{ mss: 1460 }, { sackPerm: true }, { ts: [c, 0] }, { nop: true }, { ws: 7 }],
    });
    const s = this.ts[1] + Math.round(ms + rtt);
    this.lastTs[1] = s;
    this.send(1, ms + rtt, TCPF.SYN | TCPF.ACK, undefined, {
      mark: "syn-ack",
      opts: [{ mss: 1460 }, { sackPerm: true }, { ts: [s, c] }, { nop: true }, { ws: 7 }],
    });
    this.send(0, ms + rtt + 0.1, TCPF.ACK, undefined, { mark: "ack", win: 2052 });
    // From here the windows are scaled by 128: 2052 is 262,656 bytes, the server's 502 is 64,256.
    this.win[1] = 502;
  }
}

export const text = (s: string) => new TextEncoder().encode(s);

/** A bundled capture: what it is called and is about, and the script that builds it. */
export interface Bundled {
  title: string;
  summary: string;
  build: () => Script;
}
