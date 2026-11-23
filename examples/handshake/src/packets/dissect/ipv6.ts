/** IPv6: the fixed header, extension headers walked past, and the payload handed on. */
import { ipv6, Src } from "../bytes";
import { IP_PROTOCOLS, named } from "../names";
import { type Ctx, data, header, top } from "./core";
import { classifyV6, TTL_WHY } from "./ip";
import { byProtocol } from "./payload";

const EXT_HEADERS = new Set([0, 43, 60, 44, 51]);

export function dissectIpv6(ctx: Ctx, frame: Src, at: number) {
  let next = 0;
  let body: Src | undefined;
  let src: Uint8Array = new Uint8Array(16);
  let dst: Uint8Array = new Uint8Array(16);
  let hops = 0;
  let fragmented = false;
  const all = frame.sub(at, frame.length - at);
  header(
    ctx,
    {
      proto: "ipv6",
      short: "IPv6",
      name: "Internet Protocol Version 6",
      layer: "net",
      s: all,
      i: 0,
      n: 40,
    },
    (F, size, h) => {
      const word = all.u32(0);
      const plen = all.u16(4);
      next = all.u8(6);
      hops = all.u8(7);
      src = all.bytes(8, 16);
      dst = all.bytes(24, 16);
      h.value = `${ipv6(src)} → ${ipv6(dst)}`;
      h.extent = Math.min(40 + plen, all.length);
      F.f("version", "Version", `${word >>> 28}`, 0, 1);
      const tc = (word >>> 20) & 0xff;
      F.f(
        "tc",
        "Traffic class",
        `DSCP ${tc >> 2}, ECN ${tc & 3}`,
        0,
        2,
        "IPv4's DSCP and ECN bits, same meaning.",
      );
      F.f(
        "flow",
        "Flow label",
        `0x${(word & 0xfffff).toString(16).padStart(5, "0")}`,
        1,
        3,
        "Lets routers hash a flow onto one path (ECMP) without parsing past this header. Linux picks a random one per connection.",
      );
      F.f(
        "plen",
        "Payload length",
        `${plen}`,
        4,
        2,
        "Bytes after this fixed 40-byte header, extension headers included.",
      );
      F.f(
        "next",
        "Next header",
        `${named(IP_PROTOCOLS, next)} (${next})`,
        6,
        1,
        "A chain: each extension header names the one after it, and the last names the transport.",
      );
      F.f(
        "hlim",
        "Hop limit",
        `${hops}`,
        7,
        1,
        `${TTL_WHY} Neighbor Discovery must be sent with 255, so a receiver knows the message came from on-link.`,
      );
      F.f(
        "src",
        "Source",
        `${ipv6(src)} (${classifyV6(src)})`,
        8,
        16,
        classifyV6(src).startsWith("link-local")
          ? "fe80::/10: every IPv6 interface has one, built without any server; routers never forward it."
          : undefined,
      );
      F.f("dst", "Destination", `${ipv6(dst)} (${classifyV6(dst)})`, 24, 16);
      let off = 40;
      while (EXT_HEADERS.has(next)) {
        const kind = next;
        const len =
          kind === 44 ? 8 : kind === 51 ? (all.u8(off + 1) + 2) * 4 : (all.u8(off + 1) + 1) * 8;
        const following = all.u8(off);
        if (kind === 44) fragmented = (all.u16(off + 2) & 0xfff9) !== 0;
        F.group(
          `ext${off}`,
          named(IP_PROTOCOLS, kind),
          `${len} bytes, next: ${named(IP_PROTOCOLS, following)}`,
          off,
          len,
          kind === 0
            ? "Hop-by-hop options must be examined by every router; many drop such packets outright, so they barely work on the internet."
            : kind === 44
              ? "Only the sender fragments in IPv6; routers send ICMPv6 Packet Too Big instead."
              : undefined,
          (G) => {
            G.f("next", "Next header", `${following}`, off, 1);
            if (kind !== 44) G.f("len", "Length", `${len} bytes`, off + 1, 1);
          },
        );
        next = following;
        off += len;
      }
      size(off);
      body = all.sub(off, Math.max(0, Math.min(40 + plen, all.length) - off));
    },
  );
  ctx.out.src = ipv6(src);
  ctx.out.dst = ipv6(dst);
  ctx.out.flow = { src: ipv6(src), dst: ipv6(dst) };
  top(ctx, "IPv6", `${named(IP_PROTOCOLS, next)} packet, hop limit ${hops}`);
  if (!body) return;
  if (fragmented) {
    data(ctx, body, 0, "net", "A fragment: reassembly is not attempted here.");
    return;
  }
  byProtocol(ctx, body, next, src, dst, hops);
}
