/**
 * What the internet-layer dissectors share: what kind of address an IP address is, the TTL and checksum notes, and
 * the padding an Ethernet frame adds past a short packet. The dissectors are arp.ts, ipv4.ts, ipv6.ts and icmp.ts.
 */
import { hex16, Src } from "../bytes";
import { type Ctx } from "./core";

export function classifyV4(b: Uint8Array): string {
  const [a = 0, c = 0, d = 0] = b;
  if (b.every((x) => x === 255)) return "limited broadcast";
  if (b.every((x) => x === 0)) return "unspecified: a host with no address yet";
  if (a === 10 || (a === 172 && c >= 16 && c < 32) || (a === 192 && c === 168))
    return "private, RFC 1918";
  if (a === 100 && c >= 64 && c < 128) return "carrier-grade NAT, RFC 6598";
  if (a === 127) return "loopback";
  if (a === 169 && c === 254) return "link-local: no DHCP answer";
  if (a >= 224 && a < 240) return "multicast";
  if (
    (a === 192 && c === 0 && d === 2) ||
    (a === 198 && c === 51 && d === 100) ||
    (a === 203 && c === 0 && d === 113)
  ) {
    return "documentation range, RFC 5737";
  }
  return "public";
}

export function classifyV6(b: Uint8Array): string {
  const a = ((b[0] ?? 0) << 8) | (b[1] ?? 0);
  if (b.every((x) => x === 0)) return "unspecified";
  if (b.subarray(0, 15).every((x) => x === 0) && b[15] === 1) return "loopback";
  if ((a & 0xffc0) === 0xfe80) return "link-local: never routed";
  if ((a & 0xfe00) === 0xfc00) return "unique local, RFC 4193";
  if ((a & 0xff00) === 0xff00) {
    if (a === 0xff02 && b[11] === 1 && b[12] === 0xff) return "solicited-node multicast";
    if (a === 0xff02 && b[15] === 1 && b.subarray(2, 15).every((x) => x === 0))
      return "all-nodes multicast";
    if (a === 0xff02 && b[15] === 2 && b.subarray(2, 15).every((x) => x === 0))
      return "all-routers multicast";
    return "multicast";
  }
  if (a === 0x2001 && b[2] === 0x0d && b[3] === 0xb8) return "documentation range, RFC 3849";
  if ((a & 0xe000) === 0x2000) return "global unicast";
  return "other";
}

export const TTL_WHY =
  "Decremented by every router; at 0 the packet is dropped and ICMP Time Exceeded sent back. 64 from Linux, macOS, iOS and Android, 128 from Windows: a reply's TTL hints at the sender's OS and how many hops away it is.";

export const OFFLOAD =
  " Captured on the sending host, outgoing packets often show a wrong value: with checksum offload the NIC fills it in after the capture point.";

export function checksumValue(stored: number, ok: boolean) {
  return `${hex16(stored)} ${ok ? "(correct)" : "(incorrect)"}`;
}

export function padding(ctx: Ctx, frame: Src, end: number) {
  if (end >= frame.length) return;
  const eth = ctx.out.headers.find((h) => h.proto === "eth");
  if (!eth?.children) return;
  const n = frame.length - end;
  const [offset, length] = frame.span(end, n);
  eth.children.push({
    id: "eth.padding",
    name: "Padding",
    value: `${n} bytes`,
    offset,
    length,
    layer: "link",
    why: "Ethernet frames are at least 64 bytes with the FCS, so short ones are padded. Old drivers padded with stale memory: CVE-2003-0001, 'Etherleak'.",
  });
}
