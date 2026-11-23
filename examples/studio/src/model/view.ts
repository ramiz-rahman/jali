/**
 * A session with the person's changes applied: what every pane shows, and the one way panes change it. Plain: the
 * hooks that keep it up to date are in react.ts.
 */
import { trackName, wordsFor } from "../sessions/derive";
import type { MarkerData, SegmentData, SessionData, TrackData, WordTime } from "../sessions/types";
import type { Edits, SessionEditor, SessionEdits } from "./edits";
import { markersOf } from "./markers";
import { audible, channelOf, type Channel } from "./mix";

export interface SessionView {
  session: SessionData;
  edits: SessionEdits;
  /** The session's changes: `view.edit.renameSpeaker(…)`. */
  edit: SessionEditor;
  /** The person's markers, else the session's own, in time order. */
  markers: MarkerData[];
  speakerName(speaker: string): string;
  /** A callsign as the transcript prints it (CDR, CC), for a speaker that has one. */
  speakerCode(speaker: string): string | undefined;
  /** Who says a segment: its attribution, else its microphone's speaker. */
  speakerOf(segment: SegmentData): string;
  /** The saved text: a correction, else what was recorded. */
  textOf(segment: SegmentData): string;
  /** Whether the saved text is a correction. */
  isCorrected(segment: SegmentData): boolean;
  /** Word times for `text` (default: the saved text), kept per text. */
  wordsOf(segment: SegmentData, text?: string): WordTime[];
  channel(track: string): Channel;
  /** Whether the mix lets the track be heard (mute, solo). */
  heard(track: string): boolean;
  /** Who or what is on a track, for its scribble strip. */
  trackName(track: TrackData): string;
}

export function viewOf(
  session: SessionData,
  edits: SessionEdits,
  edit: SessionEditor,
): SessionView {
  const byText = new Map<string, WordTime[]>();
  const speaker = (id: string) => session.speakers.find((s) => s.id === id);
  const speakerName = (id: string) => edits.speakerNames[id] || speaker(id)?.name || id;
  const textOf = (seg: SegmentData) => edits.corrections[seg.id] ?? seg.text;
  return {
    session,
    edits,
    edit,
    markers: markersOf(session, edits),
    speakerName,
    speakerCode: (id) => speaker(id)?.code,
    speakerOf: (seg) => edits.segmentSpeaker[seg.id] ?? seg.speaker,
    textOf,
    isCorrected: (seg) => Object.hasOwn(edits.corrections, seg.id),
    wordsOf(seg, text = textOf(seg)) {
      const key = `${seg.id}\n${text}`;
      let w = byText.get(key);
      if (!w) byText.set(key, (w = wordsFor(seg, text)));
      return w;
    },
    channel: (track) => channelOf(session.id, edits.mix, track),
    heard: (track) => audible(session.id, edits.mix, track, session.tracks),
    trackName: (track) => trackName(session, track, speakerName),
  };
}

/** The view of `session` now, for a command: it reads the edits once. */
export const viewNow = (edits: Edits, session: SessionData) =>
  viewOf(session, edits.of(session.id), edits.session(session));
