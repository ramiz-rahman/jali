/** The parsers, against each tool's recorded output. */
import { describe, expect, it } from "vitest";
import { detectFormat, parseScan } from "./detect";
import { parseArp, parseArpWindows, parseIpNeigh, parseNmapXml } from "./devices";
import * as fx from "./fixtures";
import { normaliseMac } from "./net";
import { parseMtr, parseTraceroute, parseTracert } from "./path";
import {
  parseMacosJson,
  parseMacosText,
  parseNetsh,
  parseNmcli,
  parseNmcliTerse,
  splitTerse,
} from "./wifi";
import type { Hop, ParseResult, WifiNetwork } from "./types";

function need<T extends { kind: string }>(r: ParseResult<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.scan;
}
const nets = (r: ParseResult<{ kind: "wifi"; networks: WifiNetwork[] }>) => need(r).networks;
const hops = (r: ParseResult<{ kind: "path"; hops: Hop[] }>) => need(r).hops;

describe("mac addresses", () => {
  it("pads macOS's dropped zeros and reads Windows dashes", () => {
    expect(normaliseMac("0:a:eb:3c:11:2f")).toBe("00:0a:eb:3c:11:2f");
    expect(normaliseMac("A8-6B-AD-3C-11-2F")).toBe("a8:6b:ad:3c:11:2f");
    expect(normaliseMac("a86bad3c112f")).toBe("a8:6b:ad:3c:11:2f");
    expect(normaliseMac("(incomplete)")).toBeUndefined();
    expect(normaliseMac("1:2:3")).toBeUndefined();
  });
});

describe("macOS Wi-Fi JSON", () => {
  const n = nets(parseMacosJson(fx.MACOS_JSON_REDACTED));
  it("reads the current network and the others, skipping interfaces with none", () => {
    expect(n).toHaveLength(4);
    expect(n[0]).toMatchObject({
      current: true,
      channel: 149,
      band: "5",
      widthMHz: 80,
      phy: "802.11ax",
      rateMbps: 866,
    });
  });
  it("reports redacted names honestly rather than showing the placeholder", () => {
    expect(n.every((x) => x.redacted && x.ssid === "")).toBe(true);
  });
  it("splits signal and noise, and leaves them undefined when absent", () => {
    expect(n[0]).toMatchObject({ signalDbm: -52, noiseDbm: -92 });
    expect(n[2]?.signalDbm).toBeUndefined();
  });
  it("prettifies the security constants", () => {
    expect(n.map((x) => x.security)).toEqual([
      "WPA3 Personal",
      "WPA2 Personal",
      "Open",
      "WPA3 Personal",
    ]);
  });
  it("tells 6 GHz from 5 GHz by the band in the channel text, not the number", () => {
    expect(n[3]).toMatchObject({ channel: 37, band: "6", widthMHz: 160 });
  });
  it("says what is wrong with text that is not JSON, or not this JSON", () => {
    expect(parseMacosJson("{nope")).toMatchObject({ ok: false });
    expect(parseMacosJson("{}")).toMatchObject({ ok: false });
  });
});

describe("macOS Wi-Fi text", () => {
  const n = nets(parseMacosText(fx.MACOS_TEXT));
  it("reads each network under its section by indentation", () => {
    expect(n).toHaveLength(3);
    expect(n[0]).toMatchObject({
      ssid: "Home-5G",
      current: true,
      channel: 149,
      widthMHz: 80,
      signalDbm: -52,
      noiseDbm: -92,
    });
    expect(n[1]).toMatchObject({
      ssid: "SKY-4F29",
      current: false,
      band: "2.4",
      security: "WPA2 Personal",
    });
  });
  it("marks a redacted name and does not read awdl0's lines as networks", () => {
    expect(n[2]).toMatchObject({ redacted: true, ssid: "", security: "None" });
    expect(n.some((x) => x.ssid === "Status")).toBe(false);
  });
});

describe("Windows netsh", () => {
  const n = nets(parseNetsh(fx.NETSH));
  it("makes one entry per BSSID, each with its SSID", () => {
    expect(n).toHaveLength(4);
    expect(n.map((x) => x.ssid)).toEqual(["Home-5G", "SKY-4F29", "SKY-4F29", ""]);
  });
  it("reads band, channel, radio type and converts signal % to dBm", () => {
    expect(n[0]).toMatchObject({
      band: "5",
      channel: 149,
      phy: "802.11ax",
      signalDbm: -54,
      bssid: "a8:6b:ad:3c:11:2f",
    });
    expect(n[2]).toMatchObject({ band: "2.4", channel: 11, signalDbm: -84 });
  });
  it("takes authentication from the second header line, so a hidden network keeps it", () => {
    expect(n[0]?.security).toBe("WPA3-Personal");
    expect(n[3]?.security).toBe("Open");
  });
  it("marks a width it had to guess", () => {
    expect(n[0]).toMatchObject({ widthMHz: 80, widthEstimated: true });
    expect(n[1]).toMatchObject({ widthMHz: 20, widthEstimated: true });
  });
  it("reads a German Windows by the shape of the values, not the labels", () => {
    const g = nets(parseNetsh(fx.NETSH_DE));
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({
      ssid: "Heimnetz",
      channel: 44,
      band: "5",
      signalDbm: -56,
      phy: "802.11ac",
      security: "WPA2-Personal",
    });
  });
});

describe("Linux nmcli", () => {
  it("cuts the table by its header's column positions", () => {
    const n = nets(parseNmcli(fx.NMCLI));
    expect(n).toHaveLength(5);
    expect(n[0]).toMatchObject({
      ssid: "Home-5G",
      current: true,
      channel: 149,
      band: "5",
      rateMbps: 540,
      signalDbm: -59,
      security: "WPA2 WPA3",
    });
    // `--` is a hidden SSID and an open network.
    expect(n[2]).toMatchObject({ ssid: "", security: "Open", band: "2.4", channel: 1 });
    expect(n[3]?.ssid).toBe("Corner Cafe");
    expect(n[4]).toMatchObject({ band: "6", channel: 37 });
  });
  it("works without IN-USE", () => {
    const n = nets(parseNmcli(fx.NMCLI_NO_INUSE));
    expect(n[0]).toMatchObject({ ssid: "Home-5G", channel: 36, current: false });
  });
  it("splits terse lines on unescaped colons only", () => {
    expect(splitTerse("a\\:b:c\\\\d:e")).toEqual(["a:b", "c\\d", "e"]);
    const n = nets(parseNmcliTerse(fx.NMCLI_TERSE));
    expect(n).toHaveLength(4);
    expect(n[0]).toMatchObject({
      ssid: "Home-5G",
      bssid: "a8:6b:ad:3c:11:2f",
      current: true,
      channel: 149,
    });
    expect(n[3]?.ssid).toBe("Cafe: Guest");
    expect(n[2]).toMatchObject({ ssid: "", security: "Open" });
  });
});

describe("arp and ip neigh", () => {
  it("reads macOS arp -a, zero-padding MACs and flagging incomplete entries", () => {
    const d = need(parseArp(fx.ARP_MACOS)).devices;
    expect(d).toHaveLength(5);
    expect(d[0]).toMatchObject({ ip: "192.168.1.1", mac: "00:0a:eb:3c:11:2f", iface: "en0" });
    expect(d[1]).toMatchObject({ host: "router.lan" });
    expect(d[2]).toMatchObject({ ip: "192.168.1.50", incomplete: true });
    expect(d[2]?.mac).toBeUndefined();
    expect(d[4]).toMatchObject({ mac: "01:00:5e:00:00:fb", state: "permanent" });
  });
  it("reads Linux arp -a", () => {
    const d = need(parseArp(fx.ARP_LINUX)).devices;
    expect(d.map((x) => x.mac)).toEqual(["a8:6b:ad:3c:11:2f", "10:7b:44:9c:01:80", undefined]);
    expect(d[0]?.iface).toBe("wlan0");
    expect(d[2]?.incomplete).toBe(true);
  });
  it("reads Windows arp -a, and lists a multicast entry shown on two adapters once", () => {
    const d = need(parseArpWindows(fx.ARP_WINDOWS)).devices;
    expect(d.map((x) => x.ip)).toEqual([
      "192.168.1.1",
      "192.168.1.255",
      "224.0.0.22",
      "239.255.255.250",
    ]);
    expect(d[0]).toMatchObject({
      mac: "a8:6b:ad:3c:11:2f",
      state: "dynamic",
      iface: "192.168.1.20",
    });
  });
  it("reads ip neigh, including IPv6 and entries with no lladdr", () => {
    const d = need(parseIpNeigh(fx.IP_NEIGH)).devices;
    expect(d).toHaveLength(4);
    expect(d[1]).toMatchObject({ state: "STALE", mac: "a6:83:e7:12:9c:44" });
    expect(d[2]).toMatchObject({ state: "FAILED", incomplete: true });
    expect(d[3]).toMatchObject({ ip: "fe80::aa6b:adff:fe3c:112f", state: "STALE" });
  });
});

describe("nmap XML", () => {
  it("reads hosts, MACs with nmap's vendor, names and latency, and skips hosts that are down", () => {
    const d = need(parseNmapXml(fx.NMAP_SN)).devices;
    expect(d).toHaveLength(3);
    expect(d[0]).toMatchObject({
      ip: "192.168.1.1",
      mac: "a8:6b:ad:3c:11:2f",
      vendor: "TP-Link",
      host: "router.lan",
      latencyMs: 2.314,
    });
    expect(d[1]?.vendor).toBeUndefined();
    // The machine running nmap has no MAC in the output.
    expect(d[2]).toMatchObject({ ip: "192.168.1.20", host: "macbook.lan" });
    expect(d[2]?.mac).toBeUndefined();
  });
  it("reads open ports and their services, and ignores filtered ones", () => {
    const d = need(parseNmapXml(fx.NMAP_PORTS)).devices;
    expect(d[0]?.ports).toEqual([
      { port: 80, protocol: "tcp", service: "http", product: "Debut embedded httpd" },
      { port: 515, protocol: "tcp", service: "printer", product: undefined },
      { port: 9100, protocol: "tcp", service: "jetdirect", product: undefined },
    ]);
  });
  it("explains truncated XML", () => {
    const r = parseNmapXml(fx.NMAP_SN.slice(0, 600));
    expect(r.ok).toBe(false);
  });
});

describe("traceroute", () => {
  it("reads macOS output: names, addresses, stars, several responders on a hop", () => {
    const s = need(parseTraceroute(fx.TRACEROUTE_MACOS));
    expect(s).toMatchObject({ target: "example.com", targetIp: "93.184.216.34" });
    expect(s.hops).toHaveLength(5);
    expect(s.hops[0]).toMatchObject({ n: 1, ip: "192.168.1.1", rtts: [2.345, 1.987, 2.012] });
    expect(s.hops[0]?.name).toBeUndefined();
    expect(s.hops[2]).toMatchObject({ n: 3, rtts: [null, null, null] });
    expect(s.hops[2]?.ip).toBeUndefined();
    expect(s.hops[3]).toMatchObject({
      ip: "203.0.113.5",
      name: "ae-1.r01.lon.example.net",
      alsoIps: ["203.0.113.6"],
      rtts: [12.101, 13.02, 12.518],
    });
    expect(s.hops[4]?.rtts).toEqual([14.002, null, 13.644]);
  });
  it("reads Linux annotations like !H, and -n output without names", () => {
    const h = hops(parseTraceroute(fx.TRACEROUTE_LINUX));
    expect(h[0]).toMatchObject({ ip: "192.168.1.1", name: "_gateway" });
    expect(h[2]).toMatchObject({ ip: "192.168.1.5", note: "!H", rtts: [3005.114, null, null] });
    const n = hops(parseTraceroute(fx.TRACEROUTE_N));
    expect(n[1]).toMatchObject({ ip: "1.1.1.1", rtts: [9.8, 9.7, 9.9] });
  });
  it("reads Windows tracert: <1 ms, timed out, names in brackets, unreachable reports", () => {
    const s = need(parseTracert(fx.TRACERT));
    expect(s).toMatchObject({ target: "example.com", targetIp: "93.184.216.34" });
    expect(s.hops).toHaveLength(5);
    expect(s.hops[0]).toMatchObject({ ip: "192.168.1.1", rtts: [0.5, 0.5, 0.5] });
    expect(s.hops[2]).toMatchObject({ rtts: [null, null, null] });
    expect(s.hops[2]?.ip).toBeUndefined();
    expect(s.hops[3]).toMatchObject({ name: "ae-1.r01.lon.example.net", ip: "203.0.113.5" });
    expect(s.hops[4]?.rtts).toEqual([14, null, 14]);
    const u = need(parseTracert(fx.TRACERT_UNREACHABLE));
    expect(u.hops[1]).toMatchObject({ ip: "192.168.1.20" });
  });
  it("reads an mtr report: loss, averages and ??? hops", () => {
    const h = hops(parseMtr(fx.MTR));
    expect(h).toHaveLength(5);
    expect(h[0]?.mtr).toMatchObject({ lossPct: 0, sent: 10, avg: 2.3, best: 1.9, worst: 3.5 });
    expect(h[1]).toMatchObject({ rtts: [null] });
    expect(h[1]?.ip).toBeUndefined();
    expect(h[3]).toMatchObject({ name: "ae-1.r01.lon.example.net" });
    expect(h[3]?.ip).toBeUndefined();
    expect(h[4]?.mtr?.lossPct).toBe(20);
  });
});

describe("format detection", () => {
  const cases: [string, string][] = [
    ["wifi-macos-json", fx.MACOS_JSON_REDACTED],
    ["wifi-macos-text", fx.MACOS_TEXT],
    ["wifi-netsh", fx.NETSH],
    ["wifi-netsh", fx.NETSH_DE],
    ["wifi-nmcli", fx.NMCLI],
    ["wifi-nmcli", fx.NMCLI_NO_INUSE],
    ["wifi-nmcli-terse", fx.NMCLI_TERSE],
    ["devices-arp", fx.ARP_MACOS],
    ["devices-arp", fx.ARP_LINUX],
    ["devices-arp-windows", fx.ARP_WINDOWS],
    ["devices-ip-neigh", fx.IP_NEIGH],
    ["devices-nmap", fx.NMAP_SN],
    ["devices-nmap", fx.NMAP_PORTS],
    ["path-traceroute", fx.TRACEROUTE_MACOS],
    ["path-traceroute", fx.TRACEROUTE_LINUX],
    ["path-tracert", fx.TRACERT],
    ["path-mtr", fx.MTR],
  ];
  it.each(cases)("%s", (id, text) => {
    expect(detectFormat(text)).toBe(id);
    expect(parseScan(text).ok).toBe(true);
  });
  it("tolerates a byte-order mark and Windows line endings", () => {
    expect(detectFormat("﻿" + fx.TRACERT.replace(/\n/g, "\r\n"))).toBe("path-tracert");
  });
  it("recognises a traceroute pasted without its header", () => {
    const body = fx.TRACEROUTE_MACOS.split("\n").slice(1).join("\n");
    expect(detectFormat(body)).toBe("path-traceroute");
  });
  it("lists the supported formats when it does not know the text", () => {
    const r = parseScan("hello world");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("arp -a");
      expect(r.error).toContain("netsh wlan show networks mode=bssid");
      expect(r.error).toContain("mtr --report");
    }
  });
  it("says so for an empty paste, and names the format when it fails to parse", () => {
    expect(parseScan("  \n")).toMatchObject({ ok: false });
    const r = parseScan(fx.NMAP_SN.slice(0, 600));
    expect(r).toMatchObject({ ok: false, format: "devices-nmap" });
  });
});
