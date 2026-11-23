/**
 * Turns parsed devices into what the pane shows: vendor, whether the MAC is randomised, and a role for entries
 * that are not hosts at all (multicast, broadcast, the gateway). Roles are guesses where they say so: an ARP
 * table does not say which entry is the router.
 */
import { describeMac } from "./oui";
import { ipv4Octets } from "./net";
import { analysePath } from "./path-analysis";
import type { LoadedScan } from "./store";
import type { Device } from "./types";

export type Role = "gateway" | "likely-gateway" | "multicast" | "broadcast" | "incomplete";

export interface DeviceRow {
  id: string;
  device: Device;
  ip: string;
  mac?: string;
  host?: string;
  vendor?: string;
  /** nmap reported the vendor, and the table agrees or has none. */
  vendorSource?: "table" | "nmap";
  randomised: boolean;
  moduleMaker: boolean;
  roles: Role[];
}

/** 224.0.0.0/4 */
export const isMulticastIp = (ip: string): boolean => {
  const o = ipv4Octets(ip);
  return o ? o[0] >= 224 && o[0] <= 239 : /^ff[0-9a-f]{2}:/i.test(ip);
};

/** Link-local multicast MAC prefixes: 01:00:5e (IPv4) and 33:33 (IPv6). */
const isMulticastMac = (mac: string) => mac.startsWith("01:00:5e") || mac.startsWith("33:33");

export interface AnalyseOptions {
  /** The router's address, when another scan (a traceroute's first hop) says what it is. */
  gateway?: string;
}

export function analyseDevices(devices: Device[], options: AnalyseOptions = {}): DeviceRow[] {
  return devices.map((d, i) => {
    const info = d.mac ? describeMac(d.mac) : undefined;
    const ip = d.ip ?? "";
    const roles: Role[] = [];
    if (d.incomplete) roles.push("incomplete");
    if (info?.broadcast) roles.push("broadcast");
    else if (isMulticastIp(ip) || (info && isMulticastMac(info.mac))) roles.push("multicast");
    if (options.gateway && ip === options.gateway) roles.push("gateway");
    else if (
      !options.gateway &&
      !d.incomplete &&
      /^(\d+\.\d+\.\d+)\.(1|254)$/.test(ip) &&
      roles.length === 0
    )
      roles.push("likely-gateway");
    const vendor = info?.vendor ?? d.vendor;
    return {
      id: `${ip}|${d.mac ?? i}`,
      device: d,
      ip,
      mac: info?.mac ?? d.mac,
      host: d.host,
      vendor,
      vendorSource: info?.vendor ? "table" : d.vendor ? "nmap" : undefined,
      randomised: info?.randomised ?? false,
      moduleMaker: info?.moduleMaker ?? false,
      roles,
    };
  });
}

export const isHost = (r: DeviceRow) =>
  !r.roles.includes("multicast") && !r.roles.includes("broadcast");

export interface DeviceCounts {
  hosts: number;
  randomised: number;
  special: number;
  vendors: number;
  unknownVendor: number;
}

export function countDevices(rows: DeviceRow[]): DeviceCounts {
  const hosts = rows.filter((r) => isHost(r) && !r.roles.includes("incomplete"));
  return {
    hosts: hosts.length,
    randomised: hosts.filter((r) => r.randomised).length,
    special: rows.filter((r) => !isHost(r)).length,
    vendors: new Set(hosts.map((r) => r.vendor).filter(Boolean)).size,
    unknownVendor: hosts.filter((r) => !r.vendor && !r.randomised).length,
  };
}

/** The router's address, when a traceroute of the same kind (sample with sample, yours with yours) names it. */
export function gatewayFor(loaded: LoadedScan, all: readonly LoadedScan[]): string | undefined {
  const path = all.find((s) => s.sample === loaded.sample && s.scan.kind === "path");
  return path?.scan.kind === "path" ? analysePath(path.scan).gateway : undefined;
}
