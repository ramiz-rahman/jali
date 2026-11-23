/**
 * Lesson 8: QUIC and HTTP/3: why a new transport on UDP, what the first packets contain (and why anyone can read
 * the first one), connection IDs, per-stream loss recovery, and how a browser learns to use it.
 */
import type { Lesson } from "../types";

export const quic: Lesson = {
  id: "quic",
  title: "QUIC and HTTP/3",
  promise:
    "Explain why QUIC exists, read its first packets, and watch your own browser switch to HTTP/3.",
  minutes: 18,
  steps: [
    {
      title: "Why a new transport, and why on UDP",
      body: [
        "TCP could not be fixed in place. Its header and behaviour are baked into middleboxes (NATs, firewalls, “optimisers”) that drop or rewrite anything unfamiliar, so a new TCP option takes a decade to be usable, and its implementation lives in the kernel, updated on an OS timescale. This problem is called *ossification*. [[quic|QUIC]] (RFC 9000, 2021) was designed to get out of it: build the new transport **in user space on top of UDP**, the one protocol middleboxes pass, and **encrypt nearly everything** so they cannot meddle with what they cannot read.",
        "It was designed to fix three things at once: the handshake cost (TCP then TLS: two round trips before a request), [[hol-blocking|head-of-line blocking]] across multiplexed streams, and the tie between a connection and a 4-tuple of addresses.",
        "The compare pane shows the TLS 1.3 ladder and the QUIC ladder side by side. Count the round trips before the first request.",
      ],
      show: { kind: "compare", params: { a: "tls13", b: "quic-h3" } },
    },
    {
      title: "The Initial packet: transport and TLS in one",
      body: [
        "QUIC does not run TLS over a reliable stream; it uses TLS 1.3’s handshake messages as a component, carried in QUIC `CRYPTO` frames, and takes the keys they produce. That merge is how one round trip does both jobs: the client’s first UDP datagram has the TLS ClientHello **and** the transport setup.",
        "That first packet is a long-header **Initial** (RFC 9000 §17.2): flags with the packet type, a 4-byte version (`0x00000001`), the [[dcid|destination connection ID]] and source connection ID with their lengths, a token, a length, a packet number and a payload containing the ClientHello. The client pads the UDP datagram to **at least 1200 bytes**. That is on purpose: a server will not answer with more than three times what it has received before validating the client’s address (which keeps QUIC from being a spoofing amplifier), so padding buys the server room for its first flight and proves the path carries 1200-byte datagrams.",
      ],
      show: { capture: "quic-h3", mark: "client-initial" },
    },
    {
      title: "“Encrypted”, but anyone can read it",
      body: [
        "Initial packets are encrypted, but with keys derived from information that is on the wire. The keys come from HKDF over the DCID of the client’s first Initial and a **fixed, public salt** written into the RFC (`38762cf7f55934b34d179ae6a4c80cadccbb7f0a` for version 1). Anyone who sees the first datagram can compute the same keys and decrypt it. That includes the [[sni|SNI]] in the ClientHello.",
        "This is deliberate, not a flaw. Encryption of the Initial exists to stop *ossification* (middleboxes parsing and depending on the handshake), not to hide anything or to stop an on-path attacker, who can compute the keys too; the server needs to read it before any secret exists. It means firewalls can still filter QUIC by hostname (and some do), and tools like Wireshark decrypt it without any key. Hiding the name needs [[ech|ECH]], as in TLS.",
        "Everything after the Initial exchange uses real, secret keys.",
      ],
      show: { capture: "quic-h3", mark: "client-initial" },
    },
    {
      title: "Server Initial and Handshake packets",
      body: [
        "The server answers with an **Initial** (carrying the ServerHello and an ACK, still under the public Initial keys) and then **Handshake** packets (long header type 2, under keys now derived from the key exchange), carrying EncryptedExtensions, Certificate, CertificateVerify and Finished. They usually share one UDP datagram. Everything after the ServerHello is encrypted just as in TLS 1.3, but without TLS record framing or the compatibility ChangeCipherSpec.",
        "When the client has the server’s Finished it sends its own and can immediately send request data in **1-RTT packets**. One round trip total, against two for TCP plus TLS. There is no TLS 1.2 in QUIC: the handshake is always TLS 1.3, and ALPN is mandatory (`h3` for HTTP/3, `doq` for DNS over QUIC).",
        "With a session ticket the client can also send **0-RTT** data in its first flight: same speed-for-replay-risk trade-off as TLS 1.3’s [[zero-rtt]].",
      ],
      show: { capture: "quic-h3", mark: "server-initial" },
    },
    {
      title: "Handshake packets, then 1-RTT",
      body: [
        "Once each side has its 1-RTT keys (the server after sending its Finished, the client after receiving it) it moves to **short-header** packets: a flag byte, the destination connection ID (no length, since the receiver knows how long the IDs it issued are), a packet number and the protected payload. Most fields are gone, and header protection masks the packet number, so observers can count packets but cannot read losses from gaps in the numbering. One bit, the *spin bit*, is left visible so a network can measure RTT, and endpoints may disable it.",
        "Note how little an on-path observer can learn from the packets after the first: a connection ID, packet lengths, and timing. That is a privacy gain and an operational loss: much of what network operators use to debug TCP is gone.",
      ],
      show: { capture: "quic-h3", mark: "first-1rtt" },
    },
    {
      title: "Connection IDs and migration",
      body: [
        "A TCP connection *is* its 4-tuple: change your IP (Wi-Fi to cellular) and every connection dies. A QUIC connection is named by [[connection-id|connection IDs]], which each endpoint chooses, so it **can survive a change of address**. The client sends from the new path, the server validates it (a `PATH_CHALLENGE` that has to be answered), and the connection continues with its state intact. This also covers a NAT silently rebinding the port.",
        "Endpoints give each other a pool of IDs (`NEW_CONNECTION_ID`) and switch to a fresh one when they move to a new path, so the IDs do not link the old and new paths (timing and sizes still might). Load balancers can also encode routing information into the server’s IDs (QUIC-LB) so that all packets of a connection reach the same backend even as addresses change.",
      ],
      show: { capture: "quic-h3", mark: "first-1rtt" },
    },
    {
      title: "Streams: head-of-line blocking, fixed",
      body: [
        "HTTP/2 multiplexes many requests over one TCP connection, but TCP delivers *one* ordered byte stream. If one segment is lost, TCP holds back everything behind it, including bytes of other requests that arrived intact: [[http2|HTTP/2]]’s head-of-line blocking is at the transport, and on a lossy link it can be worse than six HTTP/1.1 connections.",
        "QUIC has streams as a first-class concept. Each is ordered independently; a lost packet stalls only the streams whose data was in it. Packet numbers are never reused within a packet-number space (a retransmission is a new packet carrying old data), which removes the ambiguity TCP has when deciding whether an ACK refers to the original or the retransmission, and loss detection is sharper.",
        "Congestion control is the same in spirit as TCP’s and pluggable per implementation: CUBIC, BBR. It is in user space, so a CDN can change it without a kernel update.",
      ],
    },
    {
      title: "HTTP/3, and what it costs",
      body: [
        "[[http3|HTTP/3]] (RFC 9114) is HTTP’s semantics mapped onto QUIC streams: one request per stream, header compression with QPACK (RFC 9204, redesigned so one blocked stream does not stall compression for the rest). For applications nothing changes.",
        "Benefit depends on the path. On a clean, low-RTT wired link HTTP/3 and HTTP/2 are close; the wins are on lossy, high-RTT and mobile links, and on the first request to a server. The costs: some networks block or throttle UDP/443 (browsers fall back to TCP), UDP NAT bindings are short-lived so connections need keep-alives, and without hardware offload it uses more CPU per byte.",
      ],
    },
    {
      title: "How your browser finds out, and watching it switch",
      body: [
        'A browser starts on TCP by default, because it does not know the server speaks QUIC. The server tells it in an [[alt-svc|Alt-Svc]] header: `alt-svc: h3=":443"; ma=86400`, meaning “this service is also on UDP/443 for a day”. The browser remembers per origin, and the *next* connection tries QUIC, keeping TCP as a fallback it races. The DNS [[https-record|HTTPS record]] can say the same before any connection exists.',
        "You can watch this happen. After its transfers, the connection pane’s HTTP/3 check reads Cloudflare’s trace for a host your browser has probably not used yet (`http=http/2`), makes one DNS-over-HTTPS request to it (whose response carries the `alt-svc` header), and reads the trace again: usually it now says `http=http/3`. If it never switches, the likeliest cause is UDP/443 blocked between you and the Internet (browser policy can also hold it on TCP), which is a useful thing to know about a network.",
      ],
      show: { kind: "connection", params: {} },
      tryIt: {
        text: "Press Run in the connection pane and read the HTTP/3 check at the end of the log. Then try it on another network (a phone hotspot, an office) and compare. Corporate and guest networks are where UDP/443 gets blocked.",
        open: { kind: "connection", params: {} },
      },
    },
  ],
  check: [
    {
      q: "Why can anyone on the path read a QUIC client’s first packet, and why is that acceptable?",
      a: [
        "Initial keys come from the client’s first DCID and a public, version-specific salt, so any observer can derive them. It is acceptable because that encryption is there against ossification, not for secrecy (the TLS transcript catches tampering with the handshake): the server must read it before any shared secret exists. Hiding the SNI requires ECH.",
      ],
    },
    {
      q: "A 200 KB page and image set loads over HTTP/2 on a link with 2% loss, then over HTTP/3. Why does HTTP/3 usually do better?",
      a: [
        "TCP holds all streams behind a lost segment, so every loss delays unrelated requests. QUIC recovers per stream, and its loss detection is sharper, so a loss stalls only the streams whose data was in the lost packet.",
      ],
    },
    {
      q: "Your phone moves from Wi-Fi to cellular during a download. Why might QUIC survive it and TCP not?",
      a: [
        "QUIC identifies a connection by connection IDs, not the address 4-tuple, so it can validate the new path and continue. A TCP connection is its 4-tuple, which has just changed.",
      ],
    },
  ],
};
