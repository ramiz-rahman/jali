/**
 * Lesson 3: what happens between plugging a device in and it reaching the Internet: ARP, DHCP, NAT, CGNAT, and
 * what a scan of the LAN can and cannot tell you.
 */
import type { Lesson } from "../types";

export const homeNetwork: Lesson = {
  id: "home-network",
  title: "Inside your home network",
  promise:
    "Follow a device from joining the Wi-Fi to its first packet out, and read your own device list.",
  minutes: 13,
  steps: [
    {
      title: "One broadcast domain, one router",
      body: [
        "Your home is one [[cidr|subnet]], usually 192.168.0.0/24 or 192.168.1.0/24, and one router that is the [[gateway]] out of it. Every device on the subnet reaches every other by link-layer frames; anything outside goes to the router. That single fact explains most of what follows.",
        "To send a frame, a host needs a MAC address, but applications give it an IP address. Something has to translate. That something, on IPv4, is [[arp]].",
      ],
    },
    {
      title: "ARP: who has this address?",
      body: [
        "A host wanting 192.168.1.1 broadcasts to `ff:ff:ff:ff:ff:ff`: “who has 192.168.1.1? tell 192.168.1.20.” (EtherType `0x0806`, a 28-byte payload). The owner answers by unicast with its MAC. The result lives in the ARP cache for anywhere from tens of seconds to a few minutes, depending on the OS, and the exchange is invisible to the user, which is the point.",
        "ARP has no authentication. Any host may answer, or announce a MAC for an address that is not its own (a *gratuitous* ARP). That is the root of ARP spoofing, and the reason switches in managed networks have dynamic ARP inspection. IPv6 has no broadcast at all: [[ndp]] does the same job with ICMPv6 messages to a solicited-node multicast address, so only hosts whose address ends in the same 24 bits are interrupted, not everyone.",
      ],
      show: { capture: "home-lan", mark: "arp-request" },
    },
    {
      title: "The reply, and what it tells you",
      body: [
        "The reply is unicast and carries the sender’s MAC. This is also what a LAN scanner reads: `arp -a` is simply a dump of this cache, and tools like nmap in ARP mode discover hosts by asking everyone “who has?” in sequence. An IPv4 host that wants to be reached has to answer ARP, so it is hard to hide from; IPv6-only and sleeping devices are the blind spot.",
        "Notice what is being learned: only the **link-layer identity**. Hence the [[oui]] lookup: the first three bytes of the MAC name the organisation the block was assigned to, usually the chip or device maker, which is how a scan can label a device “Apple” or “Espressif” without asking it anything.",
      ],
      show: { capture: "home-lan", mark: "arp-reply" },
    },
    {
      title: "DHCP: how a device gets an address (DORA)",
      body: [
        "A device that just joined has no address, so it broadcasts from `0.0.0.0` to `255.255.255.255`, UDP port 68 to port 67. [[dhcp]] is four messages, [[dora]]:",
        "- **Discover**: “is there a DHCP server?”\n- **Offer**: the server proposes an address, mask, router (option 3), DNS servers (option 6) and a lease time (option 51).\n- **Request**: the client picks an offer, by broadcast, so any other server that offered knows its offer was declined. Option 50 names the address.\n- **Acknowledge**: the server commits it.",
        "Before using the address the client should check nobody else has it, with an ARP probe (RFC 5227). The client tries to renew its [[lease]] by unicast at half its length (T1, by default) and, failing that, to rebind by broadcast at 87.5% (T2). If no DHCP server answers, an IPv4 host gives itself a `169.254.x.x` link-local address: seeing one on a home network means DHCP failed, not that the Internet is down.",
      ],
      show: { capture: "home-lan", mark: "dhcp-discover" },
    },
    {
      title: "Offer and acknowledge: the options that matter",
      body: [
        "The Offer and the Ack carry the configuration that decides how the whole network behaves: the router address, the DNS servers, and the lease. Changing DNS for the whole house is a DHCP setting, not a per-device one. A short lease on a busy guest network makes addresses recycle; a long one makes a device’s IP stable, which is why “reserve this address” in a router UI is just a DHCP rule keyed on the MAC (or the client identifier).",
        "The server can answer by broadcast or unicast depending on a flag in the Discover. Look at the Offer and Ack beside this lesson and find option 53 (message type), 54 (server identifier) and 51.",
      ],
      show: { capture: "home-lan", mark: "dhcp-offer" },
    },
    {
      title: "NAT and PAT: one address for the house",
      body: [
        "Your devices have [[private-address|private addresses]] (10/8, 172.16/12, 192.168/16, from RFC 1918), which are not routed on the Internet. The router sits on a public address and does [[nat]]: strictly, [[pat]]. It rewrites the source of each outgoing packet to its own public address and a port of its own (often the original, if free), and remembers the mapping in a connection table, typically keyed on the 5-tuple. Replies are matched against it and rewritten back.",
        "The consequences all come from that table. Inbound connections to your devices have no entry, so they are dropped. This looks like a firewall but is a side effect, not a policy. Idle UDP entries often expire in tens of seconds to a few minutes (RFC 4787 asks for at least two; hence keep-alives), established TCP entries in hours to days. A port forward is a manually written table entry. Protocols that carry addresses inside their payload break, and need a helper in the router (an ALG) or STUN and ICE to discover and test their outside address, which is why video calls are so complicated to set up.",
        "IPv6 removes the need for translation: every device can have a global address. You still want the router’s stateful firewall, which blocks unsolicited inbound by default (RFC 6092).",
      ],
    },
    {
      title: "CGNAT: when the “public” address is not yours",
      body: [
        "IPv4 ran out, so many ISPs put a second NAT in front of *their* customers: [[cgnat]]. The signature is a WAN address in **100.64.0.0/10** (RFC 6598, the shared address space reserved for exactly this), or a WAN address on your router that differs from what a “what is my IP” site shows (with no VPN or second router of your own in the way).",
        "Under CGNAT your own port forwards do nothing, so nothing is reachable inbound over IPv4 without the ISP’s help (some offer PCP or a public address) or a tunnel out, and you share your public address with strangers, so blocklists and rate limits hit you for their behaviour. The practical escape is IPv6, which ISPs behind CGNAT usually still deliver natively. The path lesson shows the tell in a traceroute: a hop inside 100.64/10 just after your router, a strong sign though not proof.",
      ],
      show: { kind: "path", params: { scan: "sample-path" } },
    },
    {
      title: "Reading a device list, and randomised MACs",
      body: [
        "The devices pane lists what the sample scan found: address, MAC, a vendor from the [[oui]], and a name where [[mdns]] or DHCP gave one. A browser cannot scan your LAN, so on your own network you run a command and paste the output into Scans.",
        "Vendor lookups have a blind spot. Phones and laptops now use a [[randomised-mac]] per network: the MAC has the *locally administered* bit set (bit 1 of the first octet, so the second hex digit is 2, 6, A or E) and matches no manufacturer. A row that shows “unknown” and starts `a2:`, `3e:` or `d6:` is almost always a phone with Private Wi-Fi Address on. It can also change if the network is forgotten, which makes “I blocked that device” last only until the address changes.",
      ],
      show: { kind: "devices", params: { scan: "sample-devices" } },
      tryIt: {
        text: "Scan your own LAN. Open Scans, copy the command for your OS (`arp -a` works everywhere), paste its output, and match every row to something you own. A device you cannot place is the one worth investigating.",
        open: { kind: "scans", params: {} },
      },
    },
  ],
  check: [
    {
      q: "What is different about the first DHCP message compared to an ordinary packet?",
      a: [
        "The client has no address yet: source IP `0.0.0.0`, destination `255.255.255.255`, UDP 68 to 67, link-layer broadcast. It has to reach a server it has never met.",
      ],
    },
    {
      q: "Your router’s WAN address is 100.72.4.19. What does that tell you, and what can you not do?",
      a: [
        "It is in 100.64.0.0/10: your ISP is almost certainly doing CGNAT. Your own port forwards cannot open inbound IPv4 connections, since the second NAT is not yours; only the ISP (or a tunnel out) can.",
      ],
    },
    {
      q: "A device in your list has MAC `da:5b:…` and no vendor. Why?",
      a: [
        "`0xda` has the locally administered bit set (…10 in the low bits). It is locally administered, which on a phone or laptop almost always means a randomised MAC, so there is no OUI to look up.",
      ],
    },
  ],
};
