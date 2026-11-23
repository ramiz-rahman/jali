/**
 * The edits as they come back from storage, checked field by field: only sessions in the library, and in each, a
 * field of the wrong shape is the session's own (none) while the rest is kept.
 */
import { finite, isRecord, text } from "@jali-examples/shared/store";
import { MAX_DB, SILENCE_DB } from "../ui/lib/levels";
import { clamp } from "../ui/lib/numbers";
import { isSession } from "../sessions/ids";
import type { MarkerData } from "../sessions/types";
import { recordOf } from "../storage";
import type { AllEdits, SessionEdits } from "./edits";
import { byTime } from "./markers";
import type { Channel } from "./mix";

/** A fader in dB, brought onto its travel. */
const readGain = (v: unknown) => {
  const n = finite(v);
  return n === undefined ? undefined : clamp(n, SILENCE_DB, MAX_DB);
};

function readChannel(v: unknown): Channel | undefined {
  if (!isRecord(v)) return undefined;
  const gain = readGain(v.gain);
  const pan = finite(v.pan);
  const { mute, solo } = v;
  if (
    gain === undefined ||
    pan === undefined ||
    typeof mute !== "boolean" ||
    typeof solo !== "boolean"
  )
    return undefined;
  return { gain, pan: clamp(pan, -1, 1), mute, solo };
}

function readMarker(v: unknown): MarkerData | undefined {
  if (!isRecord(v)) return undefined;
  const { id, label } = v;
  const time = finite(v.time);
  return typeof id === "string" && time !== undefined && time >= 0 && typeof label === "string"
    ? { id, time, label }
    : undefined;
}

/** A list with one bad marker is no list the person made: `null`, and the session's own come back. */
function readMarkers(v: unknown): MarkerData[] | null {
  if (!Array.isArray(v)) return null;
  const markers = v.map(readMarker);
  return markers.every((m): m is MarkerData => m !== undefined) ? byTime(markers) : null;
}

function readSessionEdits(v: unknown): SessionEdits {
  const e = isRecord(v) ? v : {};
  return {
    corrections: recordOf(e.corrections, text),
    speakerNames: recordOf(e.speakerNames, text),
    segmentSpeaker: recordOf(e.segmentSpeaker, text),
    notes: recordOf(e.notes, text),
    markers: readMarkers(e.markers),
    mix: recordOf(e.mix, readChannel),
    masterGain: readGain(e.masterGain) ?? 0,
  };
}

/** The edits kept on this device, checked. */
export const readEdits = (v: unknown): AllEdits =>
  Object.fromEntries(
    Object.entries(recordOf(v, (e) => e))
      .filter(([id]) => isSession(id))
      .map(([id, e]) => [id, readSessionEdits(e)]),
  );
