/**
 * Builders for real packet bytes: Ethernet, ARP, IPv4, IPv6, ICMP, ICMPv6, UDP and TCP with correct checksums and
 * lengths, and the application messages the bundled captures carry (DNS, DHCP, HTTP, TLS hellos, QUIC packets). The
 * generator scripts (scripts.ts) compose them; the parser then reads the result like any file.
 */
import { checksum, parseIpv4, parseIpv6, pseudoHeader } from "../bytes";
import { initialKeys, sealInitial } from "../quic-crypto";

/** A byte writer with length-prefixed blocks, for building protocol messages in order. */
export class W {
  private a: number[] = [];

  get length() {
    return this.a.length;
  }

  u8(...v: number[]) {
    for (const x of v) this.a.push(x & 0xff);
    return this;
  }

  u16(v: number) {
    return this.u8(v >> 8, v);
  }

  u24(v: number) {
    return this.u8(v >> 16, v >> 8, v);
  }

  u32(v: number) {
    return this.u8(v >>> 24, v >>> 16, v >>> 8, v);
  }

  bytes(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.a.push((b[i] ?? 0) & 0xff);
    return this;
  }

  str(s: string) {
    return this.bytes(new TextEncoder().encode(s));
  }

  /** A QUIC variable-length integer, in the smallest encoding or a given size (1, 2, 4 or 8 bytes). */
  varint(v: number, size?: number) {
    const n = size ?? (v < 64 ? 1 : v < 16384 ? 2 : v < 2 ** 30 ? 4 : 8);
    const bits = { 1: 0, 2: 0x40, 4: 0x80, 8: 0xc0 }[n] ?? 0;
    const out: number[] = [];
    let x = v;
    for (let i = 0; i < n; i++) {
      out.unshift(x % 256);
      x = Math.floor(x / 256);
    }
    out[0] = (out[0] ?? 0) | bits;
    return this.u8(...out);
  }

  private block(width: 1 | 2 | 3, fn: (w: W) => void) {
    const inner = new W();
    fn(inner);
    if (width === 1) this.u8(inner.length);
    else if (width === 2) this.u16(inner.length);
    else this.u24(inner.length);
    return this.bytes(inner.a);
  }

  len8(fn: (w: W) => void) {
    return this.block(1, fn);
  }

  len16(fn: (w: W) => void) {
    return this.block(2, fn);
  }

  len24(fn: (w: W) => void) {
    return this.block(3, fn);
  }

  out(): Uint8Array {
    return Uint8Array.from(this.a);
  }
}

/** A seeded generator (mulberry32): the same capture every time, with bytes that look random. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    bytes: (n: number) => Uint8Array.from({ length: n }, () => Math.floor(next() * 256)),
  };
}
export type Rng = ReturnType<typeof rng>;

const macBytes = (m: string) => Uint8Array.from(m.split(":").map((x) => parseInt(x, 16)));

export function ipBytes(text: string): Uint8Array {
  const b = text.includes(":") ? parseIpv6(text) : parseIpv4(text);
  if (!b) throw new Error(`Not an address: ${text}`);
  return b;
}

export const BROADCAST = "ff:ff:ff:ff:ff:ff";

export function ethernet(dst: string, src: string, type: number, payload: Uint8Array): Uint8Array {
  const w = new W().bytes(macBytes(dst)).bytes(macBytes(src)).u16(type).bytes(payload);
  // Pad to the 60-byte minimum (64 with the FCS the NIC adds and strips).
  while (w.length < 60) w.u8(0);
  return w.out();
}

export function ipv4(
  o: {
    src: string;
    dst: string;
    proto: number;
    ttl: number;
    id: number;
    df?: boolean;
    tos?: number;
  },
  payload: Uint8Array,
): Uint8Array {
  const h = new W()
    .u8(0x45, o.tos ?? 0)
    .u16(20 + payload.length)
    .u16(o.id)
    .u16(o.df === false ? 0 : 0x4000)
    .u8(o.ttl, o.proto)
    .u16(0)
    .bytes(ipBytes(o.src))
    .bytes(ipBytes(o.dst))
    .out();
  const sum = checksum([h]);
  h[10] = sum >> 8;
  h[11] = sum & 0xff;
  return new W().bytes(h).bytes(payload).out();
}

export function ipv6(
  o: { src: string; dst: string; next: number; hlim: number; flow?: number },
  payload: Uint8Array,
) {
  return new W()
    .u32((6 << 28) | (o.flow ?? 0))
    .u16(payload.length)
    .u8(o.next, o.hlim)
    .bytes(ipBytes(o.src))
    .bytes(ipBytes(o.dst))
    .bytes(payload)
    .out();
}

/** Writes the transport checksum at `at` over the pseudo-header and the segment. */
function withChecksum(src: string, dst: string, proto: number, seg: Uint8Array, at: number) {
  const sum = checksum([pseudoHeader(ipBytes(src), ipBytes(dst), proto, seg.length), seg]);
  // UDP over IPv4 sends a computed 0 as 0xffff, since 0 means "no checksum".
  const v = proto === 17 && sum === 0 ? 0xffff : sum;
  seg[at] = v >> 8;
  seg[at + 1] = v & 0xff;
  return seg;
}

export function udp(src: string, dst: string, sport: number, dport: number, payload: Uint8Array) {
  const seg = new W()
    .u16(sport)
    .u16(dport)
    .u16(8 + payload.length)
    .u16(0)
    .bytes(payload)
    .out();
  return withChecksum(src, dst, 17, seg, 6);
}

export const TCPF = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16 } as const;

export type TcpOpt =
  | { mss: number }
  | { ws: number }
  | { sackPerm: true }
  | { ts: [number, number] }
  | { sack: [number, number][] }
  | { nop: true };

function tcpOptions(opts: TcpOpt[]): Uint8Array {
  const w = new W();
  for (const o of opts) {
    if ("mss" in o) w.u8(2, 4).u16(o.mss);
    else if ("ws" in o) w.u8(3, 3, o.ws);
    else if ("sackPerm" in o) w.u8(4, 2);
    else if ("ts" in o) w.u8(8, 10).u32(o.ts[0]).u32(o.ts[1]);
    else if ("sack" in o) {
      w.u8(5, 2 + o.sack.length * 8);
      for (const [l, r] of o.sack) w.u32(l).u32(r);
    } else w.u8(1);
  }
  while (w.length % 4) w.u8(1);
  return w.out();
}

export function tcp(
  src: string,
  dst: string,
  o: {
    sport: number;
    dport: number;
    seq: number;
    ack: number;
    flags: number;
    win: number;
    opts?: TcpOpt[];
  },
  payload: Uint8Array = new Uint8Array(0),
) {
  const opts = tcpOptions(o.opts ?? []);
  const seg = new W()
    .u16(o.sport)
    .u16(o.dport)
    .u32(o.seq >>> 0)
    .u32(o.ack >>> 0)
    .u8(((20 + opts.length) / 4) << 4, o.flags)
    .u16(o.win)
    .u16(0)
    .u16(0)
    .bytes(opts)
    .bytes(payload)
    .out();
  return withChecksum(src, dst, 6, seg, 16);
}

export function arp(op: 1 | 2, sha: string, spa: string, tha: string, tpa: string) {
  return new W()
    .u16(1)
    .u16(0x0800)
    .u8(6, 4)
    .u16(op)
    .bytes(macBytes(sha))
    .bytes(ipBytes(spa))
    .bytes(macBytes(tha))
    .bytes(ipBytes(tpa))
    .out();
}

function icmpSum(msg: Uint8Array) {
  const sum = checksum([msg]);
  msg[2] = sum >> 8;
  msg[3] = sum & 0xff;
  return msg;
}

export const icmpEcho = (type: 0 | 8, id: number, seq: number, data: Uint8Array) =>
  icmpSum(new W().u8(type, 0).u16(0).u16(id).u16(seq).bytes(data).out());

/** Time exceeded (11) or unreachable (3), quoting the offending IP header and its first 8 payload bytes. */
export const icmpError = (type: 3 | 11, code: number, quoted: Uint8Array) =>
  icmpSum(new W().u8(type, code).u16(0).u32(0).bytes(quoted.subarray(0, 28)).out());

export function icmpv6(src: string, dst: string, type: number, body: Uint8Array) {
  const msg = new W().u8(type, 0).u16(0).bytes(body).out();
  return withChecksum(src, dst, 58, msg, 2);
}

export const ndLla = (type: 1 | 2, m: string) => new W().u8(type, 1).bytes(macBytes(m)).out();

export function ndPrefix(prefix: string, len: number) {
  return new W().u8(3, 4, len, 0xc0).u32(86400).u32(14400).u32(0).bytes(ipBytes(prefix)).out();
}

export function ndRdnss(servers: string[]) {
  const w = new W()
    .u8(25, 1 + servers.length * 2)
    .u16(0)
    .u32(1800);
  for (const s of servers) w.bytes(ipBytes(s));
  return w.out();
}

// DNS

function dnsName(w: W, name: string) {
  for (const label of name.split(".")) w.len8((l) => l.str(label));
  w.u8(0);
}

export type Rr =
  | { name: string | number; type: "A" | "AAAA"; ttl: number; addr: string }
  | { name: string | number; type: "CNAME" | "NS"; ttl: number; target: string }
  | { name: string | number; type: "MX"; ttl: number; pref: number; target: string }
  | { name: string | number; type: "TXT"; ttl: number; text: string[] }
  | {
      name: string | number;
      type: "SOA";
      ttl: number;
      mname: string;
      rname: string;
      serial: number;
    }
  | {
      name: string | number;
      type: "HTTPS";
      ttl: number;
      priority: number;
      alpn: string[];
      v4: string[];
      v6: string[];
    };

const RR_TYPES = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, HTTPS: 65 } as const;

/**
 * A DNS message. A record's `name` may be a number: a compression pointer to that offset (12 is the question's
 * name), as real servers write their answers.
 */
export function dns(o: {
  id: number;
  response: boolean;
  rcode?: number;
  question: { name: string; type: keyof typeof RR_TYPES | "AAAA" };
  answers?: Rr[];
  authority?: Rr[];
  edns?: number;
}) {
  const w = new W().u16(o.id);
  const flags = o.response ? 0x8180 | (o.rcode ?? 0) : 0x0100;
  w.u16(flags)
    .u16(1)
    .u16(o.answers?.length ?? 0)
    .u16(o.authority?.length ?? 0)
    .u16(o.edns ? 1 : 0);
  dnsName(w, o.question.name);
  w.u16(RR_TYPES[o.question.type]).u16(1);
  const rr = (r: Rr) => {
    if (typeof r.name === "number") w.u16(0xc000 | r.name);
    else dnsName(w, r.name);
    w.u16(RR_TYPES[r.type]).u16(1).u32(r.ttl);
    w.len16((d) => {
      switch (r.type) {
        case "A":
        case "AAAA":
          d.bytes(ipBytes(r.addr));
          break;
        case "CNAME":
        case "NS":
          dnsName(d, r.target);
          break;
        case "MX":
          d.u16(r.pref);
          dnsName(d, r.target);
          break;
        case "TXT":
          for (const t of r.text) d.len8((x) => x.str(t));
          break;
        case "SOA":
          dnsName(d, r.mname);
          dnsName(d, r.rname);
          d.u32(r.serial).u32(7200).u32(3600).u32(1209600).u32(300);
          break;
        case "HTTPS":
          d.u16(r.priority).u8(0);
          d.u16(1).len16((p) => {
            for (const a of r.alpn) p.len8((x) => x.str(a));
          });
          d.u16(4).len16((p) => r.v4.forEach((a) => p.bytes(ipBytes(a))));
          d.u16(6).len16((p) => r.v6.forEach((a) => p.bytes(ipBytes(a))));
          break;
      }
    });
  };
  o.answers?.forEach(rr);
  o.authority?.forEach(rr);
  if (o.edns) w.u8(0).u16(41).u16(o.edns).u32(0).u16(0);
  return w.out();
}

// DHCP

export function dhcp(o: {
  op: 1 | 2;
  xid: number;
  chaddr: string;
  yiaddr?: string;
  broadcast?: boolean;
  options: [number, Uint8Array | number[]][];
}) {
  const w = new W()
    .u8(o.op, 1, 6, 0)
    .u32(o.xid)
    .u16(0)
    .u16(o.broadcast ? 0x8000 : 0);
  w.bytes(ipBytes("0.0.0.0"))
    .bytes(ipBytes(o.yiaddr ?? "0.0.0.0"))
    .bytes(ipBytes("0.0.0.0"))
    .bytes(ipBytes("0.0.0.0"));
  w.bytes(macBytes(o.chaddr))
    .bytes(new Uint8Array(10))
    .bytes(new Uint8Array(64))
    .bytes(new Uint8Array(128));
  w.u32(0x63825363);
  for (const [code, value] of o.options) w.u8(code).len8((v) => v.bytes(value));
  w.u8(255);
  while (w.length < 300) w.u8(0);
  return w.out();
}

export const ipOpt = (...a: string[]) => a.flatMap((x) => Array.from(ipBytes(x)));
export const u32Opt = (v: number) => [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
export const strOpt = (s: string) => Array.from(new TextEncoder().encode(s));

// TLS

export const GREASE = [
  0x0a0a, 0x1a1a, 0x2a2a, 0x3a3a, 0x4a4a, 0x5a5a, 0x6a6a, 0x7a7a, 0x8a8a, 0x9a9a, 0xaaaa, 0xbaba,
];

/**
 * A ClientHello as a current browser sends it: GREASE, TLS 1.3 and 1.2 suites, SNI, ALPN, supported_versions,
 * groups led by the hybrid X25519MLKEM768, an X25519 key share, and QUIC transport parameters when over QUIC.
 */
export function clientHello(
  r: Rng,
  o: { sni: string; alpn: string[]; quic?: { scid: Uint8Array } },
): Uint8Array {
  const g = GREASE[r.int(GREASE.length)] ?? 0x0a0a;
  const g2 = GREASE[r.int(GREASE.length)] ?? 0x1a1a;
  return new W()
    .u8(1)
    .len24((h) => {
      h.u16(0x0303).bytes(r.bytes(32));
      if (o.quic) h.u8(0);
      else h.len8((s) => s.bytes(r.bytes(32)));
      h.len16((c) => {
        if (!o.quic) c.u16(g);
        for (const suite of [0x1301, 0x1302, 0x1303]) c.u16(suite);
        if (!o.quic)
          for (const suite of [
            0xc02b, 0xc02f, 0xc02c, 0xc030, 0xcca9, 0xcca8, 0xc013, 0xc014, 0x009c, 0x009d, 0x002f,
            0x0035,
          ])
            c.u16(suite);
      });
      h.u8(1, 0);
      h.len16((e) => {
        if (!o.quic) e.u16(g).u16(0);
        e.u16(0).len16((x) => x.len16((l) => l.u8(0).len16((n) => n.str(o.sni))));
        e.u16(23).u16(0);
        e.u16(65281).len16((x) => x.u8(0));
        e.u16(10).len16((x) =>
          x.len16((l) => {
            if (!o.quic) l.u16(g2);
            for (const grp of [0x11ec, 0x001d, 0x0017, 0x0018]) l.u16(grp);
          }),
        );
        e.u16(11).len16((x) => x.len8((l) => l.u8(0)));
        e.u16(35).u16(0);
        e.u16(16).len16((x) => x.len16((l) => o.alpn.forEach((p) => l.len8((s) => s.str(p)))));
        e.u16(5).len16((x) => x.u8(1).u16(0).u16(0));
        e.u16(13).len16((x) =>
          x.len16((l) => {
            for (const sig of [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601])
              l.u16(sig);
          }),
        );
        e.u16(18).u16(0);
        e.u16(51).len16((x) =>
          x.len16((l) => {
            if (!o.quic) l.u16(g2).len16((k) => k.u8(0));
            l.u16(0x001d).len16((k) => k.bytes(r.bytes(32)));
          }),
        );
        e.u16(45).len16((x) => x.len8((l) => l.u8(1)));
        e.u16(43).len16((x) =>
          x.len8((l) => {
            if (!o.quic) l.u16(g);
            l.u16(0x0304).u16(0x0303);
          }),
        );
        e.u16(27).len16((x) => x.len8((l) => l.u16(2)));
        if (o.quic) {
          const scid = o.quic.scid;
          e.u16(57).len16((x) => {
            x.varint(0x01).varint(4).varint(30000, 4);
            x.varint(0x03).varint(2).varint(1472, 2);
            x.varint(0x04).varint(4).varint(15728640, 4);
            x.varint(0x05).varint(4).varint(6291456, 4);
            x.varint(0x06).varint(4).varint(6291456, 4);
            x.varint(0x07).varint(4).varint(6291456, 4);
            x.varint(0x08).varint(2).varint(100, 2);
            x.varint(0x09).varint(2).varint(103, 2);
            x.varint(0x0f).varint(scid.length).bytes(scid);
            x.varint(0x20).varint(4).varint(65536, 4);
          });
        } else {
          // Chrome's second GREASE extension, last but for padding, with one byte in it.
          e.u16(g2).u16(1).u8(0);
        }
      });
    })
    .out();
}

export function serverHello(r: Rng, o: { sessionId: Uint8Array; quic?: boolean }): Uint8Array {
  return new W()
    .u8(2)
    .len24((h) => {
      h.u16(0x0303).bytes(r.bytes(32));
      h.len8((s) => s.bytes(o.sessionId));
      h.u16(0x1301).u8(0);
      h.len16((e) => {
        e.u16(51).len16((x) => x.u16(0x001d).len16((k) => k.bytes(r.bytes(32))));
        e.u16(43).len16((x) => x.u16(0x0304));
      });
    })
    .out();
}

export const tlsRecord = (type: number, body: Uint8Array, version = 0x0303) =>
  new W().u8(type).u16(version).u16(body.length).bytes(body).out();

/** A record of `n` encrypted bytes: random-looking, as ciphertext is. */
export const encryptedRecord = (r: Rng, n: number) => tlsRecord(23, r.bytes(n));

// QUIC

export interface QuicIds {
  dcid: Uint8Array;
  scid: Uint8Array;
}

/**
 * An Initial packet, really protected per RFC 9001 with keys from `keyDcid` (the client's first DCID), padded with
 * PADDING frames to `padTo` bytes when asked. Returns the protected bytes.
 */
export async function quicInitial(o: {
  ids: QuicIds;
  keyDcid: Uint8Array;
  side: "client" | "server";
  pn: number;
  frames: Uint8Array;
  padTo?: number;
}): Promise<Uint8Array> {
  const pnLength = 2;
  const head = (len: number) =>
    new W()
      .u8(0xc0 | (pnLength - 1))
      .u32(1)
      .len8((d) => d.bytes(o.ids.dcid))
      .len8((s) => s.bytes(o.ids.scid))
      .varint(0)
      .varint(len, 2)
      .u16(o.pn)
      .out();
  const base = head(0).length;
  const plain = new W().bytes(o.frames);
  if (o.padTo) while (base + plain.length + 16 < o.padTo) plain.u8(0);
  const payload = plain.out();
  const header = head(pnLength + payload.length + 16);
  return sealInitial(header, pnLength, o.pn, payload, await initialKeys(o.keyDcid, o.side));
}

/** A Handshake (or 0-RTT) packet with a payload we can't encrypt for real: keys come from the key exchange. */
export function quicLongProtected(r: Rng, ids: QuicIds, type: 1 | 2, n: number): Uint8Array {
  return new W()
    .u8(0xc0 | (type << 4) | r.int(16))
    .u32(1)
    .len8((d) => d.bytes(ids.dcid))
    .len8((s) => s.bytes(ids.scid))
    .varint(n, 2)
    .bytes(r.bytes(n))
    .out();
}

export function quicShort(r: Rng, dcid: Uint8Array, spin: 0 | 1, n: number): Uint8Array {
  return new W()
    .u8(0x40 | (spin << 5) | r.int(32))
    .bytes(dcid)
    .bytes(r.bytes(n))
    .out();
}

export const cryptoFrame = (offset: number, data: Uint8Array) =>
  new W().u8(6).varint(offset).varint(data.length).bytes(data).out();

export const ackFrame = (largest: number, delay: number) =>
  new W().u8(2).varint(largest).varint(delay).varint(0).varint(largest).out();
