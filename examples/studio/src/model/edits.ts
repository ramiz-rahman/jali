/**
 * What the person has changed in each session, saved on this device: corrected lines, speaker names and attributions,
 * notes on segments, markers, and the mix. This is the app's state, beside Jali's. A pane keeps a draft of its own
 * (`usePaneState`) and writes here when the person saves; everything else is written here at once.
 *
 * Every change is to one session, so changes go through that session's editor, made from its data:
 * `edits.session(data).addMarker(t)`. The data is what each change is checked against (a line put back as recorded,
 * the tracks a mute clears), so an editor never depends on what happens to have loaded.
 */
import { createStore, type Store } from "@jali-examples/shared/store";
import type { SessionId } from "../sessions/ids";
import type { MarkerData, SessionData } from "../sessions/types";
import { saved } from "../storage";
import { markersOf, withMarker } from "./markers";
import { channelOf, type Channel, type Mix } from "./mix";
import { readEdits } from "./read";

export interface SessionEdits {
  corrections: Record<string, string>;
  speakerNames: Record<string, string>;
  /** A segment said by someone else than its microphone's speaker: a correction of the attribution, not the audio. */
  segmentSpeaker: Record<string, string>;
  notes: Record<string, string>;
  /** `null` until the person changes them: the session's own markers. */
  markers: MarkerData[] | null;
  mix: Mix;
  masterGain: number;
}

/** Every session's edits, by id: a session nobody has changed has none. */
export type AllEdits = Readonly<Partial<Record<SessionId, SessionEdits>>>;

/** A session nobody has changed. */
const NO_EDITS: SessionEdits = {
  corrections: {},
  speakerNames: {},
  segmentSpeaker: {},
  notes: {},
  markers: null,
  mix: {},
  masterGain: 0,
};

/** A session's edits as kept, or none: always a whole `SessionEdits`. */
export const editsOrNone = (kept: SessionEdits | undefined): SessionEdits =>
  kept ? { ...NO_EDITS, ...kept } : NO_EDITS;

/** The changes one session can take. */
export interface SessionEditor {
  /** Corrected lines, by segment id; a line put back as it was recorded is no correction. */
  saveCorrections(corrections: Record<string, string>): void;
  renameSpeaker(speaker: string, name: string): void;
  setSegmentSpeaker(segment: string, speaker: string): void;
  /** An empty note removes the segment's note. */
  saveNote(segment: string, note: string): void;
  addMarker(time: number, label?: string): MarkerData;
  renameMarker(id: string, label: string): void;
  removeMarker(id: string): void;
  /** Put a removed marker back as it was. */
  restoreMarker(marker: MarkerData): void;
  /** Back to the markers the session came with. */
  resetMarkers(): void;
  setChannel(track: string, patch: Partial<Channel>): void;
  setMasterGain(gain: number): void;
  /** Every fader, pan, mute and solo back to the session's start. */
  resetMix(): void;
  /** No track muted or soloed; faders and pans stay. */
  clearMuteSolo(): void;
}

export type Edits = Store<AllEdits> & {
  /** One session's edits; a session nobody has changed has none. */
  of(session: SessionId): SessionEdits;
  /** The editor of one session, checked against its data. */
  session(data: SessionData): SessionEditor;
};

const KEY = "studio:edits:v1";
/** Where they were kept before the key had a version: the same shape. */
const UNVERSIONED = "studio:edits";

export function createEdits(persist = true): Edits {
  const store = createStore<AllEdits>(
    persist ? saved.readVersioned(KEY, UNVERSIONED, readEdits) : {},
  );
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  let made = 0;

  const of = (session: SessionId) => editsOrNone(store.get()[session]);

  function session(data: SessionData): SessionEditor {
    const { id } = data;
    const change = (fn: (e: SessionEdits) => Partial<SessionEdits>) =>
      store.set((all) => ({ ...all, [id]: { ...of(id), ...fn(of(id)) } }));
    const channel = (e: SessionEdits, track: string) => channelOf(id, e.mix, track);
    return {
      saveCorrections: (corrections) =>
        change((e) => {
          const next = { ...e.corrections, ...corrections };
          for (const s of data.segments) if (next[s.id] === s.text) delete next[s.id];
          return { corrections: next };
        }),
      renameSpeaker: (speaker, name) =>
        change((e) => ({ speakerNames: { ...e.speakerNames, [speaker]: name.trim() } })),
      setSegmentSpeaker: (segment, speaker) =>
        change((e) => ({ segmentSpeaker: { ...e.segmentSpeaker, [segment]: speaker } })),
      saveNote: (segment, note) =>
        change((e) => {
          const notes = { ...e.notes };
          if (note.trim()) notes[segment] = note;
          else delete notes[segment];
          return { notes };
        }),
      addMarker(time, label = "Marker") {
        const marker = {
          id: `u${Date.now().toString(36)}${(made++).toString(36)}`,
          time: Math.round(time * 10) / 10,
          label,
        };
        change((e) => ({ markers: withMarker(markersOf(data, e), marker) }));
        return marker;
      },
      renameMarker: (marker, label) =>
        change((e) => ({
          markers: markersOf(data, e).map((m) => (m.id === marker ? { ...m, label } : m)),
        })),
      removeMarker: (marker) =>
        change((e) => ({ markers: markersOf(data, e).filter((m) => m.id !== marker) })),
      restoreMarker: (marker) =>
        change((e) => ({ markers: withMarker(markersOf(data, e), marker) })),
      resetMarkers: () => change(() => ({ markers: null })),
      setChannel: (track, patch) =>
        change((e) => ({ mix: { ...e.mix, [track]: { ...channel(e, track), ...patch } } })),
      setMasterGain: (gain) => change(() => ({ masterGain: gain })),
      resetMix: () => change(() => ({ mix: {}, masterGain: 0 })),
      clearMuteSolo: () =>
        change((e) => ({
          mix: Object.fromEntries(
            data.tracks.map((t) => [t.id, { ...channel(e, t.id), mute: false, solo: false }]),
          ),
        })),
    };
  }

  return { ...store, of, session };
}
