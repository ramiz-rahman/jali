/** IPv4: flags, fragments, the header checksum checked, and the payload handed on cut to the header's own length. */
import { hex16, ipv4, onesSum, Src } from "../bytes";
import { IP_PROTOCOLS, named } from "../names";
import { type Ctx, data, header, top } from "./core";
import { checksumValue, classifyV4, OFFLOAD, padding, TTL_WHY } from "./ip";
import { byProtocol } from "./payload";

export function dissectIpv4(ctx: Ctx, frame: Src, at: number) {
  let proto = 0;
  let body: Src | undefined;
  let fragment = false;
  let src: Uint8Array = new Uint8Array(4);
  let dst: Uint8Array = new Uint8Array(4);
  let total = 0;
  let ttl = 0;
  const all = frame.sub(at, frame.length - at);
  header(
    ctx,
    {
      proto: "ip",
      short: "IPv4",
      name: "Internet Protocol Version 4",
      layer: "net",
      s: all,
      i: 0,
      n: 20,
    },
    (F, size, h) => {
      const vihl = all.u8(0);
      const ihl = (vihl & 0x0f) * 4;
      size(ihl);
      total = all.u16(2);
      const flags = all.u16(6);
      const df = (flags & 0x4000) !== 0;
      const mf = (flags & 0x2000) !== 0;
      const offset = (flags & 0x1fff) * 8;
      ttl = all.u8(8);
      proto = all.u8(9);
      src = all.bytes(12, 4);
      dst = all.bytes(16, 4);
      const stored = all.u16(10);
      const ok = onesSum([all.bytes(0, ihl)]) === 0xffff;
      h.value = `${ipv4(src)} → ${ipv4(dst)}`;
      h.extent = Math.min(total, all.length);
      F.f("version", "Version", `${vihl >> 4}`, 0, 1);
      F.f(
        "ihl",
        "Header length",
        `${ihl} bytes (${vihl & 0x0f} words)`,
        0,
        1,
        ihl > 20
          ? "Options follow the fixed 20 bytes. They are rare enough that many routers punt such packets to a slow path."
          : "20 bytes: no options, as almost every packet on today's internet.",
      );
      const tos = all.u8(1);
      F.group(
        "tos",
        "Differentiated services",
        `DSCP ${tos >> 2}, ECN ${tos & 3}`,
        1,
        1,
        undefined,
        (G) => {
          G.f(
            "dscp",
            "DSCP",
            `${tos >> 2}`,
            1,
            1,
            "Per-hop priority. Most networks rewrite or ignore it at their edge; inside a home, Wi-Fi maps it to WMM queues (46, EF, means voice).",
          );
          G.f(
            "ecn",
            "ECN",
            ["Not ECN-capable (00)", "ECT(1) (01)", "ECT(0) (10)", "Congestion experienced (11)"][
              tos & 3
            ] ?? "",
            1,
            1,
            "Explicit Congestion Notification: a router marks CE instead of dropping, and the sender slows without losing a packet. L4S uses ECT(1).",
          );
        },
      );
      F.f(
        "len",
        "Total length",
        `${total}`,
        2,
        2,
        "Header plus payload. Usually at most 1500, the Ethernet MTU; 1492 on PPPoE links, whose 8-byte header eats the difference.",
      );
      F.f(
        "id",
        "Identification",
        `${hex16(all.u16(4))} (${all.u16(4)})`,
        4,
        2,
        "Groups the fragments of one datagram. With DF set it does nothing, so how a stack fills it (0, a counter, random) is an OS fingerprint.",
      );
      F.group(
        "flags",
        "Flags",
        `${hex16(flags & 0xe000)}${df ? ", Don't fragment" : ""}${mf ? ", More fragments" : ""}`,
        6,
        1,
        undefined,
        (G) => {
          G.f(
            "df",
            "Don't fragment",
            df ? "Set" : "Not set",
            6,
            1,
            "Set on nearly all TCP and QUIC traffic, for path MTU discovery: a router that can't forward it whole drops it and sends ICMP 'fragmentation needed'. Filtering that ICMP breaks the path silently.",
          );
          G.f("mf", "More fragments", mf ? "Set" : "Not set", 6, 1);
        },
      );
      F.f(
        "frag",
        "Fragment offset",
        `${offset}`,
        6,
        2,
        "In 8-byte units. Only the first fragment carries the transport header, which is why firewalls and NATs struggle with fragments and IPv6 lets only the sender fragment.",
      );
      F.f("ttl", "Time to live", `${ttl}`, 8, 1, TTL_WHY);
      F.f(
        "proto",
        "Protocol",
        `${named(IP_PROTOCOLS, proto)} (${proto})`,
        9,
        1,
        "Which transport the payload is: 6 TCP, 17 UDP, 1 ICMP.",
      );
      const csum = F.f(
        "csum",
        "Header checksum",
        checksumValue(stored, ok),
        10,
        2,
        `Covers the header only and is recomputed at every hop, because TTL changes. IPv6 dropped it: link and transport already check.${ok ? "" : OFFLOAD}`,
      );
      if (!ok) csum.warn = true;
      F.f(
        "src",
        "Source",
        `${ipv4(src)} (${classifyV4(src)})`,
        12,
        4,
        classifyV4(src).startsWith("private")
          ? "A private address: your router's NAT rewrites it to its public address on the way out, and back on the way in."
          : undefined,
      );
      F.f("dst", "Destination", `${ipv4(dst)} (${classifyV4(dst)})`, 16, 4);
      if (ihl > 20) F.f("options", "Options", `${ihl - 20} bytes`, 20, ihl - 20);
      fragment = mf || offset > 0;
      if (fragment) {
        F.note(
          "fragment",
          "Fragment",
          `${mf ? "more follow" : "last"}, offset ${offset}`,
          "Reassembly is not attempted here: only the first fragment's transport header is shown.",
        );
      }
      body = all.sub(ihl, Math.max(0, Math.min(total, all.length) - ihl));
    },
  );
  ctx.out.src = ipv4(src);
  ctx.out.dst = ipv4(dst);
  ctx.out.flow = { src: ipv4(src), dst: ipv4(dst) };
  top(ctx, "IPv4", `${named(IP_PROTOCOLS, proto)} packet, TTL ${ttl}`);
  padding(ctx, frame, at + total);
  if (!body) return;
  if (fragment && (frame.u16(at + 6) & 0x1fff) > 0) {
    top(
      ctx,
      "IPv4",
      `Fragmented IP protocol (proto=${named(IP_PROTOCOLS, proto)} ${proto}, ID=${hex16(frame.u16(at + 4))})`,
    );
    data(ctx, body, 0, "net", "A later fragment: its transport header is in the first one.");
    return;
  }
  byProtocol(ctx, body, proto, src, dst, ttl);
}
