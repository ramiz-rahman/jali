/**
 * Wi-Fi scan parsers: macOS `system_profiler SPAirPortDataType` (JSON and the plain-text form), Windows
 * `netsh wlan show networks mode=bssid`, and Linux `nmcli dev wifi list` (table and `-t` terse). Each turns text
 * into `WifiNetwork[]`; what a tool does not say stays undefined rather than being invented, except channel width,
 * which no one-line command reports on Windows or Linux and which is guessed and marked as estimated.
 */
import { bandOfChannel, channelOfFrequency, dbmOfQuality, guessWidth } from "./net";
import { fail, ok, type Band, type ParseResult, type WifiNetwork, type WifiScan } from "./types";

const REDACTED = "<redacted>";

/** Fill in what follows from what is known: the band from the channel, an estimated width. */
function complete(n: WifiNetwork): WifiNetwork {
  const band = n.band ?? (n.channel !== undefined ? bandOfChannel(n.channel) : undefined);
  const out: WifiNetwork = { ...n, band };
  if (out.widthMHz === undefined) {
    out.widthMHz = guessWidth(band, n.phy);
    out.widthEstimated = true;
  }
  return out;
}

const bandOfText = (t: string): Band | undefined => {
  const m = /(2\.4|2|5|6)\s*GHz/i.exec(t);
  if (!m) return undefined;
  return m[1] === "2" || m[1] === "2.4" ? "2.4" : m[1] === "5" ? "5" : "6";
};

/** "149 (5GHz, 80MHz)" → channel 149, 5 GHz, 80 MHz. */
function parseMacChannel(text: string): Pick<WifiNetwork, "channel" | "band" | "widthMHz"> {
  const ch = /^\s*(\d+)/.exec(text);
  const width = /(\d+)\s*MHz/i.exec(text);
  return {
    channel: ch?.[1] ? Number(ch[1]) : undefined,
    band: bandOfText(text),
    widthMHz: width?.[1] ? Number(width[1]) : undefined,
  };
}

/** "-45 dBm / -93 dBm" → signal -45, noise -93. */
function parseSignalNoise(text: string): { signalDbm?: number; noiseDbm?: number } {
  const nums = [...text.matchAll(/(-?\d+)\s*dBm/gi)].map((m) => Number(m[1]));
  return { signalDbm: nums[0], noiseDbm: nums[1] };
}

/** "spairport_security_mode_wpa2_personal" → "WPA2 Personal"; plain-text values pass through. */
export function prettySecurity(raw: string): string {
  const t = raw.replace(/^spairport_security_mode_/, "");
  if (t === raw) return raw.trim();
  if (t === "none" || t === "open") return "Open";
  return t
    .split("_")
    .map((w) =>
      /^(wpa\d?|wep|owe|psk|sae)$/.test(w) ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1),
    )
    .join(" ");
}

interface MacAttrs {
  signal?: string;
  channel?: string;
  phy?: string;
  security?: string;
  rate?: string;
}

function macNetwork(name: string, a: MacAttrs, current: boolean): WifiNetwork {
  const redacted = name === REDACTED;
  const rate = Number(a.rate);
  return complete({
    ssid: redacted ? "" : name,
    redacted,
    ...parseMacChannel(a.channel ?? ""),
    phy: a.phy,
    security: a.security ? prettySecurity(a.security) : undefined,
    ...parseSignalNoise(a.signal ?? ""),
    rateMbps: a.rate && Number.isFinite(rate) ? rate : undefined,
    current,
  });
}

/** `system_profiler SPAirPortDataType -json`. */
export function parseMacosJson(text: string): ParseResult<WifiScan> {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return fail(
      "That is not valid JSON. Copy the whole output of the command, from the first { to the last }.",
    );
  }
  const networks: WifiNetwork[] = [];
  const asRecord = (v: unknown): Record<string, unknown> | undefined =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
  const fromEntry = (entry: unknown, current: boolean) => {
    const r = asRecord(entry);
    if (!r) return;
    networks.push(
      macNetwork(
        str(r._name) ?? "",
        {
          signal: str(r.spairport_signal_noise),
          channel: str(r.spairport_network_channel),
          phy: str(r.spairport_network_phymode),
          security: str(r.spairport_security_mode),
          rate: str(r.spairport_network_rate),
        },
        current,
      ),
    );
  };
  const top = asRecord(root)?.SPAirPortDataType;
  if (!Array.isArray(top))
    return fail("This JSON has no SPAirPortDataType: it is not system_profiler's Wi-Fi output.");
  for (const section of top) {
    const interfaces = asRecord(section)?.spairport_airport_interfaces;
    if (!Array.isArray(interfaces)) continue;
    for (const itf of interfaces) {
      const r = asRecord(itf);
      if (!r) continue;
      if (r.spairport_current_network_information)
        fromEntry(r.spairport_current_network_information, true);
      const others = r.spairport_airport_other_local_wireless_networks;
      if (Array.isArray(others)) for (const o of others) fromEntry(o, false);
    }
  }
  return networks.length
    ? ok({ kind: "wifi", networks })
    : fail(
        "No networks in this output. Is Wi-Fi on? On macOS the list is empty while Wi-Fi is off.",
      );
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** `system_profiler SPAirPortDataType`, the indented plain-text form. */
export function parseMacosText(text: string): ParseResult<WifiScan> {
  const lines = text.split(/\r?\n/);
  const networks: WifiNetwork[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const header = /^\s*(Current Network Information|Other Local Wi-Fi Networks):\s*$/.exec(line);
    if (!header) continue;
    const current = header[1] === "Current Network Information";
    const base = indentOf(line);
    // The section runs while lines are indented deeper than its header.
    let end = i + 1;
    while (
      end < lines.length &&
      ((lines[end] ?? "").trim() === "" || indentOf(lines[end] ?? "") > base)
    )
      end++;
    const body = lines.slice(i + 1, end).filter((l) => l.trim() !== "");
    const entryIndent = Math.min(...body.map(indentOf));
    let name: string | undefined;
    let attrs = new Map<string, string>();
    const flush = () => {
      if (name === undefined) return;
      networks.push(
        macNetwork(
          name,
          {
            signal: attrs.get("signal / noise"),
            channel: attrs.get("channel"),
            phy: attrs.get("phy mode"),
            security: attrs.get("security"),
            rate: attrs.get("transmit rate"),
          },
          current,
        ),
      );
    };
    for (const l of body) {
      if (indentOf(l) === entryIndent && l.trimEnd().endsWith(":")) {
        flush();
        name = l.trim().slice(0, -1);
        attrs = new Map();
      } else {
        const m = /^\s*([^:]+):\s*(.*)$/.exec(l);
        if (m?.[1]) attrs.set(m[1].trim().toLowerCase(), (m[2] ?? "").trim());
      }
    }
    flush();
    i = end - 1;
  }
  return networks.length
    ? ok({ kind: "wifi", networks })
    : fail("No networks found under 'Other Local Wi-Fi Networks'. Is Wi-Fi on?");
}

/**
 * `netsh wlan show networks mode=bssid`. The labels are translated on non-English Windows, so values are told apart
 * by their shape, not their key: a percentage is the signal, `5 GHz` the band, `802.11ax` the radio type, and the
 * first bare integer after the signal is the channel.
 */
export function parseNetsh(text: string): ParseResult<WifiScan> {
  const networks: WifiNetwork[] = [];
  let ssid = "";
  let security: string | undefined;
  let headerLines = 0;
  let inHeader = false;
  let cur: WifiNetwork | undefined;
  let haveChannel = false;
  const push = () => {
    if (cur) networks.push(complete(cur));
    cur = undefined;
  };
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(.*?)\s+:\s?(.*?)\s*$/.exec(raw);
    if (!m) continue;
    const key = m[1] ?? "";
    const value = m[2] ?? "";
    if (/^SSID\s+\d+$/i.test(key)) {
      push();
      ssid = value;
      security = undefined;
      headerLines = 0;
      inHeader = true;
    } else if (/^BSSID\s+\d+$/i.test(key)) {
      push();
      inHeader = false;
      haveChannel = false;
      cur = { ssid, redacted: false, bssid: value.toLowerCase(), security };
    } else if (cur) {
      if (/^\d{1,3}\s*%$/.test(value)) cur.signalDbm = dbmOfQuality(parseInt(value, 10));
      else if (value.startsWith("802.11")) cur.phy = value.replace(/^802\.11\s*/i, "802.11");
      else if (/^(2\.4|5|6)\s*GHz$/i.test(value)) cur.band = bandOfText(value);
      else if (!haveChannel && /^\d{1,3}$/.test(value) && cur.signalDbm !== undefined) {
        cur.channel = Number(value);
        haveChannel = true;
      }
    } else if (inHeader) {
      // Before the first BSSID: network type, authentication, encryption, in that order in every language.
      headerLines++;
      if (headerLines === 2) security = value;
    }
  }
  push();
  // A hidden network has an empty SSID: keep it, unnamed.
  return networks.length
    ? ok({ kind: "wifi", networks })
    : fail("No networks in this output. Run it with mode=bssid, and check Wi-Fi is on.");
}

/** Splits an nmcli table by the column positions its header line gives. */
export function parseNmcli(text: string): ParseResult<WifiScan> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headerAt = lines.findIndex((l) => /\bBSSID\b/.test(l) && /\bSIGNAL\b/.test(l));
  const header = lines[headerAt];
  if (header === undefined) return fail("Missing nmcli's header line (BSSID … SIGNAL …).");
  const cols = [...header.matchAll(/\S+/g)].map((m) => ({
    name: m[0].toUpperCase(),
    at: m.index ?? 0,
  }));
  const networks: WifiNetwork[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    const cell = (name: string): string | undefined => {
      const i = cols.findIndex((c) => c.name === name);
      const col = cols[i];
      if (!col) return undefined;
      const v = line.slice(col.at, cols[i + 1]?.at).trim();
      return v === "--" ? "" : v;
    };
    networks.push(
      fromNmcliFields({
        inUse: cell("IN-USE"),
        ssid: cell("SSID"),
        bssid: cell("BSSID"),
        chan: cell("CHAN"),
        freq: cell("FREQ"),
        rate: cell("RATE"),
        signal: cell("SIGNAL"),
        security: cell("SECURITY"),
      }),
    );
  }
  return networks.length
    ? ok({ kind: "wifi", networks })
    : fail("nmcli printed a header and no networks.");
}

interface NmcliFields {
  inUse?: string;
  ssid?: string;
  bssid?: string;
  chan?: string;
  freq?: string;
  rate?: string;
  signal?: string;
  security?: string;
}

function fromNmcliFields(f: NmcliFields): WifiNetwork {
  const mhz = parseInt(f.freq ?? "", 10);
  const fromFreq = Number.isFinite(mhz) ? channelOfFrequency(mhz) : undefined;
  const chan = parseInt(f.chan ?? "", 10);
  const rate = parseInt(f.rate ?? "", 10);
  const signal = parseInt(f.signal ?? "", 10);
  return complete({
    ssid: f.ssid ?? "",
    redacted: false,
    bssid: f.bssid ? f.bssid.toLowerCase() : undefined,
    channel: Number.isFinite(chan) ? chan : fromFreq?.channel,
    band: fromFreq?.band,
    signalDbm: Number.isFinite(signal) ? dbmOfQuality(signal) : undefined,
    rateMbps: Number.isFinite(rate) ? rate : undefined,
    security: f.security ? f.security : f.security === "" ? "Open" : undefined,
    current: f.inUse === "*",
  });
}

/** Splits an nmcli `-t` line on its unescaped colons, undoing `\:` and `\\`. */
export function splitTerse(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\\" && (line[i + 1] === ":" || line[i + 1] === "\\")) {
      cur += line[i + 1];
      i++;
    } else if (c === ":") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** `nmcli -t -f [IN-USE,]SSID,BSSID,CHAN,FREQ,RATE,SIGNAL,SECURITY dev wifi list`: no header, fixed field order. */
export function parseNmcliTerse(text: string): ParseResult<WifiScan> {
  const networks: WifiNetwork[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const f = splitTerse(line);
    const withUse = f.length >= 8;
    const o = withUse ? 1 : 0;
    if (f.length < 7) continue;
    networks.push(
      fromNmcliFields({
        inUse: withUse ? f[0] : undefined,
        ssid: f[o],
        bssid: f[o + 1],
        chan: f[o + 2],
        freq: f[o + 3],
        rate: f[o + 4],
        signal: f[o + 5],
        security: f[o + 6],
      }),
    );
  }
  return networks.length
    ? ok({ kind: "wifi", networks })
    : fail("No nmcli -t lines found. Expected SSID:BSSID:CHAN:FREQ:RATE:SIGNAL:SECURITY per line.");
}
