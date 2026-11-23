# Handshake: a Jali example

A network lab for your own network, with the course beside the tools. Read packets layer by layer, measure your connection, probe any domain, map your Wi-Fi and the devices on it, and learn how it all works: the lesson sits in one pane and drives the tools beside it, through Jali's following. It is built with [CyberSpec](https://www.cyberspec.dev/)'s components rather than the examples' usual kit, to show Jali with a component system of its own.

```sh
vp install                  # at the repository's root
vp dev examples/handshake   # http://localhost:5360, or the next free port
```

It is for someone technical who wants to stay sharp on networking fundamentals, not a beginner's course and not a Wireshark replacement. Lessons use real field names, real numbers and RFCs.

## What it shows about Jali

- **A lesson drives the lab.** In the Course layout the lesson is a list of steps: each step selects a packet, a probe or a scan, and the panes linked to the lesson follow it. Step through the TCP lesson and the dissection, bytes and ladder move with it.
- **Following, two deep.** The outline drives the lesson, and the lesson drives the tools. In the Packet lab, the packet list drives the dissection, bytes, layers and ladder, and an arrow clicked in the ladder moves the list.
- **Followers of several kinds.** A packet selection is shown by four kinds of pane, each with its own `follow`.
- **Links as teaching material.** A lesson's step and a packet are in the address: "TCP lesson, step 6, packet 9" comes back from a link.
- **Fitting.** On a phone the lesson and its tools fold into tabs, and come back as the window widens.
- **Another component system.** CyberSpec's cut-corner controls inside Jali's panes, with Jali's frames, tabs and ⌘K set from CyberSpec's tokens. What that made hard is in [FINDINGS.md](FINDINGS.md).

## The layouts

| Layout       | What it is                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course       | Nine lessons (encapsulation, Wi-Fi, the home network, DNS, TCP, bufferbloat, TLS 1.3, QUIC and HTTP/3, routing), each with a self-check, and a glossary. |
| Packet lab   | A packet list with a display filter, the dissection, the bytes coloured by layer, OSI beside TCP/IP for this packet, and a sequence diagram.             |
| Connection   | Your connection measured live, and a probe of any domain.                                                                                                |
| Home network | Scans you bring from your own machine: Wi-Fi channels, devices, and the path to a server.                                                                |

## Packets

- **Your own captures.** Open a `.pcap` or `.pcapng` (up to 32 MB) from tcpdump, Wireshark or `pktmon`. It is read in the tab and never uploaded. Ethernet, raw IP, and Linux cooked captures (`tcpdump -i any`) are read.
- **Dissectors.** Ethernet and 802.1Q, ARP, IPv4, IPv6, ICMP and ICMPv6, UDP, TCP with its options and Wireshark-style analysis (retransmissions, duplicate ACKs, window updates), DNS including HTTPS/SVCB records, DHCP, HTTP/1.x, TLS ClientHello and ServerHello, and QUIC. Every field says why it matters.
- **QUIC Initials, decrypted.** A QUIC Initial's keys come from its destination connection ID (RFC 9001), so anyone on the path can read the ClientHello inside it. The lab decrypts Initials in the browser with WebCrypto, in your captures too. It is checked against RFC 9001's test vectors.
- **Generated captures.** Six bundled captures (a home LAN, DNS, a TCP connection start to finish, TLS 1.3, QUIC with HTTP/3, a traceroute) are made up: generated as real pcap bytes by `src/packets/generate/`, then read by the same parser as your files. Each says "Generated capture" on screen.

## Live measurements

From your browser, with no key and no backend: Cloudflare's speed test endpoints, its `/cdn-cgi/trace`, DNS over HTTPS from Cloudflare and Google, RDAP, RIPEstat and Cert Spotter. Every live figure names its source.

- **Connection** reads the trace when it opens: your public IP, the Cloudflare data centre, the HTTP and TLS versions, and the key exchange (Chrome's is post-quantum, X25519MLKEM768). Run measures idle latency and jitter, download and upload, latency under load (bufferbloat, with its grading scale), and the TCP figures Cloudflare's server sees for your connection (RTT, congestion window, retransmissions, from its `Server-Timing` header). It then watches your browser switch from HTTP/2 to HTTP/3 after one DNS query teaches it that the server speaks QUIC. If it never switches, the pane says UDP 443 may be blocked.
- **Probe** looks up a domain's DNS records from both resolvers, DNSSEC validation, HTTP/3 support from its HTTPS record, its registration, the networks announcing its addresses, and its certificates in public logs. Nothing heavier than the trace runs until you ask, and a full Run says how much data it will use first.

## Bring your own scan

A browser cannot see your local network, so Handshake does not pretend to. You run one line on your own machine and paste or drop its output. It is read in the tab, kept in this browser's `localStorage`, and never sent anywhere; "Forget this scan" and "Forget all" remove it.

|         | macOS                                     | Windows                               | Linux                                                                     |
| ------- | ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| Wi-Fi   | `system_profiler SPAirPortDataType -json` | `netsh wlan show networks mode=bssid` | `nmcli -f IN-USE,SSID,BSSID,CHAN,FREQ,RATE,SIGNAL,SECURITY dev wifi list` |
| Devices | `arp -a`                                  | `arp -a`                              | `ip neigh` or `arp -a`                                                    |
| Path    | `traceroute example.com`                  | `tracert example.com`                 | `traceroute example.com`                                                  |

`nmap -sn -oX - 192.168.1.0/24` and `mtr --report example.com` are read too, and the format is detected from the text. The Wi-Fi pane draws a channel map per band with a suggested channel and its reasoning; Devices looks up each maker from the MAC's OUI and flags private (randomised) MACs; Path classifies each hop and explains `* * *`. Three made-up samples are included and marked as such.

## Left out on purpose

- Live packet capture, device discovery, Wi-Fi scanning and port scanning: a browser can't do them, and the app never pretends it can.
- TCP stream and IP fragment reassembly: a TLS record split over segments is marked "continued", not rebuilt.
- Decrypting anything past the QUIC Initials: that needs the session's keys.
- The full OUI registry: the maker lookup covers 240 consumer brands (about 13,600 prefixes), from the IEEE MA-L registry by way of nmap's prefix list.
- On Windows and Linux, Wi-Fi channel width is guessed (no one-line command reports it) and marked "~".

## How it is built

| Folder                  | What it is                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/course/`           | The lessons and glossary as typed data, the markup they are written in, progress, and how a step's target becomes a ref.                 |
| `src/packets/`          | The capture reader, dissectors (one file per protocol), TCP analysis, QUIC Initial decryption, the filter, and the generator's scripts.  |
| `src/live/`             | The live sources: one HTTP client, the connection measurement and the domain probe, each with its pure rules in a `-model.ts` beside it. |
| `src/scans/`            | The scan parsers, their analysis, the OUI table, the samples, what is said about each kind of scan (`kinds.ts`) and the store.           |
| `src/store.ts`          | The one store the areas hold their state in (captures, the lit field, the live runs, the scans, progress), and `Remote<T>` for fetches.  |
| `src/panes/*.tsx`       | The fifteen pane kinds, one `definePane` each, with their `follow` rules.                                                                |
| `src/panes/parts/`      | What the panes share: the gates (capture, packet, scan, remote), the lab beside a source (`lab.ts`), list keys, file drop, the diagrams. |
| `src/presets.ts`        | The four layouts; tools are `linkedTo` the lesson, the packet list or the Scans pane.                                                    |
| `src/workspace.ts`      | `createJali`: the kinds, the layouts and the app's ⌘K commands.                                                                          |
| `src/shell/`            | The top bar and status line round `<JaliRoot>`, inside CyberSpec's `<Cyber>` root.                                                       |
| `src/styles/`           | The type scale and Jali's tokens set from CyberSpec's (`tokens.css`), the daylight skin (`light.css`), and one sheet per area or pane.   |
| `src/vendor/cyberspec/` | CyberSpec, as its shadcn registry installs it (MIT, `LICENSE` there). Nothing else in `src/` is vendored.                                |

The areas (`course`, `packets`, `live`, `scans`) have no React in them: the panes read them through `panes/parts/`. Inside an area, imports are relative; across areas, they go through `#src/…` with the file's extension.

CyberSpec ships a dark skin only. `light.css` adds a daylight one on its surface and ink tokens, because every example works in light and dark. The faces are Rajdhani and JetBrains Mono, self-hosted.

## Tests

- Unit tests beside the code, about 300 of them: the capture reader on pcap and pcapng, every dissector, TCP analysis, QUIC decryption against RFC 9001's vectors, the filter, the generated captures' marks; every scan format against fixtures in the tools' real output; the measurement maths and probe parsing on recorded replies; the lesson markup, and that every glossary link and lesson target resolves; and the workspace (`src/workspace.test.ts`).
- `e2e/`: Playwright tests against this app's own server, with Cloudflare's trace answered from a recorded reply and every other service refused, so they never need the network. They check that a lesson moves its tools, that the packet list moves its details and an arrow in the ladder moves the list, and run the shared quality checks on every layout in both themes (axe, a 360–2200px width sweep, nothing in the console). Run them from the repository's root with `pnpm exec playwright test -c examples/handshake`.
