/** How times and text are printed: the clock on every display, the mission clock, durations for screen readers. */
import type { SessionData } from "./types";

/** Two digits at least: "07", for clocks and counters. */
export const pad = (n: number) => String(n).padStart(2, "0");
const wholeSeconds = (t: number) => Math.max(0, Math.floor(t + 1e-6));

/** "01:07" */
export function clock(t: number): string {
  const s = wholeSeconds(t);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** "01:07.4", for the transport and the selected range. */
export function clockTenths(t: number): string {
  const tenths = Math.max(0, Math.floor(t * 10 + 1e-6));
  return `${clock(tenths / 10)}.${tenths % 10}`;
}

/**
 * The mission clock at session time `t` ("102:43:21"), for a session that has one (Apollo: time 0 is GET
 * 102:42:40); `null` for the others.
 */
export function missionTime(session: SessionData, t: number): string | null {
  const zero = session.clock?.get_at_zero;
  if (!zero) return null;
  const [h, m, sec] = zero.split(":").map(Number) as [number, number, number];
  const all = h * 3600 + m * 60 + sec + wholeSeconds(t);
  return `${Math.floor(all / 3600)}:${pad(Math.floor(all / 60) % 60)}:${pad(all % 60)}`;
}

/** "1 min 15 s", for screen readers and the library. */
export function spokenDuration(t: number): string {
  const s = Math.round(t);
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

/** A segment's opening words, for titles and the chooser. */
export function opening(text: string, words = 6): string {
  const all = text.split(/\s+/);
  return all.length > words ? `${all.slice(0, words).join(" ")}…` : text;
}

/** "line" → "Line": a word from the catalogue at the start of a sentence or a title. */
export const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
