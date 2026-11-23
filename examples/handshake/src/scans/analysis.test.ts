/** The analysis: channel spans and congestion, the recommendation, MACs and vendors, hop classification. */
import { describe, expect, it } from "vitest";
import {
  analyseWifi,
  blocks,
  congestionLabel,
  isDfs,
  overlapMHz,
  scoreBlock,
  signalQuality,
  snrQuality,
  spanOf,
} from "./channels";
import { parseScan } from "./detect";
import { analyseDevices, countDevices, isHost } from "./devices-analysis";
import * as fx from "./fixtures";
import { describeMac, tableSize, vendorOf } from "./oui";
import { analysePath, classifyIp } from "./path-analysis";
import { SAMPLE_DEVICES, SAMPLE_PATH, SAMPLE_WIFI } from "./samples";
import type { PathScan, WifiNetwork } from "./types";

const wifi = (
  channel: number,
  band: WifiNetwork["band"],
  widthMHz = 20,
  signalDbm = -50,
  extra: Partial<WifiNetwork> = {},
): WifiNetwork => ({
  ssid: `n${channel}`,
  redacted: false,
  channel,
  band,
  widthMHz,
  signalDbm,
  ...extra,
});

describe("channel spans", () => {
  it("puts 2.4 GHz channels 5 MHz apart and 20 MHz wide", () => {
    expect(spanOf(wifi(1, "2.4"))).toEqual({ lowMHz: 2402, highMHz: 2422, widthMHz: 20 });
    expect(spanOf(wifi(6, "2.4"))).toEqual({ lowMHz: 2427, highMHz: 2447, widthMHz: 20 });
  });
  it("overlaps adjacent 2.4 GHz channels ±4 and leaves 1, 6 and 11 clear of each other", () => {
    const s = (c: number) => spanOf(wifi(c, "2.4"))!;
    expect(overlapMHz(s(1), s(6))).toBe(0);
    expect(overlapMHz(s(6), s(11))).toBe(0);
    expect(overlapMHz(s(1), s(2))).toBe(15);
    expect(overlapMHz(s(1), s(4))).toBe(5);
    expect(overlapMHz(s(1), s(5))).toBe(0);
    expect(overlapMHz(s(3), s(1))).toBeGreaterThan(0);
    expect(overlapMHz(s(3), s(6))).toBeGreaterThan(0);
  });
  it("bonds 5 GHz channels into aligned blocks", () => {
    expect(spanOf(wifi(36, "5", 80))).toEqual(spanOf(wifi(48, "5", 80)));
    expect(spanOf(wifi(44, "5", 80))).toEqual({ lowMHz: 5170, highMHz: 5250, widthMHz: 80 });
    expect(spanOf(wifi(149, "5", 80))).toEqual({ lowMHz: 5735, highMHz: 5815, widthMHz: 80 });
    expect(spanOf(wifi(157, "5", 80))).toEqual(spanOf(wifi(149, "5", 80)));
    expect(spanOf(wifi(52, "5", 40))).toEqual({ lowMHz: 5250, highMHz: 5290, widthMHz: 40 });
    expect(spanOf(wifi(40, "5", 160))).toEqual({ lowMHz: 5170, highMHz: 5330, widthMHz: 160 });
    expect(spanOf(wifi(116, "5", 80))).toEqual({ lowMHz: 5570, highMHz: 5650, widthMHz: 80 });
  });
  it("lists the valid blocks", () => {
    expect(blocks("5", 80).map((b) => b.primary)).toEqual([36, 52, 100, 116, 132, 149]);
    expect(blocks("5", 160).map((b) => b.primary)).toEqual([36, 100]);
    expect(blocks("5", 40).map((b) => b.primary)).toEqual([
      36, 44, 52, 60, 100, 108, 116, 124, 132, 140, 149, 157,
    ]);
    expect(blocks("6", 80)[0]?.primary).toBe(1);
    expect(blocks("6", 80)[1]?.primary).toBe(17);
    expect(blocks("5", 80).map((b) => b.dfs)).toEqual([false, true, true, true, true, false]);
    expect(isDfs(52) && isDfs(144) && !isDfs(149) && !isDfs(48)).toBe(true);
  });
  it("reads 6 GHz channel 37 from 5955 + 5 per channel", () => {
    const s = spanOf(wifi(37, "6", 80))!;
    expect(s.lowMHz).toBe(5950 + 5 * 33 - 10); // block 33..45
    expect(s.highMHz).toBe(5950 + 5 * 45 + 10);
  });
});

describe("congestion", () => {
  it("scores empty air as zero and louder neighbours as worse", () => {
    const b = blocks("2.4", 20)[5]!; // channel 6
    expect(scoreBlock(b, []).congestion).toBe(0);
    const quiet = scoreBlock(b, [wifi(6, "2.4", 20, -85)]).load;
    const loud = scoreBlock(b, [wifi(6, "2.4", 20, -45)]).load;
    expect(loud).toBeGreaterThan(quiet * 3);
  });
  it("counts partial overlap as worse than the same overlap co-channel would be", () => {
    const six = blocks("2.4", 20)[5]!;
    expect(scoreBlock(six, [wifi(6, "2.4", 20, -45)]).load).toBeCloseTo(1, 5);
    expect(scoreBlock(six, [wifi(5, "2.4", 20, -45)]).load).toBeCloseTo(0.75 * 1.25, 5);
  });
  it("blocks a bonded channel for a narrow neighbour inside it", () => {
    const eighty = blocks("5", 80)[0]!;
    expect(scoreBlock(eighty, [wifi(44, "5", 20, -45)]).load).toBeCloseTo(1, 5);
    expect(scoreBlock(eighty, [wifi(149, "5", 20)]).load).toBe(0);
  });
  it("ignores other bands", () => {
    expect(scoreBlock(blocks("5", 80)[0]!, [wifi(36, "2.4")]).neighbours).toBe(0);
  });
  it("labels", () => {
    expect([0, 20, 50, 90].map(congestionLabel)).toEqual(["Clear", "Light", "Busy", "Congested"]);
  });
});

describe("recommendations", () => {
  it("picks the clearest of 1, 6 and 11 on 2.4 GHz and explains why", () => {
    const rec = analyseWifi([
      wifi(1, "2.4", 20, -50),
      wifi(1, "2.4", 20, -60),
      wifi(6, "2.4", 20, -55),
      wifi(11, "2.4", 20, -90),
    ]).find((b) => b.band === "2.4")!.recommendation!;
    expect(rec.best.block.primary).toBe(11);
    expect(rec.ranked.map((c) => c.block.primary)).toEqual([11, 6, 1]);
    const text = rec.reasons.join(" ");
    expect(text).toContain("1, 6 and 11");
    expect(text).toContain("Channel 1: 2 networks overlap");
  });
  it("tells you when you are on an overlapping channel", () => {
    const mine = wifi(3, "2.4", 20, -40, { current: true });
    const rec = analyseWifi([mine, wifi(1, "2.4"), wifi(6, "2.4")]).find(
      (b) => b.band === "2.4",
    )!.recommendation!;
    expect(rec.current?.block.primary).toBe(3);
    expect(rec.alreadyBest).toBe(false);
    expect(rec.reasons.join(" ")).toContain("Your network is on channel 3");
  });
  it("leaves your own network out of the score", () => {
    const mine = wifi(6, "2.4", 20, -40, { current: true });
    const band = analyseWifi([mine, wifi(1, "2.4", 20, -80)]).find((b) => b.band === "2.4")!;
    expect(band.recommendation?.current?.neighbours).toBe(0);
    expect(band.recommendation?.alreadyBest).toBe(true);
    expect(band.basis).toContain("without your own");
  });
  it("warns about DFS on 5 GHz when the clearest block is DFS, and offers the best without", () => {
    const nets = [36, 149, 100, 116, 132]
      .map((c) => wifi(c, "5", 80, -45))
      .concat(wifi(52, "5", 80, -92));
    const rec = analyseWifi(nets).find((b) => b.band === "5")!.recommendation!;
    expect(rec.best.block.primary).toBe(52);
    expect(rec.reasons.join(" ")).toContain("DFS");
    expect(rec.reasons.join(" ")).toContain("The best without DFS");
  });
  it("shows the width trade-off, and sets a wide channel against its narrow cousins", () => {
    const rec = analyseWifi([wifi(36, "5", 20, -50), wifi(100, "5", 20, -50)]).find(
      (b) => b.band === "5",
    )!.recommendation!;
    expect(rec.byWidth.map((c) => c.block.widthMHz)).toEqual([20, 40, 80, 160]);
    expect(rec.reasons.join(" ")).toContain("Width trades range and interference for speed");
    expect(rec.byWidth[3]!.congestion).toBeGreaterThanOrEqual(rec.byWidth[0]!.congestion);
  });
  it("prefers a preferred scanning channel on 6 GHz when nothing else separates them", () => {
    const rec = analyseWifi([
      wifi(37, "6", 80, -60, { current: true }),
      wifi(1, "6", 80, -60),
    ]).find((b) => b.band === "6")!.recommendation!;
    expect(rec.best.block.band).toBe("6");
    expect(rec.reasons.join(" ")).toContain("WPA3");
  });
  it("analyses the sample: a busy 2.4 band, a better 5, and one 6 GHz network", () => {
    const r = parseScan(SAMPLE_WIFI);
    if (!r.ok || r.scan.kind !== "wifi") throw new Error("sample did not parse");
    const bands = analyseWifi(r.scan.networks);
    expect(bands.map((b) => b.band)).toEqual(["2.4", "5", "6"]);
    const two = bands[0]!;
    const five = bands[1]!;
    expect(two.networks).toHaveLength(8);
    expect(two.congestion).toBeGreaterThan(five.congestion - 1);
    expect(five.recommendation?.current?.block.primary).toBe(149);
    expect(bands[2]!.networks).toHaveLength(1);
  });
});

describe("signal quality", () => {
  it("grades dBm by the usual thresholds", () => {
    expect([-40, -55, -65, -72, -80, -90].map((d) => signalQuality(d).label)).toEqual([
      "Excellent",
      "Good",
      "Fair",
      "Weak",
      "Poor",
      "Unusable",
    ]);
    expect(signalQuality(-67).label).toBe("Fair");
    expect(signalQuality(-68).label).toBe("Weak");
  });
  it("grades SNR", () => {
    expect([45, 30, 20, 12, 5].map((d) => snrQuality(d).label)).toEqual([
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Bad",
    ]);
  });
});

describe("MAC addresses and vendors", () => {
  it("looks up a vendor from the OUI, in any form of the address", () => {
    expect(vendorOf("a8:6b:ad:3c:11:2f")).toBeDefined();
    expect(vendorOf("00:03:93:aa:bb:cc")).toBe("Apple");
    expect(vendorOf("0:3:93:aa:bb:cc")).toBe("Apple");
    expect(vendorOf("00-0E-58-12-34-56")).toBe("Sonos");
    expect(vendorOf("04:83:08:00:00:01")).toBe("Espressif");
  });
  it("has no vendor for randomised addresses, and says so", () => {
    for (const mac of [
      "a6:83:e7:12:9c:44",
      "3a:5c:11:ab:07:de",
      "d2:00:00:00:00:01",
      "02:00:5e:10:00:01",
    ]) {
      const i = describeMac(mac)!;
      expect(i.randomised).toBe(true);
      expect(i.vendor).toBeUndefined();
    }
    // A real Apple prefix has the bit clear.
    expect(describeMac("00:03:93:aa:bb:cc")?.randomised).toBe(false);
    // Second hex digit 0, 4, 8, c: globally administered.
    expect(describeMac("c8:00:00:00:00:00")?.randomised).toBe(false);
  });
  it("flags multicast and broadcast", () => {
    expect(describeMac("01:00:5e:00:00:fb")).toMatchObject({ multicast: true, broadcast: false });
    expect(describeMac("ff:ff:ff:ff:ff:ff")).toMatchObject({ multicast: true, broadcast: true });
  });
  it("marks module makers whose brand is not on the box", () => {
    expect(describeMac("04:83:08:00:00:01")?.moduleMaker).toBe(true);
    expect(describeMac("00:03:93:aa:bb:cc")?.moduleMaker).toBe(false);
  });
  it("holds a few hundred vendors' worth of prefixes", () => {
    const s = tableSize();
    expect(s.vendors).toBeGreaterThan(200);
    expect(s.prefixes).toBeGreaterThan(10_000);
  });
});

describe("device analysis", () => {
  const sample = parseScan(SAMPLE_DEVICES);
  if (!sample.ok || sample.scan.kind !== "devices") throw new Error("sample did not parse");
  const sampleDevices = sample.scan.devices;
  const rows = analyseDevices(sampleDevices);
  const by = (ip: string) => rows.find((r) => r.ip === ip)!;

  it("finds vendors, randomised addresses, and entries that are not hosts", () => {
    expect(by("192.168.1.20").vendor).toBe("Apple");
    expect(by("192.168.1.23").vendor).toBe("Samsung");
    expect(by("192.168.1.12")).toMatchObject({ randomised: true, vendor: undefined });
    expect(by("192.168.1.255").roles).toContain("broadcast");
    expect(by("224.0.0.251").roles).toContain("multicast");
    expect(by("192.168.1.77").roles).toContain("incomplete");
    expect(isHost(by("224.0.0.251"))).toBe(false);
  });
  it("guesses the gateway from .1, and uses a known one when given", () => {
    expect(by("192.168.1.1").roles).toContain("likely-gateway");
    const known = analyseDevices(sampleDevices, { gateway: "192.168.1.1" });
    expect(known.find((r) => r.ip === "192.168.1.1")?.roles).toContain("gateway");
    expect(known.find((r) => r.ip === "192.168.1.1")?.roles).not.toContain("likely-gateway");
  });
  it("prefers the table's vendor and falls back to nmap's", () => {
    const r = analyseDevices([
      { ip: "10.0.0.2", mac: "00:03:93:aa:bb:cc", vendor: "Whoever" },
      { ip: "10.0.0.3", mac: "fc:fc:fc:00:00:01", vendor: "Nmap Corp" },
    ]);
    expect(r[0]).toMatchObject({ vendor: "Apple", vendorSource: "table" });
    expect(r[1]).toMatchObject({ vendor: "Nmap Corp", vendorSource: "nmap" });
  });
  it("counts hosts, randomised and special entries", () => {
    const c = countDevices(rows);
    expect(c).toMatchObject({ hosts: 10, randomised: 2, special: 3 });
    expect(c.vendors).toBeGreaterThanOrEqual(6);
  });
  it("sees multicast in an IPv6 neighbour table", () => {
    const r = analyseDevices([{ ip: "ff02::1", mac: "33:33:00:00:00:01" }]);
    expect(r[0]?.roles).toContain("multicast");
  });
});

describe("IP classes", () => {
  it.each([
    ["192.168.1.1", "private"],
    ["10.20.0.1", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.1", "private"],
    ["172.32.0.1", "public"],
    ["100.64.0.1", "cgnat"],
    ["100.127.255.254", "cgnat"],
    ["100.128.0.1", "public"],
    ["203.0.113.5", "documentation"],
    ["198.51.100.9", "documentation"],
    ["192.0.2.1", "documentation"],
    ["169.254.1.1", "link-local"],
    ["127.0.0.1", "loopback"],
    ["198.18.0.1", "benchmark"],
    ["1.1.1.1", "public"],
    ["fd00::1", "private"],
    ["fe80::1", "link-local"],
    ["2001:db8::1", "documentation"],
    ["2606:4700::1111", "public"],
  ])("%s is %s", (ip, cls) => {
    expect(classifyIp(ip).cls).toBe(cls);
  });
});

describe("path analysis", () => {
  const path = (text: string): PathScan => {
    const r = parseScan(text);
    if (!r.ok || r.scan.kind !== "path") throw new Error("did not parse");
    return r.scan;
  };

  it("finds the gateway, CGNAT and the first public hop in the sample", () => {
    const s = analysePath(path(SAMPLE_PATH));
    expect(s.gateway).toBe("192.168.1.1");
    expect(s.behindCgnat).toBe(true);
    expect(s.rows[0]?.isGateway).toBe(true);
    expect(s.rows[1]?.ip?.cls).toBe("cgnat");
    expect(s.rows[3]?.isFirstPublic).toBe(true);
    expect(s.reached).toBe(true);
    expect(s.rows[7]?.isDestination).toBe(true);
    expect(s.hops).toBe(8);
    expect(s.silentHops).toBe(1);
  });
  it("explains a * * * hop with answering hops after it as harmless", () => {
    const s = analysePath(path(SAMPLE_PATH));
    expect(s.rows[2]?.silent).toBe(true);
    expect(s.rows[2]?.notes.join(" ")).toContain("later hops answer");
    expect(s.rows[2]?.notes.join(" ")).toContain("forwards your traffic");
  });
  it("tells a trailing run of stars apart: no proof of loss", () => {
    const s = analysePath(path(fx.TRACEROUTE_LINUX));
    expect(s.reached).toBe(false);
    expect(s.rows[3]?.notes.join(" ")).toContain("does not prove loss");
    expect(s.rows[2]?.notes.join(" ")).toContain("host unreachable");
  });
  it("tells a latency jump that is real from one that is a slow ICMP reply", () => {
    const s = analysePath(path(SAMPLE_PATH));
    // Hop 4 is slow to answer but hop 5 is fast: the router, not the path.
    expect(s.rows[3]?.jump).toBeGreaterThan(20);
    expect(s.rows[3]?.jumpIsArtefact).toBe(true);
    // Hop 6 jumps and the rest stay there: the path.
    expect(s.rows[5]?.jump).toBeGreaterThan(30);
    expect(s.rows[5]?.jumpIsArtefact).toBe(false);
    expect(s.rows[5]?.notes.join(" ")).toContain("100 km per ms");
  });
  it("uses the median so one slow probe does not set the hop's time", () => {
    const s = analysePath(path(fx.TRACEROUTE_MACOS));
    expect(s.rows[0]?.rtt).toBeCloseTo(2.012, 3);
    expect(s.rows[4]?.rtt).toBeCloseTo(13.823, 3);
    expect(s.rows[4]?.lost).toBe(1);
    expect(s.rows[4]?.notes.join(" ")).toContain("1 of 3 probes unanswered");
  });
  it("separates rate-limited loss from loss that carries to the end (mtr)", () => {
    const limited = analysePath(path(fx.MTR));
    expect(limited.rows[2]?.notes.join(" ")).toContain("ICMP rate limiting");
    expect(limited.realLossFrom).toBe(5);
    const real = analysePath(path(fx.MTR_REAL_LOSS));
    expect(real.realLossFrom).toBe(2);
    expect(real.rows[1]?.notes.join(" ")).toContain("real loss");
  });
  it("notes equal-cost paths and notes made-up documentation addresses", () => {
    const s = analysePath(path(fx.TRACEROUTE_MACOS));
    expect(s.rows[3]?.notes.join(" ")).toContain("equal-cost");
    expect(s.rows[3]?.notes.join(" ")).toContain("RFC 5737");
  });
  it("handles an unreachable report in tracert", () => {
    const s = analysePath(path(fx.TRACERT_UNREACHABLE));
    expect(s.reached).toBe(false);
    expect(s.rows[1]?.hop.note).toContain("unreachable");
  });
});
