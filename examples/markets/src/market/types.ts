/**
 * The market as the panes see it: instruments, and topics a pane can read once (`snapshot`) or follow (`subscribe`).
 *
 * The app only ever talks to `MarketData`. This example plugs in a simulator (simulator.ts), with real crypto
 * prices from Kraken over a websocket on top of it (kraken.ts): the same two calls, and no pane changes.
 */

export type AssetClass = "equity" | "govt" | "corp" | "fx" | "index" | "crypto";

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Equities: the sector. Bonds: the issuer. FX: "Major". Indices: what they track. */
  group: string;
  currency: string;
  /** Digits after the point when the price is shown. */
  decimals: number;
  /** The smallest price step. */
  tick: number;
  /** Yesterday's close, where today's change is measured from. */
  prevClose: number;
  /** Annualised volatility of the price (equities, FX, indices) or, for bonds, of the yield in bp a day. */
  vol: number;
  /** Shares in issue, for a market value (equities). */
  shares?: number;
  /** Bonds: annual coupon in %, years to maturity, yesterday's yield in %. */
  coupon?: number;
  maturity?: number;
  prevYield?: number;
  /** Indices: the symbols they are made of. */
  members?: string[];
  /** Real data: where it comes from ("Kraken"). Absent for the simulated market. */
  source?: string;
  /** Trades around the clock: "today" is the last 24 hours, and there is no close (crypto). */
  continuous?: boolean;
}

/** One instrument's latest prices. A new object every time something in it changes. */
export interface Quote {
  /** No price has come yet (a live feed before its first quote): every number below is a placeholder 0 that is
   *  never shown or traded on. Absent on a real quote. */
  pending?: true;
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  /** last - prevClose, and the same in %. */
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  /** Volume-weighted average price of today's trades. */
  vwap: number;
  /** Which way the last price moved on its latest change: 1, -1, or 0 before the first. */
  tickDir: 1 | -1 | 0;
  /** Bonds: yield in %, and today's change in bp. */
  yield?: number;
  yieldChangeBp?: number;
  /** Market time of this quote, ms since the epoch. */
  time: number;
}

export interface BookLevel {
  price: number;
  size: number;
  /** Orders resting at this price. */
  orders: number;
}

export interface Book {
  symbol: string;
  /** Best first: bids high to low, asks low to high. */
  bids: BookLevel[];
  asks: BookLevel[];
  time: number;
}

export interface Trade {
  id: number;
  symbol: string;
  price: number;
  size: number;
  /** Who crossed the spread: a buyer lifting the ask, or a seller hitting the bid. */
  side: "buy" | "sell";
  time: number;
}

/** One bar of a price history. `time` is the bar's start. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Range = "1D" | "5D" | "1M" | "6M" | "1Y";
export const RANGES: readonly Range[] = ["1D", "5D", "1M", "6M", "1Y"];

export interface Headline {
  id: number;
  time: number;
  title: string;
  /** One more sentence, shown when the headline is opened. */
  body: string;
  source: string;
  /** The instruments it is about; empty for market-wide news. */
  symbols: string[];
}

/** What a pane can ask the market for. */
export type Topic =
  | { channel: "quote"; symbol: string }
  | { channel: "book"; symbol: string }
  | { channel: "trades"; symbol: string }
  | { channel: "bars"; symbol: string; range: Range }
  /** Headlines about one instrument, or every headline without `symbol`. */
  | { channel: "news"; symbol?: string }
  | { channel: "clock" };

/** What each topic delivers. */
export type TopicData<T extends Topic> = T extends { channel: "quote" }
  ? Quote
  : T extends { channel: "book" }
    ? Book
    : T extends { channel: "trades" }
      ? readonly Trade[]
      : T extends { channel: "bars" }
        ? readonly Bar[]
        : T extends { channel: "news" }
          ? readonly Headline[]
          : number;

export interface MarketData {
  readonly instruments: readonly Instrument[];
  instrument(symbol: string): Instrument | undefined;
  /** The latest value of a topic, read once. Unknown symbols throw. */
  snapshot<T extends Topic>(topic: T): TopicData<T>;
  /** Calls `onData` with each new value of `topic`, until the function it returns is called. It does not call
   *  back with the current value: read that with `snapshot`. */
  subscribe<T extends Topic>(topic: T, onData: (data: TopicData<T>) => void): () => void;
}
