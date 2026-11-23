/**
 * Writing capture files: classic pcap (microsecond or nanosecond timestamps, little-endian, as tcpdump on x86 and
 * Apple silicon writes it) and pcapng (one section, one interface, enhanced packet blocks, as Wireshark writes it).
 * The bundled captures go through these and back through the reader, so both formats are exercised end to end.
 */
import { LINK } from "../read";

export interface Frame {
  /** Seconds since the Unix epoch. */
  time: number;
  data: Uint8Array;
}

export function writePcap(frames: Frame[], { nano = false } = {}): Uint8Array {
  const size = 24 + frames.reduce((n, f) => n + 16 + f.data.length, 0);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint32(0, nano ? 0xa1b23c4d : 0xa1b2c3d4, true);
  v.setUint16(4, 2, true);
  v.setUint16(6, 4, true);
  v.setUint32(16, 262144, true);
  v.setUint32(20, LINK.ETHERNET, true);
  let at = 24;
  for (const f of frames) {
    const sec = Math.floor(f.time);
    const frac = Math.round((f.time - sec) * (nano ? 1e9 : 1e6));
    v.setUint32(at, sec, true);
    v.setUint32(at + 4, frac, true);
    v.setUint32(at + 8, f.data.length, true);
    v.setUint32(at + 12, f.data.length, true);
    out.set(f.data, at + 16);
    at += 16 + f.data.length;
  }
  return out;
}

const pad4 = (n: number) => Math.ceil(n / 4) * 4;

export function writePcapng(frames: Frame[], { iface = "en0" } = {}): Uint8Array {
  const name = new TextEncoder().encode(iface);
  const idbOptions = 4 + pad4(name.length) + 4 + 4 + 4; // if_name, if_tsresol (padded), opt_endofopt
  const idb = 20 + idbOptions;
  const shb = 28;
  const size = shb + idb + frames.reduce((n, f) => n + 32 + pad4(f.data.length), 0);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  // Section header: type, length, byte-order magic, version 1.0, section length unknown (-1).
  v.setUint32(0, 0x0a0d0d0a, true);
  v.setUint32(4, shb, true);
  v.setUint32(8, 0x1a2b3c4d, true);
  v.setUint16(12, 1, true);
  v.setUint16(14, 0, true);
  v.setInt32(16, -1, true);
  v.setInt32(20, -1, true);
  v.setUint32(24, shb, true);
  // Interface description: Ethernet, snap length, if_name and if_tsresol = 6 (microseconds).
  let at = shb;
  v.setUint32(at, 1, true);
  v.setUint32(at + 4, idb, true);
  v.setUint16(at + 8, LINK.ETHERNET, true);
  v.setUint32(at + 12, 262144, true);
  let o = at + 16;
  v.setUint16(o, 2, true);
  v.setUint16(o + 2, name.length, true);
  out.set(name, o + 4);
  o += 4 + pad4(name.length);
  v.setUint16(o, 9, true);
  v.setUint16(o + 2, 1, true);
  out[o + 4] = 6;
  o += 8;
  v.setUint32(o, 0, true);
  v.setUint32(at + idb - 4, idb, true);
  at += idb;
  for (const f of frames) {
    const len = 32 + pad4(f.data.length);
    const ts = Math.round(f.time * 1e6);
    v.setUint32(at, 6, true);
    v.setUint32(at + 4, len, true);
    v.setUint32(at + 8, 0, true);
    v.setUint32(at + 12, Math.floor(ts / 2 ** 32), true);
    v.setUint32(at + 16, ts % 2 ** 32, true);
    v.setUint32(at + 20, f.data.length, true);
    v.setUint32(at + 24, f.data.length, true);
    out.set(f.data, at + 28);
    v.setUint32(at + len - 4, len, true);
    at += len;
  }
  return out;
}
