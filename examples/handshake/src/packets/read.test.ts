/** Reading capture files: both pcap byte orders and resolutions, pcapng's blocks, and broken files said plainly. */
import { CaptureError, LINK, readCapture } from "./read";
import { writePcap, writePcapng } from "./generate/write";

const frame = (n: number) => Uint8Array.from({ length: n }, (_, i) => i & 0xff);

/** A classic pcap header and records, written by hand in either byte order. */
function pcap(
  { little, nano }: { little: boolean; nano: boolean },
  records: [number, number, Uint8Array][],
) {
  const size = 24 + records.reduce((n, [, , d]) => n + 16 + d.length, 0);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint32(0, nano ? 0xa1b23c4d : 0xa1b2c3d4, little);
  v.setUint16(4, 2, little);
  v.setUint16(6, 4, little);
  v.setUint32(16, 65535, little);
  v.setUint32(20, LINK.RAW, little);
  let at = 24;
  for (const [sec, frac, d] of records) {
    v.setUint32(at, sec, little);
    v.setUint32(at + 4, frac, little);
    v.setUint32(at + 8, d.length, little);
    v.setUint32(at + 12, d.length + 10, little);
    out.set(d, at + 16);
    at += 16 + d.length;
  }
  return out;
}

describe("classic pcap", () => {
  it.each([
    ["little-endian, microseconds", true, false, 250_000, 0.25],
    ["big-endian, microseconds", false, false, 500_000, 0.5],
    ["little-endian, nanoseconds", true, true, 125_000_000, 0.125],
    ["big-endian, nanoseconds", false, true, 1, 1e-9],
  ])("reads %s", (_, little, nano, frac, seconds) => {
    const raw = readCapture(pcap({ little, nano }, [[1_700_000_000, frac, frame(40)]]));
    expect(raw.format).toBe("pcap");
    expect(raw.frames).toHaveLength(1);
    expect(raw.frames[0]?.time).toBeCloseTo(1_700_000_000 + seconds, 9);
    expect(raw.frames[0]?.linkType).toBe(LINK.RAW);
    expect(raw.frames[0]?.wireLength).toBe(50);
  });

  it("keeps the packets before a record cut off at the end, and says so", () => {
    const whole = pcap({ little: true, nano: false }, [
      [1, 0, frame(60)],
      [2, 0, frame(60)],
    ]);
    const raw = readCapture(whole.subarray(0, whole.length - 20));
    expect(raw.frames).toHaveLength(1);
    expect(raw.warnings[0]).toMatch(/ends in the middle of packet 2/);
  });

  it("refuses a record length no packet has", () => {
    const bad = pcap({ little: true, nano: false }, [[1, 0, frame(60)]]);
    new DataView(bad.buffer).setUint32(24 + 8, 10_000_000, true);
    expect(() => readCapture(bad)).toThrow(/claims 10,000,000 bytes/);
  });
});

describe("pcapng", () => {
  it("reads what writePcapng writes: interface name, microsecond times", () => {
    const raw = readCapture(
      writePcapng([{ time: 1_800_000_000.123456, data: frame(64) }], { iface: "en0" }),
    );
    expect(raw.format).toBe("pcapng");
    expect(raw.frames[0]?.iface).toBe("en0");
    expect(raw.frames[0]?.time).toBeCloseTo(1_800_000_000.123456, 6);
    expect(raw.frames[0]?.data).toEqual(frame(64));
  });

  it("reads several interfaces, nanosecond resolution and a simple packet block", () => {
    // Little-endian 32- and 16-bit words, block by block.
    const w32 = (...v: number[]) =>
      v.flatMap((x) => [x & 0xff, (x >>> 8) & 0xff, (x >>> 16) & 0xff, x >>> 24]);
    const w16 = (...v: number[]) => v.flatMap((x) => [x & 0xff, x >> 8]);
    const ts = 2_000_000_005;
    const blocks = [
      // Section header.
      ...w32(0x0a0d0d0a, 28, 0x1a2b3c4d),
      ...w16(1, 0),
      ...w32(0xffffffff, 0xffffffff, 28),
      // Interface 0: Ethernet, no options. Interface 1: raw IP, if_tsresol = 9 (nanoseconds).
      ...w32(1, 20),
      ...w16(LINK.ETHERNET, 0),
      ...w32(0, 20),
      ...w32(1, 32),
      ...w16(LINK.RAW, 0),
      ...w32(0),
      ...w16(9, 1),
      ...w32(9, 0, 32),
      // An enhanced packet on interface 1 at 2 s + 5 ns, 4 bytes.
      ...w32(6, 36, 1, Math.floor(ts / 2 ** 32), ts % 2 ** 32, 4, 4, 0xdeadbeef, 36),
      // A simple packet block (interface 0) of 4 bytes.
      ...w32(3, 20, 4, 0xcafebabe, 20),
    ];
    const raw = readCapture(Uint8Array.from(blocks));
    expect(raw.frames).toHaveLength(2);
    expect(raw.frames[0]?.linkType).toBe(LINK.RAW);
    expect(raw.frames[0]?.time).toBeCloseTo(2.000000005, 9);
    expect(raw.frames[1]?.linkType).toBe(LINK.ETHERNET);
    expect(raw.frames[1]?.data).toEqual(Uint8Array.of(0xbe, 0xba, 0xfe, 0xca));
  });

  it("refuses a packet on an interface the file never described", () => {
    const file = writePcapng([{ time: 1, data: frame(8) }]);
    // The packet block's interface id sits 8 bytes into it, after the section (28) and interface blocks.
    const idb = new DataView(file.buffer).getUint32(28 + 4, true);
    new DataView(file.buffer).setUint32(28 + idb + 8, 3, true);
    expect(() => readCapture(file)).toThrow(/interface 3/);
  });
});

describe("files that are not captures", () => {
  it.each([
    ["an empty file", new Uint8Array(0), /empty/],
    ["a zip", Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0]), /zip/],
    ["gzip", Uint8Array.from([0x1f, 0x8b, 8, 0, 0, 0]), /gzip/],
    ["text", new TextEncoder().encode("hello, world"), /not a pcap or pcapng/],
  ])("explains %s", (_, bytes, message) => {
    expect(() => readCapture(bytes)).toThrow(CaptureError);
    expect(() => readCapture(bytes)).toThrow(message);
  });

  it("round-trips its own pcap writer, nanoseconds included", () => {
    const raw = readCapture(writePcap([{ time: 10.000000123, data: frame(20) }], { nano: true }));
    expect(raw.frames[0]?.time).toBeCloseTo(10.000000123, 9);
  });
});
