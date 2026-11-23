/**
 * What comes from Kraken, read at the edge: every frame and every price-history row is parsed here before the market
 * uses it. Text that isn't JSON, a message of a shape we don't know, a price that isn't a finite number above zero:
 * each is dropped where it arrives, so nothing downstream (a quote, a chart, the saved paper book) ever holds NaN.
 *
 * Kraken's formats: https://docs.kraken.com/api/docs/websocket-v2/ticker, …/book, …/trade, and REST OHLC.
 */
import type { Bar } from "../types";

export interface KrakenTicker {
  symbol: string;
  bid: number;
  bid_qty: number;
  ask: number;
  ask_qty: number;
  last: number;
  volume: number;
  vwap: number;
  low: number;
  high: number;
  change: number;
  change_pct: number;
  /** ms since the epoch, or undefined when Kraken sent none we can read. */
  time: number | undefined;
}
export interface KrakenLevel {
  price: number;
  qty: number;
}
export interface KrakenBook {
  symbol: string;
  bids: KrakenLevel[];
  asks: KrakenLevel[];
  time: number | undefined;
}
export interface KrakenTrade {
  symbol: string;
  side: "buy" | "sell";
  price: number;
  qty: number;
  trade_id: number;
  time: number | undefined;
}

/** One message from the websocket, of a channel we read, with only the entries that parsed. */
export type KrakenFrame =
  | { channel: "ticker"; type: "snapshot" | "update"; data: KrakenTicker[] }
  | { channel: "book"; type: "snapshot" | "update"; data: KrakenBook[] }
  | { channel: "trade"; type: "snapshot" | "update"; data: KrakenTrade[] };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A finite number, from a number or a numeric string (REST sends prices as strings). */
export function finite(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
const positive = (v: unknown) => {
  const n = finite(v);
  return n !== undefined && n > 0 ? n : undefined;
};
const nonNegative = (v: unknown) => {
  const n = finite(v);
  return n !== undefined && n >= 0 ? n : undefined;
};
const timeOf = (v: unknown) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : undefined;
};

function ticker(d: Json): KrakenTicker | undefined {
  const t = {
    symbol: d.symbol,
    bid: positive(d.bid),
    bid_qty: nonNegative(d.bid_qty),
    ask: positive(d.ask),
    ask_qty: nonNegative(d.ask_qty),
    last: positive(d.last),
    volume: nonNegative(d.volume),
    vwap: nonNegative(d.vwap),
    low: positive(d.low),
    high: positive(d.high),
    change: finite(d.change),
    change_pct: finite(d.change_pct),
  };
  if (typeof t.symbol !== "string") return undefined;
  for (const v of Object.values(t)) if (v === undefined) return undefined;
  return { ...(t as Omit<KrakenTicker, "time">), time: timeOf(d.timestamp) };
}

/** A side of a book: the levels that parse. A size of 0 is kept: it removes the level. */
function levels(v: unknown): KrakenLevel[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((l) => {
    if (!isObject(l)) return [];
    const price = positive(l.price);
    const qty = nonNegative(l.qty);
    return price === undefined || qty === undefined ? [] : [{ price, qty }];
  });
}
function book(d: Json): KrakenBook | undefined {
  if (typeof d.symbol !== "string") return undefined;
  return {
    symbol: d.symbol,
    bids: levels(d.bids),
    asks: levels(d.asks),
    time: timeOf(d.timestamp),
  };
}

function trade(d: Json): KrakenTrade | undefined {
  const price = positive(d.price);
  const qty = positive(d.qty);
  const id = finite(d.trade_id);
  if (typeof d.symbol !== "string" || price === undefined || qty === undefined) return undefined;
  if (d.side !== "buy" && d.side !== "sell") return undefined;
  if (id === undefined || !Number.isInteger(id)) return undefined;
  return { symbol: d.symbol, side: d.side, price, qty, trade_id: id, time: timeOf(d.timestamp) };
}

const READERS = { ticker, book, trade } as const;

/** A websocket message, parsed; undefined for anything else (a heartbeat, a status, an ack, or something broken). */
export function parseFrame(text: unknown): KrakenFrame | undefined {
  if (typeof text !== "string") return undefined;
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObject(m) || !Array.isArray(m.data)) return undefined;
  if (m.type !== "snapshot" && m.type !== "update") return undefined;
  if (m.channel !== "ticker" && m.channel !== "book" && m.channel !== "trade") return undefined;
  const read = READERS[m.channel] as (d: Json) => unknown;
  const data = m.data.flatMap((d) => {
    const v = isObject(d) ? read(d) : undefined;
    return v === undefined ? [] : [v];
  });
  return { channel: m.channel, type: m.type, data } as KrakenFrame;
}

/**
 * The bars in a REST OHLC answer for `pair` ("BTC/USD"): rows of time (s), open, high, low, close, vwap, volume, count.
 * Rows that don't parse are dropped, and so is an answer with none.
 *
 * Kraken keys the rows by the pair's display name ("BTC/USD") only when asked with `assetVersion=1` (the request does,
 * `ohlcUrl`), and by its internal name ("XXBTZUSD") otherwise, beside a `last` cursor. A call asks for one pair, so an
 * answer without `pair` is read from its one series, whatever its key.
 * https://docs.kraken.com/api-reference/market-data/get-ohlc-data
 */
export function parseBars(body: unknown, pair: string): Bar[] | undefined {
  if (!isObject(body) || !isObject(body.result)) return undefined;
  const series = Object.entries(body.result).filter(([k, v]) => k !== "last" && Array.isArray(v));
  const rows =
    pair in body.result ? body.result[pair] : series.length === 1 ? series[0]![1] : undefined;
  if (!Array.isArray(rows)) return undefined;
  const bars = rows.flatMap((row): Bar[] => {
    if (!Array.isArray(row)) return [];
    const [time, open, high, low, close, , volume] = row.map(finite);
    if (time === undefined || volume === undefined || volume < 0) return [];
    if (!open || !high || !low || !close || open < 0 || high < 0 || low < 0 || close < 0) return [];
    return [{ time: time * 1000, open, high, low, close, volume }];
  });
  return bars.length ? bars : undefined;
}

/** The REST call for `pair`'s bars of `interval` minutes, asking for display names so the answer is keyed by `pair`. */
export const ohlcUrl = (rest: string, pair: string, interval: number) =>
  `${rest}/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${interval}&assetVersion=1`;

/** Kraken's own error text in a REST answer, if it gave one. */
export const restError = (body: unknown) =>
  isObject(body) && Array.isArray(body.error) && body.error.every((e) => typeof e === "string")
    ? (body.error as string[]).join(", ")
    : "";
