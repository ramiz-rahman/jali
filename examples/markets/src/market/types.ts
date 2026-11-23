/**
 * The market as the panes see it: instruments, and topics a pane can read once (`snapshot`) or follow (`subscribe`).
 *
 * The app only ever talks to `MarketData`. This example plugs in a simulator (sim/), with real crypto prices from
 * Kraken over a websocket on top of it (kraken/): the same two calls, and no pane changes.
 */
import type { Store } from "@jali-examples/shared/store";

/** What every instrument has, whatever it is. */
interface Listed {
  symbol: string;
  name: string;
  /** The currency its price is quoted in. */
  currency: string;
  /** Digits after the point when the price is shown. */
  decimals: number;
  /** The smallest price step. */
  tick: number;
  /** Real data: where it comes from ("Kraken"). Absent for the simulated market. */
  source?: string;
}

/** An instrument with a session that closes. Crypto never closes: its quote says where its last 24 hours began. */
interface Closing extends Listed {
  /** Yesterday's close, where today's change is measured from. */
  prevClose: number;
}

export interface Equity extends Closing {
  assetClass: "equity";
  sector: string;
  /** Shares in issue, for a market value. */
  shares: number;
  /** Annualised volatility of the price, for the simulator's walk. */
  vol: number;
}

export interface Bond extends Closing {
  /** A government's, or a company's. */
  assetClass: "govt" | "corp";
  issuer: string;
  /** Annual coupon in %, years to maturity, yesterday's yield in %. */
  coupon: number;
  maturity: number;
  prevYield: number;
  /** The yield's typical move in a day, in bp, for the simulator's walk. */
  vol: number;
}

export interface Fx extends Closing {
  assetClass: "fx";
  /** The currency bought: EUR in EUR/USD. `currency` is the one it is priced in. */
  base: string;
  /** Annualised volatility of the rate, for the simulator's walk. */
  vol: number;
}

export interface Index extends Closing {
  assetClass: "index";
  /** What it measures: "Technology". */
  tracks: string;
  /** The symbols it is made of. */
  members: string[];
}

export interface Crypto extends Listed {
  assetClass: "crypto";
  /** The coin: BTC in BTCUSD. */
  base: string;
}

export type Instrument = Equity | Bond | Fx | Index | Crypto;
export type AssetClass = Instrument["assetClass"];

/** A bond's yield, beside its price. */
export interface Yield {
  /** In %. */
  pct: number;
  /** Today's change, in bp. */
  changeBp: number;
}

/** One instrument's latest prices. A new object every time something in it changes. */
export interface Quote {
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
  /** Bonds only. */
  yield?: Yield;
  /** Market time of this quote, ms since the epoch. */
  time: number;
}

export interface BookLevel {
  price: number;
  size: number;
  /** Orders resting at this price, where the venue says: Kraken's book gives sizes only. */
  orders?: number;
}

export interface Book {
  symbol: string;
  /** Best first: bids high to low, asks low to high. */
  bids: BookLevel[];
  asks: BookLevel[];
  time: number;
}

export type Side = "buy" | "sell";

export interface Trade {
  id: number;
  symbol: string;
  price: number;
  size: number;
  /** Who crossed the spread: a buyer lifting the ask, or a seller hitting the bid. */
  side: Side;
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

/** Each channel: what a topic of it names, and what it delivers. */
interface Channels {
  /** null until the instrument's first price is known (a live feed before its first quote). */
  quote: { topic: { symbol: string }; data: Quote | null };
  book: { topic: { symbol: string }; data: Book };
  trades: { topic: { symbol: string }; data: readonly Trade[] };
  bars: { topic: { symbol: string; range: Range }; data: readonly Bar[] };
  /** Headlines about one instrument, or every headline without `symbol`. */
  news: { topic: { symbol?: string }; data: readonly Headline[] };
  /** The market's clock, ms since the epoch. */
  clock: { topic: object; data: number };
}

export type Channel = keyof Channels;
export type TopicOf<C extends Channel> = { channel: C } & Channels[C]["topic"];
/** What a pane can ask the market for. */
export type Topic = { [C in Channel]: TopicOf<C> }[Channel];
/** What a topic delivers. */
export type TopicData<T extends Topic> = Channels[T["channel"]]["data"];
/** How a market answers each channel (topics.ts). */
export type Readers = { [C in Channel]: (topic: TopicOf<C>) => Channels[C]["data"] };

/** The live feed: connecting (first try), live, or down (it was lost or never came, and is being tried again). */
export type FeedState = "connecting" | "live" | "down";

export interface MarketData {
  readonly instruments: readonly Instrument[];
  instrument(symbol: string): Instrument | undefined;
  /** The latest value of a topic, read once. Unknown symbols throw. */
  snapshot<T extends Topic>(topic: T): TopicData<T>;
  /** Calls `onData` with each new value of `topic`, until the function it returns is called. It does not call
   *  back with the current value: read that with `snapshot`. */
  subscribe<T extends Topic>(topic: T, onData: (data: TopicData<T>) => void): () => void;
  /** Whether its live feed is connected, when it has one (Kraken's); a simulated market alone has none. */
  readonly feed?: Store<FeedState>;
}
