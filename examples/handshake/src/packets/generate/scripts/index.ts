/** The bundled captures, by id, in the order the capture menu lists them. */
import type { Bundled } from "./tape";
import { dnsLookup } from "./dns";
import { homeLan } from "./home-lan";
import { quicH3 } from "./quic-h3";
import { tcpLifecycle } from "./tcp-lifecycle";
import { tls13 } from "./tls13";
import { traceroute } from "./traceroute";

export const SCRIPTS = {
  "home-lan": homeLan,
  dns: dnsLookup,
  "tcp-lifecycle": tcpLifecycle,
  tls13,
  "quic-h3": quicH3,
  traceroute,
} as const satisfies Record<string, Bundled>;

export type BundledId = keyof typeof SCRIPTS;
export type { Bundled, Script } from "./tape";
