/** What an IP header carries, by its protocol number: TCP, UDP, ICMP, ICMPv6, or data. */
import { Src } from "../bytes";
import { type Ctx, data } from "./core";
import { dissectIcmp, dissectIcmpv6 } from "./icmp";
import { dissectTcp, dissectUdp } from "./transport";

export function byProtocol(
  ctx: Ctx,
  s: Src,
  proto: number,
  src: Uint8Array,
  dst: Uint8Array,
  ttl: number,
) {
  if (proto === 6) return dissectTcp(ctx, s, src, dst);
  if (proto === 17) return dissectUdp(ctx, s, src, dst);
  if (proto === 1) return dissectIcmp(ctx, s, ttl);
  if (proto === 58) return dissectIcmpv6(ctx, s, src, dst);
  data(ctx, s, 0, "transport");
}
