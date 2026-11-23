/**
 * Format detection: given pasted text, say which tool printed it and parse it. Detection looks for what only
 * that tool prints (a header, a column name, a key), never for the OS, so the same paste works from any machine.
 */
import { parseArp, parseArpWindows, parseIpNeigh, parseNmapXml } from "./devices";
import { parseMtr, parseTraceroute, parseTracert } from "./path";
import { type FormatId, type ParseResult, type ScanData, type ScanKind } from "./types";
import { parseMacosJson, parseMacosText, parseNetsh, parseNmcli, parseNmcliTerse } from "./wifi";

export interface FormatInfo {
  id: FormatId;
  kind: ScanKind;
  /** What the person would call it. */
  label: string;
  /** The command that prints it, as a short reminder. */
  command: string;
}

export const FORMATS: FormatInfo[] = [
  {
    id: "wifi-macos-json",
    kind: "wifi",
    label: "macOS Wi-Fi (JSON)",
    command: "system_profiler SPAirPortDataType -json",
  },
  {
    id: "wifi-macos-text",
    kind: "wifi",
    label: "macOS Wi-Fi (text)",
    command: "system_profiler SPAirPortDataType",
  },
  {
    id: "wifi-netsh",
    kind: "wifi",
    label: "Windows Wi-Fi (netsh)",
    command: "netsh wlan show networks mode=bssid",
  },
  { id: "wifi-nmcli", kind: "wifi", label: "Linux Wi-Fi (nmcli)", command: "nmcli dev wifi list" },
  {
    id: "wifi-nmcli-terse",
    kind: "wifi",
    label: "Linux Wi-Fi (nmcli -t)",
    command: "nmcli -t … dev wifi list",
  },
  { id: "devices-arp", kind: "devices", label: "arp -a (macOS, BSD, Linux)", command: "arp -a" },
  { id: "devices-arp-windows", kind: "devices", label: "arp -a (Windows)", command: "arp -a" },
  { id: "devices-ip-neigh", kind: "devices", label: "ip neigh (Linux)", command: "ip neigh" },
  {
    id: "devices-nmap",
    kind: "devices",
    label: "nmap XML",
    command: "nmap -sn -oX - 192.168.1.0/24",
  },
  {
    id: "path-traceroute",
    kind: "path",
    label: "traceroute (macOS, Linux)",
    command: "traceroute example.com",
  },
  { id: "path-tracert", kind: "path", label: "tracert (Windows)", command: "tracert example.com" },
  { id: "path-mtr", kind: "path", label: "mtr report", command: "mtr --report example.com" },
];

export const formatInfo = (id: FormatId): FormatInfo =>
  FORMATS.find((f) => f.id === id) ?? FORMATS[0]!;

/** One line per supported format, for the "I don't know this" message. */
export const SUPPORTED = FORMATS.map((f) => `${f.label}: ${f.command}`);

const UNKNOWN =
  "I don't recognise this output. Supported: " +
  FORMATS.map((f) => `${f.label} (${f.command})`).join("; ") +
  ".";

/** Which format the text is, if any. */
export function detectFormat(input: string): FormatId | undefined {
  const text = input.replace(/^﻿/, "");
  const head = text.trimStart();
  if (head.startsWith("{") && text.includes("SPAirPortDataType")) return "wifi-macos-json";
  if (/<nmaprun\b/.test(text)) return "devices-nmap";
  if (/Other Local Wi-Fi Networks:|Current Network Information:/.test(text))
    return "wifi-macos-text";
  if (/^\s*SSID\s+\d+\s*:/m.test(text) && /^\s*BSSID\s+\d+\s*:/m.test(text)) return "wifi-netsh";
  if (/\bBSSID\b/.test(text) && /\bSIGNAL\b/.test(text) && /\bCHAN\b/.test(text))
    return "wifi-nmcli";
  if (/^[^\n]*:(?:[0-9A-Fa-f]{2}\\:){5}[0-9A-Fa-f]{2}:/m.test(text)) return "wifi-nmcli-terse";
  if (/Internet Address\s+Physical Address/i.test(text)) return "devices-arp-windows";
  if (/\(\d{1,3}(?:\.\d{1,3}){3}\)\s+at\s+/.test(text)) return "devices-arp";
  if (
    /^\S+\s+dev\s+\S+/m.test(text) &&
    /\b(lladdr|FAILED|INCOMPLETE|REACHABLE|STALE|DELAY|PROBE)\b/.test(text)
  )
    return "devices-ip-neigh";
  if (/^\s*Tracing route to /im.test(text)) return "path-tracert";
  if (/^\s*HOST:\s.*Loss%/im.test(text)) return "path-mtr";
  if (/^\s*traceroute6? to /im.test(text)) return "path-traceroute";
  // A traceroute pasted without its header: hop lines with times or stars.
  const hopLines = text
    .split(/\r?\n/)
    .filter((l) => /^\s*\d{1,2}\s+(\*|\S+\s+\(|\S+\s+[\d.]+\s+ms)/.test(l));
  if (hopLines.length >= 2) return "path-traceroute";
  const tracertLines = text
    .split(/\r?\n/)
    .filter((l) => /^\s*\d{1,2}\s{2,}(<?\d+\s*ms|\*)/.test(l));
  if (tracertLines.length >= 2) return "path-tracert";
  return undefined;
}

const parsers: Record<FormatId, (text: string) => ParseResult<ScanData>> = {
  "wifi-macos-json": parseMacosJson,
  "wifi-macos-text": parseMacosText,
  "wifi-netsh": parseNetsh,
  "wifi-nmcli": parseNmcli,
  "wifi-nmcli-terse": parseNmcliTerse,
  "devices-arp": parseArp,
  "devices-arp-windows": parseArpWindows,
  "devices-ip-neigh": parseIpNeigh,
  "devices-nmap": parseNmapXml,
  "path-traceroute": parseTraceroute,
  "path-tracert": parseTracert,
  "path-mtr": parseMtr,
};

export type Detected =
  | { ok: true; format: FormatId; scan: ScanData }
  | { ok: false; format?: FormatId; error: string };

/** Detect and parse. A recognised format that fails to parse says why; an unrecognised one lists what is supported. */
export function parseScan(input: string): Detected {
  if (input.trim() === "") return { ok: false, error: "Nothing to read yet." };
  const format = detectFormat(input);
  if (!format) return { ok: false, error: UNKNOWN };
  const result = parsers[format](input.replace(/^﻿/, ""));
  return result.ok
    ? { ok: true, format, scan: result.scan }
    : { ok: false, format, error: result.error };
}
