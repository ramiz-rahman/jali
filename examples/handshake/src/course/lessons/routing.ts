/**
 * Lesson 9: how a packet finds its way, and how traceroute exploits TTL to show the path. The skill taught is
 * reading the output honestly: `* * *`, latency at one hop, asymmetric return paths.
 */
import type { Lesson } from "../types";

export const routing: Lesson = {
  id: "routing",
  title: "Routing and traceroute",
  promise:
    "Read a traceroute without being fooled by it, and say what is and is not a problem on the path.",
  minutes: 13,
  steps: [
    {
      title: "A hop budget in every packet",
      body: [
        "Every IP packet has an 8-bit [[ttl|TTL]] (IPv6: hop limit). Each router decrements it by one before forwarding; when it would reach zero the router discards the packet instead. The point is protection against loops: a packet caught in a routing loop dies after at most 255 hops rather than circling forever. In practice the count is *hops*: RFC 791 defined it in seconds, but every router simply decrements it by one.",
        "Operating systems pick a starting value: 64 on Linux and macOS, 128 on Windows, 255 on many routers. Seen from the other end, the TTL left on an arriving packet tells you roughly how far it came: 52 arriving from a Linux box means about 12 hops.",
        "The packet pane shows a traceroute probe: a UDP datagram with TTL 1. It will not get far.",
      ],
      show: { capture: "traceroute", mark: "ttl-1" },
    },
    {
      title: "Time Exceeded: the router speaks up",
      body: [
        "A router that discards a packet for TTL expiry may tell the sender: it generates an ICMP **Time Exceeded** message (type 11 code 0; ICMPv6 type 3) addressed to the packet’s source, from *its own* address. The message quotes the offending IP header and at least the next 8 bytes of the original (most routers now quote more), enough to include the UDP or TCP ports and TCP’s sequence number.",
        "That is the whole trick of [[traceroute]]. Send a probe with TTL 1: the first router discards it and identifies itself. TTL 2 reaches the second router, and so on. The quoted header lets the tool match each reply to the probe that caused it.",
      ],
      show: { capture: "traceroute", mark: "exceeded-1" },
    },
    {
      title: "Increase the TTL, learn the next hop",
      body: [
        "The next probe has TTL 2. It passes the first router (TTL becomes 1) and dies at the second, which answers with its own Time Exceeded. Classic traceroute sends three probes per hop, to destination ports starting at 33434 and increasing, with a timeout of a few seconds each, up to 30 hops by default. The three times you see per line are the three round trips.",
        "Different tools probe differently. Unix `traceroute` sends UDP; Windows `tracert` sends ICMP echo; `traceroute -I` (ICMP) and `-T` (TCP, Linux) change that; `mtr` sends continuously and shows loss statistics per hop. If one is filtered, another may pass: firewalls often block UDP high ports but allow ICMP echo or TCP 443.",
      ],
      show: { capture: "traceroute", mark: "ttl-2" },
    },
    {
      title: "Hop two’s reply, and what a hop is",
      body: [
        "Look at the second reply: its *source address* is one of the router’s own, usually the interface the reply leaves by, which with asymmetric routing need not be the one the probe came in on. A hop is a router interface, not a place; a router with many ports can present different addresses for different paths through it. That is also why names (reverse DNS, like `ae-1.r21.nycmny01.us.bb.example.net`) are useful: they often encode the router’s role, city and the link it sits on.",
        "Between your home and a distant server there are usually 8 to 20 hops. The first is your own router (a private address); the next may be a carrier-grade NAT (a 100.64.0.0/10 address, see the home network lesson); then ISP equipment, one or more transit or peering networks, and the destination’s network.",
      ],
      show: { capture: "traceroute", mark: "exceeded-2" },
    },
    {
      title: "Arriving: how the destination ends it",
      body: [
        "When a probe finally has enough TTL to reach the destination, the destination does not send Time Exceeded: it *answers*. For a UDP probe aimed at an unlikely port that is ICMP **Port Unreachable** (type 3 code 3); for an ICMP echo probe, an echo reply; for TCP, a SYN-ACK or RST. Receiving that is how traceroute knows to stop.",
        "The capture ends in exactly this reply. The sample path beside it was made up to look like a real home-to-server trace: a home router, ISP hops, a silent hop and the destination.",
      ],
      show: { capture: "traceroute", mark: "final-reply" },
    },
    {
      title: "Asterisks: silence is not failure",
      body: [
        "A line of asterisks means no reply arrived in the timeout for any of the three probes. It does **not** mean the router is down, because the router forwarded the probes (the later hops answered). The usual causes: the router is configured not to send ICMP Time Exceeded; a firewall drops those replies; or the router rate-limits ICMP generation heavily.",
        "The only time `* * *` is meaningful is when it runs to the **end** of the trace and no further hop ever replies: then traffic is being dropped somewhere, or the destination just does not answer probes of that type. Try again with a different probe type before deciding which. In the sample path beside this step, hop 3 is `* * *` and hop 4 onward answer normally: the first case, harmless. Hop 2 there is `100.64.0.1`, the likely CGNAT tell from the home network lesson.",
      ],
      show: { kind: "path", params: { scan: "sample-path" } },
    },
    {
      title: "The latency trap",
      body: [
        "The most common misreading of traceroute: “hop 7 takes 140 ms, so that router is slow.” Almost always wrong. A router forwards packets in specialised hardware (the *fast path*), but a Time Exceeded message is generated by the router’s general-purpose CPU (the *slow path*), at low priority, and often rate-limited by control-plane policing. The extra time at that hop is mostly that CPU getting round to the reply, not how long the router takes to forward your traffic.",
        "The test: if hop 7 shows 140 ms but hops 8, 9 and the destination show 20 ms, there is no problem at 7: later probes pass through that same router at line rate and return quickly. A real problem **persists to the end**: latency or loss that starts at hop N and stays for every hop after N, including the destination.",
        "That is also why ICMP loss at one hop does not mean packet loss on the path. Only loss that continues from that hop to the destination is evidence of real loss.",
      ],
      show: { kind: "path", params: { scan: "sample-path" } },
    },
    {
      title: "What traceroute cannot show: asymmetry, ECMP, hidden hops",
      body: [
        "- **[[asymmetric-routing|Asymmetric paths]].** Each network chooses its own exit by policy, so replies often take a different route home than your probes took out. The trace shows only the forward path, yet each hop’s RTT includes the *return* path to you, which you cannot see. A latency jump at a hop may be a different return route.\n- **[[ecmp|Load balancing]].** Routers split traffic over equal paths by hashing the flow’s ports and addresses. Classic traceroute changes the port on every probe, so consecutive hops may come from different paths and the printed route is a collage. Paris traceroute and `mtr` with fixed flows avoid it.\n- **Hidden hops.** MPLS networks may not decrement TTL for the inside of their backbone, so whole segments are invisible.\n- **The path is policy, not geography.** [[bgp|BGP]] chooses routes by business rules (prefer customers, then free peers, then paid transit), not by speed; the trace can wander far from the straight line. Mapping hops to their [[asn|ASN]] shows roughly where one network hands you to the next (link addresses can belong to either side, so the boundary may be off by a hop).",
      ],
    },
    {
      title: "Now your own",
      body: [
        "Run `traceroute -n 1.1.1.1` (`tracert -d 1.1.1.1` on Windows) and paste it into Scans. Count the hops, find the first private address (your router), look for a 100.64/10 hop (CGNAT), find the hop where the latency steps up and decide whether it persists to the end, and look for the move between your ISP and the next network. Then trace a destination in another country and compare.",
        "One last connection to the first lesson: path MTU discovery depends on the same ICMP machinery. Blocking ICMP does not just break traceroute; it also breaks the “too big” message that keeps large packets working.",
      ],
      show: { kind: "path", params: { scan: "sample-path" } },
      tryIt: {
        text: "Trace your own path: open Scans, run the command for your OS, and load the result into the path pane.",
        open: { kind: "scans", params: {} },
      },
    },
  ],
  check: [
    {
      q: "Hop 6 of a traceroute shows 180 ms and 30% loss. Hops 7–11 show 25 ms and no loss. Is there a problem at hop 6?",
      a: [
        "Almost certainly not. The router is deprioritising its own ICMP replies (slow path, rate limiting). Traffic through it, shown by the later hops, is fine. A real problem persists to the destination.",
      ],
    },
    {
      q: "Why does a UDP traceroute end with ICMP Port Unreachable, and what does a Windows trace end with?",
      a: [
        "The probe’s destination port is one nothing listens on, so the destination host answers ICMP Port Unreachable instead of Time Exceeded. Windows sends ICMP echo requests, and the destination answers with an echo reply.",
      ],
    },
    {
      q: "You see a hop at 100.64.12.1 right after your home router. What does it mean?",
      a: [
        "Almost certainly that your ISP runs carrier-grade NAT: the address is from the shared range 100.64.0.0/10 (RFC 6598), reserved for exactly that.",
      ],
    },
  ],
};
