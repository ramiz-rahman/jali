/**
 * Every dissector, on packets built byte by byte with the generator's builders: what each field reads, where its
 * bytes are, and that broken or cut packets are marked rather than fatal. The RFC 9001 client Initial is decrypted
 * and its ClientHello read, inside a real UDP datagram.
 */
import { byteIndex } from "../fields";
import { fromHex } from "../quic-crypto";
import { CLIENT_INITIAL } from "../fixtures/rfc9001";
import { LINK } from "../read";
import type { Packet } from "../types";
import {
  arp,
  BROADCAST,
  clientHello,
  dhcp,
  dns,
  ethernet,
  icmpError,
  icmpv6,
  ipOpt,
  ipv4,
  ipv6,
  ndLla,
  rng,
  tcp,
  TCPF,
  tlsRecord,
  udp,
  W,
} from "../generate/build";
import { dissectAll } from "./index";

const A = "3c:22:fb:4a:9e:01";
const B = "50:c7:bf:12:7c:10";

async function dissect(frames: Uint8Array[], linkType: number = LINK.ETHERNET): Promise<Packet[]> {
  return dissectAll(
    frames.map((data, i) => ({ time: 100 + i * 0.01, data, wireLength: data.length, linkType })),
  );
}

async function one(frame: Uint8Array, linkType: number = LINK.ETHERNET): Promise<Packet> {
  const [p] = await dissect([frame], linkType);
  if (!p) throw new Error("no packet");
  return p;
}

const field = (p: Packet, id: string) => {
  const f = byteIndex(p).byId.get(id);
  if (!f) throw new Error(`No field ${id} in ${[...byteIndex(p).byId.keys()].join(", ")}`);
  return f;
};

const v4udp = (
  payload: Uint8Array,
  sport: number,
  dport: number,
  src = "192.168.1.23",
  dst = "192.168.1.1",
) =>
  ethernet(
    B,
    A,
    0x0800,
    ipv4({ src, dst, proto: 17, ttl: 64, id: 1 }, udp(src, dst, sport, dport, payload)),
  );

describe("link layer", () => {
  it("reads Ethernet addresses and flags a locally administered one", async () => {
    const p = await one(
      ethernet(
        B,
        "3e:22:fb:4a:9e:01",
        0x0806,
        arp(1, "3e:22:fb:4a:9e:01", "192.168.1.23", "00:00:00:00:00:00", "192.168.1.1"),
      ),
    );
    expect(field(p, "eth.src").value).toMatch(/locally administered/);
    expect(field(p, "eth.dst")).toMatchObject({ offset: 0, length: 6 });
    expect(field(p, "eth.padding").length).toBe(60 - 42);
  });

  it("walks past an 802.1Q tag to the EtherType", async () => {
    const inner = ipv4(
      { src: "10.0.0.1", dst: "10.0.0.2", proto: 1, ttl: 64, id: 2 },
      new W().u8(8, 0).u16(0xf7ff).u32(0).out(),
    );
    const tagged = new W()
      .bytes(fromHex("50c7bf127c10" + "3c22fb4a9e01"))
      .u16(0x8100)
      .u16((5 << 13) | 20)
      .u16(0x0800)
      .bytes(inner)
      .out();
    const p = await one(tagged);
    expect(p.protos.has("vlan")).toBe(true);
    expect(field(p, "eth.vlan12").value).toBe("VLAN 20, priority 5");
    expect(p.protocol).toBe("ICMP");
  });

  it("reads Linux cooked v1 and v2 headers", async () => {
    const ip = ipv4(
      { src: "10.0.0.1", dst: "10.0.0.2", proto: 17, ttl: 64, id: 3 },
      udp("10.0.0.1", "10.0.0.2", 5000, 6000, new Uint8Array(4)),
    );
    const sll = new W()
      .u16(4)
      .u16(1)
      .u16(6)
      .bytes(fromHex("3c22fb4a9e010000"))
      .u16(0x0800)
      .bytes(ip)
      .out();
    const sll2 = new W()
      .u16(0x0800)
      .u16(0)
      .u32(3)
      .u16(1)
      .u8(0, 6)
      .bytes(fromHex("3c22fb4a9e010000"))
      .bytes(ip)
      .out();
    const v1 = await one(sll, LINK.SLL);
    const v2 = await one(sll2, LINK.SLL2);
    expect(v1.headers.map((h) => h.short)).toEqual(["Frame", "SLL", "IPv4", "UDP", "Data"]);
    expect(field(v1, "sll.pkttype").value).toBe("Sent by us");
    expect(field(v2, "sll.ifindex").value).toBe("3");
    expect(v2.flow).toMatchObject({ src: "10.0.0.1", sport: 5000, dport: 6000 });
  });

  it("reads raw IP with no link header", async () => {
    const p = await one(
      ipv6({ src: "2001:db8::1", dst: "2001:db8::2", next: 59, hlim: 64 }, new Uint8Array(0)),
      LINK.RAW,
    );
    expect(p.src).toBe("2001:db8::1");
  });
});

describe("ARP", () => {
  it("asks and answers in Wireshark's words", async () => {
    const [ask, answer] = await dissect([
      ethernet(BROADCAST, A, 0x0806, arp(1, A, "192.168.1.23", "00:00:00:00:00:00", "192.168.1.1")),
      ethernet(A, B, 0x0806, arp(2, B, "192.168.1.1", A, "192.168.1.23")),
    ]);
    expect(ask?.info).toBe("Who has 192.168.1.1? Tell 192.168.1.23");
    expect(answer?.info).toBe(`192.168.1.1 is at ${B}`);
    expect(ask && field(ask, "arp.tpa")).toMatchObject({
      value: "192.168.1.1",
      offset: 14 + 24,
      length: 4,
    });
  });
});

describe("IPv4", () => {
  it("checks the header checksum, and says why a bad one is common", async () => {
    const good = ipv4(
      { src: "192.168.1.23", dst: "198.51.100.10", proto: 17, ttl: 64, id: 7 },
      udp("192.168.1.23", "198.51.100.10", 1, 2, new Uint8Array(0)),
    );
    const bad = good.slice();
    bad[10] = (bad[10] ?? 0) ^ 0xff;
    const [ok, broken] = await dissect([good, bad], LINK.RAW);
    expect(ok && field(ok, "ip.csum").value).toMatch(/correct/);
    expect(broken && field(broken, "ip.csum")).toMatchObject({ warn: true });
    expect(broken && field(broken, "ip.csum").why).toMatch(/offload/);
  });

  it("explains TTL and classifies addresses", async () => {
    const p = await one(
      ipv4(
        { src: "192.168.1.23", dst: "203.0.113.9", proto: 17, ttl: 128, id: 9 },
        udp("192.168.1.23", "203.0.113.9", 1, 2, new Uint8Array(0)),
      ),
      LINK.RAW,
    );
    expect(field(p, "ip.ttl").why).toMatch(/128 from Windows/);
    expect(field(p, "ip.src").value).toMatch(/private, RFC 1918/);
    expect(field(p, "ip.dst").value).toMatch(/documentation range/);
  });

  it("leaves a later fragment's payload alone", async () => {
    const frag = ipv4(
      { src: "10.0.0.1", dst: "10.0.0.2", proto: 17, ttl: 64, id: 0x1234, df: false },
      new Uint8Array(16),
    );
    frag[6] = 0x00;
    frag[7] = 185; // offset 1480
    const p = await one(frag, LINK.RAW);
    expect(p.info).toMatch(/Fragmented IP protocol/);
    expect(p.protos.has("udp")).toBe(false);
  });
});

describe("IPv6", () => {
  it("walks extension headers to the transport", async () => {
    const payload = udp(
      "2001:db8::1",
      "2001:db8::2",
      4000,
      53,
      dns({ id: 1, response: false, question: { name: "example.com", type: "AAAA" } }),
    );
    const hbh = new W().u8(17, 0).u8(1, 4, 0, 0, 0, 0).out(); // hop-by-hop: next UDP, 8 bytes of PadN
    const p = await one(
      ipv6(
        { src: "2001:db8::1", dst: "2001:db8::2", next: 0, hlim: 64 },
        new W().bytes(hbh).bytes(payload).out(),
      ),
      LINK.RAW,
    );
    expect(p.protocol).toBe("DNS");
    expect(field(p, "ipv6.ext40").name).toBe("IPv6 Hop-by-Hop");
    expect(field(p, "ipv6.hlim").why).toMatch(/255/);
  });
});

describe("ICMP and ICMPv6", () => {
  it("reads a time exceeded and the probe it quotes", async () => {
    const probe = ipv4(
      { src: "192.168.1.23", dst: "192.0.2.80", proto: 17, ttl: 1, id: 0x6c01 },
      udp("192.168.1.23", "192.0.2.80", 51034, 33434, new Uint8Array(24)),
    );
    const p = await one(
      ipv4(
        { src: "198.51.100.1", dst: "192.168.1.23", proto: 1, ttl: 254, id: 5 },
        icmpError(11, 0, probe),
      ),
      LINK.RAW,
    );
    expect(p.info).toBe("Time-to-live exceeded (Time to live exceeded in transit)");
    expect(field(p, "icmp.quoted.dport").value).toBe("33434");
    expect(field(p, "icmp.quoted.ttl").value).toBe("1");
    expect(field(p, "icmp.csum").value).toMatch(/correct/);
  });

  it("reads Neighbor Discovery with its checksum over the pseudo-header", async () => {
    const src = "2001:db8:1::5";
    const dst = "ff02::1:ff00:1";
    const body = new W()
      .u32(0)
      .bytes(fromHex("20010db8000100000000000000000001"))
      .bytes(ndLla(1, A))
      .out();
    const p = await one(
      ethernet(
        "33:33:ff:00:00:01",
        A,
        0x86dd,
        ipv6({ src, dst, next: 58, hlim: 255 }, icmpv6(src, dst, 135, body)),
      ),
    );
    expect(p.info).toBe("Neighbor Solicitation for 2001:db8:1::1");
    expect(field(p, "icmpv6.csum").value).toMatch(/correct/);
    expect(field(p, "ipv6.dst").value).toMatch(/solicited-node/);
  });
});

describe("UDP and TCP", () => {
  it("reads UDP and checks its checksum", async () => {
    const p = await one(v4udp(new Uint8Array(10), 40000, 9999));
    expect(p.info).toBe("40000 → 9999 Len=10");
    expect(field(p, "udp.csum").value).toMatch(/correct/);
  });

  it("reads TCP flags and every option in a SYN", async () => {
    const seg = tcp("192.168.1.23", "198.51.100.10", {
      sport: 53214,
      dport: 443,
      seq: 1000,
      ack: 0,
      flags: TCPF.SYN,
      win: 65535,
      opts: [{ mss: 1460 }, { sackPerm: true }, { ts: [10, 0] }, { nop: true }, { ws: 7 }],
    });
    const p = await one(
      ipv4({ src: "192.168.1.23", dst: "198.51.100.10", proto: 6, ttl: 64, id: 1 }, seg),
      LINK.RAW,
    );
    expect(p.info).toBe(
      "53214 → 443 [SYN] Seq=0 Win=65535 Len=0 MSS=1460 SACK_PERM TSval=10 TSecr=0 WS=128",
    );
    expect(field(p, "tcp.options.mss").value).toBe("1460 bytes");
    expect(field(p, "tcp.options.ws").value).toBe("7 (multiply by 128)");
    expect(field(p, "tcp.flags.syn").value).toBe("Set");
    expect(field(p, "tcp.csum").value).toMatch(/correct/);
  });
});

describe("DNS", () => {
  it("reads an HTTPS record's alpn and address hints", async () => {
    const msg = dns({
      id: 0x71b7,
      response: true,
      question: { name: "www.example.com", type: "HTTPS" },
      answers: [
        {
          name: 12,
          type: "HTTPS",
          ttl: 60,
          priority: 1,
          alpn: ["h3", "h2"],
          v4: ["192.0.2.80"],
          v6: ["2001:db8::80"],
        },
      ],
      edns: 1232,
    });
    const p = await one(v4udp(msg, 53, 49533, "192.168.1.1", "192.168.1.23"));
    expect(p.info).toBe(
      "Standard query response 0x71b7 HTTPS www.example.com HTTPS 1 . alpn=h3,h2 ipv4hint=192.0.2.80 ipv6hint=2001:db8::80",
    );
    const answer = field(p, "dns.an0");
    expect(answer.value).toMatch(/^www\.example\.com: HTTPS/);
    const alpn = answer.children
      ?.find((f) => f.id === "dns.an0.rdata")
      ?.children?.find((f) => f.name === "alpn");
    expect(alpn?.value).toBe("h3,h2");
    expect(alpn?.why).toMatch(/HTTP\/3/);
  });

  it("reads CNAME chains, MX, TXT and NXDOMAIN", async () => {
    const [a, mx, txt, nx] = await dissect([
      v4udp(
        dns({
          id: 1,
          response: true,
          question: { name: "www.example.com", type: "A" },
          answers: [
            { name: 12, type: "CNAME", ttl: 300, target: "edge.example.net" },
            { name: "edge.example.net", type: "A", ttl: 60, addr: "192.0.2.80" },
          ],
        }),
        53,
        5000,
      ),
      v4udp(
        dns({
          id: 2,
          response: true,
          question: { name: "example.com", type: "MX" },
          answers: [{ name: 12, type: "MX", ttl: 60, pref: 10, target: "mail.example.com" }],
        }),
        53,
        5000,
      ),
      v4udp(
        dns({
          id: 3,
          response: true,
          question: { name: "example.com", type: "TXT" },
          answers: [{ name: 12, type: "TXT", ttl: 60, text: ["v=spf1 -all"] }],
        }),
        53,
        5000,
      ),
      v4udp(
        dns({ id: 4, response: true, rcode: 3, question: { name: "wpad.lan", type: "A" } }),
        53,
        5000,
      ),
    ]);
    expect(a?.info).toMatch(/CNAME edge\.example\.net A 192\.0\.2\.80$/);
    expect(mx?.info).toMatch(/MX 10 mail\.example\.com$/);
    expect(txt?.info).toMatch(/TXT "v=spf1 -all"$/);
    expect(nx?.info).toMatch(/No such name \(NXDOMAIN\)/);
  });

  it("survives a compression pointer loop", async () => {
    const msg = new W()
      .u16(1)
      .u16(0x0100)
      .u16(1)
      .u16(0)
      .u16(0)
      .u16(0)
      .u16(0xc00c)
      .u16(1)
      .u16(1)
      .out();
    const p = await one(v4udp(msg, 5000, 53));
    expect(p.headers.some((h) => h.warn || h.id === "error")).toBe(true);
  });
});

describe("DHCP", () => {
  it("reads the message type and options", async () => {
    const msg = dhcp({
      op: 2,
      xid: 0xabc,
      chaddr: A,
      yiaddr: "192.168.1.23",
      options: [
        [53, [5]],
        [54, ipOpt("192.168.1.1")],
        [51, [0, 1, 0x51, 0x80]],
        [6, ipOpt("192.168.1.1")],
      ],
    });
    const p = await one(v4udp(msg, 67, 68, "192.168.1.1", "192.168.1.23"));
    expect(p.info).toBe("DHCP ACK - Transaction ID 0xabc");
    expect(field(p, "dhcp.yiaddr").value).toBe("192.168.1.23");
    expect(p.headers.at(-1)?.children?.some((f) => f.value === "86400 s (24 h)")).toBe(true);
  });
});

describe("HTTP and TLS over TCP", () => {
  const seg = (payload: Uint8Array, dport: number, seq = 1) =>
    ipv4(
      { src: "192.168.1.23", dst: "203.0.113.50", proto: 6, ttl: 64, id: seq },
      tcp(
        "192.168.1.23",
        "203.0.113.50",
        { sport: 50000, dport, seq, ack: 1, flags: TCPF.ACK | TCPF.PSH, win: 2052 },
        payload,
      ),
    );

  it("reads a request line and headers", async () => {
    const p = await one(
      seg(
        new TextEncoder().encode(
          'GET /a HTTP/1.1\r\nHost: example.org\r\nAlt-Svc: h3=":443"\r\n\r\n',
        ),
        80,
      ),
      LINK.RAW,
    );
    expect(p.protocol).toBe("HTTP");
    expect(p.info).toBe("GET /a HTTP/1.1");
    expect(p.headers.at(-1)?.children?.find((f) => f.name === "Alt-Svc")?.why).toMatch(/HTTP\/3/);
  });

  it("reads a ClientHello: SNI, ALPN, suites, groups and key shares by name", async () => {
    const hello = clientHello(rng(1), { sni: "www.example.com", alpn: ["h2", "http/1.1"] });
    const p = await one(seg(tlsRecord(22, hello, 0x0301), 443), LINK.RAW);
    expect(p.info).toBe("Client Hello (SNI=www.example.com)");
    const all = [...byteIndex(p).byId.values()];
    expect(
      all.find((f) => f.name === "Extension: application_layer_protocol_negotiation")?.value,
    ).toBe("h2, http/1.1");
    expect(all.find((f) => f.name === "Extension: supported_groups")?.value).toMatch(
      /^GREASE, X25519MLKEM768, x25519/,
    );
    expect(all.some((f) => f.value === "TLS_AES_128_GCM_SHA256 (0x1301)")).toBe(true);
    expect(all.find((f) => f.name === "Server name")).toMatchObject({
      value: "www.example.com",
      length: 15,
    });
  });

  it("names an X25519MLKEM768 key share and its size", async () => {
    const ks = new W()
      .u16(51)
      .len16((x) => x.len16((l) => l.u16(0x11ec).len16((k) => k.bytes(new Uint8Array(1216)))));
    const body = new W()
      .u16(0x0303)
      .bytes(new Uint8Array(32))
      .u8(0)
      .u16(2)
      .u16(0x1301)
      .u8(1, 0)
      .len16((e) => e.bytes(ks.out()))
      .out();
    const msg = new W().u8(1).u24(body.length).bytes(body).out();
    const p = await one(seg(tlsRecord(22, msg), 443), LINK.RAW);
    const entry = [...byteIndex(p).byId.values()].find((f) => f.name === "Key share entry");
    expect(entry?.value).toBe("X25519MLKEM768 (0x11ec), 1216 bytes");
    expect(entry?.why).toMatch(/ML-KEM-768/);
  });

  it("marks application data as encrypted", async () => {
    const p = await one(seg(tlsRecord(23, new Uint8Array(40)), 443), LINK.RAW);
    expect(p.info).toBe("Application Data");
    expect(byteIndex(p).layer.at(-1)).toBe("crypt");
  });
});

describe("QUIC", () => {
  it("decrypts the RFC 9001 client Initial in a datagram and reads its ClientHello", async () => {
    const p = await one(v4udp(fromHex(CLIENT_INITIAL), 51000, 443, "192.168.1.23", "192.0.2.80"));
    expect(p.protocol).toBe("QUIC");
    expect(p.info).toMatch(
      /^Initial, DCID=8394c8f03e515708, PKN: 2, CRYPTO, PADDING · Client Hello \(SNI=example\.com\)$/,
    );
    expect(field(p, "quic.pn")).toMatchObject({ value: "2", length: 4 });
    expect(p.plain).toBeDefined();
    // The decrypted frames sit where their ciphertext was: the first CRYPTO frame right after the packet number.
    const crypto = [...byteIndex(p).byId.values()].find((f) => f.name === "CRYPTO");
    expect(crypto?.offset).toBe(14 + 20 + 8 + 22);
    expect(p.plain?.[14 + 20 + 8 + 22]).toBe(0x06);
  });

  it("says why it can't read a short-header packet", async () => {
    const p = await one(
      v4udp(
        new W().u8(0x41).bytes(new Uint8Array(8)).bytes(new Uint8Array(40)).out(),
        443,
        51000,
        "192.0.2.80",
        "192.168.1.23",
      ),
    );
    expect(p.info).toMatch(/^Protected Payload/);
    expect(field(p, "quic.dcid").why).toMatch(/guess/);
    expect(field(p, "quic.payload")).toMatchObject({ layer: "crypt" });
  });
});

describe("damaged packets", () => {
  it("marks a header cut short instead of failing", async () => {
    const full = ethernet(
      B,
      A,
      0x0800,
      ipv4({ src: "10.0.0.1", dst: "10.0.0.2", proto: 6, ttl: 64, id: 1 }, new Uint8Array(20)),
    );
    const p = await one(full.subarray(0, 14 + 20 + 6));
    const tcpHeader = p.headers.find((h) => h.proto === "tcp");
    expect(tcpHeader?.warn).toBe(true);
    expect(tcpHeader?.children?.at(-1)?.name).toBe("Cut short");
  });
});
