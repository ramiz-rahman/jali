/**
 * Everything that moves for one simulated instrument, made once when the market starts: where it opens, how wide its
 * spread is, how often it trades and in what lots. An index also knows its members and their weights.
 */
import { isBond } from "../classes";
import type { Bar, Quote, Trade } from "../types";
import { dailyVolume } from "./history";
import { bondPrice, type SimInstrument } from "./instruments";
import { createRandom, hash, type Random } from "./random";

/** Trading seconds in a session and in a year. */
export const SESSION_S = 6.5 * 3600;
export const YEAR_S = 252 * SESSION_S;

export interface Live {
  inst: SimInstrument;
  /** Its own random stream, so one instrument's moves don't shift another's. */
  r: Random;
  /** A fixed number for its order book's sizes (book.ts). */
  key: number;
  mid: number;
  /** Bonds: the yield in %; 0 otherwise. */
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
  /** The last quote read, until something in it changes. */
  quote: Quote | null;
  /** Set during a step: the price changed; a trade printed. */
  moved: boolean;
  traded: boolean;
  /** Index members: weight at yesterday's close. */
  weights?: { live: Live; weight: number }[];
}

export const round = (x: number, decimals: number) => Number(x.toFixed(decimals));

/** How a class trades: its spread in ticks, trades a second, and its lot. */
function trading(inst: SimInstrument, own: Random): { spread: number; rate: number; lot: number } {
  switch (inst.assetClass) {
    case "equity": {
      // The larger the company, the tighter and busier its market.
      const liquid = Math.min(1, inst.shares / 2e9);
      const spread = 1 + Math.round((1 - liquid) * 4 + own.next() * 2);
      return { spread, rate: 0.6 + liquid * 2.2, lot: 10 };
    }
    case "govt":
      return { spread: 4 + Math.round(inst.maturity / 4), rate: 0.5, lot: 1_000 };
    case "corp":
      return { spread: 30, rate: 0.12, lot: 1_000 };
    case "fx":
      return { spread: 6 + own.int(0, 6), rate: 2.5, lot: 100_000 };
    case "index":
      return { spread: 0, rate: 0, lot: 1 };
  }
}

/** Where it opens: a little gap from yesterday's close, or for a bond from yesterday's yield. An index is its members. */
function opening(inst: SimInstrument, own: Random): { mid: number; yld: number } {
  if (isBond(inst)) {
    const yld = inst.prevYield + own.gauss() * 0.02;
    return { mid: bondPrice(yld, inst.coupon, inst.maturity), yld };
  }
  const gap = inst.assetClass === "index" ? 0 : own.gauss() * (inst.vol / Math.sqrt(252)) * 0.3;
  return { mid: inst.prevClose * Math.exp(gap), yld: 0 };
}

function createLive(inst: SimInstrument, seed: number): Live {
  const own = createRandom(hash(inst.symbol, seed));
  const { mid, yld } = opening(inst, own);
  const { spread, rate, lot } = trading(inst, own);
  const price = round(mid, inst.decimals);
  return {
    inst,
    r: own,
    key: hash(inst.symbol),
    mid,
    yld,
    bid: mid,
    ask: mid,
    bidSize: 0,
    askSize: 0,
    last: price,
    open: price,
    high: price,
    low: price,
    volume: 0,
    turnover: 0,
    tickDir: 0,
    spreadTicks: spread,
    rate,
    size: rate ? dailyVolume(inst) / SESSION_S / rate : 0,
    lot,
    bars: [],
    trades: [],
    quote: null,
    moved: true,
    traded: false,
  };
}

/** Every instrument's live state, by symbol; an index weighs its members by market value at yesterday's close. */
export function createLives(
  instruments: readonly SimInstrument[],
  seed: number,
): Map<string, Live> {
  const lives = new Map(instruments.map((inst) => [inst.symbol, createLive(inst, seed)]));
  const cap = (l: Live) => l.inst.prevClose * (l.inst.assetClass === "equity" ? l.inst.shares : 1);
  for (const live of lives.values()) {
    if (live.inst.assetClass !== "index") continue;
    const members = live.inst.members.flatMap((s) => lives.get(s) ?? []);
    const total = members.reduce((sum, m) => sum + cap(m), 0);
    live.weights = members.map((m) => ({ live: m, weight: cap(m) / total }));
  }
  return lives;
}
