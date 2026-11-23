/**
 * A simulated market behind the `MarketData` interface. A seeded random walk moves every price a few times a
 * second (moves.ts): equities share a market and a sector factor, bond yields move along the curve together, the
 * dollar moves the FX pairs, and indices are their members weighted by market value. Trades print at the bid or the
 * ask, and build the day's bars, volume and time and sales.
 *
 *   const market = createSimulator({ seed: 7 });
 *   market.step(40);             // ten seconds of market time, at once (tests)
 *   const stop = market.run();   // or in real time (the app)
 *
 * The same seed and start always give the same market.
 */
import { aggregate, MINUTE } from "../bars";
import { isBond } from "../classes";
import { readWith, createTopicHub } from "../topics";
import type { Bar, Headline, MarketData, Quote, Range, Side, Topic } from "../types";
import { bookOf } from "./book";
import { indexHistory, instrumentHistory, intradayShape, type History } from "./history";
import { INSTRUMENTS, type SimInstrument } from "./instruments";
import { createLives, round, type Live } from "./live";
import { drawShocks, move } from "./moves";
import { flowHeadline, type HeadlineDraft } from "./news";
import { createRandom } from "./random";

export interface SimulatorOptions {
  /** Default 1. */
  seed?: number;
  /** Market time when the simulation starts, ms since the epoch. The session opens at 09:30 that day, and the
   *  morning until `start` is simulated first, so charts have history. Default: today at 13:40. */
  start?: number;
  /** Market time per step, in ms. Default 250: four ticks a second. */
  tickMs?: number;
  instruments?: readonly SimInstrument[];
}

export interface Simulator extends MarketData {
  readonly instruments: readonly SimInstrument[];
  /** Move the market on by `count` steps. */
  step(count?: number): void;
  /** The market's clock, ms since the epoch. */
  now(): number;
  /** When today's session opened. */
  readonly sessionOpen: number;
  /** Step in real time until the returned function is called. */
  run(): () => void;
}

const TAPE = 200;
const MAX_NEWS = 300;

export function createSimulator(options: SimulatorOptions = {}): Simulator {
  const seed = options.seed ?? 1;
  const tickMs = options.tickMs ?? 250;
  const instruments = options.instruments ?? INSTRUMENTS;
  const r = createRandom(seed);

  const start = options.start ?? todayAt(13, 40);
  const sessionOpen = new Date(start).setHours(9, 30, 0, 0);
  let now = sessionOpen;
  let tradeId = 0;
  let newsId = 0;
  const news: Headline[] = [];
  let freshNews: Headline[] = [];

  const lives = createLives(instruments, seed);
  const all = [...lives.values()];
  const sectors = [
    ...new Set(all.flatMap((l) => (l.inst.assetClass === "equity" ? l.inst.sector : []))),
  ];

  // ---------- one step of market time ----------

  function advance(dtMs: number, detailed: boolean) {
    const dt = dtMs / 1000;
    now += dtMs;
    const shocks = drawShocks(r, sectors);
    const activity = intradayShape((now - sessionOpen) / MINUTE);

    for (const l of all) {
      l.moved = false;
      l.traded = false;
      const before = l.mid;
      const headline = move(l, shocks, dt);
      if (headline) addNews(headline);
      if (l.weights) continue; // an index is its members, once they have moved (below)

      // The spread sits around the mid, on whole ticks.
      const { inst } = l;
      const spread = l.spreadTicks * inst.tick;
      const bid = round(
        Math.floor((l.mid - spread / 2) / inst.tick + 1e-6) * inst.tick,
        inst.decimals,
      );
      const ask = round(bid + spread, inst.decimals);
      const lots = (x: number) => Math.max(1, Math.round(x / l.lot)) * l.lot;
      const bidSize = lots(l.size * (2 + 4 * l.r.next()));
      const askSize = lots(l.size * (2 + 4 * l.r.next()));
      if (bid !== l.bid || ask !== l.ask) l.moved = true;
      l.bid = bid;
      l.ask = ask;
      if (detailed || l.bidSize === 0) {
        l.bidSize = bidSize;
        l.askSize = askSize;
      }

      // Trades: buyers lift the ask, sellers hit the bid, leaning with the move.
      const count = detailed ? l.r.poisson(l.rate * activity * dt) : 0;
      const lean = Math.max(-0.3, Math.min(0.3, (l.mid - before) / (before * 0.0004 + 1e-12)));
      for (let i = 0; i < count; i++) {
        const side: Side = l.r.next() < 0.5 + lean ? "buy" : "sell";
        const size = lots(l.size * Math.exp(l.r.gauss() * 0.9 - 0.4));
        print(l, side === "buy" ? ask : bid, size, side);
      }
      // History has no single trades: the bar takes the volume a step would have had.
      if (!detailed && l.rate) {
        const price = l.r.next() < 0.5 ? bid : ask;
        const volume = l.size * l.rate * activity * dt;
        bar(l, price, volume);
        l.volume += volume;
        l.turnover += price * volume;
        setLast(l, price);
      }
      // Currencies have no single exchange price: their last is the mid.
      if (inst.assetClass === "fx") {
        setLast(l, round((bid + ask) / 2, inst.decimals));
        if (!count) bar(l, l.last, 0);
      }
    }

    for (const l of all) {
      if (!l.weights) continue;
      const level =
        l.inst.prevClose *
        l.weights.reduce((s, m) => s + (m.weight * m.live.mid) / m.live.inst.prevClose, 0);
      const rounded = round(level, l.inst.decimals);
      l.bid = l.ask = rounded;
      l.volume = l.weights.reduce((s, m) => s + m.live.volume, 0);
      setLast(l, rounded);
      bar(l, rounded, 0);
    }

    // A headline every few minutes from the day's flow.
    if (r.next() < dt / 150) addNews(flowHeadline(r, instruments));
  }

  function print(l: Live, price: number, size: number, side: Side) {
    l.traded = true;
    l.volume += size;
    l.turnover += price * size;
    if (l.inst.assetClass !== "fx") setLast(l, price);
    bar(l, price, size);
    l.trades.unshift({ id: ++tradeId, symbol: l.inst.symbol, price, size, side, time: now });
    if (l.trades.length > TAPE) l.trades.length = TAPE;
  }

  function setLast(l: Live, price: number) {
    if (price !== l.last) {
      l.tickDir = price > l.last ? 1 : -1;
      l.moved = true;
    }
    l.last = price;
    l.high = Math.max(l.high, price);
    l.low = Math.min(l.low, price);
    if (l.moved) l.quote = null;
  }

  function bar(l: Live, price: number, volume: number) {
    const time = now - (now % MINUTE);
    const last = l.bars[l.bars.length - 1];
    if (last && last.time === time) {
      // Bars are replaced, never changed in place: a subscriber may still hold the old one.
      l.bars[l.bars.length - 1] = {
        ...last,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
        volume: last.volume + volume,
      };
    } else l.bars.push({ time, open: price, high: price, low: price, close: price, volume });
    if (volume) l.quote = null;
  }

  function addNews(draft: HeadlineDraft) {
    const h: Headline = { id: ++newsId, time: now, ...draft };
    news.unshift(h);
    if (news.length > MAX_NEWS) news.length = MAX_NEWS;
    freshNews.push(h);
  }

  // The morning before `start`, in coarse steps: bars, volume and the first headlines. The last minute runs
  // tick by tick, so time and sales has trades in it from the start.
  while (now + 15_000 <= start - 60_000) advance(15_000, false);
  while (now + tickMs <= start) advance(tickMs, true);
  freshNews = [];
  // The live state begins from what the morning left.
  for (const l of all) {
    l.open = l.bars[0]?.open ?? l.last;
    l.quote = null;
  }

  // ---------- reading ----------

  const live = (symbol: string) => {
    const l = lives.get(symbol);
    if (!l) throw new Error(`Unknown instrument ${symbol}`);
    return l;
  };

  function quoteOf(l: Live): Quote {
    if (l.quote) return l.quote;
    const { inst } = l;
    const change = l.last - inst.prevClose;
    l.quote = {
      symbol: inst.symbol,
      bid: l.bid,
      ask: l.ask,
      bidSize: l.bidSize,
      askSize: l.askSize,
      last: l.last,
      change,
      changePct: (change / inst.prevClose) * 100,
      open: l.open,
      high: l.high,
      low: l.low,
      prevClose: inst.prevClose,
      volume: l.volume,
      vwap: l.volume ? l.turnover / l.volume : l.last,
      tickDir: l.tickDir,
      time: now,
      ...(isBond(inst) ? { yield: { pct: l.yld, changeBp: (l.yld - inst.prevYield) * 100 } } : {}),
    };
    return l.quote;
  }

  // Histories are made the first time a chart asks, and kept.
  const histories = new Map<string, History>();
  function historyOf(l: Live): History {
    let h = histories.get(l.inst.symbol);
    if (h) return h;
    h =
      l.inst.assetClass === "index"
        ? indexHistory(
            l.inst,
            (l.weights ?? []).map((m) => ({
              inst: m.live.inst,
              weight: m.weight,
              history: historyOf(m.live),
            })),
          )
        : instrumentHistory(l.inst, sessionOpen, seed);
    histories.set(l.inst.symbol, h);
    return h;
  }

  function barsOf(l: Live, range: Range): Bar[] {
    if (range === "1D") return [...l.bars];
    const h = historyOf(l);
    if (range === "5D") return [...h.halfHours, ...aggregate(l.bars, 30 * MINUTE, sessionOpen)];
    const today: Bar = {
      time: sessionOpen,
      open: l.open,
      high: l.high,
      low: l.low,
      close: l.last,
      volume: l.volume,
    };
    const days = { "1M": 21, "6M": 125, "1Y": 251 }[range];
    return [...h.daily.slice(-days), today];
  }

  const read = readWith({
    quote: (t) => quoteOf(live(t.symbol)),
    book: (t) => bookOf(live(t.symbol), now),
    trades: (t) => [...live(t.symbol).trades],
    bars: (t) => barsOf(live(t.symbol), t.range),
    news: ({ symbol }) => (symbol ? news.filter((h) => h.symbols.includes(symbol)) : [...news]),
    clock: () => now,
  });
  const hub = createTopicHub(read);

  /** Whether a topic has something new after this step. */
  function changed(t: Topic): boolean {
    switch (t.channel) {
      case "quote":
      case "bars":
        return live(t.symbol).moved || live(t.symbol).traded;
      case "book":
        return true; // sizes away from the touch change on their own
      case "trades":
        return live(t.symbol).traded;
      case "news":
        return freshNews.some((h) => !t.symbol || h.symbols.includes(t.symbol));
      case "clock":
        return true;
    }
  }

  function tick() {
    advance(tickMs, true);
    hub.notify(changed);
    freshNews = [];
  }

  return {
    instruments,
    sessionOpen,
    instrument: (symbol) => lives.get(symbol)?.inst,
    now: () => now,
    snapshot: read,
    subscribe(topic, onData) {
      if (topic.channel !== "clock" && topic.channel !== "news") live(topic.symbol);
      return hub.add(topic, onData);
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) tick();
    },
    run() {
      let last = Date.now();
      const timer = setInterval(() => {
        // Catch up after the tab was in the background, a few steps at a time; past that, time just pauses.
        const due = Math.min(8, Math.floor((Date.now() - last) / tickMs));
        last += due * tickMs;
        if (Date.now() - last > tickMs * 8) last = Date.now();
        for (let i = 0; i < due; i++) tick();
      }, tickMs);
      return () => clearInterval(timer);
    },
  };
}

function todayAt(hours: number, minutes: number): number {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}
