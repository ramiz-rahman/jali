/**
 * Small network facts the parsers and the analysis share: MAC and IPv4 text, and the arithmetic between Wi-Fi
 * channels, frequencies and bands.
 */
import type { Band } from "./types";

/**
 * `aa:bb:cc:dd:ee:ff` from any of the forms tools print: dashes (Windows), no separators, or macOS's habit of
 * dropping each octet's leading zero (`0:1b:63:a:b:c`). Undefined when it is not a six-octet address.
 */
export function normaliseMac(text: string): string | undefined {
  const t = text.trim();
  const parts = /^[0-9a-f]{12}$/i.test(t) ? (t.match(/../g) ?? []) : t.split(/[:-]/);
  if (parts.length !== 6 || !parts.every((p) => /^[0-9a-f]{1,2}$/i.test(p))) return undefined;
  return parts.map((p) => p.padStart(2, "0").toLowerCase()).join(":");
}

export function isIpv4(text: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  return m !== null && m.slice(1).every((o) => Number(o) <= 255);
}

export function ipv4Octets(text: string): [number, number, number, number] | undefined {
  if (!isIpv4(text)) return undefined;
  const [a = 0, b = 0, c = 0, d = 0] = text.split(".").map(Number);
  return [a, b, c, d];
}

/** Centre frequency in MHz of a primary channel in a band. */
export function centreMHz(band: Band, channel: number): number {
  if (band === "2.4") return channel === 14 ? 2484 : 2407 + 5 * channel;
  if (band === "5") return 5000 + 5 * channel;
  return 5950 + 5 * channel;
}

/** Band and channel for a centre frequency, as nmcli prints it (`5745 MHz`). */
export function channelOfFrequency(mhz: number): { band: Band; channel: number } | undefined {
  if (mhz === 2484) return { band: "2.4", channel: 14 };
  if (mhz >= 2412 && mhz <= 2472) return { band: "2.4", channel: (mhz - 2407) / 5 };
  if (mhz >= 5160 && mhz <= 5885) return { band: "5", channel: (mhz - 5000) / 5 };
  if (mhz >= 5955 && mhz <= 7115) return { band: "6", channel: (mhz - 5950) / 5 };
  return undefined;
}

/** A band for a channel number when the tool did not say: 1 to 14 are 2.4 GHz, the rest 5 GHz. */
export function bandOfChannel(channel: number): Band {
  return channel <= 14 ? "2.4" : "5";
}

/** Width to draw when the tool did not report one. Marked as estimated wherever it is shown. */
export function guessWidth(band: Band | undefined, phy: string | undefined): number {
  if (band === "2.4" || band === undefined) return 20;
  if (band === "5" && phy && /(^|\D)(11)?n$|802\.11n/i.test(phy) && !/ac|ax|be/i.test(phy))
    return 40;
  return 80;
}

/** Windows and NetworkManager report signal as a 0 to 100 quality. Both map it linearly: -100 dBm at 0, -50 dBm at 100. */
export function dbmOfQuality(quality: number): number {
  return Math.round(Math.min(100, Math.max(0, quality)) / 2 - 100);
}
