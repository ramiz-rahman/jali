/** ARP: who has this IPv4 address, and the answer. */
import { hex16, ipv4, mac, Src } from "../bytes";
import { type Ctx, header, top } from "./core";
import { padding } from "./ip";

function arpWhy(op: number) {
  return op === 1
    ? "A broadcast question: who has this IPv4 address? Every host on the link hears it and may cache the asker's mapping."
    : "The answer, sent unicast to the asker. ARP has no authentication: anyone can answer for any address, which is all ARP spoofing is.";
}

export function dissectArp(ctx: Ctx, frame: Src, at: number) {
  const s = frame.sub(at, Math.min(28, frame.length - at));
  header(
    ctx,
    {
      proto: "arp",
      short: "ARP",
      name: "Address Resolution Protocol",
      layer: "net",
      s,
      i: 0,
      n: 28,
    },
    (F, _size, h) => {
      const op = s.u16(6);
      const sha = s.bytes(8, 6);
      const spa = s.bytes(14, 4);
      const tha = s.bytes(18, 6);
      const tpa = s.bytes(24, 4);
      const probe = op === 1 && spa.every((x) => x === 0);
      const announce = ipv4(spa) === ipv4(tpa);
      h.why =
        "Maps an IPv4 address to a MAC address on the local link (RFC 826). It never crosses a router.";
      h.value = op === 1 ? "request" : op === 2 ? "reply" : `opcode ${op}`;
      F.f("htype", "Hardware type", s.u16(0) === 1 ? "Ethernet (1)" : `${s.u16(0)}`, 0, 2);
      F.f(
        "ptype",
        "Protocol type",
        `${s.u16(2) === 0x0800 ? "IPv4" : ""} (${hex16(s.u16(2))})`,
        2,
        2,
      );
      F.f("hlen", "Hardware size", `${s.u8(4)}`, 4, 1);
      F.f("plen", "Protocol size", `${s.u8(5)}`, 5, 1);
      F.f(
        "op",
        "Opcode",
        op === 1 ? "request (1)" : op === 2 ? "reply (2)" : `${op}`,
        6,
        2,
        arpWhy(op),
      );
      F.f(
        "sha",
        "Sender MAC address",
        mac(sha),
        8,
        6,
        "The asker's own mapping rides along in every request, so one broadcast teaches the whole link where the asker is.",
      );
      F.f(
        "spa",
        "Sender IP address",
        ipv4(spa),
        14,
        4,
        probe
          ? "0.0.0.0: an ARP probe. Before using an address a host asks whether anyone has it (RFC 5227 conflict detection)."
          : undefined,
      );
      F.f(
        "tha",
        "Target MAC address",
        mac(tha),
        18,
        6,
        op === 1 ? "All zeros in a request: this is the unknown being asked for." : undefined,
      );
      F.f("tpa", "Target IP address", ipv4(tpa), 24, 4);
      ctx.out.src = mac(sha);
      ctx.out.dst = op === 1 ? "Broadcast" : mac(tha);
      if (probe) top(ctx, "ARP", `Who has ${ipv4(tpa)}? (ARP Probe)`);
      else if (announce) top(ctx, "ARP", `ARP Announcement for ${ipv4(spa)}`);
      else if (op === 1) top(ctx, "ARP", `Who has ${ipv4(tpa)}? Tell ${ipv4(spa)}`);
      else top(ctx, "ARP", `${ipv4(spa)} is at ${mac(sha)}`);
    },
  );
  padding(ctx, frame, at + 28);
}

/** Bytes after the IP datagram on a short Ethernet frame: padding up to the 60-byte minimum. */
