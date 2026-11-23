/**
 * Device-list parsers: the ARP cache as `arp -a` prints it on macOS/BSD, Linux and Windows, Linux's `ip neigh`,
 * and nmap's XML (`nmap -sn -oX -` for a ping sweep, `nmap -oX` with ports). All yield `Device[]`, one per
 * (address, hardware address), with whatever the tool knew: a name, the interface, nmap's own vendor and open
 * ports.
 */
import { isIpv4, normaliseMac } from "./net";
import { fail, ok, type Device, type DevicesScan, type ParseResult } from "./types";

const key = (d: Device) => `${d.ip ?? ""}|${d.mac ?? ""}`;

/** The same (address, MAC) can show on several interfaces or lines: keep the first. */
function unique(devices: Device[]): Device[] {
  const seen = new Set<string>();
  return devices.filter((d) => (seen.has(key(d)) ? false : (seen.add(key(d)), true)));
}

const done = (devices: Device[], what: string): ParseResult<DevicesScan> =>
  devices.length
    ? ok({ kind: "devices", devices: unique(devices) })
    : fail(`No entries found in this ${what} output.`);

/**
 * `arp -a` on macOS, BSD and Linux:
 * `? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]` or
 * `router.lan (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on wlan0`. macOS drops leading zeros inside the MAC.
 */
export function parseArp(text: string): ParseResult<DevicesScan> {
  const devices: Device[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m =
      /^(\S+)\s+\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+(\(incomplete\)|<incomplete>|[0-9a-fA-F:.-]+)(.*)$/.exec(
        line,
      );
    if (!m) continue;
    const rest = m[4] ?? "";
    const incomplete = /incomplete/i.test(m[3] ?? "");
    const state = /\bpermanent\b/.test(rest) ? "permanent" : undefined;
    devices.push({
      ip: m[2],
      mac: incomplete ? undefined : normaliseMac(m[3] ?? ""),
      host: m[1] === "?" ? undefined : m[1],
      iface: /\bon\s+(\S+)/.exec(rest)?.[1],
      state,
      incomplete: incomplete || undefined,
    });
  }
  return done(devices, "arp -a");
}

/** Windows `arp -a`: an `Interface:` heading per adapter, then `192.168.1.1   aa-bb-cc-dd-ee-ff   dynamic`. */
export function parseArpWindows(text: string): ParseResult<DevicesScan> {
  const devices: Device[] = [];
  let iface: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*[^\d\s][^:]*:\s*(\d{1,3}(?:\.\d{1,3}){3})\s+---/.exec(line);
    if (head) {
      iface = head[1];
      continue;
    }
    const m =
      /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})\s+(\S+)\s*$/.exec(
        line,
      );
    if (m && isIpv4(m[1] ?? ""))
      devices.push({ ip: m[1], mac: normaliseMac(m[2] ?? ""), iface, state: m[3]?.toLowerCase() });
  }
  return done(devices, "arp -a");
}

/** Linux `ip neigh`: `192.168.1.1 dev wlan0 lladdr aa:bb:cc:dd:ee:ff REACHABLE`, or `… dev wlan0  FAILED`. */
export function parseIpNeigh(text: string): ParseResult<DevicesScan> {
  const devices: Device[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m =
      /^(\S+)\s+dev\s+(\S+)(?:\s+lladdr\s+(\S+))?(?:\s+router)?(?:\s+proxy)?\s*([A-Z]+)?\s*$/.exec(
        line.trim(),
      );
    if (!m) continue;
    const state = m[4];
    devices.push({
      ip: m[1],
      mac: m[3] ? normaliseMac(m[3]) : undefined,
      iface: m[2],
      state,
      incomplete: !m[3] || undefined,
    });
  }
  return done(devices, "ip neigh");
}

/** nmap's XML: every `<host>` with its addresses, hostnames, ports and round trip. Needs a DOM (the browser's). */
export function parseNmapXml(text: string): ParseResult<DevicesScan> {
  const start = text.indexOf("<?xml");
  const xml = start > 0 ? text.slice(start) : text;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror") || doc.documentElement.nodeName !== "nmaprun") {
    return fail(
      "That is not complete nmap XML. Copy everything from <?xml to </nmaprun>, and run nmap with -oX - so it prints XML.",
    );
  }
  const devices: Device[] = [];
  for (const host of Array.from(doc.querySelectorAll("host"))) {
    if (host.querySelector(":scope > status")?.getAttribute("state") === "down") continue;
    const d: Device = {};
    for (const a of Array.from(host.querySelectorAll(":scope > address"))) {
      const type = a.getAttribute("addrtype");
      if (type === "ipv4" || type === "ipv6") d.ip ??= a.getAttribute("addr") ?? undefined;
      if (type === "mac") {
        d.mac = normaliseMac(a.getAttribute("addr") ?? "");
        d.vendor = a.getAttribute("vendor") || undefined;
      }
    }
    d.host = host.querySelector(":scope > hostnames > hostname")?.getAttribute("name") ?? undefined;
    const ports = Array.from(host.querySelectorAll(":scope > ports > port"))
      .filter((p) => p.querySelector(":scope > state")?.getAttribute("state") === "open")
      .map((p) => ({
        port: Number(p.getAttribute("portid")),
        protocol: p.getAttribute("protocol") ?? "tcp",
        service: p.querySelector(":scope > service")?.getAttribute("name") ?? undefined,
        product: p.querySelector(":scope > service")?.getAttribute("product") ?? undefined,
      }));
    if (ports.length) d.ports = ports;
    const srtt = Number(host.querySelector(":scope > times")?.getAttribute("srtt"));
    if (Number.isFinite(srtt) && srtt > 0) d.latencyMs = srtt / 1000;
    if (d.ip) devices.push(d);
  }
  return doc.querySelectorAll("host").length === 0
    ? fail("This nmap run found no hosts. Check the address range you scanned.")
    : ok({ kind: "devices", devices });
}
