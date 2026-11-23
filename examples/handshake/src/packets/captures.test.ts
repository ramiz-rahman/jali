/**
 * The bundled captures: each is generated, written as a capture file and read back through the same reader and
 * dissectors as a file someone opens. Every mark the lessons use must land on the packet it names.
 */
import { byteIndex } from "./fields";
import { CAPTURES, captureMark, captureState, captureStore, openCaptureFile } from "./captures";
import { writePcap } from "./generate/write";
import { ready } from "./testing";
import type { Packet } from "./types";

async function marked(id: string, mark: string): Promise<Packet> {
  const n = captureMark(id, mark);
  if (n === undefined) throw new Error(`${id} has no mark ${mark}`);
  const p = (await ready(id)).packets[n - 1];
  if (!p) throw new Error(`${id}#${mark} points past the end`);
  return p;
}

const REQUIRED: Record<string, string[]> = {
  "home-lan": [
    "arp-request",
    "arp-reply",
    "dhcp-discover",
    "dhcp-offer",
    "dhcp-request",
    "dhcp-ack",
  ],
  dns: ["query-a", "response-a", "query-https", "response-https"],
  "tcp-lifecycle": [
    "syn",
    "syn-ack",
    "ack",
    "request",
    "response-first",
    "dup-ack",
    "retransmission",
    "window-update",
    "fin",
    "last-ack",
  ],
  tls13: ["syn", "client-hello", "server-hello", "change-cipher-spec", "first-encrypted"],
  "quic-h3": ["client-initial", "server-initial", "handshake", "first-1rtt"],
  traceroute: ["ttl-1", "exceeded-1", "ttl-2", "exceeded-2", "final-reply"],
};

describe("bundled captures", () => {
  it("lists the six, each with a title and a summary", () => {
    expect(CAPTURES.map((c) => c.id)).toEqual(Object.keys(REQUIRED));
    for (const c of CAPTURES) expect(c.summary.length).toBeGreaterThan(100);
  });

  it.each(Object.entries(REQUIRED))(
    "%s has every required mark, read back without warnings or bad checksums",
    async (id, marks) => {
      const capture = await ready(id);
      expect(capture.madeUp).toBe(true);
      expect(capture.warnings).toEqual([]);
      for (const mark of marks) expect(captureMark(id, mark)).toBeGreaterThan(0);
      // Real bytes: every checksum the dissectors check comes out correct, and nothing is cut short.
      for (const p of capture.packets) {
        const bad = [...byteIndex(p).byId.values()].filter((f) => f.warn && !p.analysis.length);
        expect(bad.map((f) => `#${p.n} ${f.id}`)).toEqual([]);
      }
    },
  );

  it("is the same every time", async () => {
    const first = (await ready("tls13")).packets.map((p) => p.info);
    expect(first[3]).toBe("Client Hello (SNI=www.example.com)");
    expect(captureMark("tls13", "client-hello")).toBe(4);
  });

  it("answers undefined for an unknown capture or mark", () => {
    expect(captureMark("tls13", "nope")).toBeUndefined();
    expect(captureMark("file-abc", "syn")).toBeUndefined();
  });
});

describe("marks land on what they name", () => {
  it("home-lan: DORA, then ARP", async () => {
    for (const [mark, type] of [
      ["dhcp-discover", "Discover"],
      ["dhcp-offer", "Offer"],
      ["dhcp-request", "Request"],
      ["dhcp-ack", "ACK"],
    ]) {
      expect((await marked("home-lan", mark ?? "")).info).toMatch(new RegExp(`^DHCP ${type} `));
    }
    expect((await marked("home-lan", "arp-request")).info).toBe(
      "Who has 192.168.1.1? Tell 192.168.1.23",
    );
    expect((await marked("home-lan", "arp-reply")).info).toMatch(/^192\.168\.1\.1 is at /);
  });

  it("dns: the HTTPS record says alpn=h3,h2", async () => {
    expect((await marked("dns", "query-a")).info).toMatch(
      /^Standard query 0x[0-9a-f]+ A www\.example\.com$/,
    );
    expect((await marked("dns", "response-a")).info).toMatch(/A 192\.0\.2\.80$/);
    expect((await marked("dns", "query-https")).info).toMatch(/HTTPS www\.example\.com$/);
    expect((await marked("dns", "response-https")).info).toMatch(/alpn=h3,h2/);
  });

  it("tcp-lifecycle: the handshake, the loss and its recovery, the close", async () => {
    const id = "tcp-lifecycle";
    expect((await marked(id, "syn")).info).toMatch(
      /\[SYN\] Seq=0 .*MSS=1460 SACK_PERM TSval=\d+ TSecr=0 WS=128$/,
    );
    expect((await marked(id, "syn-ack")).info).toMatch(/\[SYN, ACK\] Seq=0 Ack=1/);
    expect((await marked(id, "ack")).info).toMatch(/\[ACK\] Seq=1 Ack=1 /);
    expect((await marked(id, "request")).info).toMatch(/^GET \/reports\/.* HTTP\/1\.1$/);
    expect((await marked(id, "response-first")).info).toBe("HTTP/1.1 200 OK");
    expect((await marked(id, "dup-ack")).analysis.map((a) => a.kind)).toEqual(["dup-ack"]);
    expect((await marked(id, "retransmission")).analysis.map((a) => a.kind)).toEqual([
      "fast-retransmission",
    ]);
    expect((await marked(id, "window-update")).analysis.map((a) => a.kind)).toEqual([
      "window-update",
    ]);
    expect((await marked(id, "fin")).info).toMatch(/\[FIN, ACK\]/);
    const last = await marked(id, "last-ack");
    expect(last.info).toMatch(/\[ACK\]/);
    expect(last.n).toBe((await ready(id)).packets.length);
  });

  it("tls13: hello, hello, CCS, then ciphertext", async () => {
    expect((await marked("tls13", "syn")).info).toMatch(/\[SYN\]/);
    expect((await marked("tls13", "client-hello")).info).toBe("Client Hello (SNI=www.example.com)");
    const sh = await marked("tls13", "server-hello");
    expect(sh.info).toBe("Server Hello");
    expect(sh.protocol).toBe("TLSv1.3");
    expect((await marked("tls13", "change-cipher-spec")).info).toBe("Change Cipher Spec");
    const enc = await marked("tls13", "first-encrypted");
    expect(enc.info).toBe("Application Data");
    expect(byteIndex(enc).layer.at(-1)).toBe("crypt");
  });

  it("quic-h3: the client Initial really decrypts", async () => {
    const ci = await marked("quic-h3", "client-initial");
    expect(ci.plain).toBeDefined();
    expect(ci.info).toMatch(
      /^Initial, .*PKN: 0, CRYPTO, PADDING · Client Hello \(SNI=www\.example\.com\)$/,
    );
    expect(ci.wireLength - 14 - 20 - 8).toBeGreaterThanOrEqual(1200);
    const all = [...byteIndex(ci).byId.values()];
    expect(
      all.find((f) => f.name === "Extension: application_layer_protocol_negotiation")?.value,
    ).toBe("h3");
    expect(all.find((f) => f.name === "initial_source_connection_id")).toBeDefined();
    expect((await marked("quic-h3", "server-initial")).info).toMatch(
      /^Initial, .*ACK, CRYPTO · Server Hello; Handshake, /,
    );
    expect((await marked("quic-h3", "handshake")).info).toMatch(/^Handshake, /);
    expect((await marked("quic-h3", "first-1rtt")).info).toMatch(/^Protected Payload, DCID=/);
  });

  it("traceroute: probes by TTL, routers' time exceeded, the target's port unreachable", async () => {
    const t1 = await marked("traceroute", "ttl-1");
    expect(byteIndex(t1).byId.get("ip.ttl")?.value).toBe("1");
    const e1 = await marked("traceroute", "exceeded-1");
    expect(e1.src).toBe("192.168.1.1");
    expect(e1.info).toMatch(/^Time-to-live exceeded/);
    expect(byteIndex(await marked("traceroute", "ttl-2")).byId.get("ip.ttl")?.value).toBe("2");
    expect((await marked("traceroute", "exceeded-2")).src).toBe("198.51.100.1");
    const last = await marked("traceroute", "final-reply");
    expect(last.info).toBe("Destination unreachable (Port unreachable)");
    expect(last.src).toBe("192.0.2.80");
  });
});

describe("opening a file", () => {
  it("names it by its bytes, so the same file lands on the same id", async () => {
    const bytes = writePcap([
      { time: 1, data: Uint8Array.from({ length: 60 }, (_, i) => (i < 12 ? 0xaa : 0)) },
    ]);
    const file = new File([bytes.slice().buffer], "mine.pcap");
    const id = await openCaptureFile(file);
    expect(id).toMatch(/^file-[0-9a-f]{12}$/);
    expect(await openCaptureFile(file)).toBe(id);
    const capture = await ready(id);
    expect(capture).toMatchObject({ madeUp: false, fileName: "mine.pcap", format: "pcap" });
  });

  it("refuses a file that isn't a capture, with the reason", async () => {
    await expect(openCaptureFile(new File(["not a capture"], "notes.txt"))).rejects.toThrow(
      /not a pcap or pcapng/,
    );
  });

  it("reports a file from an earlier session as missing, not failed", () => {
    expect(captureState(captureStore.get(), "file-000000000000").status).toBe("missing");
  });
});
