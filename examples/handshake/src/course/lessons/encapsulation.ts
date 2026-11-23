/**
 * Lesson 1: what each layer adds to a packet, and the arithmetic that falls out of it (MTU, MSS, overhead).
 * It is first because every later lesson reads headers.
 */
import type { Lesson } from "../types";

export const encapsulation: Lesson = {
  id: "encapsulation",
  title: "Encapsulation and the MTU arithmetic",
  promise: "Read any packet as a stack of headers, and compute what fits in it.",
  minutes: 14,
  steps: [
    {
      title: "Seven layers on paper, four in the wire",
      body: [
        "The [[osi-model]] has seven layers: physical, data link, network, transport, session, presentation, application. It was designed as a committee reference model, and the protocols that won were designed separately, as the four-layer [[tcp-ip-model]] of RFC 1122: **link, internet, transport, application**.",
        "Nothing in the Internet’s stack implements “session” or “presentation” as a layer. TLS does what OSI would call both, and sits awkwardly between TCP and HTTP. Wi-Fi and Ethernet each span OSI’s layers 1 and 2. QUIC is a transport that contains its own cryptographic handshake. OSI survives as vocabulary: “layer 2” means Ethernet or Wi-Fi framing, “layer 3” means IP, “layer 4” TCP/UDP, “layer 7” the application protocol.",
        "The layers pane beside this lesson maps both models onto one real packet: an HTTP request. Each coloured band is one layer’s header or payload.",
      ],
      show: { capture: "tcp-lifecycle", mark: "request" },
    },
    {
      title: "Encapsulation: every layer wraps the one above",
      body: [
        "The application hands bytes down. TCP puts a header in front and calls the result a *segment*. IP puts a header in front of that: a *packet*. The link layer adds a header and a trailer: a *frame*. The receiver peels in the reverse order, and each layer reads only its own header.",
        "The same bytes are in the hex view, coloured by layer. The first 14 bytes belong to the link layer, the next 20 to IP, the next 20 or more to TCP, and what remains is the HTTP request. Of the three, only the [[frame]] has a trailer: a 4-byte CRC the network card checks and usually strips, which is why captures rarely show it.",
      ],
      show: { capture: "tcp-lifecycle", mark: "request" },
    },
    {
      title: "The Ethernet header: 14 bytes, and a cost you do not see",
      body: [
        "Destination [[mac-address]] (6 bytes), source MAC (6), EtherType (2): 14 bytes. EtherType `0x0800` says the payload is IPv4, `0x86DD` IPv6, `0x0806` [[arp]], `0x8100` a [[vlan]] tag.",
        "On the wire a frame also carries a 7-byte preamble, a 1-byte start delimiter, the 4-byte FCS and a 12-byte inter-frame gap. A full-size frame is 1500 payload + 14 + 4 = 1518 bytes, but occupies 1538 bytes of line time. Even a perfect TCP transfer therefore tops out at 1460 / 1538 ≈ 94.9% of the line rate. That is the “gigabit gives me 940 Mbit/s” number, and it is not a defect.",
        "The MAC addresses are *per link*. A router throws the whole link header away and builds a new one for the next hop; the IP header is what survives the journey.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn" },
    },
    {
      title: "The IP header: 20 bytes of who, where, and how long",
      body: [
        "IPv4’s header is 20 bytes when it has no options (IHL = 5, counted in 32-bit words; options can stretch it to 60, and almost nothing uses them). The fields that matter: **source and destination address**, **TTL** (decremented per router, drop at zero), **protocol** (6 TCP, 17 UDP, 1 ICMP), the **DF** flag, the identification and fragment-offset fields used by [[fragmentation]], total length, and a header checksum that every router must recompute because TTL changed.",
        "IPv6’s header is a fixed 40 bytes: bigger addresses, but fewer fields. It has no header checksum (the link layer and transport checksum catch corruption), no fragmentation fields (those moved into an optional extension header only the sender may use), and TTL is renamed hop limit. Fewer fields to process is a deliberate router-speed decision.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn-ack" },
    },
    {
      title: "The TCP header: 20 bytes, up to 60",
      body: [
        "Source and destination port (2 + 2), sequence and acknowledgment numbers (4 + 4), data offset and flags (2), window (2), checksum (2), urgent pointer (2): 20 bytes. The data offset counts 32-bit words in 4 bits, so options can add up to 40 more.",
        "In practice a SYN carries about 20 bytes of options (MSS, SACK-permitted, timestamps, window scale), and later segments usually carry 12 bytes of timestamps, making the common header 32. Hold on to that: it is why a 1500-byte MTU rarely carries 1460 bytes of payload, and why a capture shows 1448.",
        "Find the options in the SYN’s dissection tree beside this lesson. UDP, for contrast, is 8 bytes: ports, length, checksum.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn" },
    },
    {
      title: "MTU and MSS: where 1460 comes from",
      body: [
        "The [[mtu]] is the largest IP packet a link carries. For Ethernet it is **1500**, measured from the first byte of the IP header: the frame header and trailer are outside it. The [[mss]] is the largest *TCP payload* a peer will accept, and each side announces it in its SYN.",
        "```\nMSS = MTU − IP header − TCP header\n    = 1500 − 20 − 20 = 1460   (IPv4)\n    = 1500 − 40 − 20 = 1440   (IPv6)\n```",
        "The MSS option does not count the other TCP options: RFC 6691 says to subtract them from the payload, so with timestamps on a segment carries 1448 bytes. A host derives its MSS from its own interface MTU, and each side then sends no more than the other announced, which keeps either end from building a segment the other’s first link cannot carry.",
        "The same arithmetic runs for UDP applications, with no negotiation at all. DNS used a 512-byte answer limit for decades for the same reason, and the 2020 DNS flag day settled on 1232 bytes of EDNS payload so that a reply fits a minimum-MTU IPv6 packet (1280 − 40 − 8) without fragmenting.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn-ack" },
      tryIt: {
        text: "Find your real path MTU. Ping with the don’t-fragment bit and grow the size until it fails: 1472 bytes of ICMP data + 8 + 20 = 1500. macOS: `ping -D -s 1472 1.1.1.1`; Linux: `ping -M do -s 1472 1.1.1.1`; Windows: `ping -f -l 1472 1.1.1.1`. If 1472 fails while smaller sizes get replies, something on your path (or your own interface) is smaller than 1500.",
        open: { kind: "connection", params: {} },
      },
    },
    {
      title: "When the numbers change",
      body: [
        "Every extra layer of tunnelling subtracts from the payload, and the arithmetic is all you need:",
        "- **IPv6**: 40-byte header, so MSS 1440. Links must carry at least 1280; routers never fragment.\n- **802.1Q [[vlan]]**: +4 bytes of tag. The frame grows to 1522; the MTU stays 1500 as long as every switch accepts it.\n- **[[pppoe]]** (many DSL and fibre ISPs): +8 bytes, so MTU **1492**, MSS 1452. RFC 4638 lets some ISPs restore 1500 with a baby-jumbo link.\n- **WireGuard**: 32 bytes of header + 8 UDP + 20 or 40 of IP = 60 or 80 bytes of overhead; the default interface MTU is 1420 so it also fits IPv6 transport.\n- **Jumbo frames**: 9000 on a LAN that opts in everywhere; one device left at 1500 and it breaks quietly.\n- **Wi-Fi**: 802.11 can carry 2304 bytes, but access points bridge to Ethernet and keep 1500.",
        "A mismatch is rarely a clean failure. Small packets (DNS, SYN, ACKs, the start of a TLS handshake) work, large ones disappear, and you get “it connects but pages hang”. That is the signature of a path MTU black hole.",
      ],
    },
    {
      title: "What a router rewrites, and why large packets die quietly",
      body: [
        "A router takes the frame off the wire, discards the link header, reads the IP destination, decrements TTL, recomputes the IPv4 checksum, looks up the next hop, and builds a new link header with a new pair of MAC addresses. Source and destination IP stay untouched, unless something is doing [[nat]], in which case it also rewrites addresses and ports and fixes the checksums.",
        "If the next link’s MTU is smaller than the packet, an IPv4 router may fragment it, unless the sender set DF. TCP sets DF on nearly everything, so the router drops it and sends back an ICMP “fragmentation needed”: this is [[pmtud]]. IPv6 has only this path: routers never fragment, they send Packet Too Big.",
        "The failure mode follows directly. A firewall that drops all ICMP drops those messages, the sender never learns, and unless its stack falls back to probing smaller sizes (PLPMTUD, RFC 4821) every full-size segment vanishes. Hence the rule of thumb: never block ICMP wholesale, and clamp the MSS on a tunnel or PPPoE interface so TCP never builds a packet the path cannot carry.",
      ],
      show: { capture: "tcp-lifecycle", mark: "response-first" },
    },
  ],
  check: [
    {
      q: "A PPPoE connection has MTU 1492. What MSS does a TCP host announce over IPv4 and over IPv6?",
      a: ["IPv4: 1492 − 20 − 20 = **1452**. IPv6: 1492 − 40 − 20 = **1432**."],
    },
    {
      q: "Why does a gigabit Ethernet transfer settle near 940 Mbit/s even on a perfect LAN?",
      a: [
        "Each full frame carries 1460 bytes of TCP payload but occupies 1538 bytes of line time (frame, FCS, preamble, gap): 1460 / 1538 ≈ 94.9%. With TCP timestamps it is 1448 / 1538 ≈ 94.1%.",
      ],
    },
    {
      q: "Pages load partly and then hang on one network only, though ping works. What is the first thing to suspect, and why do small packets get through?",
      a: [
        "A path MTU black hole: something on the path has a smaller MTU than the endpoints assume and the ICMP “too big” message is being filtered. Small packets fit; full-size ones are dropped with DF set and the sender never hears why.",
      ],
    },
  ],
};
