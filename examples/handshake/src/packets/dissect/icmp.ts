/** ICMP and ICMPv6: echo, time exceeded, unreachable with the quoted datagram, and Neighbor Discovery. */
import { hex16, ipv4, ipv6, mac, onesSum, pseudoHeader, Src } from "../bytes";
import { ICMP_TYPES, ICMP_UNREACHABLE, ICMPV6_TYPES, IP_PROTOCOLS, named } from "../names";
import { type Ctx, type Fields, header, top } from "./core";
import { checksumValue, OFFLOAD } from "./ip";

const ICMP_WHY: Record<number, string> = {
  0: "The echo reply. Its TTL, compared with what the OS starts at, says how many hops back it came.",
  3: "A router or the destination could not deliver the packet; the quoted header says which packet it was.",
  8: "ping. The identifier pairs requests with replies (one per running ping), the sequence number counts them.",
  11: "A router decremented TTL to 0 and dropped the packet. traceroute sends probes with TTL 1, 2, 3… and lists who sends these: each names a hop. Routers rate-limit them and some never send any (the * * * hops).",
};

export function dissectIcmp(ctx: Ctx, s: Src, ipTtl: number) {
  header(
    ctx,
    {
      proto: "icmp",
      short: "ICMP",
      name: "Internet Control Message Protocol",
      layer: "net",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      const type = s.u8(0);
      const code = s.u8(1);
      const stored = s.u16(2);
      const ok = onesSum([s.bytes(0, s.length)]) === 0xffff;
      const codeName =
        type === 3
          ? named(ICMP_UNREACHABLE, code, "Code")
          : type === 11
            ? code === 0
              ? "Time to live exceeded in transit"
              : "Fragment reassembly time exceeded"
            : `${code}`;
      h.value = named(ICMP_TYPES, type, "Type");
      h.why = ICMP_WHY[type];
      F.f("type", "Type", `${type} (${named(ICMP_TYPES, type, "Type")})`, 0, 1, ICMP_WHY[type]);
      F.f(
        "code",
        "Code",
        `${code} (${codeName})`,
        1,
        1,
        type === 3 && code === 3
          ? "Port unreachable from the destination itself: nothing listens on that UDP port. traceroute probes high ports (33434+) to get exactly this, which tells it it has arrived."
          : type === 3 && code === 4
            ? "The path MTU is smaller than this packet and DF was set: the next-hop MTU is in the header. Firewalls that drop this create black holes."
            : undefined,
      );
      const csum = F.f(
        "csum",
        "Checksum",
        checksumValue(stored, ok),
        2,
        2,
        ok ? undefined : `Covers the whole ICMP message.${OFFLOAD}`,
      );
      if (!ok) csum.warn = true;
      if (type === 0 || type === 8) {
        const id = s.u16(4);
        const seq = s.u16(6);
        F.f("id", "Identifier", `${hex16(id)} (${id})`, 4, 2);
        F.f("seq", "Sequence number", `${seq}`, 6, 2);
        if (s.length > 8)
          F.f(
            "data",
            "Data",
            `${s.length - 8} bytes`,
            8,
            s.length - 8,
            "Filler, often a timestamp the sender reads back to time the round trip.",
          );
        top(
          ctx,
          "ICMP",
          `Echo (ping) ${type === 8 ? "request" : "reply"} id=${hex16(id)}, seq=${seq}, ttl=${ipTtl}`,
        );
        return;
      }
      if (type === 3 || type === 11) {
        if (type === 3 && code === 4) F.f("mtu", "Next-hop MTU", `${s.u16(6)}`, 6, 2);
        else F.f("unused", "Unused", hex16(s.u16(6)), 4, 4);
        quotedV4(F, s.sub(8, s.length - 8));
        top(ctx, "ICMP", `${named(ICMP_TYPES, type, "Type")} (${codeName})`);
        return;
      }
      top(ctx, "ICMP", named(ICMP_TYPES, type, "ICMP type"));
    },
  );
}

/** The IPv4 header and first 8 bytes of the datagram an ICMP error is about: enough to name the flow. */
function quotedV4(F: Fields, q: Src) {
  F.group(
    "quoted",
    "Quoted datagram",
    "the header of the packet this is about",
    0,
    q.length,
    "Routers quote the dropped packet's IP header and first 8 transport bytes, so the sender can tell which flow and which probe it was.",
    (G) => {
      const ihl = (q.u8(0) & 0x0f) * 4;
      const proto = q.u8(9);
      const inner = G.as("net");
      inner.f(
        "ttl",
        "Time to live",
        `${q.u8(8)}`,
        8,
        1,
        "As it arrived at the router that dropped it: usually 1 in a time-exceeded, which is why it was dropped.",
      );
      inner.f("proto", "Protocol", `${named(IP_PROTOCOLS, proto)} (${proto})`, 9, 1);
      inner.f("src", "Source", ipv4(q.bytes(12, 4)), 12, 4);
      inner.f(
        "dst",
        "Destination",
        ipv4(q.bytes(16, 4)),
        16,
        4,
        "Where the original packet was going: the traceroute target, at every hop.",
      );
      const t = G.as("transport");
      if (proto === 17 || proto === 6) {
        t.f("sport", "Source port", `${q.u16(ihl)}`, ihl, 2);
        t.f(
          "dport",
          "Destination port",
          `${q.u16(ihl + 2)}`,
          ihl + 2,
          2,
          proto === 17
            ? "Classic traceroute adds 1 to the port with each probe, so the port in the quote says which probe this answers."
            : undefined,
        );
      } else if (proto === 1) {
        t.f("type", "ICMP type", `${q.u8(ihl)}`, ihl, 1);
        t.f("seq", "Sequence number", `${q.u16(ihl + 6)}`, ihl + 6, 2);
      }
    },
    "net",
  );
}

const ND_WHY: Record<number, string> = {
  133: "A host just joined the link and asks routers to announce themselves now, instead of waiting for the next periodic advertisement.",
  134: "The router announces itself as default gateway and the prefix in use. With the A flag hosts build their own addresses (SLAAC): no DHCP needed. M and O say whether DHCPv6 hands out addresses or only other settings.",
  135: "IPv6's ARP: who has this address? Sent to the target's solicited-node multicast group, so only hosts whose address ends the same way wake up, not the whole link.",
  136: "The answer, with the MAC. S: in reply to a solicitation. O: overwrite any cached entry. R: the sender is a router.",
};

export function dissectIcmpv6(ctx: Ctx, s: Src, src: Uint8Array, dst: Uint8Array) {
  header(
    ctx,
    {
      proto: "icmpv6",
      short: "ICMPv6",
      name: "Internet Control Message Protocol v6",
      layer: "net",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      const type = s.u8(0);
      const code = s.u8(1);
      const stored = s.u16(2);
      const ok = onesSum([pseudoHeader(src, dst, 58, s.length), s.bytes(0, s.length)]) === 0xffff;
      h.value = named(ICMPV6_TYPES, type, "Type");
      h.why = ND_WHY[type];
      F.f("type", "Type", `${type} (${h.value})`, 0, 1, ND_WHY[type]);
      F.f("code", "Code", `${code}`, 1, 1);
      const csum = F.f(
        "csum",
        "Checksum",
        checksumValue(stored, ok),
        2,
        2,
        `Unlike ICMP's, it covers a pseudo-header with both addresses, because IPv6 has no header checksum of its own.${ok ? "" : OFFLOAD}`,
      );
      if (!ok) csum.warn = true;
      let opts = 8;
      let info = h.value;
      if (type === 128 || type === 129) {
        F.f("id", "Identifier", hex16(s.u16(4)), 4, 2);
        F.f("seq", "Sequence number", `${s.u16(6)}`, 6, 2);
        info = `Echo (ping) ${type === 128 ? "request" : "reply"} id=${hex16(s.u16(4))}, seq=${s.u16(6)}`;
        opts = s.length;
      } else if (type === 133) {
        F.f("reserved", "Reserved", "0", 4, 4);
      } else if (type === 134) {
        const flags = s.u8(5);
        F.f(
          "hoplimit",
          "Cur hop limit",
          `${s.u8(4)}`,
          4,
          1,
          "The hop limit hosts should use for what they send.",
        );
        F.group(
          "flags",
          "Flags",
          `${flags & 0x80 ? "M " : ""}${flags & 0x40 ? "O" : ""}`.trim() || "none",
          5,
          1,
          undefined,
          (G) => {
            G.f(
              "m",
              "Managed (M)",
              flags & 0x80 ? "Set: get an address from DHCPv6" : "Not set",
              5,
              1,
            );
            G.f(
              "o",
              "Other (O)",
              flags & 0x40 ? "Set: get DNS and other settings from DHCPv6" : "Not set",
              5,
              1,
            );
          },
        );
        F.f(
          "lifetime",
          "Router lifetime",
          `${s.u16(6)} s`,
          6,
          2,
          "How long hosts may use this router as default gateway; 0 means not a default router.",
        );
        F.f("reachable", "Reachable time", `${s.u32(8)} ms`, 8, 4);
        F.f("retrans", "Retrans timer", `${s.u32(12)} ms`, 12, 4);
        opts = 16;
      } else if (type === 135 || type === 136) {
        const target = ipv6(s.bytes(8, 16));
        if (type === 136) {
          const flags = s.u8(4);
          F.f(
            "flags",
            "Flags",
            `${flags & 0x80 ? "R" : ""}${flags & 0x40 ? "S" : ""}${flags & 0x20 ? "O" : ""}` ||
              "none",
            4,
            4,
            ND_WHY[136],
          );
        } else {
          F.f("reserved", "Reserved", "0", 4, 4);
        }
        F.f("target", "Target address", target, 8, 16);
        info =
          type === 135 ? `Neighbor Solicitation for ${target}` : `Neighbor Advertisement ${target}`;
        opts = 24;
      } else if (type === 1 || type === 3) {
        F.f("unused", "Unused", "0", 4, 4);
        if (s.length >= 48) {
          F.group(
            "quoted",
            "Quoted packet",
            `${ipv6(s.bytes(16, 16))} → ${ipv6(s.bytes(32, 16))}`,
            8,
            s.length - 8,
            "As much of the offending packet as fits in the minimum MTU, so the sender can match it.",
            (G) => {
              G.f("hlim", "Hop limit", `${s.u8(15)}`, 15, 1);
              G.f("dst", "Destination", ipv6(s.bytes(32, 16)), 32, 16);
            },
          );
        }
        opts = s.length;
      }
      while (opts + 2 <= s.length) {
        const t = s.u8(opts);
        const len = s.u8(opts + 1) * 8;
        if (len === 0) break;
        ndOption(F, s, opts, t, len);
        opts += len;
      }
      top(ctx, "ICMPv6", info);
    },
  );
}

function ndOption(F: Fields, s: Src, at: number, type: number, len: number) {
  if (type === 1 || type === 2) {
    F.f(
      `opt${at}`,
      type === 1 ? "Source link-layer address" : "Target link-layer address",
      mac(s.bytes(at + 2, 6)),
      at,
      len,
      "The MAC rides in the ND message itself, so the receiver can answer without asking back.",
    );
  } else if (type === 3) {
    const prefix = ipv6(s.bytes(at + 16, 16));
    const flags = s.u8(at + 3);
    F.group(
      `opt${at}`,
      "Prefix information",
      `${prefix}/${s.u8(at + 2)}`,
      at,
      len,
      "The /64 hosts build addresses in. With A set, each host picks its own interface ID: usually random and rotated (RFC 8981), for privacy.",
      (G) => {
        G.f(
          "flags",
          "Flags",
          `${flags & 0x80 ? "L (on-link) " : ""}${flags & 0x40 ? "A (autonomous: use SLAAC)" : ""}`.trim(),
          at + 3,
          1,
        );
        G.f("valid", "Valid lifetime", `${s.u32(at + 4)} s`, at + 4, 4);
        G.f("preferred", "Preferred lifetime", `${s.u32(at + 8)} s`, at + 8, 4);
        G.f("prefix", "Prefix", prefix, at + 16, 16);
      },
    );
  } else if (type === 5) {
    F.f(`opt${at}`, "MTU", `${s.u32(at + 4)}`, at, len);
  } else if (type === 25) {
    const servers: string[] = [];
    for (let o = at + 8; o + 16 <= at + len; o += 16) servers.push(ipv6(s.bytes(o, 16)));
    F.f(
      `opt${at}`,
      "Recursive DNS server",
      servers.join(", "),
      at,
      len,
      "RDNSS (RFC 8106): DNS servers in the RA itself, so a SLAAC-only network needs no DHCPv6 at all.",
    );
  } else {
    F.f(`opt${at}`, `Option ${type}`, `${len} bytes`, at, len);
  }
}
