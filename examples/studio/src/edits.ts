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
import { asString, isNumber, isRecord, recordOf } from "./stored";

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

const KEY = "studio:edits:v1";
/** Where they were kept before the key had a version: the same shape. */
const UNVERSIONED = "studio:edits";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A fader in dB, from silence (-60) to +6, as the fader can set it. */
const readGain = (v: unknown) => (isNumber(v) ? clamp(v, -60, 6) : undefined);

function readChannel(v: unknown): Channel | undefined {
  if (!isRecord(v)) return undefined;
  const gain = readGain(v.gain);
  const { pan, mute, solo } = v;
  if (
    gain === undefined ||
    !isNumber(pan) ||
    typeof mute !== "boolean" ||
    typeof solo !== "boolean"
  )
    return undefined;
  return { gain, pan: clamp(pan, -1, 1), mute, solo };
}

function readMarker(v: unknown): MarkerData | undefined {
  if (!isRecord(v)) return undefined;
  const { id, time, label } = v;
  return typeof id === "string" && isNumber(time) && time >= 0 && typeof label === "string"
    ? { id, time, label }
    : undefined;
}

/** One session's edits, field by field: a field of the wrong shape is the session's own (none), the rest kept. */
function readSessionEdits(v: unknown): SessionEdits {
  const e = isRecord(v) ? v : {};
  const markers = Array.isArray(e.markers) ? e.markers.map(readMarker) : null;
  return {
    corrections: recordOf(e.corrections, asString),
    speakerNames: recordOf(e.speakerNames, asString),
    segmentSpeaker: recordOf(e.segmentSpeaker, asString),
    notes: recordOf(e.notes, asString),
    // A list with one bad marker is no list the person made: the session's own come back.
    markers: markers?.every((m): m is MarkerData => m !== undefined)
      ? markers.sort((a, b) => a.time - b.time)
      : null,
    mix: recordOf(e.mix, readChannel),
    masterGain: readGain(e.masterGain) ?? 0,
  };
}

/** The edits kept on this device, checked: only sessions in the library, each read field by field. */
export const readEdits = (v: unknown): Record<string, SessionEdits> =>
  Object.fromEntries(
    Object.entries(recordOf(v, (e) => e))
      .filter(([id]) => Object.hasOwn(CATALOGUE, id))
      .map(([id, e]) => [id, readSessionEdits(e)]),
  );

export function createEdits(persist = true): Edits {
  const store = createStore<Readonly<Record<string, SessionEdits>>>(
    persist ? saved.readVersioned(KEY, UNVERSIONED, readEdits) : {},
  );
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const of = (session: string): SessionEdits => ({
    ...empty(),
    ...(Object.hasOwn(store.get(), session) ? store.get()[session] : undefined),
  });
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
