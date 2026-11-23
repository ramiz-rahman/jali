/** The display filter: protocols, fields, tcpdump's shorthands, logic, and errors that say what is wrong. */
import { parseFilter } from "./filter";
import type { Packet, ProtoId } from "./types";

const pkt = (protos: ProtoId[], o: Partial<Packet> = {}): Packet => ({
  n: 1,
  time: 0,
  rel: 0,
  data: new Uint8Array(0),
  wireLength: 60,
  linkType: 1,
  headers: [],
  src: "",
  dst: "",
  protocol: "",
  info: "",
  protos: new Set(protos),
  analysis: [],
  ...o,
});

const dnsQuery = pkt(["eth", "ip", "udp", "dns"], {
  flow: { src: "192.168.1.23", dst: "192.168.1.1", transport: "udp", sport: 51812, dport: 53 },
  stream: { transport: "udp", index: 2 },
});
const https = pkt(["eth", "ip", "tcp", "tls"], {
  flow: { src: "192.168.1.23", dst: "203.0.113.50", transport: "tcp", sport: 53220, dport: 443 },
  stream: { transport: "tcp", index: 0 },
});
const dup = pkt(["eth", "ip", "tcp"], {
  flow: { src: "192.168.1.23", dst: "198.51.100.10", transport: "tcp", sport: 53214, dport: 80 },
  analysis: [{ kind: "dup-ack", label: "TCP Dup ACK 8#1", why: "" }],
});
const arp = pkt(["eth", "arp"], { src: "3c:22:fb:4a:9e:01", dst: "Broadcast" });
const all = [dnsQuery, https, dup, arp];

const matches = (text: string) => {
  const f = parseFilter(text);
  if (!f.ok) throw new Error(f.error);
  return all.filter(f.test);
};

describe("parseFilter", () => {
  it("lets everything through when empty", () => expect(matches("  ")).toHaveLength(4));

  it.each([
    ["dns", [dnsQuery]],
    ["tcp", [https, dup]],
    ["tls", [https]],
    ["arp", [arp]],
    ["ip.addr==192.168.1.1", [dnsQuery]],
    ["ip.dst == 203.0.113.50", [https]],
    ["ip.addr!=192.168.1.1", [https, dup, arp]],
    ["port 443", [https]],
    ["tcp.port==80", [dup]],
    ["udp.port==53", [dnsQuery]],
    ["tcp.stream==0", [https]],
    ["udp.stream==2", [dnsQuery]],
    ["tcp.analysis.flags", [dup]],
    ["tcp.analysis.duplicate_ack", [dup]],
    ["tcp.analysis.retransmission", []],
    ["host 192.168.1.1", [dnsQuery]],
    ["dns || arp", [dnsQuery, arp]],
    ["tcp and not tls", [dup]],
    ["!(tcp || udp)", [arp]],
    ["TCP && port 80", [dup]],
  ])("%s", (text, want) => expect(matches(text)).toEqual(want));

  it.each([
    ["tcp.prt==80", /Unknown field "tcp.prt"/],
    ["htp", /Unknown protocol or field "htp"/],
    ["(dns", /never closed/],
    ["port", /needs a value/],
    ["port https", /not a port number/],
    ["ip.addr", /needs a comparison/],
    ["tcp udp", /Unexpected "udp"/],
    ["tcp > 3", /Unexpected/],
  ])("says what is wrong with %s", (text, error) => {
    const f = parseFilter(text);
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.error).toMatch(error);
  });
});
