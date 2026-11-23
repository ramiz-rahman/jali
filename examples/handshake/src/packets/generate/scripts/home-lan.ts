/** The bundled capture “Joining the home network”. */
import {
  arp,
  BROADCAST,
  dhcp,
  ethernet,
  icmpEcho,
  icmpv6,
  ipBytes,
  ipOpt,
  ipv4,
  ipv6,
  ndLla,
  ndPrefix,
  ndRdnss,
  strOpt,
  u32Opt,
  udp,
  W,
} from "../build";
import { L, R, Tape, v4, text, type Bundled, type Script } from "./tape";

function homeLanScript(): Script {
  const tape = new Tape(0, "pcapng");
  const ids = new Map<string, number>();
  const xid = 0x5e2a91c4;
  const prl = [1, 121, 3, 6, 15, 108, 114, 119, 252, 95, 44, 46];
  const clientId = [1, ...L.mac.split(":").map((x) => parseInt(x, 16))];
  const fromNowhere = (payload: Uint8Array) =>
    ethernet(
      BROADCAST,
      L.mac,
      0x0800,
      ipv4(
        { src: "0.0.0.0", dst: "255.255.255.255", proto: 17, ttl: 64, id: 0, df: false, tos: 0x10 },
        udp("0.0.0.0", "255.255.255.255", 68, 67, payload),
      ),
    );
  const fromRouter = (payload: Uint8Array) =>
    v4("router", R.ip, L.ip, 17, udp(R.ip, L.ip, 67, 68, payload), ids);
  const serverOpts = (type: number): [number, number[]][] => [
    [53, [type]],
    [54, ipOpt(R.ip)],
    [51, u32Opt(86400)],
    [58, u32Opt(43200)],
    [59, u32Opt(75600)],
    [1, ipOpt("255.255.255.0")],
    [3, ipOpt(R.ip)],
    [6, ipOpt(R.ip)],
    [15, strOpt("lan")],
  ];

  tape.add(
    0,
    fromNowhere(
      dhcp({
        op: 1,
        xid,
        chaddr: L.mac,
        options: [
          [53, [1]],
          [55, prl],
          [57, [0x05, 0xdc]],
          [61, clientId],
          [50, ipOpt(L.ip)],
          [51, u32Opt(7776000)],
          [12, strOpt("lab-laptop")],
        ],
      }),
    ),
    "dhcp-discover",
  );
  tape.add(
    2.4,
    fromRouter(dhcp({ op: 2, xid, chaddr: L.mac, yiaddr: L.ip, options: serverOpts(2) })),
    "dhcp-offer",
  );
  tape.add(
    1004.1,
    fromNowhere(
      dhcp({
        op: 1,
        xid,
        chaddr: L.mac,
        options: [
          [53, [3]],
          [55, prl],
          [57, [0x05, 0xdc]],
          [61, clientId],
          [50, ipOpt(L.ip)],
          [54, ipOpt(R.ip)],
          [12, strOpt("lab-laptop")],
        ],
      }),
    ),
    "dhcp-request",
  );
  tape.add(
    1006.9,
    fromRouter(dhcp({ op: 2, xid, chaddr: L.mac, yiaddr: L.ip, options: serverOpts(5) })),
    "dhcp-ack",
  );
  // RFC 5227: announce the new address, so stale ARP caches on the link update.
  tape.add(
    1012.3,
    ethernet(BROADCAST, L.mac, 0x0806, arp(1, L.mac, L.ip, "00:00:00:00:00:00", L.ip)),
    "arp-announce",
  );
  tape.add(
    1013.0,
    ethernet(BROADCAST, L.mac, 0x0806, arp(1, L.mac, L.ip, "00:00:00:00:00:00", R.ip)),
    "arp-request",
  );
  tape.add(1014.6, ethernet(L.mac, R.mac, 0x0806, arp(2, R.mac, R.ip, L.mac, L.ip)), "arp-reply");
  // IPv6 comes up beside it: ask for a router, get the prefix, resolve the router's global address.
  const v6 = (
    src: string,
    dst: string,
    dmac: string,
    smac: string,
    type: number,
    body: Uint8Array,
  ) =>
    ethernet(
      dmac,
      smac,
      0x86dd,
      ipv6({ src, dst, next: 58, hlim: 255 }, icmpv6(src, dst, type, body)),
    );
  tape.add(
    1020.2,
    v6(
      L.ll,
      "ff02::2",
      "33:33:00:00:00:02",
      L.mac,
      133,
      new W().u32(0).bytes(ndLla(1, L.mac)).out(),
    ),
    "router-solicitation",
  );
  tape.add(
    1023.8,
    v6(
      R.ll,
      "ff02::1",
      "33:33:00:00:00:01",
      R.mac,
      134,
      new W()
        .u8(64, 0)
        .u16(1800)
        .u32(0)
        .u32(0)
        .bytes(ndLla(1, R.mac))
        .bytes(ndPrefix("2001:db8:1::", 64))
        .bytes(ndRdnss([R.global]))
        .out(),
    ),
    "router-advertisement",
  );
  const global = "2001:db8:1:0:9c41:7a2e:51b0:3d17";
  tape.add(
    1530.4,
    v6(
      global,
      "ff02::1:ff00:1",
      "33:33:ff:00:00:01",
      L.mac,
      135,
      new W().u32(0).bytes(ipBytes(R.global)).bytes(ndLla(1, L.mac)).out(),
    ),
    "neighbor-solicitation",
  );
  tape.add(
    1531.9,
    v6(
      R.global,
      global,
      L.mac,
      R.mac,
      136,
      new W().u8(0xe0, 0, 0, 0).bytes(ipBytes(R.global)).bytes(ndLla(2, R.mac)).out(),
    ),
    "neighbor-advertisement",
  );
  // And the first thing anyone does on a new network: ping the router.
  const echo = new W()
    .bytes(text("handshake-lab-ping").subarray(0, 16))
    .bytes(new Uint8Array(40))
    .out();
  tape.add(2040.0, v4("laptop", L.ip, R.ip, 1, icmpEcho(8, 0x4d2, 1, echo), ids), "ping-request");
  tape.add(2041.7, v4("router", R.ip, L.ip, 1, icmpEcho(0, 0x4d2, 1, echo), ids), "ping-reply");
  return tape.script;
}

export const homeLan: Bundled = {
  title: "Joining the home network",
  summary:
    "A laptop joins 192.168.1.0/24. DHCP's four messages (Discover, Offer, Request, ACK) get it an address, a lease, a gateway and a DNS server; an ARP announcement claims the address and an ARP exchange finds the router's MAC. IPv6 comes up beside it with no server at all: a Router Solicitation, the Advertisement with the /64 prefix, Neighbor Discovery for the router. Then a ping to the router, whose reply's TTL of 64 says Linux, one hop away.",
  build: homeLanScript,
};
