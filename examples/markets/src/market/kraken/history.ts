/**
 * Price history from Kraken's REST API, loaded the first time a chart asks and kept up to date by each ticker. Calls
 * go one at a time (its public limit is about one a second), and a failed call waits longer before each next try:
 * a chart asks on every tick, so without the wait a failing call would be made on every tick.
 */
import { MINUTE } from "../bars";
import type { Bar, Range } from "../types";
import { ohlcUrl, parseBars, restError } from "./frames";
import type { Pair } from "./pairs";

export type Fetch = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** After a failed call, the first wait before trying again; it doubles each time, up to the most. */
export const HISTORY_RETRY_MS = 5_000;
const HISTORY_RETRY_MAX_MS = 5 * 60_000;
const DAY = 24 * 60 * MINUTE;

/** Each range: Kraken's bar size in minutes, and how far back it reaches. */
const RANGE: Record<Range, { interval: number; span: number }> = {
  "1D": { interval: 5, span: DAY },
  "5D": { interval: 30, span: 5 * DAY },
  "1M": { interval: 1440, span: 31 * DAY },
  "6M": { interval: 1440, span: 183 * DAY },
  "1Y": { interval: 1440, span: 366 * DAY },
};

export interface KrakenHistory {
  /** `p`'s bars for `range`, or none while they load (`onLoaded` says when they have). */
  barsOf(p: Pair, range: Range): Bar[];
  /** Every loaded series with `last` in its latest bar, or in a new one once its interval has begun. */
  tick(p: Pair, last: number): void;
}

export function createKrakenHistory({
  rest,
  get,
  now,
  onLoaded,
}: {
  rest: string;
  get: Fetch;
  now: () => number;
  onLoaded: (p: Pair) => void;
}): KrakenHistory {
  const loading = new Set<string>();
  /** Failed calls, by "pair:interval": how many in a row, and when the next try may go. */
  const failed = new Map<string, { count: number; retryAt: number }>();
  let queue = Promise.resolve();

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

  function load(p: Pair, interval: number) {
    const key = `${p.pair}:${interval}`;
    if (p.bars.has(interval) || loading.has(key)) return;
    const f = failed.get(key);
    if (f && now() < f.retryAt) return;
    loading.add(key);
    queue = queue
      .then(async () => {
        const res = await get(ohlcUrl(rest, p.pair, interval));
        const body: unknown = await res.json();
        const parsed = res.ok ? parseBars(body, p.pair) : undefined;
        if (!parsed) throw new Error(restError(body) || "no bars");
        failed.delete(key);
        p.bars.set(interval, p.quote ? withLast(parsed, interval, p.quote.last) : parsed);
        onLoaded(p);
      })
      .catch(() => {
        // Nothing to show yet. Try again later, waiting longer each time it fails.
        const count = (failed.get(key)?.count ?? 0) + 1;
        const wait = Math.min(HISTORY_RETRY_MAX_MS, HISTORY_RETRY_MS * 2 ** (count - 1));
        failed.set(key, { count, retryAt: now() + wait });
      })
      .finally(() => loading.delete(key));
  }

  return {
    barsOf(p, range) {
      const { interval, span } = RANGE[range];
      const bars = p.bars.get(interval);
      if (!bars) {
        load(p, interval);
        return [];
      }
      const from = now() - span;
      return bars.filter((b) => b.time + interval * MINUTE > from);
    },
    tick(p, last) {
      for (const [interval, bars] of p.bars) p.bars.set(interval, withLast(bars, interval, last));
    },
  };
}
