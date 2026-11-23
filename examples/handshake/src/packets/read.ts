/**
 * Reading a capture file: classic pcap (either byte order, microsecond or nanosecond timestamps) and pcapng
 * (Wireshark's default: section headers, interfaces, enhanced and simple packet blocks, several interfaces). A file
 * that is not one of these, or is broken, fails with a `CaptureError` that says what is wrong; a file cut off in the
 * middle of a packet keeps the packets before it, with a warning.
 */

export class CaptureError extends Error {}

/** The link types the dissectors read (tcpdump.org/linktypes.html). */
export const LINK = {
  NULL: 0,
  ETHERNET: 1,
  RAW: 101,
  LOOP: 108,
  SLL: 113,
  IPV4: 228,
  IPV6: 229,
  SLL2: 276,
} as const;

const LINK_NAMES: Record<number, string> = {
  [LINK.NULL]: "BSD loopback",
  [LINK.ETHERNET]: "Ethernet",
  [LINK.RAW]: "Raw IP",
  [LINK.LOOP]: "OpenBSD loopback",
  [LINK.SLL]: "Linux cooked (SLL)",
  [LINK.IPV4]: "Raw IPv4",
  [LINK.IPV6]: "Raw IPv6",
  [LINK.SLL2]: "Linux cooked v2 (SLL2)",
  105: "802.11 Wi-Fi",
  127: "802.11 + radiotap",
};

export const linkName = (type: number) => LINK_NAMES[type] ?? `link type ${type}`;

export interface RawFrame {
  /** Seconds since the Unix epoch. */
  time: number;
  data: Uint8Array;
  wireLength: number;
  linkType: number;
  iface?: string;
}

export interface RawCapture {
  format: "pcap" | "pcapng";
  frames: RawFrame[];
  warnings: string[];
}

/** A single packet larger than this is a corrupt length, not a packet (jumbo frames are 9 KB; tcpdump's snaplen 256 KB). */
const MAX_PACKET = 262_144;

export function readCapture(bytes: Uint8Array): RawCapture {
  if (bytes.length < 4) throw new CaptureError("The file is empty or too short to be a capture.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, false);
  if (magic === 0x0a0d0d0a) return readPcapng(bytes, view);
  if ([0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1].includes(magic))
    return readPcap(bytes, view);
  // Common wrong files, named, so the message helps.
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head.startsWith("PK"))
    throw new CaptureError("This is a zip file. Unzip it and open the .pcap inside.");
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    throw new CaptureError("This is gzip-compressed. Decompress it (gunzip) and open the .pcap.");
  }
  throw new CaptureError(
    "This is not a pcap or pcapng file: it does not start with either format's magic number.",
  );
}

function readPcap(bytes: Uint8Array, view: DataView): RawCapture {
  if (bytes.length < 24)
    throw new CaptureError("The pcap header is cut short: the file is under 24 bytes.");
  const be = view.getUint32(0, false);
  const little = be === 0xd4c3b2a1 || be === 0x4d3cb2a1;
  const nano = be === 0xa1b23c4d || be === 0x4d3cb2a1;
  const u32 = (at: number) => view.getUint32(at, little);
  // The top bits of the link type field carry FCS information (pcap's LINKTYPE_* with flags); the type is the low 28.
  const linkType = u32(20) & 0x0fffffff;
  const frames: RawFrame[] = [];
  const warnings: string[] = [];
  let at = 24;
  while (at < bytes.length) {
    if (at + 16 > bytes.length) {
      warnings.push(
        `The file ends inside packet ${frames.length + 1}'s record header; it was left out.`,
      );
      break;
    }
    const sec = u32(at);
    const frac = u32(at + 4);
    const caplen = u32(at + 8);
    const wire = u32(at + 12);
    if (caplen > MAX_PACKET) {
      throw new CaptureError(
        `Packet ${frames.length + 1} claims ${caplen.toLocaleString("en")} bytes: the file is corrupt from there.`,
      );
    }
    if (at + 16 + caplen > bytes.length) {
      warnings.push(
        `The file ends in the middle of packet ${frames.length + 1}; it was left out. Was the capture still being written?`,
      );
      break;
    }
    frames.push({
      time: sec + frac / (nano ? 1e9 : 1e6),
      data: bytes.subarray(at + 16, at + 16 + caplen),
      wireLength: Math.max(wire, caplen),
      linkType,
    });
    at += 16 + caplen;
  }
  return { format: "pcap", frames, warnings };
}

interface Iface {
  linkType: number;
  /** Seconds per timestamp unit. */
  unit: number;
  name?: string;
  snaplen: number;
}

function readPcapng(bytes: Uint8Array, view: DataView): RawCapture {
  const frames: RawFrame[] = [];
  const warnings: string[] = [];
  let little = true;
  // Interface ids count from 0 within each section; a new section header starts the list again.
  let ifaces: Iface[] = [];
  let at = 0;
  while (at < bytes.length) {
    if (at + 12 > bytes.length) {
      warnings.push("The file ends inside a block header; the rest was left out.");
      break;
    }
    const type = view.getUint32(at, little);
    if (type === 0x0a0d0d0a) {
      // The section header sets the byte order for everything up to the next one.
      if (at + 28 > bytes.length) throw new CaptureError("The pcapng section header is cut short.");
      const order = view.getUint32(at + 8, false);
      if (order === 0x1a2b3c4d) little = false;
      else if (order === 0x4d3c2b1a) little = true;
      else
        throw new CaptureError(
          "The pcapng section header has an unknown byte-order magic: the file is corrupt.",
        );
      ifaces = [];
    }
    const length = view.getUint32(at + 4, little);
    if (length < 12 || length % 4 !== 0) {
      throw new CaptureError(
        `A pcapng block at byte ${at} has an impossible length (${length}): the file is corrupt.`,
      );
    }
    if (at + length > bytes.length) {
      warnings.push(
        `The file ends in the middle of a block at byte ${at}; it was left out. Was it still being written?`,
      );
      break;
    }
    const body = at + 8;
    const end = at + length - 4;
    const u32 = (o: number) => view.getUint32(o, little);
    const u16 = (o: number) => view.getUint16(o, little);

    if (type === 1) {
      // Interface description: link type, snap length, then options (name, timestamp resolution).
      const iface: Iface = { linkType: u16(body), snaplen: u32(body + 4), unit: 1e-6 };
      for (const [code, value] of options(bytes, body + 8, end, u16)) {
        if (code === 2) iface.name = new TextDecoder().decode(value);
        if (code === 9 && value.length >= 1) {
          const r = value[0] ?? 6;
          iface.unit = r & 0x80 ? 2 ** -(r & 0x7f) : 10 ** -r;
        }
      }
      ifaces.push(iface);
    } else if (type === 6 || type === 2) {
      // Enhanced packet block (6), or the obsolete packet block (2) whose interface id is 16 bits.
      const id = type === 6 ? u32(body) : u16(body);
      const iface = ifaces[id];
      if (!iface)
        throw new CaptureError(`A packet names interface ${id}, which the file never described.`);
      const ts = u32(body + 4) * 2 ** 32 + u32(body + 8);
      const caplen = u32(body + 12);
      const wire = u32(body + 16);
      if (caplen > MAX_PACKET || body + 20 + caplen > end) {
        throw new CaptureError(
          `Packet ${frames.length + 1}'s length runs past its block: the file is corrupt.`,
        );
      }
      frames.push({
        time: ts * iface.unit,
        data: bytes.subarray(body + 20, body + 20 + caplen),
        wireLength: Math.max(wire, caplen),
        linkType: iface.linkType,
        iface: iface.name,
      });
    } else if (type === 3) {
      // Simple packet block: no timestamp and no interface id (always the first); its captured length is what fits.
      const iface = ifaces[0];
      if (!iface)
        throw new CaptureError("A simple packet block comes before any interface is described.");
      const wire = u32(body);
      const caplen = Math.min(wire, end - (body + 4), iface.snaplen || wire);
      frames.push({
        time: frames.at(-1)?.time ?? 0,
        data: bytes.subarray(body + 4, body + 4 + caplen),
        wireLength: wire,
        linkType: iface.linkType,
        iface: iface.name,
      });
    }
    // Other blocks (name resolution, interface statistics, decryption secrets, custom) carry no packets.
    at += length;
  }
  if (frames.some((f) => f.time === 0) && frames.some((f) => f.time !== 0)) {
    warnings.push(
      "Some packets came in simple packet blocks, which carry no timestamp; they take the one before.",
    );
  }
  return { format: "pcapng", frames, warnings };
}

/** A block's options: code, length, value, padded to 32 bits, until opt_endofopt or the block's end. */
function* options(bytes: Uint8Array, from: number, end: number, u16: (o: number) => number) {
  let at = from;
  while (at + 4 <= end) {
    const code = u16(at);
    const length = u16(at + 2);
    if (code === 0) return;
    if (at + 4 + length > end) return;
    yield [code, bytes.subarray(at + 4, at + 4 + length)] as const;
    at += 4 + Math.ceil(length / 4) * 4;
  }
}
