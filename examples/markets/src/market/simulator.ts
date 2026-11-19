/**
 * A simulated market behind the `MarketData` interface. A seeded random walk moves every price a few times a
 * second: equities share a market and a sector factor, bond yields move along the curve together, the dollar moves
 * the FX pairs, and indices are their members weighted by market value. Trades print at the bid or the ask, and
 * build the day's bars, volume and time and sales.
 *
 *   const market = createSimulator({ seed: 7 });
 *   market.step(40);             // ten seconds of market time, at once (tests)
 *   const stop = market.run();   // or in real time (the app)
 *
 * The same seed and start always give the same market.
 */
import {
  aggregate,
  dailyVolume,
  indexHistory,
  instrumentHistory,
  intradayShape,
  MINUTE,
  type History,
} from "./history";
import { INSTRUMENTS, bondPrice } from "./instruments";
import { flowHeadline, moveHeadline } from "./news";
import { createRandom, hash, noise, type Random } from "./random";
import type {
  Bar,
  Book,
  BookLevel,
  Headline,
  Instrument,
  MarketData,
  Quote,
  Range,
  Topic,
  TopicData,
  Trade,
} from "./types";

export interface SimulatorOptions {
  /** Default 1. */
  seed?: number;
  /** Market time when the simulation starts, ms since the epoch. The session opens at 09:30 that day, and the
   *  morning until `start` is simulated first, so charts have history. Default: today at 11:45. */
  start?: number;
  /** Market time per step, in ms. Default 250: four ticks a second. */
  tickMs?: number;
  instruments?: readonly Instrument[];
}

export interface Simulator extends MarketData {
  /** Move the market on by `count` steps. */
  step(count?: number): void;
  /** The market's clock, ms since the epoch. */
  now(): number;
  /** When today's session opened. */
  readonly sessionOpen: number;
  /** Step in real time until the returned function is called. */
  run(): () => void;
}

const YEAR_S = 252 * 6.5 * 3600; // trading seconds in a year
const SESSION_S = 6.5 * 3600;
const LEVELS = 10;
const TAPE = 200;
const MAX_NEWS = 300;

/** Everything that moves for one instrument. */
interface Live {
  inst: Instrument;
  r: Random;
  key: number;
  mid: number;
  /** Bonds: the yield in %. */
  yld: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  tickDir: 1 | -1 | 0;
  spreadTicks: number;
  /** Trades a second, and their mean size. */
  rate: number;
  size: number;
  /** Size steps: 10 shares, 1,000 face, 100,000 currency. */
  lot: number;
  bars: Bar[];
  trades: Trade[];
  quote: Quote | null;
  /** Set during a step: the price changed; a trade printed. */
  moved: boolean;
  traded: boolean;
  /** Index members: weight at yesterday's close. */
  weights?: { live: Live; weight: number }[];
}

const round = (x: number, decimals: number) => Number(x.toFixed(decimals));

export function createSimulator(options: SimulatorOptions = {}): Simulator {
  const seed = options.seed ?? 1;
  const tickMs = options.tickMs ?? 250;
  const instruments = options.instruments ?? INSTRUMENTS;
  const r = createRandom(seed);

  const start = options.start ?? todayAt(11, 45);
  const sessionOpen = new Date(start).setHours(9, 30, 0, 0);
  let now = sessionOpen;
  let tradeId = 0;
  let newsId = 0;
  const news: Headline[] = [];
  let freshNews: Headline[] = [];

  const lives = new Map<string, Live>();
  for (const inst of instruments) {
    const own = createRandom(hash(inst.symbol, seed));
    // The open gaps a little from yesterday's close (bonds: their yield, below).
    const priced = inst.assetClass === "equity" || inst.assetClass === "fx";
    const gap = priced ? own.gauss() * (inst.vol / Math.sqrt(252)) * 0.3 : 0;
    const yld = (inst.prevYield ?? 0) + (inst.coupon !== undefined ? own.gauss() * 0.02 : 0);
    const mid =
      inst.coupon !== undefined
        ? bondPrice(yld, inst.coupon, inst.maturity!)
        : inst.prevClose * Math.exp(gap);
    const liquid = inst.assetClass === "equity" ? Math.min(1, (inst.shares ?? 1e9) / 2e9) : 1;
    const params = {
      equity: {
        spread: 1 + Math.round((1 - liquid) * 4 + own.next() * 2),
        rate: 0.6 + liquid * 2.2,
        lot: 10,
      },
      govt: { spread: 4 + Math.round((inst.maturity ?? 1) / 4), rate: 0.5, lot: 1_000 },
      corp: { spread: 30, rate: 0.12, lot: 1_000 },
      fx: { spread: 6 + own.int(0, 6), rate: 2.5, lot: 100_000 },
      index: { spread: 0, rate: 0, lot: 1 },
    }[inst.assetClass];
    const meanSize = params.rate ? dailyVolume(inst) / SESSION_S / params.rate : 0;
    lives.set(inst.symbol, {
      inst,
      r: own,
      key: hash(inst.symbol),
      mid,
      yld,
      bid: mid,
      ask: mid,
      bidSize: 0,
      askSize: 0,
      last: round(mid, inst.decimals),
      open: round(mid, inst.decimals),
      high: round(mid, inst.decimals),
      low: round(mid, inst.decimals),
      volume: 0,
      turnover: 0,
      tickDir: 0,
      spreadTicks: params.spread,
      rate: params.rate,
      size: meanSize,
      lot: params.lot,
      bars: [],
      trades: [],
      quote: null,
      moved: true,
      traded: false,
    });
  }
  // Indices weigh their members by market value at yesterday's close.
  for (const live of lives.values()) {
    const members = live.inst.members?.map((s) => lives.get(s)!).filter(Boolean);
    if (!members?.length) continue;
    const caps = members.map((m) => m.inst.prevClose * (m.inst.shares ?? 1));
    const total = caps.reduce((a, b) => a + b, 0);
    live.weights = members.map((m, i) => ({ live: m, weight: caps[i]! / total }));
  }
  const all = [...lives.values()];
  const sectors = [...new Set(all.map((l) => l.inst.group))];

  // ---------- one step of market time ----------

  function advance(dtMs: number, detailed: boolean) {
    const dt = dtMs / 1000;
    now += dtMs;
    // The shared shocks of this step.
    const market = r.gauss();
    const sector = new Map(sectors.map((s) => [s, r.gauss()]));
    const curveLevel = r.gauss();
    const curveSlope = r.gauss();
    const dollar = r.gauss();
    const minutes = (now - sessionOpen) / MINUTE;
    const activity = intradayShape(minutes);

    for (const l of all) {
      l.moved = false;
      l.traded = false;
      const { inst } = l;
      const before = l.mid;
      let shock = 0;
      if (inst.assetClass === "equity") {
        const sigma = inst.vol * Math.sqrt(dt / YEAR_S);
        shock = 0.5 * market + 0.4 * sector.get(inst.group)! + 0.768 * l.r.gauss();
        let ret = sigma * shock;
        // Now and then a sharp move, and a headline that explains it.
        if (l.r.next() < dt / (3600 * 5)) {
          const up = l.r.next() < 0.5;
          ret += (up ? 1 : -1) * (0.005 + l.r.next() * 0.01);
          addNews(moveHeadline(l.r, inst, up));
        }
        l.mid *= Math.exp(ret);
      } else if (inst.coupon !== undefined) {
        // Yields: the curve moves as a whole, the ends a little apart, each bond a little on its own.
        const slope = Math.max(-1, Math.min(1, Math.log(inst.maturity! / 5) / Math.log(6)));
        const bp = inst.vol * Math.sqrt(dt / SESSION_S);
        shock = -(0.8 * curveLevel + 0.4 * slope * curveSlope + 0.45 * l.r.gauss());
        l.yld -= (bp * shock) / 100;
        l.mid = bondPrice(l.yld, inst.coupon, inst.maturity!);
      } else if (inst.assetClass === "fx") {
        const sigma = inst.vol * Math.sqrt(dt / YEAR_S);
        const usdFirst = inst.symbol.startsWith("USD") ? 1 : -1;
        shock = 0.6 * usdFirst * dollar + 0.8 * l.r.gauss();
        l.mid *= Math.exp(sigma * shock);
      }
      if (inst.assetClass === "index") continue; // after the members, below

      // The spread sits around the mid, on whole ticks.
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
        const side = l.r.next() < 0.5 + lean ? "buy" : "sell";
        const size = lots(l.size * Math.exp(l.r.gauss() * 0.9 - 0.4));
        print(l, side === "buy" ? ask : bid, size, side);
      }
      // History has no single trades: the bar takes the volume a step would have had.
      if (!detailed && l.rate) {
        const price = l.r.next() < 0.5 ? bid : ask;
        bar(l, price, l.size * l.rate * activity * dt);
        l.volume += l.size * l.rate * activity * dt;
        l.turnover += price * l.size * l.rate * activity * dt;
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

  function print(l: Live, price: number, size: number, side: "buy" | "sell") {
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

  function addNews(draft: Omit<Headline, "id" | "time">) {
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
    const prevClose = l.inst.prevClose;
    const q: Quote = {
      symbol: l.inst.symbol,
      bid: l.bid,
      ask: l.ask,
      bidSize: l.bidSize,
      askSize: l.askSize,
      last: l.last,
      change: l.last - prevClose,
      changePct: ((l.last - prevClose) / prevClose) * 100,
      open: l.open,
      high: l.high,
      low: l.low,
      prevClose,
      volume: l.volume,
      vwap: l.volume ? l.turnover / l.volume : l.last,
      tickDir: l.tickDir,
      time: now,
    };
    if (l.inst.coupon !== undefined) {
      q.yield = l.yld;
      q.yieldChangeBp = (l.yld - l.inst.prevYield!) * 100;
    }
    l.quote = q;
    return q;
  }

  function bookOf(l: Live): Book {
    const { inst } = l;
    const step = inst.tick * (inst.coupon !== undefined ? 5 : 1);
    const side = (best: number, bestSize: number, dir: 1 | -1): BookLevel[] =>
      Array.from({ length: l.rate ? LEVELS : 0 }, (_, i) => {
        const price = round(best + dir * i * step, inst.decimals);
        const ticks = Math.round(price / inst.tick);
        // Sizes belong to a price, not a position, and each changes on its own clock.
        const phase = noise(l.key, ticks) * 4000;
        const n = noise(l.key, ticks, Math.floor((now + phase) / 4000));
        const size =
          i === 0
            ? bestSize
            : Math.max(
                l.lot,
                Math.round((l.size * (3 + i * 1.4) * (0.3 + 1.5 * n)) / l.lot) * l.lot,
              );
        return { price, size, orders: Math.max(1, Math.round(size / (l.size * 1.6 || 1))) };
      });
    return {
      symbol: inst.symbol,
      bids: side(l.bid, l.bidSize, -1),
      asks: side(l.ask, l.askSize, 1),
      time: now,
    };
  }

  // Histories are made the first time a chart asks, and kept.
  const histories = new Map<string, History>();
  function historyOf(l: Live): History {
    let h = histories.get(l.inst.symbol);
    if (h) return h;
    h = l.weights
      ? indexHistory(
          l.inst,
          l.weights.map((m) => ({
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

  function read<T extends Topic>(topic: T): TopicData<T> {
    const t = topic as Topic;
    switch (t.channel) {
      case "quote":
        return quoteOf(live(t.symbol)) as TopicData<T>;
      case "book":
        return bookOf(live(t.symbol)) as TopicData<T>;
      case "trades":
        return [...live(t.symbol).trades] as unknown as TopicData<T>;
      case "bars":
        return barsOf(live(t.symbol), t.range) as unknown as TopicData<T>;
      case "news":
        return (t.symbol
          ? news.filter((h) => h.symbols.includes(t.symbol!))
          : [...news]) as unknown as TopicData<T>;
      case "clock":
        return now as TopicData<T>;
    }
  }

  // ---------- subscribing ----------

  type Listener = (data: never) => void;
  const subs = new Map<string, { topic: Topic; listeners: Set<Listener> }>();
  const keyOf = (t: Topic) =>
    t.channel === "clock"
      ? "clock"
      : `${t.channel}:${"symbol" in t ? (t.symbol ?? "*") : "*"}:${t.channel === "bars" ? t.range : ""}`;

  /** Whether a topic has something new after this step. */
  function due(t: Topic): boolean {
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

  function notify() {
    for (const { topic, listeners } of subs.values()) {
      if (!listeners.size || !due(topic)) continue;
      const data = read(topic);
      // A copy: a listener may unsubscribe while being called.
      for (const l of Array.from(listeners)) (l as (d: unknown) => void)(data);
    }
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
      const key = keyOf(topic);
      let sub = subs.get(key);
      if (!sub) subs.set(key, (sub = { topic, listeners: new Set() }));
      sub.listeners.add(onData as Listener);
      return () => {
        sub.listeners.delete(onData as Listener);
        if (!sub.listeners.size) subs.delete(key);
      };
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) {
        advance(tickMs, true);
        notify();
      }
    },
    run() {
      let last = Date.now();
      const timer = setInterval(() => {
        // Catch up after the tab was in the background, a few steps at a time; past that, time just pauses.
        const due = Math.min(8, Math.floor((Date.now() - last) / tickMs));
        last += due * tickMs;
        if (Date.now() - last > tickMs * 8) last = Date.now();
        for (let i = 0; i < due; i++) {
          advance(tickMs, true);
          notify();
        }
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
