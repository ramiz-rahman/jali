/**
 * QUIC Initial packet protection (RFC 9001 §5), with WebCrypto. Initial keys come from the client's first
 * Destination Connection ID and a salt everyone knows, so anyone on the path can derive them: Initial encryption
 * stops middleboxes from ossifying on the handshake, it does not keep it secret. Both directions are here: opening
 * (to read a capture, the user's own included) and sealing (to generate the bundled QUIC capture for real).
 */
import { Src } from "./bytes";

/** RFC 9001 §5.2: the version 1 salt. */
const SALT_V1 = fromHex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a");

export function fromHex(text: string): Uint8Array {
  const clean = text.replace(/[^0-9a-f]/gi, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** WebCrypto wants an ArrayBuffer of exactly these bytes, not a view into a larger one. */
const buf = (u: Uint8Array): ArrayBuffer => u.slice().buffer;

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    buf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, buf(data)));
}

/** HKDF-Extract (RFC 5869 §2.2) is one HMAC with the salt as its key. */
export const hkdfExtract = (salt: Uint8Array, ikm: Uint8Array) => hmac(salt, ikm);

/**
 * HKDF-Expand-Label (RFC 8446 §7.1) with an empty context. Every output here is at most 32 bytes, one SHA-256
 * block, so HKDF-Expand is a single HMAC over the label and the counter byte 1. WebCrypto's own HKDF always
 * extracts first, which is why this is written out.
 */
export async function hkdfExpandLabel(
  secret: Uint8Array,
  label: string,
  length: number,
): Promise<Uint8Array> {
  const full = new TextEncoder().encode(`tls13 ${label}`);
  const info = Uint8Array.from([length >> 8, length & 0xff, full.length, ...full, 0, 1]);
  return (await hmac(secret, info)).subarray(0, length);
}

export interface InitialKeys {
  secret: Uint8Array;
  key: Uint8Array;
  iv: Uint8Array;
  hp: Uint8Array;
}

/** The Initial keys for one side, from the client's original Destination Connection ID (RFC 9001 §5.2). */
export async function initialKeys(
  dcid: Uint8Array,
  side: "client" | "server",
): Promise<InitialKeys> {
  const initial = await hkdfExtract(SALT_V1, dcid);
  const secret = await hkdfExpandLabel(initial, side === "client" ? "client in" : "server in", 32);
  return {
    secret,
    key: await hkdfExpandLabel(secret, "quic key", 16),
    iv: await hkdfExpandLabel(secret, "quic iv", 12),
    hp: await hkdfExpandLabel(secret, "quic hp", 16),
  };
}

/**
 * The header protection mask: AES-ECB of the 16-byte sample (RFC 9001 §5.4.3). WebCrypto has no ECB, but CBC with
 * a zero IV over one block is the same thing: the first block out is AES(sample XOR 0). The padding block CBC adds
 * after it is thrown away.
 */
export async function hpMask(hp: Uint8Array, sample: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", buf(hp), "AES-CBC", false, ["encrypt"]);
  const out = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: new ArrayBuffer(16) },
    k,
    buf(sample),
  );
  return new Uint8Array(out).subarray(0, 5);
}

/** The AEAD nonce: the IV XORed with the packet number, right-aligned (RFC 9001 §5.3). */
export function nonceFor(iv: Uint8Array, pn: number): Uint8Array {
  const nonce = iv.slice();
  for (let i = 0; i < 6; i++) {
    const at = nonce.length - 1 - i;
    nonce[at] = (nonce[at] ?? 0) ^ (Math.floor(pn / 256 ** i) & 0xff);
  }
  return nonce;
}

async function gcmKey(key: Uint8Array, use: "encrypt" | "decrypt") {
  return crypto.subtle.importKey("raw", buf(key), "AES-GCM", false, [use]);
}

/** A QUIC long header's layout (RFC 9000 §17.2), up to where the packet number starts. */
export interface LongHeader {
  first: number;
  version: number;
  dcid: Uint8Array;
  scid: Uint8Array;
  /** Initial only: the token, empty unless the server sent a Retry or a NEW_TOKEN earlier. */
  token?: Uint8Array;
  /** The Length field: packet number plus protected payload. */
  length?: number;
  /** Offsets from the packet's start. */
  dcidAt: number;
  scidAt: number;
  tokenAt?: number;
  lengthAt?: number;
  pnAt?: number;
  /** Where the packet ends, from the packet's start (the next coalesced packet begins here). */
  end?: number;
}

/** The packet types of a long header, by version: v2 (RFC 9369) moved them round so v1 parsers notice. */
export function longType(
  first: number,
  version: number,
): "Initial" | "0-RTT" | "Handshake" | "Retry" {
  const bits = (first >> 4) & 0x03;
  const v1 = ["Initial", "0-RTT", "Handshake", "Retry"] as const;
  const v2 = ["Retry", "Initial", "0-RTT", "Handshake"] as const;
  return (version === 0x6b3343cf ? v2 : v1)[bits] ?? "Initial";
}

export function parseLong(packet: Uint8Array): LongHeader {
  const s = new Src(packet);
  const first = s.u8(0);
  const version = s.u32(1);
  const dcidLen = s.u8(5);
  const dcidAt = 6;
  const dcid = s.bytes(dcidAt, dcidLen);
  const scidAt = dcidAt + dcidLen + 1;
  const scid = s.bytes(scidAt, s.u8(scidAt - 1));
  const out: LongHeader = { first, version, dcid, scid, dcidAt, scidAt };
  if (version === 0) return out;
  const type = longType(first, version);
  if (type === "Retry") return out;
  let at = scidAt + scid.length;
  if (type === "Initial") {
    const tl = s.varint(at);
    out.tokenAt = at;
    out.token = s.bytes(at + tl.size, tl.value);
    at += tl.size + tl.value;
  }
  const len = s.varint(at);
  out.lengthAt = at;
  out.length = len.value;
  out.pnAt = at + len.size;
  out.end = out.pnAt + len.value;
  return out;
}

export interface Opened {
  header: LongHeader;
  /** The first byte with its protection removed: the packet number length is in its low two bits. */
  first: number;
  pn: number;
  pnLength: number;
  /** The decrypted frames; byte i came from the ciphertext at `payloadAt + i`. */
  plaintext: Uint8Array;
  payloadAt: number;
  /** The packet with header protection removed and the payload decrypted (the tag kept as it was). */
  plain: Uint8Array;
}

/** Remove header protection and decrypt one Initial packet. `packet` starts at its first byte and may run on. */
export async function openInitial(packet: Uint8Array, keys: InitialKeys): Promise<Opened | string> {
  let header: LongHeader;
  try {
    header = parseLong(packet);
  } catch {
    return "The long header is cut short.";
  }
  const { pnAt, end } = header;
  if (pnAt === undefined || end === undefined) return "Not an Initial packet.";
  if (end > packet.length) return "The packet's Length runs past the datagram: it was cut short.";
  if (pnAt + 4 + 16 > end) return "Too short to carry a header protection sample.";
  const mask = await hpMask(keys.hp, packet.subarray(pnAt + 4, pnAt + 20));
  const first = (packet[0] ?? 0) ^ ((mask[0] ?? 0) & 0x0f);
  const pnLength = (first & 0x03) + 1;
  const plainHeader = packet.slice(0, pnAt + pnLength);
  plainHeader[0] = first;
  let pn = 0;
  for (let i = 0; i < pnLength; i++) {
    const byte = (packet[pnAt + i] ?? 0) ^ (mask[1 + i] ?? 0);
    plainHeader[pnAt + i] = byte;
    pn = pn * 256 + byte;
  }
  const payloadAt = pnAt + pnLength;
  try {
    const k = await gcmKey(keys.key, "decrypt");
    const out = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: buf(nonceFor(keys.iv, pn)),
        additionalData: buf(plainHeader),
        tagLength: 128,
      },
      k,
      buf(packet.subarray(payloadAt, end)),
    );
    const plaintext = new Uint8Array(out);
    const plain = packet.slice(0, end);
    plain.set(plainHeader, 0);
    plain.set(plaintext, payloadAt);
    return { header, first, pn, pnLength, plaintext, payloadAt, plain };
  } catch {
    return "The authentication tag did not verify: these are not this connection's Initial keys, or the packet is damaged.";
  }
}

/**
 * Protect one Initial packet: `header` is the unprotected header ending with the packet number, whose Length field
 * already counts the 16-byte tag. Encrypt, then sample the ciphertext and mask the header (RFC 9001 §5.4.1).
 */
export async function sealInitial(
  header: Uint8Array,
  pnLength: number,
  pn: number,
  payload: Uint8Array,
  keys: InitialKeys,
): Promise<Uint8Array> {
  const k = await gcmKey(keys.key, "encrypt");
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: buf(nonceFor(keys.iv, pn)),
        additionalData: buf(header),
        tagLength: 128,
      },
      k,
      buf(payload),
    ),
  );
  const out = new Uint8Array(header.length + sealed.length);
  out.set(header, 0);
  out.set(sealed, header.length);
  const pnAt = header.length - pnLength;
  const mask = await hpMask(keys.hp, out.subarray(pnAt + 4, pnAt + 20));
  out[0] = (out[0] ?? 0) ^ ((mask[0] ?? 0) & 0x0f);
  for (let i = 0; i < pnLength; i++) out[pnAt + i] = (out[pnAt + i] ?? 0) ^ (mask[1 + i] ?? 0);
  return out;
}
