/**
 * What the app derives from a session's data: its tracks' names, colours and envelopes, the segment or word at a time,
 * and word times for a corrected line. Plain functions of the delivered data, so commands and tests use them too.
 */
import { catalogueOf, PALETTE, type ChannelColour } from "./catalog";
import type { SegmentData, SessionData, TrackData, WordTime } from "./types";

export const trackById = (session: SessionData, id: string) =>
  session.tracks.find((t) => t.id === id);

export const segmentById = (session: SessionData, id: string) =>
  session.segments.find((s) => s.id === id);

/** A track's channel colour, used the same way everywhere: the mixer's lamp and pan ring, the timeline's lamp and
 *  the transcript's speaker marks (a line takes the colour of the track it is heard on). */
export function colourOf(session: SessionData, track: string): ChannelColour {
  const set = catalogueOf(session).colours[track];
  if (set) return set;
  const i = session.tracks.findIndex((t) => t.id === track);
  return PALETTE[Math.max(0, i) % PALETTE.length]!;
}

/** A track's loudness over time, for drawing: 0 to 1 (delivered as 0 to 99, one scale for every track of a session). */
export interface Envelope {
  peaks: Float32Array;
  /** Values per second of the session's clock. */
  perSecond: number;
  /** The loudest value, so a quiet track can be scaled up to its box. */
  loudest: number;
}

/** The delivered envelopes have one value per 20 ms. */
const PEAKS_PER_SECOND = 50;

const envelopeFrom = (peaks: Float32Array): Envelope => ({
  peaks,
  perSecond: PEAKS_PER_SECOND,
  loudest: peaks.reduce((m, v) => Math.max(m, v), 0) || 1,
});

const envelopes = new WeakMap<object, Envelope>();
const remember = (key: object, make: () => Envelope) => {
  let e = envelopes.get(key);
  if (!e) envelopes.set(key, (e = make()));
  return e;
};

/** A track's envelope across the whole session, made once. */
export const envelopeOf = (track: TrackData): Envelope =>
  remember(track, () => envelopeFrom(Float32Array.from(track.peaks, (v) => v / 99)));

/** The whole session in one envelope, the loudest track at each moment: the library's thumbnails. Made once. */
export const overviewOf = (session: SessionData): Envelope =>
  remember(session, () => {
    const all = session.tracks.map((t) => envelopeOf(t).peaks);
    const out = new Float32Array(Math.max(0, ...all.map((a) => a.length)));
    for (const a of all) for (let i = 0; i < a.length; i++) out[i] = Math.max(out[i]!, a[i]!);
    return envelopeFrom(out);
  });

/** Whether a track has words in the transcript (the Flight Director's loop has none). */
export const hasTranscript = (session: SessionData, track: string) =>
  session.segments.some((s) => s.track === track);

/**
 * Who or what is on a track, for its scribble strip: the person wearing the microphone (a dinner guest); else a song
 * group's own name ("Drums"); else the people heard on it, by callsign where the transcript prints one
 * ("CC · LMP · CDR"); else that it has no transcript (the Flight Director's loop).
 */
export function trackName(
  session: SessionData,
  track: TrackData,
  speakerName: (id: string) => string,
): string {
  if (track.speaker) return speakerName(track.speaker);
  if (track.stems?.length) return track.label;
  const heard = [
    ...new Set(session.segments.filter((s) => s.track === track.id).map((s) => s.speaker)),
  ];
  if (!heard.length) return "no transcript";
  const codes = heard.map((id) => session.speakers.find((p) => p.id === id)?.code);
  return codes.every((c) => c) ? codes.join(" · ") : heard.map(speakerName).join(", ");
}

/** The input line of a scribble strip: the microphone or loop ("Close-talk P05"), or for a song's group the masters
 *  summed into it ("8 stems"). */
export function trackInput(track: TrackData): string {
  const n = track.stems?.length;
  if (!n) return track.label;
  return n === 1 ? "1 stem" : `${n} stems`;
}

/** Every segment playing at `time`, in the order they started. */
export function segmentsAt(session: SessionData, time: number): number[] {
  const segs = session.segments;
  const out: number[] = [];
  for (let i = 0; i < segs.length && segs[i]!.start <= time; i++)
    if (time < segs[i]!.end) out.push(i);
  return out;
}

/**
 * The segment playing at `time`, or -1 in a pause. Segments may overlap (people talk over each other at dinner): of
 * those under the playhead, the one that started last, which is the one a listener has just begun to hear.
 */
export function segmentIndexAt(session: SessionData, time: number): number {
  return segmentsAt(session, time).at(-1) ?? -1;
}

/** The segment at or before `time`: where the transcript's reading place is during a pause. */
export function segmentIndexNear(session: SessionData, time: number): number {
  let at = 0;
  session.segments.forEach((s, i) => {
    if (s.start <= time) at = i;
  });
  return at;
}

/** The segment `time` is in, else the next one, else the last: what "loop the segment playing" loops. */
export const segmentForLoop = (session: SessionData, time: number): SegmentData =>
  session.segments.find((s) => time < s.end) ?? session.segments.at(-1)!;

/** The word being spoken at `time` in `words`, or -1. */
export function wordIndexAt(words: readonly WordTime[], time: number): number {
  return words.findIndex((w) => time >= w[1] && time < w[2]);
}

/** A token nobody speaks ("[laugh]", "[noise]"): printed as a quiet note, never lit as it plays. */
export const isSound = (word: string) => /^\[.*\]$/.test(word);

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
