/**
 * What a scan is, after parsing: one of three shapes (Wi-Fi networks, devices on the LAN, hops on a path), whatever
 * tool and operating system the text came from. The parsers produce these; the analysis, the store and the panes
 * only ever see these.
 */

export type Band = "2.4" | "5" | "6";

export interface WifiNetwork {
  /** Network name; empty when the network is hidden or the OS withheld it. */
  ssid: string;
  /** macOS prints `<redacted>` for every name unless the terminal has Location Services permission. */
  redacted: boolean;
  bssid?: string;
  /** Primary channel. */
  channel?: number;
  band?: Band;
  /** Channel width in MHz, as the tool reported it or, when it did not, a guess from band and PHY. */
  widthMHz?: number;
  widthEstimated?: boolean;
  signalDbm?: number;
  noiseDbm?: number;
  security?: string;
  /** 802.11n / ac / ax / be. */
  phy?: string;
  rateMbps?: number;
  /** The network this computer is connected to. */
  current?: boolean;
}

export interface Device {
  ip?: string;
  mac?: string;
  /** Name from reverse DNS (arp -a, nmap). */
  host?: string;
  /** Interface the entry was seen on. */
  iface?: string;
  /** Neighbour state from `ip neigh` (REACHABLE, STALE, FAILED …) or `permanent`/`static`/`dynamic`. */
  state?: string;
  /** An ARP entry with no hardware address: the host did not answer. */
  incomplete?: boolean;
  /** The vendor nmap printed beside the MAC, if any. */
  vendor?: string;
  ports?: { port: number; protocol: string; service?: string; product?: string }[];
  /** Round trip nmap measured, in ms. */
  latencyMs?: number;
}

export interface Hop {
  n: number;
  /** The first responder's address and name; `*` hops have neither. */
  ip?: string;
  name?: string;
  /** Other addresses that answered at this TTL (equal-cost paths). */
  alsoIps: string[];
  /** One entry per probe, in ms; null is no answer. */
  rtts: (number | null)[];
  /** mtr's report columns, when the text was an mtr report. */
  mtr?: {
    lossPct: number;
    sent: number;
    last: number;
    avg: number;
    best: number;
    worst: number;
    stdev: number;
  };
  /** A traceroute annotation such as `!H` (host unreachable) or a tracert message. */
  note?: string;
}

export type ScanKind = "wifi" | "devices" | "path";

export type FormatId =
  | "wifi-macos-json"
  | "wifi-macos-text"
  | "wifi-netsh"
  | "wifi-nmcli"
  | "wifi-nmcli-terse"
  | "devices-arp"
  | "devices-arp-windows"
  | "devices-ip-neigh"
  | "devices-nmap"
  | "path-traceroute"
  | "path-tracert"
  | "path-mtr";

export interface WifiScan {
  kind: "wifi";
  networks: WifiNetwork[];
}
export interface DevicesScan {
  kind: "devices";
  devices: Device[];
}
export interface PathScan {
  kind: "path";
  /** The destination as the tool printed it, when it did. */
  target?: string;
  targetIp?: string;
  hops: Hop[];
}
export type ScanData = WifiScan | DevicesScan | PathScan;

export type ParseResult<T> = { ok: true; scan: T } | { ok: false; error: string };

export const ok = <T>(scan: T): ParseResult<T> => ({ ok: true, scan });
export const fail = <T>(error: string): ParseResult<T> => ({ ok: false, error });
