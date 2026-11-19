/**
 * The sessions and what the app derives from them: tracks, the segment or word at a time, and word times for a
 * corrected line. Plain functions of the bundled data, so pane titles, commands and tests can use them too.
 */
import apollo from "./data/apollo11-landing.json";
import dinner from "./data/dinner-party.json";
import song from "./data/light-caught-by-the-stone.json";
import { catalogueOf, PALETTE, type ChannelColour } from "./catalog";
import type { MarkerData, SegmentData, SessionData, TrackData, WordTime } from "./types";

/** The library, in its order: the landing first (the session a first visit opens on), then the song, then dinner. */
export const SESSIONS: readonly SessionData[] = [apollo, song, dinner] as unknown as SessionData[];

export type { MarkerData, SegmentData, SessionData, TrackData, WordTime };
export type Track = TrackData;

/** A session's tracks, in the order of its channel strips and lanes. */
export const tracksOf = (session: SessionData): readonly Track[] => session.tracks;

export const trackById = (session: SessionData, id: string) =>
  session.tracks.find((t) => t.id === id);

/** A track's channel colour, used the same way everywhere: the mixer's lamp and pan ring, the timeline's lamp and
 *  the transcript's speaker marks (a line takes the colour of the track it is heard on). */
export function colourOf(session: SessionData, track: string): ChannelColour {
  const set = catalogueOf(session).colours[track];
  if (set) return set;
  const i = session.tracks.findIndex((t) => t.id === track);
  return PALETTE[Math.max(0, i) % PALETTE.length]!;
}

/**
 * Who or what is on a track, for its scribble strip: the person wearing the microphone (a dinner guest); else the
 * people heard on it, by callsign where the transcript prints one ("CC · LMP · CDR"); else a song group's own name
 * ("Drums"); else that it has no transcript (the Flight Director's loop).
 */
export function trackName(
  track: Track,
  speakerName: (id: string) => string,
  session?: SessionData,
): string {
  if (track.speaker) return speakerName(track.speaker);
  if (session) {
    const heard = [
      ...new Set(session.segments.filter((s) => s.track === track.id).map((s) => s.speaker)),
    ];
    const people = heard.map((id) => session.speakers.find((p) => p.id === id));
    if (people.length && people.every((p) => p?.code)) return people.map((p) => p!.code).join(" · ");
    if (people.length) return heard.map(speakerName).join(", ");
  }
  if (track.stems?.length) return track.label;
  return "no transcript";
}

/** The input line of a scribble strip: the microphone or loop ("Close-talk P05"), or for a song's group the masters
 *  summed into it ("8 stems"). */
export const trackInput = (track: Track) =>
  track.stems?.length
    ? track.stems.length === 1
      ? "1 stem"
      : `${track.stems.length} stems`
    : track.label;

/** The track a segment is heard on. */
export const trackOf = (segment: SegmentData) => segment.track;

/** Whether a track has words in the transcript (the Flight Director's loop has none). */
export const hasTranscript = (session: SessionData, track: string) =>
  session.segments.some((s) => s.track === track);

export const sessionById = (id: string): SessionData | undefined =>
  SESSIONS.find((s) => s.id === id);

export const segmentById = (session: SessionData | undefined, id: string) =>
  session?.segments.find((s) => s.id === id);

/**
 * The segment playing at `time`, or -1 in a pause. Segments may overlap (people talk over each other at dinner): of
 * those under the playhead, the one that started last, which is the one a listener has just begun to hear.
 */
export function segmentIndexAt(session: SessionData, time: number): number {
  const at = segmentsAt(session, time);
  return at.length ? at[at.length - 1]! : -1;
}

/** Every segment playing at `time`, in the order they started. */
export function segmentsAt(session: SessionData, time: number): number[] {
  const segs = session.segments;
  const out: number[] = [];
  for (let i = 0; i < segs.length && segs[i]!.start <= time; i++)
    if (time < segs[i]!.end) out.push(i);
  return out;
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

/**
 * The mission clock at session time `t` ("GET 102:43:21"), for a session that has one (Apollo: time 0 is GET
 * 102:42:40); `null` for the others.
 */
export function missionTime(session: SessionData, t: number): string | null {
  const zero = session.clock?.get_at_zero;
  if (!zero) return null;
  const [h, m, sec] = zero.split(":").map(Number) as [number, number, number];
  const all = h * 3600 + m * 60 + sec + Math.max(0, Math.floor(t + 1e-6));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(all / 3600)}:${pad(Math.floor(all / 60) % 60)}:${pad(all % 60)}`;
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
