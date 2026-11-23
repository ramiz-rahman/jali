/**
 * A simulated order book: ten levels a side from the touch, one tick apart (five for a bond). Sizes belong to a price,
 * not a position, and each changes on its own clock, so the book breathes without jumping.
 */
import { isBond } from "../classes";
import type { Book, BookLevel } from "../types";
import { round, type Live } from "./live";
import { noise } from "./random";

const LEVELS = 10;

export function bookOf(l: Live, now: number): Book {
  const { inst } = l;
  const step = inst.tick * (isBond(inst) ? 5 : 1);
  const side = (best: number, bestSize: number, dir: 1 | -1): BookLevel[] =>
    Array.from({ length: l.rate ? LEVELS : 0 }, (_, i) => {
      const price = round(best + dir * i * step, inst.decimals);
      const ticks = Math.round(price / inst.tick);
      const phase = noise(l.key, ticks) * 4000;
      const n = noise(l.key, ticks, Math.floor((now + phase) / 4000));
      const size =
        i === 0
          ? bestSize
          : Math.max(l.lot, Math.round((l.size * (3 + i * 1.4) * (0.3 + 1.5 * n)) / l.lot) * l.lot);
      return { price, size, orders: Math.max(1, Math.round(size / (l.size * 1.6 || 1))) };
    });
  return {
    symbol: inst.symbol,
    bids: side(l.bid, l.bidSize, -1),
    asks: side(l.ask, l.askSize, 1),
    time: now,
  };
}
