/**
 * Lesson 7: the TLS 1.3 handshake, message by message: what a passive observer can read, what is encrypted from
 * ServerHello on, the post-quantum key share, 0-RTT's replay problem, and ECH.
 */
import type { Lesson } from "../types";

export const tls: Lesson = {
  id: "tls",
  title: "TLS 1.3: the handshake, message by message",
  promise:
    "Say exactly what travels in the clear, what is encrypted from where, and what each round trip buys.",
  minutes: 17,
  steps: [
    {
      title: "What TLS adds to TCP",
      body: [
        "[[tls|TLS]] sits between the application and TCP and delivers three things: **authentication** of the server (a [[certificate]] chained to a root your OS trusts), **confidentiality** and **integrity** of the stream. It knows nothing of HTTP; anything that runs over TCP can run over it.",
        "The ladder beside this lesson is a generated TLS 1.3 connection: TCP handshake first, then the TLS messages. Count the round trips. The TCP handshake is one, and TLS 1.3 adds exactly **one** more before the client can send its request. TLS 1.2 needed two. Cutting that round trip was the biggest user-visible change in the protocol (RFC 8446, 2018).",
      ],
      show: { kind: "ladder", params: { capture: "tls13" } },
    },
    {
      title: "Packet one: the ClientHello",
      body: [
        "After the TCP ACK the client sends a [[client-hello|ClientHello]]. It is the most information-dense packet on the Internet and it is **not encrypted**, because no keys exist yet. Everything an observer learns about the connection is in it: the 32-byte random, a list of cipher suites (RFC 8446 defines five for 1.3, such as `TLS_AES_128_GCM_SHA256` `0x1301` and `TLS_CHACHA20_POLY1305_SHA256` `0x1303`), and a list of extensions.",
        "The extensions that matter: `server_name` (SNI), `application_layer_protocol_negotiation` (ALPN), `supported_versions`, `supported_groups`, `key_share`, `signature_algorithms`, `psk_key_exchange_modes`. Open the ClientHello in the packet pane and find each. Browsers also add random *GREASE* values to keep servers from hard-coding what they expect; the fingerprinting tool JA3/JA4 hashes this very list.",
      ],
      show: { capture: "tls13", mark: "client-hello" },
    },
    {
      title: "SNI and ALPN: who and what",
      body: [
        "[[sni|SNI]] names the host the client wants, so a server with one IP address and hundreds of certificates can choose the right one before encrypting anything. It is the main thing a network operator or censor sees about an HTTPS connection: not the URL, not the content, but the **domain**.",
        "[[alpn|ALPN]] (RFC 7301) lists the application protocols the client speaks, in preference order, typically `h2` and `http/1.1`; the server picks one in its encrypted reply. It replaces a separate upgrade round trip: the client learns it is talking HTTP/2 at the end of the handshake. QUIC uses the same field to say `h3`.",
      ],
      show: { capture: "tls13", mark: "client-hello" },
    },
    {
      title: "supported_versions and key_share: the real negotiation",
      body: [
        "Look at the version fields: the ClientHello’s `legacy_version` says `0x0303` (TLS 1.2), and the record layer carries an equally old value (`0x0301` or `0x0303`). They are lies on purpose. Servers and middleboxes that choked on unknown versions made TLS 1.3 undeployable, so the real offer moved into the `supported_versions` extension (`0x0304` for 1.3) and the old fields froze.",
        "The [[key-share|key_share]] extension is what makes one round trip enough. The client *guesses* which key-exchange group the server will pick (usually X25519) and sends its public value immediately, alongside a list of other groups it supports. If the guess is right, the server answers with its share and both sides derive a shared secret in the same flight. If wrong, the server sends HelloRetryRequest and it costs a round trip.",
        "Every full handshake uses an ephemeral exchange (ECDHE, or finite-field DHE): TLS 1.3 removed static RSA key exchange, and only PSK-only resumption skips it. Stealing the server’s certificate key later does not decrypt recorded traffic: [[forward-secrecy]].",
      ],
      show: { capture: "tls13", mark: "client-hello" },
    },
    {
      title: "Post-quantum: X25519MLKEM768",
      body: [
        "A sufficiently large quantum computer breaks elliptic-curve Diffie-Hellman. Traffic recorded today could be decrypted then: *harvest now, decrypt later*. The defence is to change the key exchange now. Signatures can wait, because they matter only at connection time.",
        "[[x25519mlkem768|X25519MLKEM768]] concatenates two exchanges: classical X25519 and ML-KEM-768, the NIST standard (FIPS 203) derived from Kyber. The secret is secure unless **both** are broken, hedging against a flaw in the young algorithm. The price is size: the client key share grows from 32 to 1216 bytes (1184 for the ML-KEM key), the server’s to 1120. A browser’s ClientHello no longer fits in one 1500-byte packet, which broke some middleboxes that expected to see the whole hello at once.",
        "Chrome shipped a Kyber hybrid by default in version 124 and switched to the final ML-KEM codepoint (`0x11EC`) in 131, and Cloudflare negotiates it. The connection pane reads Cloudflare’s trace for your browser, and its “Key exchange” row tells you which exchange you got (it appears once the trace has loaded).",
      ],
      show: { kind: "connection", params: {} },
    },
    {
      title: "ServerHello: where the encryption begins",
      body: [
        "The server picks a suite and a version, and returns its own key share in the **ServerHello**. That is the last plaintext handshake message. With its share and the client’s, both sides compute a shared secret, run it through HKDF to derive handshake traffic keys, and **every handshake message after this one is encrypted**.",
        "Look at what follows in the capture: the server’s EncryptedExtensions, Certificate, CertificateVerify and Finished are in there, but the packet view can only show them as encrypted records, which Wireshark labels “Application Data”: the record layer disguises handshake messages so on the wire every protected record has the same outer type (23). Note what this means: **the certificate is encrypted in TLS 1.3**. An observer can no longer read who the server claims to be, which TLS 1.2 broadcast in clear.",
      ],
      show: { capture: "tls13", mark: "server-hello" },
    },
    {
      title: "The ChangeCipherSpec that does nothing",
      body: [
        "Right after the ServerHello there is a ChangeCipherSpec record with a single byte of payload, which in TLS 1.2 meant “my next messages are encrypted”. In 1.3 it carries no meaning at all. It is there purely so the connection resembles a 1.2 resumption to middleboxes that would otherwise drop the unfamiliar flow: *middlebox compatibility mode*, a fossil kept alive by the network’s inability to cope with change.",
        "Then comes the first encrypted record. The client can verify the server’s certificate chain and CertificateVerify signature, send its own Finished (an HMAC over the entire transcript, proving no one tampered with the handshake), and begin sending application data in the same flight. One round trip, after TCP’s own.",
      ],
      show: { capture: "tls13", mark: "change-cipher-spec" },
    },
    {
      title: "0-RTT: faster, and replayable",
      body: [
        "On a resumed connection the server has given the client a ticket, from which both derive a pre-shared key. The client may then include **early data** in its very first flight, encrypted with a key derived from the ticket: [[zero-rtt|0-RTT]], the request already on the wire before the handshake finishes.",
        "The price is that nothing in the first flight proves freshness. An attacker who records it can send it again, and the server will treat it as new: a [[replay|replay attack]]. Early data also lacks [[forward-secrecy]]: stealing the ticket key reveals it. So servers should accept 0-RTT only for requests that are safe to replay (a GET, not a payment); a front end that accepts it marks the request to the origin with `Early-Data: 1`, and the origin can answer `425 Too Early` (RFC 8470) so the client retries after the handshake. If in doubt, it is off.",
      ],
    },
    {
      title: "ECH: closing the last plaintext field",
      body: [
        "What remains visible after all this? The destination IP, timing, and the [[sni|SNI]]. [[ech|Encrypted Client Hello]] encrypts the entire inner ClientHello, SNI included, to a public key the site publishes in its [[https-record|HTTPS DNS record]]. On the wire there is an *outer* ClientHello naming only a shared “public name” (for Cloudflare, one shared across millions of sites) and an opaque payload.",
        "It only hides the name if the lookup is private too and the site shares an IP with many others. If DNS is plaintext, the lookup leaks the name anyway; if the site is the only one on its IP, the address gives it away. Hence the pairing the lessons keep returning to: [[doh]] for the lookup, the HTTPS record for the key, ECH for the hello. Where it is used it defeats SNI-based filtering, which is why some networks block it.",
      ],
      show: { kind: "probe", params: { domain: "cloudflare.com" } },
    },
  ],
  check: [
    {
      q: "Which handshake messages can a passive observer read in TLS 1.3, and which not?",
      a: [
        "The ClientHello (SNI, ALPN, offered versions, suites, key shares) and the ServerHello are in the clear. EncryptedExtensions, the certificate, CertificateVerify and Finished are encrypted. With ECH the ClientHello’s inner part is encrypted too.",
      ],
    },
    {
      q: "The ClientHello’s `legacy_version` says TLS 1.2 on a TLS 1.3 connection. Why?",
      a: [
        "Middleboxes and some servers rejected unknown versions, so the protocol froze the old fields at 1.2 and moved the real negotiation to the `supported_versions` extension.",
      ],
    },
    {
      q: "Why is 0-RTT replayable even though the data is encrypted?",
      a: [
        "Encryption does not make a message fresh. The server has contributed no randomness before the client’s first flight, so an attacker can resend the recorded bytes and get a valid decryption. Servers must keep state or restrict 0-RTT to requests that are safe to replay.",
      ],
    },
  ],
};
