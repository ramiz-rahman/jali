/**
 * The real instruments of the live feed: ten crypto pairs against the US dollar, as Kraken lists them, and each
 * pair's state as Kraken's frames update it. The decimals and ticks are Kraken's (from its public AssetPairs), so a
 * price shows exactly as the exchange quotes it.
 */
import type { Bar, Book, BookLevel, Crypto, Quote, Trade } from "../types";
import type { KrakenBook, KrakenTicker, KrakenTrade } from "./frames";

type PairRow = [symbol: string, pair: string, name: string, decimals: number];

const PAIRS: PairRow[] = [
  ["BTCUSD", "BTC/USD", "Bitcoin", 1],
  ["ETHUSD", "ETH/USD", "Ether", 2],
  ["SOLUSD", "SOL/USD", "Solana", 2],
  ["XRPUSD", "XRP/USD", "XRP", 5],
  ["ADAUSD", "ADA/USD", "Cardano", 6],
  ["DOGEUSD", "DOGE/USD", "Dogecoin", 7],
  ["LTCUSD", "LTC/USD", "Litecoin", 2],
  ["LINKUSD", "LINK/USD", "Chainlink", 5],
  ["AVAXUSD", "AVAX/USD", "Avalanche", 3],
  ["DOTUSD", "DOT/USD", "Polkadot", 4],
];

export const CRYPTO_SYMBOLS: readonly string[] = PAIRS.map(([symbol]) => symbol);

/** The book's depth, and how many trades the tape keeps. */
export const DEPTH = 10;
const TAPE = 200;

/** One pair: its instrument, Kraken's name for it ("BTC/USD"), and what the feed has said about it so far. */
export interface Pair {
  inst: Crypto;
  pair: string;
  /** null until its first ticker. */
  quote: Quote | null;
  /** The book as Kraken sends it, price to size, and as read from that. */
  bids: Map<number, number>;
  asks: Map<number, number>;
  book: Book | null;
  /** Newest first. */
  trades: Trade[];
  /** Bars by Kraken interval (5, 30, 1440), oldest first, once loaded (history.ts). */
  bars: Map<number, Bar[]>;
}

export function createPairs(): Pair[] {
  return PAIRS.map(([symbol, pair, name, decimals]) => ({
    inst: {
      symbol,
      name,
      assetClass: "crypto",
      base: pair.split("/")[0] ?? symbol,
      currency: "USD",
      decimals,
      tick: 10 ** -decimals,
      source: "Kraken",
    },
    pair,
    quote: null,
    bids: new Map(),
    asks: new Map(),
    book: null,
    trades: [],
    bars: new Map(),
  }));
}

/** A ticker: the pair's new quote. Its "previous close" is the price 24 hours ago. */
export function applyTicker(p: Pair, t: KrakenTicker, now: number) {
  const prev = p.quote;
  const prevClose = t.last - t.change;
  p.quote = {
    symbol: p.inst.symbol,
    bid: t.bid,
    ask: t.ask,
    bidSize: t.bid_qty,
    askSize: t.ask_qty,
    last: t.last,
    change: t.change,
    changePct: t.change_pct,
    open: prevClose,
    high: t.high,
    low: t.low,
    prevClose,
    volume: t.volume,
    vwap: t.vwap,
    tickDir: !prev ? 0 : t.last > prev.last ? 1 : t.last < prev.last ? -1 : prev.tickDir,
    time: t.time ?? now,
  };
}

/** A book snapshot or update: levels of size 0 go, and the book is kept to its depth. */
export function applyBook(p: Pair, b: KrakenBook, snapshot: boolean, now: number) {
  if (snapshot) [p.bids, p.asks] = [new Map(), new Map()];
  for (const [side, levels] of [
    [p.bids, b.bids],
    [p.asks, b.asks],
  ] as const)
    for (const { price, qty } of levels) {
      if (qty === 0) side.delete(price);
      else side.set(price, qty);
    }
  // A level that falls off the end is no longer sent: drop it.
  const best = (m: Map<number, number>, dir: 1 | -1): BookLevel[] => {
    const levels = [...m]
      .sort((a, c) => (a[0] - c[0]) * dir)
      .slice(0, DEPTH)
      .map(([price, size]) => ({ price, size }));
    for (const price of m.keys()) if (!levels.some((l) => l.price === price)) m.delete(price);
    return levels;
  };
  p.book = {
    symbol: p.inst.symbol,
    bids: best(p.bids, -1),
    asks: best(p.asks, 1),
    time: b.time ?? now,
  };
}

/** Trades: a snapshot replaces the tape (after a reconnect, say); an update adds to its top. */
export function applyTrades(
  p: Pair,
  trades: readonly KrakenTrade[],
  snapshot: boolean,
  now: number,
) {
  const added = trades.map((t): Trade => ({
    id: t.trade_id,
    symbol: p.inst.symbol,
    price: t.price,
    size: t.qty,
    side: t.side,
    time: t.time ?? now,
  }));
  // A snapshot comes oldest first; the tape shows the newest on top.
  p.trades = snapshot
    ? added.sort((a, b) => b.time - a.time || b.id - a.id).slice(0, TAPE)
    : [...added.reverse(), ...p.trades].slice(0, TAPE);
}

/** What the pair showed of a stream, forgotten when nobody follows it: it is out of date by the time anyone does. */
export function forget(p: Pair, stream: "book" | "trade") {
  if (stream === "book") [p.book, p.bids, p.asks] = [null, new Map(), new Map()];
  else p.trades = [];
}
