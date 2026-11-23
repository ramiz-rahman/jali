/**
 * Lesson 5: TCP, following one generated connection from SYN to teardown, then the same machinery live on the
 * reader's own connection (cwnd and retransmissions from Cloudflare's server-side stats).
 */
import type { Lesson } from "../types";

export const tcp: Lesson = {
  id: "tcp",
  title: "TCP: handshake, windows, loss, teardown",
  promise:
    "Read a TCP conversation like a protocol analyst: numbers, windows, losses, and what the sender does about them.",
  minutes: 20,
  steps: [
    {
      title: "A reliable stream out of an unreliable network",
      body: [
        "IP delivers packets best-effort: they can be lost, duplicated, reordered. [[tcp|TCP]] builds on that an ordered, reliable byte stream, with three mechanisms: **sequence numbers** (every byte is numbered, so the receiver can reorder and detect gaps), **acknowledgments** (the receiver says what it has), and **windows** (two limits on how much may be in flight: the receiver’s and the network’s).",
        "The ladder beside this lesson is one HTTP/1.1 request over TCP. It is generated, and carries one of each event we will cover: handshake, data, a duplicate ACK, a retransmission, a window update, teardown. Time runs down; each arrow is a packet.",
      ],
      show: { kind: "ladder", params: { capture: "tcp-lifecycle" } },
    },
    {
      title: "SYN: the first packet, and its options",
      body: [
        "The client sends a segment with the **SYN** flag set (plus ECE and CWR if it offers [[ecn|ECN]]). It carries the client’s [[isn|initial sequence number]]. The ISN does not start at zero: it is chosen unpredictably, from a keyed hash of the connection’s addresses and ports plus a clock (RFC 6528), so an attacker who cannot see the connection cannot practically guess its way into it.",
        "The SYN also carries the options, negotiated only here: **MSS** (kind 2), **window scale** (kind 3), **SACK-permitted** (kind 4), **timestamps** (kind 8). Window scale, SACK and timestamps are offers: if the SYN-ACK does not return one, it is off for the connection. MSS is not an offer but a statement of what this side can receive. Wireshark shows sequence numbers *relative* to the ISN, which is a display convenience: on the wire the number is 32 random-looking bits.",
        "A SYN costs one sequence number of its own, whether or not it carries data (only TCP Fast Open puts data in it). Same for a FIN.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn" },
    },
    {
      title: "SYN-ACK: the server answers",
      body: [
        "The server replies with SYN and ACK set. Its own ISN goes in the sequence field; the acknowledgment number is the client’s ISN + 1: “I have everything up to your ISN, send me the next byte”. That +1 is the SYN’s phantom byte.",
        "A server under a SYN flood cannot afford to keep state for every half-open connection, so many use **SYN cookies**: encode the needed state into the server’s ISN and keep nothing until the client’s ACK arrives echoing it.",
        "Compare the options the server echoes with the client’s. The MSS can differ in each direction: each side announces what it can receive.",
      ],
      show: { capture: "tcp-lifecycle", mark: "syn-ack" },
    },
    {
      title: "ACK, and the first data: 1 RTT in",
      body: [
        "The client’s ACK completes the handshake: acknowledgment = server ISN + 1. It could carry data too; in practice the client sends its request immediately after. **One full round trip has passed before the first byte of the request leaves**, which is the cost every later lesson (TLS, QUIC) is trying to shave.",
        "Look at the request packet. Its sequence number is client ISN + 1 (relative: 1), and its length is the size of the HTTP request. The server’s ACK will be seq + length: ACKs are *cumulative*, and name the next byte expected. They do not name the byte received.",
      ],
      show: { capture: "tcp-lifecycle", mark: "request" },
    },
    {
      title: "Flow control: the receive window",
      body: [
        "Every segment carries the [[window|receive window]]: how many more bytes the sender may have unacknowledged. A slow application reading from its socket fills the buffer and the window shrinks, down to zero, which stops the sender: this is flow control.",
        "The field is 16 bits, 65,535 bytes at most, and that is nowhere near enough for a fast path. The ceiling is window / RTT: 64 KB over 20 ms is 3.3 MB/s, **about 26 Mbit/s**, whatever the link can do. [[window-scaling]] (agreed in the SYN, never later) multiplies the field by 2^n for n up to 14, allowing about 1 GiB. The needed window is the [[bdp]]: 1 Gbit/s × 20 ms = 2.5 MB.",
        "A window update is an ACK whose only news is a larger window: the receiver reopening room after the application read. If you see lots of `TCP ZeroWindow` in a capture, the problem is the receiving application, not the network.",
      ],
      show: { capture: "tcp-lifecycle", mark: "window-update" },
    },
    {
      title: "Loss, part 1: duplicate ACKs and fast retransmit",
      body: [
        "Suppose segment 3 of 6 is lost. The receiver gets 4, 5, 6, which are out of order. It cannot acknowledge them cumulatively (the ack number is still the start of the missing segment), so it re-sends the *same* ACK each time: a [[dup-ack|duplicate ACK]]. Three duplicates are strong evidence of loss, not reordering, and the sender retransmits immediately: [[fast-retransmit]], with no timer involved (RFC 5681).",
        "With [[sack]] (negotiated in the SYN) the duplicates also carry ranges: “I have 4–6”. The sender then knows exactly what is missing, and does not resend 4–6 unnecessarily. Without SACK, TCP can only learn about one hole per round trip.",
        "Recovery after fast retransmit is mild: the window is cut to about half, and the connection continues. A loss on a busy pipe costs about one extra round trip of delay, not a timeout.",
      ],
      show: { capture: "tcp-lifecycle", mark: "dup-ack" },
    },
    {
      title: "Loss, part 2: the retransmission timeout",
      body: [
        "Fast retransmit needs later segments to trigger duplicate ACKs. If the *last* segments of a burst are lost, nothing follows, and classic TCP has only a timer: the [[rto]]. It is computed from a smoothed RTT and its mean deviation (RFC 6298: SRTT + max(G, 4·RTTVAR)), at least 1 second by the standard (Linux floors it at 200 ms), and **doubles after each failure**. A timeout is also read as severe congestion: the congestion window drops to one segment and slow start starts over.",
        "That asymmetry is why small requests suffer: tail loss on a short response means a 200 ms to 1 s stall, where a loss in the middle of a bulk transfer costs almost nothing. Tail loss probe and RACK (RFC 8985) exist to shorten exactly that gap.",
      ],
      show: { capture: "tcp-lifecycle", mark: "retransmission" },
    },
    {
      title: "Congestion control: finding the speed",
      body: [
        "The sender limits itself to min(**[[cwnd]]**, receive window). cwnd usually starts at 10 segments (RFC 6928, about 14.6 KB) and the sender doesn’t know the path’s capacity, so it probes. In [[slow-start]] it grows by what each ACK acknowledges, roughly doubling the window each round trip, until loss or [[ssthresh]]. After that, congestion avoidance grows it more slowly (Reno: about one segment per round trip; CUBIC: along its curve), and a loss cuts it back (Reno halves; CUBIC cuts to 70%).",
        "Slow start is why a fresh connection is slow however fat the pipe: reaching a 2.5 MB window from 14.6 KB takes about 8 doublings, so 8 round trips. Over a 100 ms path that is nearly a second, and why short transfers are latency-bound, not bandwidth-bound.",
        "The connection pane measures this live on your connection. It downloads from Cloudflare’s speed test over HTTPS, notes which HTTP version your browser negotiated, and shows the server-side numbers Cloudflare reports for the connection: RTT, congestion window, retransmissions. Over HTTP/1.1 or HTTP/2, those are TCP’s.",
      ],
      show: { kind: "connection", params: {} },
      tryIt: {
        text: "Run the measurement and watch cwnd and retransmits. On a clean wired connection retransmits stay near zero. On a congested Wi-Fi link, or a saturated uplink, they do not. Then run it while someone else streams video, and compare.",
        open: { kind: "connection", params: {} },
      },
    },
    {
      title: "CUBIC and BBR: two answers to “how fast?”",
      body: [
        "[[cubic|CUBIC]] (RFC 9438; the default in Linux, Windows and Apple’s stack) is loss-based: it keeps growing the window until packets drop, then backs off and probes again along a cubic curve, flat near the previous peak and aggressive away from it. Its weakness is built in. To find the limit it must overfill the bottleneck buffer: this is the engine of [[bufferbloat]], the next lesson.",
        "[[bbr|BBR]] (Google, 2016) models the path instead: it estimates the bottleneck bandwidth and the minimum RTT, and paces at that rate with roughly one [[bdp]] in flight, probing for more now and then. On a clean path it keeps queues short and is far less sensitive to random loss, which is why it helps on lossy long-haul and mobile links. Version 1 was unfair to CUBIC flows sharing a bottleneck; later versions were reworked.",
        "Which one your connection used is a property of the *sender* (the server, for a download), not your computer. You choose the algorithm for what you upload.",
      ],
    },
    {
      title: "Teardown and TIME_WAIT",
      body: [
        "Each direction closes by itself. One side sends [[fin|FIN]], “I have no more data”; the other ACKs it, and later sends its own FIN, which gets an ACK: four segments, or three when the ACK and FIN merge. The ladder shows the FIN and then the last ACK. RST is the abort: no handshake, state dropped.",
        "The side that closed first ends in [[time-wait|TIME_WAIT]], for twice the maximum segment lifetime in the standard (minutes), and a fixed 60 seconds in Linux. It does two jobs: if the final ACK is lost, the peer retransmits its FIN and this side must still be there to ACK it; and any old duplicate of this connection dies out before the same 4-tuple is reused.",
        "The operational consequence: a client that opens thousands of short connections to the same server can exhaust its ephemeral ports. Linux has about 28,000 by default (32768–60999), so at a 60-second TIME_WAIT that is about 470 new connections a second to one destination. The fix is connection reuse (keep-alive, pooling, HTTP/2), not a smaller timeout.",
      ],
      show: { capture: "tcp-lifecycle", mark: "last-ack" },
    },
  ],
  check: [
    {
      q: "A client’s ISN is 1000. It sends a SYN, then a request of 200 bytes. What are the sequence number of the request and the server’s ACK for it?",
      a: [
        "The SYN uses sequence 1000 and consumes one number, so the request has sequence **1001** (relative: 1). The server acknowledges **1201** (1001 + 200): the next byte it expects.",
      ],
    },
    {
      q: "A path with RTT 50 ms and no window scaling: what is the best throughput?",
      a: ["65,535 bytes / 0.05 s ≈ 1.31 MB/s, about **10.5 Mbit/s**, on any link."],
    },
    {
      q: "When does TCP recover from loss in about one RTT, and when does it stall for hundreds of milliseconds?",
      a: [
        "When later segments are in flight, they trigger duplicate ACKs and fast retransmit resends at once, so the hole is filled about a round trip after the loss. When the lost segment is the tail of a burst, nothing follows to trigger duplicate ACKs, so classic TCP waits for the RTO: 200 ms to a second, and the window collapses. Tail loss probe (RFC 8985) shortens this on modern stacks.",
      ],
    },
    {
      q: "Why is a big download on a fresh connection slow for its first second, regardless of link speed?",
      a: [
        "Slow start: cwnd begins at about 10 segments and doubles once per RTT, so reaching a window of one BDP takes log₂(BDP / 14.6 KB) round trips.",
      ],
    },
  ],
};
