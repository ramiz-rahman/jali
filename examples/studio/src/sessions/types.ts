/**
 * A session as it is delivered (src/sessions/data/<id>.json, built by scripts/audio/): its tracks, the words and
 * their times, markers and credits. Every track is one continuous file that starts at session time 0, and all of a
 * session's tracks have the same length.
 */
import type { SessionId } from "./ids";

export interface SpeakerData {
  id: string;
  name: string;
  role: string;
  /** A callsign as the transcript prints it: Apollo's CDR, LMP, CC, PAO. */
  code?: string;
}

/** One word and its time on the session's clock, in seconds. A token nobody speaks ("[laugh]", "...") has no length. */
export type WordTime = [text: string, start: number, end: number];

export interface TrackData {
  id: string;
  kind: "voice" | "music";
  /** The input: "Air-to-ground", "Close-talk P05", "Drums". */
  label: string;
  /** The person on this microphone, when there is one. */
  speaker?: string;
  /** Relative to the page. */
  file: string;
  channels: number;
  sampleRate: number;
  /** The whole track's envelope, 0 to 99, one value per 20 ms. One scale for every track of the session. */
  peaks: number[];
  /** Where the audio came from (a tape's channel). */
  source?: string;
  /** The masters summed into this track. */
  stems?: string[];
}

export interface SegmentData {
  id: string;
  speaker: string;
  /** The track it is heard on. */
  track: string;
  /** On the session's clock, in seconds: the first spoken word's start to the last one's end. */
  start: number;
  end: number;
  /** The part with speech in it, on the session's clock. */
  voiced: [number, number];
  text: string;
  /** The text token by token, with times. */
  words: WordTime[];
  /** The track's envelope from `start` to `end`. */
  peaks: number[];
  /** Where a line was printed (Apollo: the transcript and its GET). */
  source?: { transcript?: string; get?: string };
}

export interface MarkerData {
  id: string;
  time: number;
  label: string;
}

export interface CreditsData {
  /** One line, for wherever the session is shown. */
  line: string;
  sources: string[];
  license: string;
  /** The notice that the files were changed, where the licence asks for one. */
  modified?: string;
}

export interface SessionData {
  id: SessionId;
  /** Kept by the build (scripts/audio/); the app shows the catalogue's source line instead (catalog.ts). */
  show: string;
  episode: number;
  title: string;
  recorded: string;
  speakers: SpeakerData[];
  /** When the first word starts, and the end. */
  intro: number;
  outro: number;
  duration: number;
  tracks: TrackData[];
  segments: SegmentData[];
  markers: MarkerData[];
  credits: CreditsData;
  /** A mission clock: session time 0 is this GET ("102:42:40"). */
  clock?: { get_at_zero: string; note?: string };
  /** Where a song's words came from. */
  lyricsSource?: string;
}
