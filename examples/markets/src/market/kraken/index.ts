/**
 * Real crypto prices from Kraken, behind the same `MarketData` as the simulator, and in front of it: crypto symbols
 * are answered here, every other topic goes on to the simulated market underneath.
 *
 *   const market = createKrakenMarket(createSimulator());
 *   await market.ready();   // the first quote of every pair, or a timeout
 *
 * Kraken's public data needs no key and no backend: quotes, the order book and trades come over its websocket
 * (socket.ts), price history from its REST API, which allows calls from any page (history.ts). Nothing from Kraken is
 * trusted: frames and price history are parsed at the edge (frames.ts). Until a pair's first quote arrives its quote
 * is null, and the panes say its price is not known yet.
 */
import type { Store } from "@jali-examples/shared/store";
import { createTopicHub, readWith } from "../topics";
import type { Channel, FeedState, MarketData, Topic } from "../types";
import type { KrakenFrame } from "./frames";
import { createKrakenHistory, type Fetch } from "./history";
import { applyBook, applyTicker, applyTrades, createPairs, forget, type Pair } from "./pairs";
import { connectKraken, type SocketClass, type Stream } from "./socket";

export { HISTORY_RETRY_MS } from "./history";
export { CRYPTO_SYMBOLS } from "./pairs";
export type { SocketLike } from "./socket";

export interface KrakenOptions {
  /** Default wss://ws.kraken.com/v2. */
  url?: string;
  /** Default https://api.kraken.com. */
  rest?: string;
  /** For tests: a stand-in for the browser's. */
  WebSocket?: SocketClass;
  fetch?: Fetch;
  /** Now, in ms since the epoch. Default Date.now. */
  now?: () => number;
}

export interface LiveMarket extends MarketData {
  /** Resolves when every pair has its first quote (true), or after `timeoutMs` (false). */
  ready(timeoutMs?: number): Promise<boolean>;
  readonly feed: Store<FeedState>;
  close(): void;
}

/** The stream a channel needs while followed; quotes always stream. */
const STREAM: Partial<Record<Channel, Stream>> = { book: "book", trades: "trade" };

export function createKrakenMarket(base: MarketData, options: KrakenOptions = {}): LiveMarket {
  const now = options.now ?? Date.now;
  const pairs = createPairs();
  const bySymbol = new Map(pairs.map((p) => [p.inst.symbol, p]));
  const byKrakenName = new Map(pairs.map((p) => [p.pair, p]));
  const pairOf = (t: Topic) => ("symbol" in t && t.symbol ? bySymbol.get(t.symbol) : undefined);

  const read = readWith({
    quote: (t) => {
      const p = bySymbol.get(t.symbol);
      return p ? p.quote : base.snapshot(t);
    },
    book: (t) => {
      const p = bySymbol.get(t.symbol);
      return p
        ? (p.book ?? { symbol: t.symbol, bids: [], asks: [], time: now() })
        : base.snapshot(t);
    },
    trades: (t) => {
      const p = bySymbol.get(t.symbol);
      return p ? [...p.trades] : base.snapshot(t);
    },
    bars: (t) => {
      const p = bySymbol.get(t.symbol);
      return p ? history.barsOf(p, t.range) : base.snapshot(t);
    },
    // No free news feed is tagged by coin (see the README): a coin has none, the market's are the simulator's.
    news: (t) => (pairOf(t) ? [] : base.snapshot(t)),
    clock: (t) => base.snapshot(t),
  });
  const hub = createTopicHub(read);
  const changed = (p: Pair, ...channels: Channel[]) =>
    hub.notify((t) => "symbol" in t && t.symbol === p.inst.symbol && channels.includes(t.channel));

  const history = createKrakenHistory({
    rest: options.rest ?? "https://api.kraken.com",
    get: options.fetch ?? ((u) => fetch(u)),
    now,
    onLoaded: (p) => changed(p, "bars"),
  });

  function receive(m: KrakenFrame) {
    const snapshot = m.type === "snapshot";
    switch (m.channel) {
      case "ticker":
        for (const d of m.data) {
          const p = byKrakenName.get(d.symbol);
          if (!p) continue;
          const first = !p.quote;
          applyTicker(p, d, now());
          history.tick(p, d.last);
          if (first && pairs.every((x) => x.quote)) waiting.splice(0).forEach((w) => w());
          changed(p, "quote", "bars");
        }
        return;
      case "book":
        for (const d of m.data) {
          const p = byKrakenName.get(d.symbol);
          if (!p) continue;
          applyBook(p, d, snapshot, now());
          changed(p, "book");
        }
        return;
      case "trade":
        for (const p of pairs) {
          const trades = m.data.filter((d) => d.symbol === p.pair);
          if (!trades.length) continue;
          applyTrades(p, trades, snapshot, now());
          changed(p, "trades");
        }
    }
  }

  const socket = connectKraken({
    url: options.url ?? "wss://ws.kraken.com/v2",
    Socket:
      options.WebSocket ??
      (typeof WebSocket === "undefined" ? undefined : (WebSocket as unknown as SocketClass)),
    pairs: pairs.map((p) => p.pair),
    onFrame: receive,
  });

  /** Who waits for every pair's first quote (`ready`). */
  const waiting: (() => void)[] = [];

  return {
    instruments: [...pairs.map((p) => p.inst), ...base.instruments],
    instrument: (symbol) => bySymbol.get(symbol)?.inst ?? base.instrument(symbol),
    snapshot: read,
    subscribe(topic, onData) {
      const p = pairOf(topic);
      if (!p) return base.subscribe(topic, onData);
      const stream = STREAM[topic.channel];
      const unfollow = stream ? socket.follow(stream, p.pair, () => forget(p, stream)) : undefined;
      const remove = hub.add(topic, onData);
      return () => {
        remove();
        unfollow?.();
      };
    },
    ready(timeoutMs = 6000) {
      if (pairs.every((p) => p.quote)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        waiting.push(() => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    },
    feed: socket.feed,
    close: socket.close,
  };
}
