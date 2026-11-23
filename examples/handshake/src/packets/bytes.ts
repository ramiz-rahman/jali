/**
 * Reading bytes: a bounds-checked view the dissectors read through, the address and number formats they print,
 * and the Internet checksum (RFC 1071) the IP, ICMP, UDP and TCP headers share.
 */

/** A read past the end of the bytes a header claims: the dissector catches it and marks the header cut short. */
export class Truncated extends Error {
  constructor(readonly at: number) {
    super(`The bytes end at ${at}`);
  }
}

/**
 * The bytes a dissector reads, and where each of them sits in the packet. For plain packet bytes that is the same
 * offset; for a decrypted QUIC payload it is where the ciphertext was (AES-GCM is a stream cipher, so plaintext byte
 * i came from ciphertext byte i); for a reassembled TLS message it may be nowhere on this packet (-1).
 */
export class Src {
  readonly b: Uint8Array;
  private readonly where: (i: number) => number;

  constructor(b: Uint8Array, where: number | ((i: number) => number) = 0) {
    this.b = b;
    this.where = typeof where === "number" ? (i) => where + i : where;
  }

  get length() {
    return this.b.length;
  }

  need(i: number, n: number) {
    if (i < 0 || i + n > this.b.length) throw new Truncated(this.b.length);
  }

  u8(i: number): number {
    this.need(i, 1);
    return this.b[i] ?? 0;
  }

  u16(i: number): number {
    return (this.u8(i) << 8) | this.u8(i + 1);
  }

  u24(i: number): number {
    return (this.u8(i) << 16) | this.u16(i + 1);
  }

  u32(i: number): number {
    return ((this.u8(i) << 24) >>> 0) + this.u24(i + 1);
  }

  bytes(i: number, n: number): Uint8Array {
    this.need(i, n);
    return this.b.subarray(i, i + n);
  }

  /** A QUIC variable-length integer (RFC 9000 §16): the top two bits give its length. */
  varint(i: number): { value: number; size: number } {
    const first = this.u8(i);
    const size = 1 << (first >> 6);
    this.need(i, size);
    let value = first & 0x3f;
    for (let k = 1; k < size; k++) value = value * 256 + this.u8(i + k);
    return { value, size };
  }

  /** Where `n` bytes from `i` sit in the packet: offset and length, or length 0 when they are not all on it. */
  span(i: number, n: number): [number, number] {
    const start = this.where(i);
    if (start < 0 || n <= 0) return [Math.max(start, 0), 0];
    const end = this.where(i + n - 1);
    return end - start === n - 1 ? [start, n] : [start, 0];
  }

  /** Other bytes at these bytes' positions: a decrypted payload read where its ciphertext sits. */
  remap(b: Uint8Array): Src {
    return new Src(b, this.where);
  }

  /** A view of `n` bytes from `i`, keeping their packet positions. */
  sub(i: number, n: number): Src {
    this.need(i, n);
    return new Src(this.b.subarray(i, i + n), (k) => this.where(i + k));
  }
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

export const hex = (b: Uint8Array, sep = ""): string => Array.from(b, (x) => HEX[x]).join(sep);

export const hex16 = (n: number) => `0x${n.toString(16).padStart(4, "0")}`;

export const mac = (b: Uint8Array): string => hex(b, ":");

export const ipv4 = (b: Uint8Array): string => Array.from(b).join(".");

/** An IPv6 address as RFC 5952 writes it: lower case, no leading zeros, the longest run of zero groups as "::". */
export function ipv6(b: Uint8Array): string {
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((b[i] ?? 0) << 8) | (b[i + 1] ?? 0));
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const text = (g: number[]) => g.map((x) => x.toString(16)).join(":");
  if (best < 0) return text(groups);
  return `${text(groups.slice(0, best))}::${text(groups.slice(best + bestLen))}`;
}

export function parseIpv4(text: string): Uint8Array | undefined {
  const parts = text.split(".");
  if (parts.length !== 4) return undefined;
  const out = parts.map(Number);
  return out.every(
    (x, i) => Number.isInteger(x) && x >= 0 && x <= 255 && /^\d+$/.test(parts[i] ?? ""),
  )
    ? Uint8Array.from(out)
    : undefined;
}

export function parseIpv6(text: string): Uint8Array | undefined {
  const halves = text.toLowerCase().split("::");
  if (halves.length > 2) return undefined;
  const groups = (s: string) => (s ? s.split(":") : []);
  const head = groups(halves[0] ?? "");
  const tail = halves.length === 2 ? groups(halves[1] ?? "") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return undefined;
  const all = [...head, ...Array<string>(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  const out = new Uint8Array(16);
  for (const [i, g] of all.entries()) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return undefined;
    const v = parseInt(g, 16);
    out[i * 2] = v >> 8;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

/** The ones' complement sum of 16-bit words (RFC 1071), folded; 0 means a header with its checksum in it checks. */
export function onesSum(parts: Uint8Array[]): number {
  let sum = 0;
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 2) sum += ((part[i] ?? 0) << 8) | (part[i + 1] ?? 0);
    // Each part is summed from an even offset: a part of odd length is padded with a zero byte, as RFC 1071 says
    // for the last one. Only the last part may be odd in the callers here.
  }
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return sum;
}

export const checksum = (parts: Uint8Array[]): number => ~onesSum(parts) & 0xffff;

/** The pseudo-header TCP, UDP and ICMPv6 checksums cover (RFC 9293 §3.1, RFC 8200 §8.1). */
export function pseudoHeader(
  src: Uint8Array,
  dst: Uint8Array,
  proto: number,
  length: number,
): Uint8Array {
  if (src.length === 4) {
    return Uint8Array.from([...src, ...dst, 0, proto, length >> 8, length & 0xff]);
  }
  const out = new Uint8Array(40);
  out.set(src, 0);
  out.set(dst, 16);
  out[32] = (length >>> 24) & 0xff;
  out[33] = (length >>> 16) & 0xff;
  out[34] = (length >>> 8) & 0xff;
  out[35] = length & 0xff;
  out[39] = proto;
  return out;
}

export const ascii = (b: Uint8Array): string =>
  Array.from(b, (x) => String.fromCharCode(x)).join("");

/** Printable ASCII, with anything else as a dot, as a hex dump shows it. */
export const printable = (x: number) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : ".");
