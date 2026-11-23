/**
 * Lesson 4: DNS from the packet up: the resolution path, caching, record types, encrypted transports, DNSSEC, and
 * the HTTPS record that lets a browser start on HTTP/3.
 */
import type { Lesson } from "../types";

export const dns: Lesson = {
  id: "dns",
  title: "DNS, from the packet up",
  promise:
    "Trace a lookup end to end, know what encrypted DNS hides, and read the record that selects HTTP/3.",
  minutes: 14,
  steps: [
    {
      title: "The path of a lookup",
      body: [
        "Your application calls the OS, whose *stub resolver* sends one question to a configured [[resolver]]: your router (which forwards), your ISP, or something like 1.1.1.1 or 8.8.8.8. The stub asks once and expects an answer. All the work happens in the recursive resolver.",
        "On a cold cache the resolver asks a **root server** (13 named letters, a to m, served from well over a thousand anycast instances) who handles `.com`; asks a `.com` **TLD server** who handles `example.com`; then asks the [[authoritative]] server for the record. Three or four queries, in sequence, then the answer comes back. Every step is cached, so almost no lookup does all of them.",
        "That is why DNS *feels* like nothing: it is nearly always a cache hit in a resolver a few milliseconds away. And why a slow first visit to a rarely used site is often DNS.",
      ],
      show: { capture: "dns", mark: "query-a" },
    },
    {
      title: "One question on the wire",
      body: [
        "A DNS message is a 12-byte header (ID, flags, four counts) followed by sections. The query here is UDP, destination port 53, a few dozen bytes: ID, flags with **RD** (recursion desired) set, one question, QNAME `example.com`, QTYPE `A`, QCLASS `IN`. The ID matches question to answer (and, with the random source port, is what makes spoofing a reply hard; 32 bits of luck, not a lot).",
        "Names are encoded as length-prefixed labels: `7example3com0`. Find it in the hex view. The answer travels in a single datagram. Responses that do not fit are flagged **TC** (truncated) and the client retries over TCP; with EDNS0 (RFC 6891) a client advertises how big a UDP payload it accepts, and 1232 bytes is the recommended ceiling so that answers avoid fragmentation.",
      ],
      show: { capture: "dns", mark: "query-a" },
    },
    {
      title: "The answer: records, TTLs, flags",
      body: [
        "The response echoes the question and adds answers. Each resource record is a name, a type, a class, a **TTL** and data. The flags to read first: **QR** (this is a response), **RA** (the server does recursion), **AA** (authoritative answer: set only when the answering server is authoritative for the zone, never on an answer from cache) and **RCODE**: 0 `NOERROR`, 3 `NXDOMAIN` (no such name), 2 `SERVFAIL` (the resolver could not get an answer; DNSSEC failures look like this).",
        "`NOERROR` with an empty answer is different from `NXDOMAIN`. From a recursive resolver it means the name exists but has no record of that type (the zone’s SOA in the authority section confirms it), which is how an IPv4-only host answers the AAAA question.",
      ],
      show: { capture: "dns", mark: "response-a" },
    },
    {
      title: "Caching and TTL",
      body: [
        "The [[ttl-dns|TTL]] is how long, in seconds, anyone may reuse the answer. Resolvers count it down, so asking twice shows a falling number. A 300-second TTL means a change takes up to five minutes to reach everyone, if everyone respects it; some resolvers floor low values, and browsers keep their own cache too. The classic migration advice follows: lower the TTL *a full old-TTL ahead* of a change, switch, then raise it again.",
        "Negative answers are cached as well, for the smaller of the zone’s SOA TTL and its MINIMUM field (**negative caching**, RFC 2308). Looking up a name before you created it can make it “not exist” for you for minutes after.",
        "TTL also means DNS is a cheap load balancer and an expensive failover: a short TTL buys control at the cost of extra queries on every client and a harder dependency on the resolver’s health.",
      ],
      show: { capture: "dns", mark: "response-a" },
    },
    {
      title: "Record types that matter",
      body: [
        "- **A** / **AAAA**: IPv4 / IPv6 address. Clients ask for both at once and race the connections (“Happy Eyeballs”, RFC 8305: IPv6 first, IPv4 after about 250 ms).\n- **CNAME**: an alias; follow the other name. Not allowed at a zone apex or beside other records.\n- **NS**: which servers are authoritative; **SOA**: zone metadata and the negative TTL.\n- **MX**: mail servers; **TXT**: free text, used for SPF, DKIM, domain verification.\n- **PTR**: reverse lookup, address to name, under `in-addr.arpa` (IPv6: `ip6.arpa`).\n- **HTTPS** (type 65) and **SVCB** (64): how to reach a service. The last step of this lesson.",
        "For the [[a-record|A and AAAA]] case you will see in most captures, remember that the answer can be a chain (CNAME to CNAME to A) and that one name can return several addresses: the client picks, usually the first, and round-robin order is a (weak) form of balancing.",
      ],
    },
    {
      title: "Encrypted DNS: what it hides, and what it does not",
      body: [
        "Classic DNS is plaintext UDP: everyone on the path, including your ISP, can see every name you look up and rewrite the answer. [[dot|DNS over TLS]] (TCP 853, RFC 7858), [[doh|DNS over HTTPS]] (443, RFC 8484) and DNS over QUIC (UDP 853, RFC 9250) wrap the same messages in encryption between you and your resolver.",
        "Be exact about what that buys. It hides your lookups **from the network between you and the resolver**, and prevents on-path tampering. It does not hide them from the resolver, which sees everything and knows who you are by IP. Your next connection also gives the name away: until ECH, the [[sni|SNI]] in the TLS ClientHello is plaintext, and the destination IP is visible regardless.",
        "DoT is easier for a network to find and block (its own port); DoH blends into other HTTPS, which is why enterprises dislike it. Which is better depends on whom you are hiding from.",
      ],
    },
    {
      title: "DNSSEC: authentic, not secret",
      body: [
        "[[dnssec|DNSSEC]] signs records. A zone publishes its public keys (DNSKEY), signs each record set (RRSIG), and its parent holds a hash of the key (DS), all the way up to the root, whose key is the trust anchor. A *validating* resolver checks the chain, and if it holds, sets the **AD** bit (“authenticated data”) in its response to a client that asks (DO or AD set in the query). If it fails, the resolver returns `SERVFAIL`, not a wrong answer.",
        "Three limits. It proves origin and integrity, not secrecy: queries and answers are still readable. Your stub usually trusts the resolver’s [[ad-bit|AD bit]] without checking, so it only protects you on a path to the resolver you trust. And signing is far from universal: most domains are not signed.",
        "The probe on the right asks a validating resolver for `cloudflare.com` and shows whether it came back with AD set.",
      ],
      show: { kind: "probe", params: { domain: "cloudflare.com" } },
    },
    {
      title: "The HTTPS record: telling the browser first",
      body: [
        "Before a browser opens a connection it asks for the A and AAAA records. Modern browsers also ask for type 65, the [[https-record|HTTPS record]] (RFC 9460). The answer in this capture carries `alpn=h3,h2`: “this service speaks HTTP/3 and HTTP/2”. It can also carry a port, IPv4/IPv6 address hints, and an `ech` key for Encrypted Client Hello.",
        "Why it matters: without it a browser starts every new site on TCP+TLS and learns about HTTP/3 only from an [[alt-svc]] header *after* a first visit. With it, the very first connection can be QUIC. It also solves the long-standing problem that a CNAME cannot sit at a zone apex: the record has an alias mode (priority 0) that can.",
        "The query and the response are separate packets; look at both.",
      ],
      show: { capture: "dns", mark: "response-https" },
    },
    {
      title: "Ask it yourself",
      body: [
        "With `dig` (on macOS and most Linux; on Windows via WSL or BIND’s tools): `dig +short cloudflare.com A`, `dig cloudflare.com HTTPS`, and `dig +dnssec cloudflare.com` to see the RRSIG and, from a validating resolver, the `ad` flag. Compare the answer from your resolver and from `@1.1.1.1`: if they differ for a CDN-hosted name, you have seen DNS-based traffic steering.",
        "The probe makes the same live queries from your browser through public DoH resolvers.",
      ],
      show: { kind: "probe", params: { domain: "cloudflare.com" } },
      tryIt: {
        text: "Try a domain of your own in the probe: your own site, your workplace’s, your bank’s. Look at which resolver answered, the TTL, whether it is DNSSEC-signed, and whether it advertises `h3` in its HTTPS record.",
        open: { kind: "probe", params: { domain: "cloudflare.com" } },
      },
    },
  ],
  check: [
    {
      q: "A resolver returns `NOERROR` and an empty answer for AAAA. Is the name missing?",
      a: [
        "No. `NXDOMAIN` means the name does not exist. `NOERROR` with no answers means it exists but has no record of that type, as for an IPv4-only host.",
      ],
    },
    {
      q: "Your DNS-over-HTTPS setup is on. Name two things a network observer can still learn about where you are going.",
      a: [
        "The destination IP address of every connection, and the SNI in the TLS ClientHello (until ECH is used; ECH hides the name only if the HTTPS-record lookup that delivers its key is encrypted too). Also timing and volume.",
      ],
    },
    {
      q: "What does the AD bit mean, and when is it worth trusting?",
      a: [
        "The resolver validated the answer’s DNSSEC signatures. It is worth trusting only when the path from you to that resolver is itself trusted, because anyone on the path can set the bit on a forged reply.",
      ],
    },
  ],
};
