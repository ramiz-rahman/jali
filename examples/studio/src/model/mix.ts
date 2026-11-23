/**
 * The mix: each track's channel (fader, pan, mute, solo) and the rules for what is heard. The mixer sets it, the
 * engine plays it, the timeline dims what it silences.
 */
import { catalogueOf } from "../sessions/catalog";
import type { SessionId } from "../sessions/ids";

export interface Channel {
  /** The fader, in dB: `SILENCE_DB` (levels.ts) is silence. */
  gain: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  mute: boolean;
  solo: boolean;
}

/** A session's channels, by track id. Only the ones the person has moved are kept. */
export type Mix = Record<string, Channel>;

const CENTRED: Channel = { gain: 0, pan: 0, mute: false, solo: false };

/** A track's channel: as the person left it, else as the catalogue starts it, else at 0 dB, centred. */
export function channelOf(session: SessionId, mix: Mix, track: string): Channel {
  if (Object.hasOwn(mix, track)) return mix[track]!;
  const start = catalogueOf(session).mix[track];
  return start ? { ...CENTRED, ...start } : CENTRED;
}

/** Whether a track is heard: not muted, and soloed if any of the session's `tracks` is. */
export function audible(
  session: SessionId,
  mix: Mix,
  track: string,
  tracks: readonly { id: string }[],
): boolean {
  const ch = channelOf(session, mix, track);
  const anySolo = tracks.some((t) => channelOf(session, mix, t.id).solo);
  return !ch.mute && (!anySolo || ch.solo);
}
