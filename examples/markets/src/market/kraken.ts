/**
 * Real crypto prices from Kraken, behind the same `MarketData` as the simulator, and in front of it: crypto symbols
 * are answered here, every other topic goes on to the simulated market underneath.
 *
 *   const market = createKrakenMarket(createSimulator());
 *   await market.ready();   // the first quote of every pair, or a timeout
 *
 * Kraken's public data needs no key and no backend: quotes, the order book and trades come over its websocket
 * (wss://ws.kraken.com/v2), price history from its REST API, which allows calls from any page.
 *
 * Quotes stream for every pair all the time: the watchlist and the top bar show them. The book and trades stream
 * only while a pane follows them, and stop a little after the last one goes, so switching desks doesn't churn.
 *
 * Nothing from Kraken is trusted: frames and price history are parsed at the edge (kraken-frames.ts). Until a pair's
 * first quote arrives its quote is `pending`, and says so, rather than showing a price of 0. Whether the feed is live
 * is `feed()`, for the status line.
 */
import { MINUTE } from "./history";
import { cryptoInstruments, krakenPair } from "./crypto";
import {
  parseBars,
  parseFrame,
  restError,
  type KrakenBook,
  type KrakenFrame,
  type KrakenTicker,
  type KrakenTrade,
} from "./kraken-frames";
import type {
  Bar,
  Book,
  BookLevel,
  Instrument,
  MarketData,
  Quote,
  Range,
  Topic,
  TopicData,
  Trade,
} from "./types";

export interface KrakenOptions {
  /** Default wss://ws.kraken.com/v2. */
  url?: string;
  /** Default https://api.kraken.com. */
  rest?: string;
  /** For tests: a stand-in for the browser's. */
  WebSocket?: new (url: string) => SocketLike;
  fetch?: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  /** Now, in ms since the epoch. Default Date.now. */
  now?: () => number;
}

/** The part of a WebSocket this uses. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
}

/** The live feed: connecting (first try), live, or down (it was lost or never came, and is being tried again). */
export type FeedState = "connecting" | "live" | "down";

/** The feed's state, to read and to follow (a store, as the app's others are). */
export interface FeedStatus {
  get(): FeedState;
  subscribe(listener: () => void): () => void;
}

export interface LiveMarket extends MarketData {
  /** Resolves when every pair has its first quote (true), or after `timeoutMs` (false). */
  ready(timeoutMs?: number): Promise<boolean>;
  /** Whether the websocket is connected now, and a change when it connects or is lost. */
  feed: FeedStatus;
  close(): void;
}

const DEPTH = 10;
const TAPE = 200;
const DAY = 24 * 60 * MINUTE;
/** A stream nobody follows is kept this long before it is stopped. */
const LINGER_MS = 10_000;
/** After a failed price-history call, the first wait before trying again; it doubles each time, up to the most. */
export const HISTORY_RETRY_MS = 5_000;
const HISTORY_RETRY_MAX_MS = 5 * 60_000;

/** Each range: Kraken's bar size in minutes, and how far back it reaches. */
const RANGE: Record<Range, { interval: number; span: number }> = {
  "1D": { interval: 5, span: DAY },
  "5D": { interval: 30, span: 5 * DAY },
  "1M": { interval: 1440, span: 31 * DAY },
  "6M": { interval: 1440, span: 183 * DAY },
  "1Y": { interval: 1440, span: 366 * DAY },
};

interface Pair {
  inst: Instrument;
  pair: string;
  quote: Quote | null;
  bids: Map<number, number>;
  asks: Map<number, number>;
  book: Book | null;
  trades: Trade[];
  /** Bars by Kraken interval (5, 30, 1440), oldest first, once loaded. */
  bars: Map<number, Bar[]>;
}

type Stream = "book" | "trade";
type Listener = (data: never) => void;

export function createKrakenMarket(base: MarketData, options: KrakenOptions = {}): LiveMarket {
  const url = options.url ?? "wss://ws.kraken.com/v2";
  const rest = options.rest ?? "https://api.kraken.com";
  // No WebSocket at all (an old runtime): the feed stays down and the simulated market runs on.
  const Socket: KrakenOptions["WebSocket"] =
    options.WebSocket ??
    (typeof WebSocket === "undefined"
      ? undefined
      : (WebSocket as unknown as KrakenOptions["WebSocket"]));
  const get = options.fetch ?? ((u: string) => fetch(u));
  const now = options.now ?? Date.now;

  const pairs = new Map<string, Pair>();
  const bySymbolOfKraken = new Map<string, Pair>();
  for (const inst of cryptoInstruments()) {
    const pair = krakenPair(inst.symbol);
    if (!pair) continue;
    const p: Pair = {
      inst,
      pair,
      quote: null,
      bids: new Map(),
      asks: new Map(),
      book: null,
      trades: [],
      bars: new Map(),
    };
    pairs.set(inst.symbol, p);
    bySymbolOfKraken.set(p.pair, p);
  }
  const instruments = [...[...pairs.values()].map((p) => p.inst), ...base.instruments];

  // ---------- listeners ----------

  const subs = new Map<string, { topic: Topic; listeners: Set<Listener> }>();
  const keyOf = (t: Topic) =>
    `${t.channel}:${"symbol" in t ? (t.symbol ?? "*") : "*"}:${t.channel === "bars" ? t.range : ""}`;

  function notify(symbol: string, channels: Topic["channel"][]) {
    for (const { topic, listeners } of subs.values()) {
      if (!listeners.size || !("symbol" in topic) || topic.symbol !== symbol) continue;
      if (!channels.includes(topic.channel)) continue;
      const data = read(topic);
      for (const l of Array.from(listeners)) (l as (d: unknown) => void)(data);
    }
  }

  // ---------- the websocket ----------

  let socket: SocketLike | null = null;
  let closed = false;
  let retry = 0;

  let feedState: FeedState = "connecting";
  const feedListeners = new Set<() => void>();
  const setFeed = (next: FeedState) => {
    if (next === feedState) return;
    feedState = next;
    for (const l of Array.from(feedListeners)) l();
  };
  /** Streams wanted now, by "channel:pair"; and timers that will stop the ones nobody follows. */
  const wanted = new Map<string, { channel: Stream; pair: string; count: number }>();
  const lingering = new Map<string, ReturnType<typeof setTimeout>>();

  const send = (method: "subscribe" | "unsubscribe", params: Record<string, unknown>) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify({ method, params }));
  };
  const streamParams = (channel: Stream, pair: string) =>
    channel === "book"
      ? { channel, symbol: [pair], depth: DEPTH }
      : { channel, symbol: [pair], snapshot: true };

  /** Back off: 1s, 2s, 4s… up to 15s between tries. */
  const reconnect = () => setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));

  function connect() {
    if (closed) return;
    let ws: SocketLike;
    try {
      if (!Socket) throw new Error("no WebSocket");
      ws = new Socket(url);
    } catch {
      setFeed("down");
      if (Socket) reconnect();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      retry = 0;
      setFeed("live");
      // Quotes on every change of the best bid or offer, not only on trades.
      send("subscribe", {
        channel: "ticker",
        symbol: [...pairs.values()].map((p) => p.pair),
        event_trigger: "bbo",
      });
      for (const w of wanted.values()) send("subscribe", streamParams(w.channel, w.pair));
    };
    ws.onmessage = (e) => {
      const frame = parseFrame(e.data);
      if (frame) receive(frame);
    };
    ws.onclose = () => {
      if (socket !== ws || closed) return;
      socket = null;
      setFeed("down");
      reconnect();
    };
  }

  function follow(channel: Stream, p: Pair) {
    const key = `${channel}:${p.pair}`;
    clearTimeout(lingering.get(key));
    lingering.delete(key);
    const w = wanted.get(key);
    if (w) return void w.count++;
    wanted.set(key, { channel, pair: p.pair, count: 1 });
    send("subscribe", streamParams(channel, p.pair));
  }

  function unfollow(channel: Stream, p: Pair) {
    const key = `${channel}:${p.pair}`;
    const w = wanted.get(key);
    if (!w || --w.count > 0) return;
    lingering.set(
      key,
      setTimeout(() => {
        lingering.delete(key);
        if (wanted.get(key)?.count) return;
        wanted.delete(key);
        send("unsubscribe", streamParams(channel, p.pair));
        // What it showed is out of date by the time anyone follows it again.
        if (channel === "book") [p.book, p.bids, p.asks] = [null, new Map(), new Map()];
        else p.trades = [];
      }, LINGER_MS),
    );
  }

  // ---------- messages ----------

  /** A frame that parsed (kraken-frames.ts): every entry in it has the fields it needs, as finite numbers. */
  function receive(m: KrakenFrame) {
    const snapshot = m.type === "snapshot";
    if (m.channel === "ticker")
      for (const d of m.data) {
        const p = bySymbolOfKraken.get(d.symbol);
        if (p) onTicker(p, d);
      }
    else if (m.channel === "book")
      for (const d of m.data) {
        const p = bySymbolOfKraken.get(d.symbol);
        if (p) onBook(p, d, snapshot);
      }
    else {
      const pairs = new Set(m.data.flatMap((d) => bySymbolOfKraken.get(d.symbol) ?? []));
      // A snapshot replaces what was there (after a reconnect, say).
      if (snapshot) for (const p of pairs) p.trades = [];
      for (const d of m.data) {
        const p = bySymbolOfKraken.get(d.symbol);
        if (p) onTrade(p, d, snapshot);
      }
      if (snapshot)
        for (const p of pairs) {
          // A snapshot comes oldest first: the tape shows the newest on top.
          p.trades = p.trades.sort((a, b) => b.time - a.time || b.id - a.id).slice(0, TAPE);
          notify(p.inst.symbol, ["trades"]);
        }
    }
  }

  function onTicker(p: Pair, t: KrakenTicker) {
    const prev = p.quote;
    // Kraken's change is over the last 24 hours: "yesterday's close" is the price a day ago.
    const prevClose = t.last - t.change;
    if (!p.inst.prevClose) p.inst.prevClose = prevClose;
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
      time: t.time ?? now(),
    };
    for (const [interval, bars] of p.bars) p.bars.set(interval, withLast(bars, interval, t.last));
    if (!prev) firstQuote();
    notify(p.inst.symbol, ["quote", "bars"]);
  }

  function onBook(p: Pair, b: KrakenBook, snapshot: boolean) {
    if (snapshot) [p.bids, p.asks] = [new Map(), new Map()];
    for (const [side, levels] of [
      [p.bids, b.bids],
      [p.asks, b.asks],
    ] as const)
      for (const { price, qty } of levels) {
        if (qty === 0) side.delete(price);
        else side.set(price, qty);
      }
    // Keep the book to its depth: a level that falls off the end is no longer sent.
    const side = (m: Map<number, number>, dir: 1 | -1): BookLevel[] => {
      const levels = [...m]
        .sort((a, c) => (a[0] - c[0]) * dir)
        .slice(0, DEPTH)
        .map(([price, size]) => ({ price, size, orders: 0 }));
      for (const price of m.keys()) if (!levels.some((l) => l.price === price)) m.delete(price);
      return levels;
    };
    p.book = {
      symbol: p.inst.symbol,
      bids: side(p.bids, -1),
      asks: side(p.asks, 1),
      time: b.time ?? now(),
    };
    notify(p.inst.symbol, ["book"]);
  }

  function onTrade(p: Pair, t: KrakenTrade, snapshot: boolean) {
    const trade: Trade = {
      id: t.trade_id,
      symbol: p.inst.symbol,
      price: t.price,
      size: t.qty,
      side: t.side,
      time: t.time ?? now(),
    };
    p.trades = snapshot ? [...p.trades, trade] : [trade, ...p.trades].slice(0, TAPE);
    if (!snapshot) notify(p.inst.symbol, ["trades"]);
  }

  // ---------- price history ----------

  const loading = new Set<string>();
  /** Failed calls, by "pair:interval": how many in a row, and when the next try may go. A chart asks on every tick,
   *  so without this a failing call would be made again on every tick. */
  const failed = new Map<string, { count: number; retryAt: number }>();
  /** Calls to the REST API, one at a time: its public limit is about one a second. */
  let queue = Promise.resolve();

  function loadBars(p: Pair, interval: number) {
    const key = `${p.pair}:${interval}`;
    if (p.bars.has(interval) || loading.has(key)) return;
    const f = failed.get(key);
    if (f && now() < f.retryAt) return;
    loading.add(key);
    queue = queue
      .then(async () => {
        const res = await get(
          `${rest}/0/public/OHLC?pair=${encodeURIComponent(p.pair)}&interval=${interval}`,
        );
        const body: unknown = await res.json();
        const parsed = res.ok ? parseBars(body, p.pair) : undefined;
        if (!parsed) throw new Error(restError(body) || "no bars");
        const bars = p.quote ? withLast(parsed, interval, p.quote.last) : parsed;
        failed.delete(key);
        p.bars.set(interval, bars);
        notify(p.inst.symbol, ["bars"]);
      })
      .catch(() => {
        // Nothing to show yet. Try again later, waiting longer each time it fails.
        const count = (failed.get(key)?.count ?? 0) + 1;
        const wait = Math.min(HISTORY_RETRY_MAX_MS, HISTORY_RETRY_MS * 2 ** (count - 1));
        failed.set(key, { count, retryAt: now() + wait });
      })
      .finally(() => {
        loading.delete(key);
      });
  }

  /** Bars with the latest price in the last one, and a new bar once its interval has begun. */
  function withLast(bars: Bar[], interval: number, last: number): Bar[] {
    const end = bars.at(-1);
    if (!end) return bars;
    const ms = interval * MINUTE;
    const start = Math.floor(now() / ms) * ms;
    if (start > end.time)
      return [...bars, { time: start, open: last, high: last, low: last, close: last, volume: 0 }];
    if (end.close === last) return bars;
    // Replaced, never changed in place: a subscriber may still hold the old one.
    const bar = {
      ...end,
      close: last,
      high: Math.max(end.high, last),
      low: Math.min(end.low, last),
    };
    return [...bars.slice(0, -1), bar];
  }

  function barsOf(p: Pair, range: Range): Bar[] {
    const { interval, span } = RANGE[range];
    const bars = p.bars.get(interval);
    if (!bars) {
      loadBars(p, interval);
      return [];
    }
    const from = now() - span;
    return bars.filter((b) => b.time + interval * MINUTE > from);
  }

  // ---------- reading ----------

  /** Before the first quote arrives (the page waits for it, up to a point): not known yet. Its numbers are zeros that
   *  nothing shows or trades on: the panes say "not known yet", and the paper book refuses a market order. */
  const emptyQuote = (p: Pair): Quote => ({
    pending: true,
    symbol: p.inst.symbol,
    bid: 0,
    ask: 0,
    bidSize: 0,
    askSize: 0,
    last: p.inst.prevClose,
    change: 0,
    changePct: 0,
    open: p.inst.prevClose,
    high: p.inst.prevClose,
    low: p.inst.prevClose,
    prevClose: p.inst.prevClose,
    volume: 0,
    vwap: 0,
    tickDir: 0,
    time: now(),
  });

  function read<T extends Topic>(topic: T): TopicData<T> {
    const t = topic as Topic;
    const p = "symbol" in t && t.symbol ? pairs.get(t.symbol) : undefined;
    if (!p) return base.snapshot(topic);
    switch (t.channel) {
      case "quote":
        return (p.quote ?? emptyQuote(p)) as TopicData<T>;
      case "book":
        return (p.book ?? {
          symbol: p.inst.symbol,
          bids: [],
          asks: [],
          time: now(),
        }) as TopicData<T>;
      case "trades":
        return [...p.trades] as unknown as TopicData<T>;
      case "bars":
        return barsOf(p, t.range) as unknown as TopicData<T>;
      case "news":
        return [] as unknown as TopicData<T>; // no free news feed tagged by coin: see the README
    }
    return base.snapshot(topic);
  }

  // ---------- ready ----------

  const waiting: (() => void)[] = [];
  function firstQuote() {
    if ([...pairs.values()].every((p) => p.quote)) waiting.splice(0).forEach((w) => w());
  }

  connect();

  return {
    instruments,
    instrument: (symbol) => pairs.get(symbol)?.inst ?? base.instrument(symbol),
    snapshot: read,
    subscribe(topic, onData) {
      const p = "symbol" in topic && topic.symbol ? pairs.get(topic.symbol) : undefined;
      if (!p) return base.subscribe(topic, onData);
      const stream: Stream | null =
        topic.channel === "book" ? "book" : topic.channel === "trades" ? "trade" : null;
      if (stream) follow(stream, p);
      const key = keyOf(topic);
      let sub = subs.get(key);
      if (!sub) subs.set(key, (sub = { topic, listeners: new Set() }));
      sub.listeners.add(onData as Listener);
      return () => {
        sub.listeners.delete(onData as Listener);
        if (!sub.listeners.size) subs.delete(key);
        if (stream) unfollow(stream, p);
      };
    },
    ready(timeoutMs = 6000) {
      if ([...pairs.values()].every((p) => p.quote)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        waiting.push(() => {
          clearTimeout(timer);
          resolve(true);
        });
      });
    },
    feed: {
      get: () => feedState,
      subscribe(listener) {
        feedListeners.add(listener);
        return () => feedListeners.delete(listener);
      },
    },
    close() {
      closed = true;
      lingering.forEach((t) => clearTimeout(t));
      socket?.close();
      socket = null;
    },
  };
}
