/**
 * The link layer: the frame's own metadata, Ethernet II with 802.1Q tags, Linux's cooked headers (SLL and SLL2, what
 * `tcpdump -i any` writes), BSD loopback, and raw IP. Each hands its payload on by EtherType or address family.
 */
import { hex16, mac, Src } from "../bytes";
import { LINK, linkName } from "../read";
import { ETHERTYPES, named } from "../names";
import { data, header, type Ctx, type Fields } from "./core";
import { dissectArp } from "./arp";
import { dissectIpv4 } from "./ipv4";
import { dissectIpv6 } from "./ipv6";

export function dissectFrame(
  ctx: Ctx,
  meta: {
    time: number;
    rel: number;
    delta: number;
    wireLength: number;
    linkType: number;
    iface?: string;
  },
) {
  const s = ctx.frame;
  header(
    ctx,
    { proto: "frame", short: "Frame", name: `Frame ${ctx.n}`, layer: "link", s, i: 0, n: 0 },
    (F, _size, h) => {
      h.value = `${meta.wireLength.toLocaleString("en")} bytes on wire, ${s.length.toLocaleString("en")} captured`;
      h.extent = s.length;
      F.note(
        "time",
        "Arrival time",
        new Date(meta.time * 1000).toISOString().replace("T", " ").replace("Z", " UTC"),
        "Stamped by the capturing host's kernel when the packet passed the capture point, not when it was sent: a timeline on one machine, never a one-way delay.",
      );
      F.note("rel", "Time since first packet", `${meta.rel.toFixed(6)} s`);
      F.note(
        "delta",
        "Time since previous packet",
        `${meta.delta.toFixed(6)} s`,
        "Gaps here are where the waiting is: a round trip, a server thinking, or a retransmission timer.",
      );
      F.note(
        "wire",
        "Length on wire",
        `${meta.wireLength.toLocaleString("en")} bytes`,
        "Without the Ethernet preamble and the 4-byte FCS: the NIC checks and strips those before the capture sees the frame.",
      );
      F.note(
        "caplen",
        "Captured length",
        `${s.length.toLocaleString("en")} bytes`,
        meta.wireLength > s.length
          ? "Less than on the wire: the snap length (tcpdump -s) cut the packet, so the payload's end is missing."
          : undefined,
      );
      if (meta.iface) F.note("iface", "Interface", meta.iface);
      F.note("link", "Link type", linkName(meta.linkType));
    },
  );

  switch (meta.linkType) {
    case LINK.ETHERNET:
      return ethernet(ctx, s);
    case LINK.RAW:
      return byVersion(ctx, s, 0);
    case LINK.IPV4:
      return dissectIpv4(ctx, s, 0);
    case LINK.IPV6:
      return dissectIpv6(ctx, s, 0);
    case LINK.SLL:
      return sll(ctx, s);
    case LINK.SLL2:
      return sll2(ctx, s);
    case LINK.NULL:
    case LINK.LOOP:
      return loopback(ctx, s, meta.linkType);
    default:
      ctx.out.protocol = linkName(meta.linkType);
      ctx.out.info = `${linkName(meta.linkType)} frames are not dissected here`;
      data(ctx, s, 0, "link");
  }
}

/** The I/G and U/L bits of a MAC address, which say who it reaches and whether a vendor assigned it. */
function macKind(b: Uint8Array): string {
  if (b.every((x) => x === 0xff)) return "broadcast";
  const first = b[0] ?? 0;
  if (first & 1) {
    if (first === 0x33 && b[1] === 0x33) return "IPv6 multicast";
    if (first === 0x01 && b[1] === 0x00 && b[2] === 0x5e) return "IPv4 multicast";
    return "multicast";
  }
  return first & 2 ? "unicast, locally administered" : "unicast, vendor-assigned";
}

function addressField(F: Fields, key: string, name: string, s: Src, i: number, why: string) {
  const b = s.bytes(i, 6);
  F.group(key, name, `${mac(b)} (${macKind(b)})`, i, 6, why, (G) => {
    G.f(
      "oui",
      "OUI",
      mac(b.subarray(0, 3)),
      i,
      3,
      "The first three bytes name the NIC's vendor (IEEE registry) when the address is vendor-assigned; a randomised address has no vendor.",
    );
    G.f(
      "ig",
      "I/G bit",
      (b[0] ?? 0) & 1 ? "1: group (multicast or broadcast)" : "0: individual",
      i,
      1,
    );
    G.f(
      "lg",
      "U/L bit",
      (b[0] ?? 0) & 2 ? "1: locally administered" : "0: globally unique (vendor-assigned)",
      i,
      1,
      "Set on the private Wi-Fi addresses iOS, Android and Windows randomise per network, so the address can't track the device across networks.",
    );
  });
}

function ethernet(ctx: Ctx, s: Src) {
  let type = 0;
  let at = 14;
  header(
    ctx,
    { proto: "eth", short: "Ethernet", name: "Ethernet II", layer: "link", s, i: 0, n: 14 },
    (F, size, h) => {
      const dst = s.bytes(0, 6);
      const src = s.bytes(6, 6);
      ctx.out.src = mac(src);
      ctx.out.dst = mac(dst);
      h.value = `${mac(src)} → ${mac(dst)}`;
      addressField(
        F,
        "dst",
        "Destination",
        s,
        0,
        "Where the frame goes on this link only: every router hop rewrites both MAC addresses. ff:ff:ff:ff:ff:ff reaches every host in the broadcast domain.",
      );
      addressField(
        F,
        "src",
        "Source",
        s,
        6,
        "The sending interface on this link. Behind a router, every remote host's packets carry the router's MAC here, not the host's.",
      );
      type = s.u16(12);
      // 802.1Q and 802.1ad tags sit between the source address and the EtherType; QinQ stacks two.
      while (type === 0x8100 || type === 0x88a8) {
        const tci = s.u16(at);
        const tagAt = at - 2;
        F.group(
          `vlan${tagAt}`,
          type === 0x8100 ? "802.1Q tag" : "802.1ad tag",
          `VLAN ${tci & 0x0fff}, priority ${tci >> 13}`,
          tagAt,
          4,
          "A VLAN tag: trunk links carry several networks on one cable this way. Access ports strip it, so a host usually never sees one.",
          (G) => {
            G.f("tpid", "TPID", hex16(type), tagAt, 2);
            G.f(
              "pcp",
              "Priority (PCP)",
              `${tci >> 13}`,
              at,
              1,
              "802.1p class of service: switches and Wi-Fi WMM map it to queues; 5 or 6 is usually voice or video.",
            );
            G.f("dei", "Drop eligible (DEI)", `${(tci >> 12) & 1}`, at, 1);
            G.f(
              "vid",
              "VLAN ID",
              `${tci & 0x0fff}`,
              at,
              2,
              "Which virtual LAN, 1–4094. Guest Wi-Fi on a home router is often its own VLAN.",
            );
          },
          "link",
        );
        ctx.out.protos.add("vlan");
        type = s.u16(at + 2);
        at += 4;
      }
      F.f(
        "type",
        "Type",
        `${named(ETHERTYPES, type)} (${hex16(type)})`,
        at - 2,
        2,
        "The EtherType: which protocol the payload is. A value under 0x0600 would be an 802.3 length field instead.",
      );
      size(at);
      h.extent = s.length;
    },
  );
  ctx.out.protocol = "Ethernet";
  ctx.out.info = `${ctx.out.src} → ${ctx.out.dst}`;
  byEtherType(ctx, s, at, type);
}

export function byEtherType(ctx: Ctx, s: Src, at: number, type: number) {
  if (type === 0x0800) return dissectIpv4(ctx, s, at);
  if (type === 0x86dd) return dissectIpv6(ctx, s, at);
  if (type === 0x0806) return dissectArp(ctx, s, at);
  ctx.out.protocol = ETHERTYPES[type] ?? hex16(type);
  ctx.out.info = `${named(ETHERTYPES, type, "EtherType")} frame`;
  data(ctx, s, at, "link");
}

function byVersion(ctx: Ctx, s: Src, at: number) {
  const version = s.length > at ? (s.b[at] ?? 0) >> 4 : 0;
  if (version === 4) return dissectIpv4(ctx, s, at);
  if (version === 6) return dissectIpv6(ctx, s, at);
  ctx.out.protocol = "Raw";
  ctx.out.info = `IP version ${version}: not IPv4 or IPv6`;
  data(ctx, s, at, "net");
}

const SLL_TYPES = [
  "Unicast to us",
  "Broadcast",
  "Multicast",
  "Unicast to another host",
  "Sent by us",
];

const COOKED_WHY =
  "tcpdump -i any captures every interface at once and they have no common link header, so Linux writes this one instead. The destination MAC is lost.";

function sll(ctx: Ctx, s: Src) {
  let type = 0;
  header(
    ctx,
    { proto: "sll", short: "SLL", name: "Linux cooked capture v1", layer: "link", s, i: 0, n: 16 },
    (F, _size, h) => {
      const pkt = s.u16(0);
      const alen = Math.min(s.u16(4), 8);
      type = s.u16(14);
      h.why = COOKED_WHY;
      h.value = SLL_TYPES[pkt] ?? `Packet type ${pkt}`;
      F.f(
        "pkttype",
        "Packet type",
        h.value,
        0,
        2,
        "Which way the packet went: the kernel knows, and the cooked header keeps it.",
      );
      F.f("hatype", "Link-layer address type", `${s.u16(2)}`, 2, 2);
      F.f("halen", "Address length", `${alen}`, 4, 2);
      F.f("src", "Source", mac(s.bytes(6, alen)), 6, 8);
      if (alen === 6) ctx.out.src = mac(s.bytes(6, 6));
      F.f("protocol", "Protocol", `${named(ETHERTYPES, type)} (${hex16(type)})`, 14, 2);
    },
  );
  byEtherType(ctx, s, 16, type);
}

function sll2(ctx: Ctx, s: Src) {
  let type = 0;
  header(
    ctx,
    { proto: "sll", short: "SLL2", name: "Linux cooked capture v2", layer: "link", s, i: 0, n: 20 },
    (F, _size, h) => {
      type = s.u16(0);
      const pkt = s.u8(10);
      const alen = Math.min(s.u8(11), 8);
      h.why = COOKED_WHY;
      h.value = SLL_TYPES[pkt] ?? `Packet type ${pkt}`;
      F.f("protocol", "Protocol", `${named(ETHERTYPES, type)} (${hex16(type)})`, 0, 2);
      F.f(
        "ifindex",
        "Interface index",
        `${s.u32(4)}`,
        4,
        4,
        "Which interface it was seen on (ip link shows the numbers): v2's reason to exist, since -i any merges them all.",
      );
      F.f("hatype", "Link-layer address type", `${s.u16(8)}`, 8, 2);
      F.f("pkttype", "Packet type", h.value, 10, 1);
      F.f("src", "Source", mac(s.bytes(12, alen)), 12, 8);
      if (alen === 6) ctx.out.src = mac(s.bytes(12, 6));
    },
  );
  byEtherType(ctx, s, 20, type);
}

function loopback(ctx: Ctx, s: Src, linkType: number) {
  let family = 0;
  header(
    ctx,
    { proto: "loop", short: "Loopback", name: "Null/Loopback", layer: "link", s, i: 0, n: 4 },
    (F, _size, h) => {
      const be = s.u32(0);
      // DLT_NULL writes the family in the capturing host's byte order; DLT_LOOP always big-endian.
      const le = ((be & 0xff) << 24) | ((be & 0xff00) << 8) | ((be >>> 8) & 0xff00) | (be >>> 24);
      family = linkType === LINK.LOOP || be < 256 ? be : le >>> 0;
      h.value = family === 2 ? "IPv4" : [24, 28, 30].includes(family) ? "IPv6" : `Family ${family}`;
      F.f(
        "family",
        "Address family",
        `${h.value} (${family})`,
        0,
        4,
        "lo0 on macOS: traffic to your own machine never touches a NIC, so there is no Ethernet header, only the address family.",
      );
    },
  );
  if (family === 2) return dissectIpv4(ctx, s, 4);
  if ([24, 28, 30].includes(family)) return dissectIpv6(ctx, s, 4);
  data(ctx, s, 4, "net");
}
