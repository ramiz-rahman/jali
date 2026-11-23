/**
 * Where the chart's bars and labels go, as plain functions of the bars and the width: how many minutes a 1D bar
 * covers, how many slots the chart has, and which bars get a time on the axis.
 */
import { aggregate, dayOf, MINUTE, SESSION_MINUTES } from "../../market/bars";
import type { Bar, Instrument, Range } from "../../market/types";
import * as f from "../../ui/format";

export const AXIS_W = 64; // the price axis, on the right
export const AXIS_H = 20; // the time axis, below

/** Minutes a 1D bar may cover: the fewest that keep a candle 5px wide. */
const BUCKETS = [1, 2, 5, 10, 15, 30];
/** Slots across a 5D chart: five sessions of 13 half hours. */
const SLOTS_5D = 65;

/**
 * The bars to draw and the slots to draw them in. Today comes by the minute (390 bars a session): a narrow chart
 * merges them into wider bars that read better, and its slots are the whole session, so today's line fills in as
 * the day goes on.
 */
export function fit(raw: readonly Bar[], inst: Instrument, range: Range, width: number) {
  if (range !== "1D") return { bars: raw, slots: range === "5D" ? SLOTS_5D : raw.length };
  const day = dayOf(inst);
  const bucket =
    BUCKETS.find((m) => m >= day.bar && (width - AXIS_W) / (day.minutes / m) >= 5) ?? 30;
  const first = raw[0];
  const bars = bucket > day.bar && first ? aggregate(raw, bucket * MINUTE, first.time) : raw;
  return { bars, slots: day.minutes / bucket };
}

/** A bar's time in the readout: the minute today, the day and minute over five days, the date beyond. */
export const barTime = (range: Range, time: number) =>
  range === "1D"
    ? f.hhmm(time)
    : range === "5D"
      ? `${f.weekday(time)} ${f.hhmm(time)}`
      : f.day(time);

/** A price on the axis: a round number too long for it (100,000.0) loses its decimals. */
export function axisPrice(inst: Instrument, t: number) {
  const text = f.price(inst, t);
  return text.length > 8 && Number.isInteger(t) ? f.int(t) : text;
}

/** Where the time axis gets a label: each hour today (every third over 24 hours), each day over 5D, each week or
 *  month beyond. */
export function timeLabels(
  bars: readonly Bar[],
  range: Range,
  slots: number,
  dayMinutes: number,
): { i: number; label: string }[] {
  const out: { i: number; label: string }[] = [];
  const first = bars[0];
  // Today: every hour of the session, including the ones still to come.
  if (range === "1D") {
    if (!first) return out;
    const open = first.time;
    const perSlot = (dayMinutes / slots) * MINUTE;
    const hours = dayMinutes > SESSION_MINUTES ? 3 : 1;
    const start = new Date(open);
    start.setMinutes(0, 0, 0);
    start.setHours(
      Math.ceil((start.getHours() + (open > start.getTime() ? 1 : 0)) / hours) * hours,
    );
    for (let t = start.getTime(); t < open + dayMinutes * MINUTE; t += hours * 60 * MINUTE)
      out.push({ i: Math.round((t - open) / perSlot), label: f.hhmm(t) });
    return out;
  }
  bars.forEach((b, i) => {
    const d = new Date(b.time);
    const before = bars[i - 1];
    const prev = before ? new Date(before.time) : null;
    if (range === "5D") {
      if (!prev || prev.getDate() !== d.getDate()) out.push({ i, label: f.weekday(b.time) });
    } else if (range === "1M") {
      if (prev && d.getDay() < prev.getDay()) out.push({ i, label: f.day(b.time) });
    } else if (prev && prev.getMonth() !== d.getMonth()) {
      out.push({ i, label: d.toLocaleDateString("en-GB", { month: "short" }) });
    }
  });
  return out;
}
