/**
 * The registries the dissectors print names from: IANA's numbers for EtherTypes, IP protocols, TLS cipher suites,
 * groups, signature schemes and extensions, DNS record types, DHCP options and ICMP messages. Only what is common
 * on a home network or a modern browser's handshake; anything else prints its number.
 */

export const named = (table: Record<number, string>, n: number, fallback = "Unknown") =>
  table[n] ?? `${fallback} (${n})`;

export const ETHERTYPES: Record<number, string> = {
  0x0800: "IPv4",
  0x0806: "ARP",
  0x86dd: "IPv6",
  0x8100: "802.1Q VLAN",
  0x88a8: "802.1ad QinQ",
  0x88cc: "LLDP",
  0x888e: "EAPOL (802.1X)",
  0x8863: "PPPoE discovery",
  0x8864: "PPPoE session",
  0x893a: "IEEE 1905.1",
};

export const IP_PROTOCOLS: Record<number, string> = {
  0: "IPv6 Hop-by-Hop",
  1: "ICMP",
  2: "IGMP",
  6: "TCP",
  17: "UDP",
  41: "IPv6 (encapsulated)",
  43: "IPv6 Routing",
  44: "IPv6 Fragment",
  47: "GRE",
  50: "ESP",
  51: "AH",
  58: "ICMPv6",
  59: "No next header",
  60: "IPv6 Destination Options",
  132: "SCTP",
};

/** Well-known and registered ports a home capture is full of. */
export const PORTS: Record<number, string> = {
  22: "ssh",
  53: "domain",
  67: "bootps",
  68: "bootpc",
  80: "http",
  123: "ntp",
  443: "https",
  853: "dns-over-tls",
  1900: "ssdp",
  5353: "mdns",
  5355: "llmnr",
  8080: "http-alt",
};

/** Cipher suites: TLS 1.3's five, and the TLS 1.2 ones a browser still offers. */
export const CIPHER_SUITES: Record<number, string> = {
  0x1301: "TLS_AES_128_GCM_SHA256",
  0x1302: "TLS_AES_256_GCM_SHA384",
  0x1303: "TLS_CHACHA20_POLY1305_SHA256",
  0x1304: "TLS_AES_128_CCM_SHA256",
  0x1305: "TLS_AES_128_CCM_8_SHA256",
  0xc02b: "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
  0xc02f: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
  0xc02c: "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
  0xc030: "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
  0xcca9: "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
  0xcca8: "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
  0xc013: "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA",
  0xc014: "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA",
  0x009c: "TLS_RSA_WITH_AES_128_GCM_SHA256",
  0x009d: "TLS_RSA_WITH_AES_256_GCM_SHA384",
  0x002f: "TLS_RSA_WITH_AES_128_CBC_SHA",
  0x0035: "TLS_RSA_WITH_AES_256_CBC_SHA",
  0x00ff: "TLS_EMPTY_RENEGOTIATION_INFO_SCSV",
};

/** Named groups for key exchange, the hybrid post-quantum ones included (draft-ietf-tls-ecdhe-mlkem). */
export const GROUPS: Record<number, string> = {
  0x0017: "secp256r1",
  0x0018: "secp384r1",
  0x0019: "secp521r1",
  0x001d: "x25519",
  0x001e: "x448",
  0x0100: "ffdhe2048",
  0x0101: "ffdhe3072",
  0x11eb: "SecP256r1MLKEM768",
  0x11ec: "X25519MLKEM768",
  0x11ed: "SecP384r1MLKEM1024",
  0x6399: "X25519Kyber768Draft00 (obsolete)",
};

export const SIG_SCHEMES: Record<number, string> = {
  0x0401: "rsa_pkcs1_sha256",
  0x0501: "rsa_pkcs1_sha384",
  0x0601: "rsa_pkcs1_sha512",
  0x0403: "ecdsa_secp256r1_sha256",
  0x0503: "ecdsa_secp384r1_sha384",
  0x0603: "ecdsa_secp521r1_sha512",
  0x0804: "rsa_pss_rsae_sha256",
  0x0805: "rsa_pss_rsae_sha384",
  0x0806: "rsa_pss_rsae_sha512",
  0x0807: "ed25519",
  0x0808: "ed448",
  0x0201: "rsa_pkcs1_sha1",
  0x0203: "ecdsa_sha1",
};

export const TLS_EXTENSIONS: Record<number, string> = {
  0: "server_name",
  5: "status_request",
  10: "supported_groups",
  11: "ec_point_formats",
  13: "signature_algorithms",
  16: "application_layer_protocol_negotiation",
  18: "signed_certificate_timestamp",
  21: "padding",
  23: "extended_master_secret",
  27: "compress_certificate",
  35: "session_ticket",
  41: "pre_shared_key",
  42: "early_data",
  43: "supported_versions",
  44: "cookie",
  45: "psk_key_exchange_modes",
  51: "key_share",
  57: "quic_transport_parameters",
  17513: "application_settings",
  17613: "application_settings (new codepoint)",
  65037: "encrypted_client_hello",
  65281: "renegotiation_info",
};

export const TLS_VERSIONS: Record<number, string> = {
  0x0300: "SSL 3.0",
  0x0301: "TLS 1.0",
  0x0302: "TLS 1.1",
  0x0303: "TLS 1.2",
  0x0304: "TLS 1.3",
};

export const TLS_CONTENT: Record<number, string> = {
  20: "Change Cipher Spec",
  21: "Alert",
  22: "Handshake",
  23: "Application Data",
};

export const TLS_HANDSHAKE: Record<number, string> = {
  1: "Client Hello",
  2: "Server Hello",
  4: "New Session Ticket",
  8: "Encrypted Extensions",
  11: "Certificate",
  12: "Server Key Exchange",
  13: "Certificate Request",
  14: "Server Hello Done",
  15: "Certificate Verify",
  16: "Client Key Exchange",
  20: "Finished",
};

/** GREASE (RFC 8701): values like 0x0a0a a client sends so servers keep tolerating ones they don't know. */
export const isGrease = (n: number) => (n & 0x0f0f) === 0x0a0a && n >> 8 === (n & 0xff);

export const DNS_TYPES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  41: "OPT",
  43: "DS",
  46: "RRSIG",
  47: "NSEC",
  48: "DNSKEY",
  64: "SVCB",
  65: "HTTPS",
  255: "ANY",
};

export const DNS_RCODES: Record<number, string> = {
  0: "No error",
  1: "Format error",
  2: "Server failure",
  3: "No such name (NXDOMAIN)",
  4: "Not implemented",
  5: "Refused",
};

export const SVC_KEYS: Record<number, string> = {
  0: "mandatory",
  1: "alpn",
  2: "no-default-alpn",
  3: "port",
  4: "ipv4hint",
  5: "ech",
  6: "ipv6hint",
};

export const DHCP_TYPES: Record<number, string> = {
  1: "Discover",
  2: "Offer",
  3: "Request",
  4: "Decline",
  5: "ACK",
  6: "NAK",
  7: "Release",
  8: "Inform",
};

export const DHCP_OPTIONS: Record<number, string> = {
  1: "Subnet Mask",
  3: "Router",
  6: "Domain Name Server",
  12: "Host Name",
  15: "Domain Name",
  28: "Broadcast Address",
  42: "NTP Servers",
  50: "Requested IP Address",
  51: "IP Address Lease Time",
  53: "DHCP Message Type",
  54: "DHCP Server Identifier",
  55: "Parameter Request List",
  57: "Maximum DHCP Message Size",
  58: "Renewal Time (T1)",
  59: "Rebinding Time (T2)",
  60: "Vendor Class Identifier",
  61: "Client Identifier",
  81: "Client FQDN",
  108: "IPv6-Only Preferred",
  114: "Captive Portal",
  119: "Domain Search",
  121: "Classless Static Route",
  252: "Proxy auto-discovery (WPAD)",
};

export const ICMP_TYPES: Record<number, string> = {
  0: "Echo (ping) reply",
  3: "Destination unreachable",
  5: "Redirect",
  8: "Echo (ping) request",
  11: "Time-to-live exceeded",
  12: "Parameter problem",
};

export const ICMP_UNREACHABLE: Record<number, string> = {
  0: "Network unreachable",
  1: "Host unreachable",
  2: "Protocol unreachable",
  3: "Port unreachable",
  4: "Fragmentation needed and DF set",
  9: "Network administratively prohibited",
  10: "Host administratively prohibited",
  13: "Communication administratively prohibited",
};

export const ICMPV6_TYPES: Record<number, string> = {
  1: "Destination unreachable",
  2: "Packet too big",
  3: "Time exceeded",
  4: "Parameter problem",
  128: "Echo (ping) request",
  129: "Echo (ping) reply",
  133: "Router Solicitation",
  134: "Router Advertisement",
  135: "Neighbor Solicitation",
  136: "Neighbor Advertisement",
  137: "Redirect",
  143: "Multicast Listener Report v2",
};

export const QUIC_VERSIONS: Record<number, string> = {
  0x00000001: "QUIC v1 (RFC 9000)",
  0x6b3343cf: "QUIC v2 (RFC 9369)",
  0x00000000: "Version Negotiation",
};
