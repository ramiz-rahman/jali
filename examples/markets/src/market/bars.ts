/** Price bars, whoever makes them: the simulator, Kraken's history, and a chart that merges them to fit. */
import { facts } from "./classes";
import type { Bar, Instrument } from "./types";

export const MINUTE = 60_000;

/** Bars of one size merged into bars of a larger one (1-minute bars into half hours, for 5D). */
export function aggregate(bars: readonly Bar[], size: number, origin: number): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const time = origin + Math.floor((b.time - origin) / size) * size;
    const last = out[out.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume += b.volume;
    } else out.push({ ...b, time });
  }
  return out;
}

/** How one day comes, for a 1D chart or a sparkline: a session is 390 one-minute bars from the simulator; a coin's
 *  day is the last 24 hours, in Kraken's 5-minute bars. */
export const dayOf = (inst: Instrument) =>
  facts(inst).continuous ? { minutes: 24 * 60, bar: 5 } : { minutes: SESSION_MINUTES, bar: 1 };

/** 09:30 to 16:00. */
export const SESSION_MINUTES = 390;
