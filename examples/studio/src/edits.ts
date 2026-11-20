/**
 * What the person has changed in each session, saved on this device: corrected lines, speaker names and attributions,
 * notes on segments, markers, and the mix. This is the app's state, beside Jali's. A pane keeps a draft of its own
 * (`usePaneState`) and writes here when the person saves; everything else is written here at once.
 */
import { useMemo } from "react";
import { CATALOGUE } from "./sessions/catalog";
import {
  sessionById,
  wordsFor,
  type MarkerData,
  type SegmentData,
  type SessionData,
  type WordTime,
} from "./sessions/sessions";
import { createStore, saved, useStore, type Store } from "./store";

export interface Channel {
  /** The fader, in dB: -60 is silence. */
  gain: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface SessionEdits {
  corrections: Record<string, string>;
  speakerNames: Record<string, string>;
  /** A segment said by someone else than its microphone's speaker: a correction of the attribution, not the audio. */
  segmentSpeaker: Record<string, string>;
  notes: Record<string, string>;
  /** `null` until the person changes them: the session's own markers. */
  markers: MarkerData[] | null;
  mix: Record<string, Channel>;
  masterGain: number;
}

/** Each track's starting fader and pan, from the catalogue. Track ids are unique across the library, so one map
 *  serves every session; a track it doesn't name starts at 0 dB, centred. */
export const DEFAULT_CHANNEL: Record<string, Channel> = Object.fromEntries(
  Object.values(CATALOGUE).flatMap((c) =>
    Object.entries(c.mix).map(([id, m]) => [id, { ...m, mute: false, solo: false }]),
  ),
);

const empty = (): SessionEdits => ({
  corrections: {},
  speakerNames: {},
  segmentSpeaker: {},
  notes: {},
  markers: null,
  mix: {},
  masterGain: 0,
});

export type Edits = Store<Readonly<Record<string, SessionEdits>>> & {
  of(session: string): SessionEdits;
  saveCorrections(session: string, corrections: Record<string, string>): void;
  renameSpeaker(session: string, speaker: string, name: string): void;
  setSegmentSpeaker(session: string, segment: string, speaker: string): void;
  saveNote(session: string, segment: string, note: string): void;
  addMarker(session: string, time: number, label?: string): MarkerData;
  renameMarker(session: string, id: string, label: string): void;
  removeMarker(session: string, id: string): void;
  /** Put a removed marker back as it was. */
  restoreMarker(session: string, marker: MarkerData): void;
  /** Back to the markers the session came with. */
  resetMarkers(session: string): void;
  setChannel(session: string, track: string, patch: Partial<Channel>): void;
  setMasterGain(session: string, gain: number): void;
  resetMix(session: string): void;
};

const KEY = "studio:edits";

export function createEdits(persist = true): Edits {
  const store = createStore<Readonly<Record<string, SessionEdits>>>(
    persist ? saved.read<Record<string, SessionEdits>>(KEY, {}) : {},
  );
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const of = (session: string): SessionEdits => ({ ...empty(), ...store.get()[session] });
  const change = (session: string, fn: (e: SessionEdits) => Partial<SessionEdits>) =>
    store.set((all) => ({ ...all, [session]: { ...of(session), ...fn(of(session)) } }));
  const markersOf = (session: string) => of(session).markers ?? sessionById(session)?.markers ?? [];
  let made = 0;

  return {
    ...store,
    of,
    saveCorrections: (session, corrections) =>
      change(session, (e) => {
        const next = { ...e.corrections, ...corrections };
        // A line put back as it was recorded is no correction.
        const original = sessionById(session)?.segments ?? [];
        for (const s of original) if (next[s.id] === s.text) delete next[s.id];
        return { corrections: next };
      }),
    renameSpeaker: (session, speaker, name) =>
      change(session, (e) => ({ speakerNames: { ...e.speakerNames, [speaker]: name.trim() } })),
    setSegmentSpeaker: (session, segment, speaker) =>
      change(session, (e) => ({ segmentSpeaker: { ...e.segmentSpeaker, [segment]: speaker } })),
    saveNote: (session, segment, note) =>
      change(session, (e) => {
        const notes = { ...e.notes };
        if (note.trim()) notes[segment] = note;
        else delete notes[segment];
        return { notes };
      }),
    addMarker(session, time, label) {
      const marker = {
        id: `u${Date.now().toString(36)}${(made++).toString(36)}`,
        time: Math.round(time * 10) / 10,
        label: label ?? "Marker",
      };
      change(session, () => ({
        markers: [...markersOf(session), marker].sort((a, b) => a.time - b.time),
      }));
      return marker;
    },
    renameMarker: (session, id, label) =>
      change(session, () => ({
        markers: markersOf(session).map((m) => (m.id === id ? { ...m, label } : m)),
      })),
    removeMarker: (session, id) =>
      change(session, () => ({ markers: markersOf(session).filter((m) => m.id !== id) })),
    restoreMarker: (session, marker) =>
      change(session, () => ({
        markers: [...markersOf(session).filter((m) => m.id !== marker.id), marker].sort(
          (a, b) => a.time - b.time,
        ),
      })),
    resetMarkers: (session) => change(session, () => ({ markers: null })),
    setChannel: (session, track, patch) =>
      change(session, (e) => ({
        mix: { ...e.mix, [track]: { ...channelOf(e, track), ...patch } },
      })),
    setMasterGain: (session, gain) => change(session, () => ({ masterGain: gain })),
    resetMix: (session) => change(session, () => ({ mix: {}, masterGain: 0 })),
  };
}

export const channelOf = (e: SessionEdits, track: string): Channel =>
  e.mix[track] ?? DEFAULT_CHANNEL[track] ?? { gain: 0, pan: 0, mute: false, solo: false };

/** Whether a track is heard: not muted, and soloed if anything is (among the session's `tracks`). */
export function audible(
  e: SessionEdits,
  track: string,
  tracks: readonly { id: string }[],
): boolean {
  const ch = channelOf(e, track);
  const anySolo = tracks.some((t) => channelOf(e, t.id).solo);
  return !ch.mute && (!anySolo || ch.solo);
}

/** A session with the person's changes applied: what every pane shows. */
export interface SessionView {
  session: SessionData;
  edits: SessionEdits;
  speakerName(speaker: string): string;
  /** Who says a segment: its attribution, else its microphone's speaker. */
  speakerOf(segment: SegmentData): string;
  /** The saved text: a correction, else what was recorded. */
  textOf(segment: SegmentData): string;
  wordsOf(segment: SegmentData, text?: string): WordTime[];
  markers: MarkerData[];
}

export function viewOf(session: SessionData, edits: SessionEdits): SessionView {
  const byText = new Map<string, WordTime[]>();
  return {
    session,
    edits,
    speakerName: (id) =>
      edits.speakerNames[id] || session.speakers.find((s) => s.id === id)?.name || id,
    speakerOf: (seg) => edits.segmentSpeaker[seg.id] ?? seg.speaker,
    textOf: (seg) => edits.corrections[seg.id] ?? seg.text,
    wordsOf(seg, text = edits.corrections[seg.id] ?? seg.text) {
      const key = `${seg.id}\n${text}`;
      let w = byText.get(key);
      if (!w) byText.set(key, (w = wordsFor(seg, text)));
      return w;
    },
    markers: edits.markers ?? session.markers,
  };
}

/** The session with its edits, kept up to date. `undefined` for a session that doesn't exist. */
export function useSessionView(edits: Edits, id: string): SessionView | undefined {
  const mine = useStore(edits, (all) => all[id]);
  return useMemo(() => {
    const session = sessionById(id);
    return session ? viewOf(session, { ...empty(), ...mine }) : undefined;
  }, [id, mine]);
}
