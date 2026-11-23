/**
 * Price history before today: a year of daily bars and the last four sessions in 30-minute bars, generated from
 * each instrument's own seeded stream so it is the same on every load. Indices are built from their members.
 */
import { MINUTE } from "../bars";
import { isBond } from "../classes";
import type { Bar, Index } from "../types";
import { bondPrice, type SimInstrument } from "./instruments";
import { createRandom, hash } from "./random";

const DAYS = 252;
const HALF_HOUR = 30 * MINUTE;
const BARS_PER_SESSION = 13; // 09:30 to 16:00 in half hours

export interface History {
  /** Daily bars, oldest first, the last one yesterday's (closing at `prevClose`). */
  daily: Bar[];
  /** The four sessions before today, in 30-minute bars, oldest first. */
  halfHours: Bar[];
}

/** Session opens of the `count` weekdays before `today` (each 09:30 local), oldest first. */
function previousSessions(today: number, count: number): number[] {
  const out: number[] = [];
  const d = new Date(today);
  d.setHours(9, 30, 0, 0);
  while (out.length < count) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(d.getTime());
  }
  return out;
}

/** Typical daily volume, in the units the instrument trades in: an index has none of its own. */
export function dailyVolume(inst: SimInstrument): number {
  switch (inst.assetClass) {
    case "equity":
      return inst.shares * 0.004;
    case "fx":
      return 9e9;
    case "govt":
      return 4e9;
    case "corp":
      return 1.5e8;
    case "index":
      return 0;
  }
}

/** One instrument's history (an index's is its members': see `indexHistory`). */
export function instrumentHistory(
  inst: Exclude<SimInstrument, Index>,
  today: number,
  seed: number,
): History {
  const r = createRandom(hash(inst.symbol, seed));
  const sessions = previousSessions(today, DAYS);
  const bond = isBond(inst) ? inst : undefined;
  // A little calmer than today's volatility: a year of it at full strength wanders further than real prices do.
  const dayVol = (bond ? inst.vol / 100 : inst.vol / Math.sqrt(252)) * 0.7;
  // A day's move in the price: for a bond, its yield's move times roughly its duration.
  const pxVol = bond ? (Math.min(bond.maturity * 0.85, 18) * inst.vol) / 1e4 : dayVol;

  // Walk back from yesterday's close (or yield): each earlier close undoes one day's move.
  const closes: number[] = Array.from({ length: DAYS }, () => 0);
  let level = bond ? bond.prevYield : inst.prevClose;
  for (let d = DAYS - 1; d >= 0; d--) {
    closes[d] = level;
    const move = r.gauss() * dayVol;
    level = bond ? level - move : level / Math.exp(move + 0.0002);
  }
  const price = (x: number) => (bond ? bondPrice(x, bond.coupon, bond.maturity) : x);

  const volume = dailyVolume(inst);
  const daily: Bar[] = sessions.map((time, d) => {
    const prev = d === 0 ? level : closes[d - 1]!;
    const close = closes[d]!;
    const open = bond ? prev + r.gauss() * dayVol * 0.2 : prev * Math.exp(r.gauss() * dayVol * 0.2);
    const [o, c] = [price(open), price(close)];
    const wick = () => Math.abs(r.gauss()) * pxVol * 0.45;
    const high = Math.max(o, c) * (1 + wick());
    const low = Math.min(o, c) * (1 - wick());
    return { time, open: o, high, low, close: c, volume: volume * Math.exp(r.gauss() * 0.35) };
  });

  // The last four sessions, half hour by half hour: a walk from the day's open, bent to end at its close.
  const halfHours: Bar[] = [];
  for (const day of daily.slice(-4)) {
    const steps = [day.open];
    const step = pxVol / Math.sqrt(BARS_PER_SESSION);
    for (let i = 0; i < BARS_PER_SESSION; i++) steps.push(steps[i]! * Math.exp(r.gauss() * step));
    const drift = Math.log(day.close / steps[BARS_PER_SESSION]!);
    const path = steps.map((p, i) => p * Math.exp((drift * i) / BARS_PER_SESSION));
    let high = -Infinity;
    let low = Infinity;
    for (let i = 0; i < BARS_PER_SESSION; i++) {
      const open = path[i]!;
      const close = path[i + 1]!;
      const spread = Math.abs(r.gauss()) * step * 0.4;
      const bar: Bar = {
        time: day.time + i * HALF_HOUR,
        open,
        close,
        high: Math.max(open, close) * (1 + spread),
        low: Math.min(open, close) * (1 - spread),
        volume: (day.volume / BARS_PER_SESSION) * intradayShape(i * 30) * Math.exp(r.gauss() * 0.3),
      };
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
      halfHours.push(bar);
    }
    // The day's bar agrees with its half hours.
    day.high = high;
    day.low = low;
  }
  return { daily, halfHours };
}

/** An index's history, from its members' histories weighted by market value at yesterday's close. */
export function indexHistory(
  index: Index,
  members: { inst: SimInstrument; history: History; weight: number }[],
): History {
  const combine = (pick: (h: History) => Bar[]): Bar[] =>
    pick(members[0]!.history).map((bar, i) => {
      const level = (f: (b: Bar) => number) =>
        index.prevClose *
        members.reduce((sum, m) => sum + (m.weight * f(pick(m.history)[i]!)) / m.inst.prevClose, 0);
      const open = level((b) => b.open);
      const close = level((b) => b.close);
      // Members don't all peak at once: an index's range is narrower than its members' average.
      const reach = level((b) => b.high) - Math.max(open, close);
      const dip = Math.min(open, close) - level((b) => b.low);
      return {
        time: bar.time,
        open,
        close,
        high: Math.max(open, close) + reach * 0.6,
        low: Math.min(open, close) - dip * 0.6,
        volume: members.reduce((sum, m) => sum + pick(m.history)[i]!.volume, 0),
      };
    });
  return { daily: combine((h) => h.daily), halfHours: combine((h) => h.halfHours) };
}

/** More trading near the open and the close: a multiplier on the average rate, `minutes` after 09:30. */
export function intradayShape(minutes: number): number {
  const toClose = Math.max(0, 390 - minutes);
  return 0.62 + 1.1 * Math.exp(-minutes / 35) + 0.75 * Math.exp(-toClose / 35);
}
