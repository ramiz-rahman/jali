/** Numbers as a trader reads them: fixed decimals, a real minus sign, compact sizes. */
import type { Instrument } from "../market/types";

const formats = new Map<string, Intl.NumberFormat>();
const fmt = (min: number, max = min, extra: Intl.NumberFormatOptions = {}) => {
  const key = `${min}:${max}:${JSON.stringify(extra)}`;
  let f = formats.get(key);
  if (!f)
    formats.set(
      key,
      (f = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
        ...extra,
      })),
    );
  return f;
};

const MINUS = "−";
const signed = (text: string, x: number) => (x > 0 ? `+${text}` : x < 0 ? `${MINUS}${text}` : text);

export const price = (inst: Instrument, x: number) =>
  fmt(inst.decimals).format(x).replace("-", MINUS);

/** A price change with its sign: +1.24, −0.031. */
export const change = (inst: Instrument, x: number) =>
  signed(fmt(inst.decimals).format(Math.abs(x)), round(x, inst.decimals));

export const pct = (x: number, digits = 2) =>
  signed(`${fmt(digits).format(Math.abs(x))}%`, round(x, digits));

/** Basis points with a sign: +3.2bp. */
export const bp = (x: number) => signed(`${fmt(1).format(Math.abs(x))}bp`, round(x, 1));

export const percent = (x: number, digits = 3) => `${fmt(digits).format(x)}%`;

export const int = (x: number) => fmt(0).format(Math.round(x)).replace("-", MINUS);

export const money = (x: number, digits = 0) =>
  signed(fmt(digits).format(Math.abs(x)), round(x, digits));

/** 1,240 · 12.4K · 3.1M · 1.2B: sizes and volumes in a narrow column. A fraction (0.0153 BTC) keeps its digits. */
export function size(x: number): string {
  const a = Math.abs(x);
  if (a < 1000 && !Number.isInteger(x))
    return fmt(0, a < 1 ? 4 : a < 100 ? 3 : 1)
      .format(x)
      .replace("-", MINUS);
  if (a < 10_000) return int(x);
  const [d, s] = a < 1e6 ? [1e3, "K"] : a < 1e9 ? [1e6, "M"] : [1e9, "B"];
  return `${fmt(a / d < 100 ? 1 : 0)
    .format(x / d)
    .replace("-", MINUS)}${s}`;
}

/** 11:42:07 */
export const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const weekday = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { weekday: "short" });

/** Which way a number points: for colour, arrows and words. */
export type Direction = "up" | "down" | "flat";
export const direction = (x: number, digits = 6): Direction => {
  const r = round(x, digits);
  return r > 0 ? "up" : r < 0 ? "down" : "flat";
};

function round(x: number, digits: number) {
  return Number(x.toFixed(digits));
}

/** What a quantity is in: shares, face value, a currency or a coin. */
export const unit = (inst: Instrument) =>
  inst.assetClass === "equity"
    ? "shares"
    : inst.assetClass === "fx"
      ? inst.symbol.slice(0, 3)
      : inst.assetClass === "crypto"
        ? base(inst)
        : "face";

/** A crypto pair's coin: BTC in BTCUSD. */
export const base = (inst: Instrument) => inst.symbol.replace(/USD$/, "");

/** The spread in the units traders use: pips for FX, price points for bonds, basis points for shares, and for crypto
 *  (whose spread is often a single tick, far under a basis point) the price itself. */
export const spread = (inst: Instrument, bid: number, ask: number) =>
  inst.assetClass === "fx"
    ? `${((ask - bid) / (inst.tick * 10)).toFixed(1)} pips`
    : inst.coupon !== undefined
      ? (ask - bid).toFixed(3)
      : inst.assetClass === "crypto"
        ? price(inst, ask - bid)
        : `${(((ask - bid) / ask) * 1e4).toFixed(1)}bp`;
