/**
 * The sessions and what the app derives from them: tracks, the segment or word at a time, and word times for a
 * corrected line. Plain functions of the bundled data, so pane titles, commands and tests can use them too.
 */
import { SESSIONS } from "./generated";
import type { MarkerData, SegmentData, SessionData, WordTime } from "./types";

export { SESSIONS };
export type { MarkerData, SegmentData, SessionData, WordTime };

export type TrackKind = "voice" | "music" | "sting";
export interface Track {
  id: string;
  kind: TrackKind;
  /** "Mic A": the input, not the person. A voice track's default speaker is `speaker`. */
  label: string;
  speaker?: string;
}

/** Every session has the same four tracks: two microphones, the music bed and the sting. */
export const TRACKS: readonly Track[] = [
  { id: "mic-a", kind: "voice", label: "Mic A", speaker: "host" },
  { id: "mic-b", kind: "voice", label: "Mic B", speaker: "guest" },
  { id: "bed", kind: "music", label: "Music bed" },
  { id: "sting", kind: "sting", label: "Sting" },
];

/** Each track's channel colour, used the same way everywhere: the mixer's lamp and pan ring, the timeline's lamp
 *  and the transcript's speaker marks (a speaker takes the colour of the microphone they speak into). */
export const CHANNEL: Record<string, "blue" | "green" | "white" | "orange"> = {
  "mic-a": "blue",
  "mic-b": "green",
  bed: "white",
  sting: "orange",
};

/** A track's display name: its speaker's, or the synth's. */
export const trackName = (track: Track, speakerName: (id: string) => string) =>
  track.speaker ? speakerName(track.speaker) : track.kind === "music" ? "Synth pad" : "Synth bells";

/** The track a segment's clip is on: the microphone of the speaker who recorded it. */
export const trackOf = (segment: SegmentData) =>
  TRACKS.find((t) => t.speaker === segment.speaker)?.id ?? "mic-a";

export const sessionById = (id: string): SessionData | undefined =>
  SESSIONS.find((s) => s.id === id);

export const segmentById = (session: SessionData | undefined, id: string) =>
  session?.segments.find((s) => s.id === id);

/** The segment playing at `time`, or -1 in a pause between two. */
export function segmentIndexAt(session: SessionData, time: number): number {
  const segs = session.segments;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segs[mid]!;
    if (time < s.start) hi = mid - 1;
    else if (time >= s.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** The segment at or before `time`: where the transcript's reading place is during a pause. */
export function segmentIndexNear(session: SessionData, time: number): number {
  let at = 0;
  for (let i = 0; i < session.segments.length; i++) if (session.segments[i]!.start <= time) at = i;
  return at;
}

/** The word being spoken at `time` in `words`, or -1. */
export function wordIndexAt(words: readonly WordTime[], time: number): number {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (time >= w[1] && time < w[2]) return i;
  }
  return -1;
}

/** The last marker at or before `time`. */
export function markerIndexAt(markers: readonly MarkerData[], time: number): number {
  let at = -1;
  markers.forEach((m, i) => {
    if (m.time <= time + 0.05) at = i;
  });
  return at;
}

const weight = (w: string) =>
  w.replace(/[^\p{L}\p{N}]/gu, "").length +
  1.5 +
  (/[,;:]$/.test(w) ? 3 : 0) +
  (/[.?!]$/.test(w) ? 5 : 0);

/**
 * Word times for a segment's text. The recorded text keeps the generated times; a corrected text has no recording
 * of its own, so its words share the voiced part of the clip by their length, the same rule the generator starts from.
 */
export function wordsFor(segment: SegmentData, text: string): WordTime[] {
  if (text === segment.text) return segment.words;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const [start, end] = segment.voiced;
  const total = words.reduce((s, w) => s + weight(w), 0);
  let acc = 0;
  return words.map((w) => {
    const a = start + (acc / total) * (end - start);
    acc += weight(w);
    return [w, a, start + (acc / total) * (end - start)];
  });
}

/** "01:07" */
export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t + 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "01:07.4", for the transport and the selected range. */
export function clockTenths(t: number): string {
  const tenths = Math.max(0, Math.floor(t * 10 + 1e-6));
  return `${clock(tenths / 10)}.${tenths % 10}`;
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
