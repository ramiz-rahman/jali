/** What the transcript works out about its lines, as plain functions of the session: no React, no drawing. */
import { wordIndexAt } from "../../sessions/derive";
import type { MarkerData, SegmentData, WordTime } from "../../sessions/types";

/**
 * Markers as headings, by the id of the line each heads: over the first line at or after each marker. Where several
 * fall before one line (a song's intro and groove before its first sung line), the last of them names the section
 * the line opens. `markers` are in time order.
 */
export function sectionsOf(
  markers: readonly MarkerData[],
  segments: readonly SegmentData[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of markers) {
    const seg = segments.find((s) => s.start >= m.time - 0.05);
    if (seg) out.set(seg.id, m.label);
  }
  return out;
}

/** The lines that start while an earlier line is still going: two people at once. */
export function overlapsOf(segments: readonly SegmentData[]): Set<string> {
  const out = new Set<string>();
  let reach = -Infinity;
  for (const s of segments) {
    if (reach > s.start) out.add(s.id);
    reach = Math.max(reach, s.end);
  }
  return out;
}

/** How far the playhead is through a line. */
export type Progress =
  | { at: "before" }
  | { at: "after" }
  /** The word being spoken, or between two words the last one started (`between`). */
  | { at: "word"; word: number; between?: true };

/** A line not reached yet, and one played: one object each, so a row that stays before or after is unchanged. */
const BEFORE: Progress = { at: "before" };
const AFTER: Progress = { at: "after" };

export function progressOf(seg: SegmentData, t: number, words: readonly WordTime[]): Progress {
  if (t < seg.start) return BEFORE;
  if (t >= seg.end) return AFTER;
  const i = wordIndexAt(words, t);
  if (i >= 0) return { at: "word", word: i };
  let last = -1;
  words.forEach((w, k) => {
    if (w[1] <= t) last = k;
  });
  return { at: "word", word: last, between: true };
}

/** A word's mark as the playhead passes: played, being spoken, or not yet. */
export function wordState(p: Progress, i: number): "played" | "now" | undefined {
  if (p.at === "after") return "played";
  if (p.at !== "word") return undefined;
  if (i < p.word || (p.between && i === p.word)) return "played";
  return i === p.word && !p.between ? "now" : undefined;
}
