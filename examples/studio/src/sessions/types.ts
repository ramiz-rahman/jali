/** A session as the generation script writes it (scripts/make-voices.mjs): the words, their times and the clips. */

export interface SpeakerData {
  id: string;
  name: string;
  role: string;
  /** The macOS system voice that read the part: a placeholder for a real recording. */
  voice: string;
}

/** One word and its time on the session's clock, in seconds. */
export type WordTime = [text: string, start: number, end: number];

export interface SegmentData {
  id: string;
  speaker: string;
  /** On the session's clock, in seconds. Exact: the clip's own length. */
  start: number;
  end: number;
  /** Where the clip is, relative to the page. */
  clip: string;
  /** The part of the clip with speech in it, on the session's clock. */
  voiced: [number, number];
  text: string;
  /** Interpolated across the voiced part. */
  words: WordTime[];
  /** The clip's envelope, 0 to 99, one value per 20 ms from the clip's start. */
  peaks: number[];
}

export interface MarkerData {
  id: string;
  time: number;
  label: string;
}

/** How the music bed is synthesised: the key's root (a MIDI note), the tempo and a timbre. */
export interface MusicData {
  root: number;
  tempo: number;
  colour: "warm" | "bright" | "dark";
}

export interface SessionData {
  id: string;
  show: string;
  episode: number;
  title: string;
  recorded: string;
  music: MusicData;
  speakers: SpeakerData[];
  /** When the first word starts, the outro sting and the end. */
  intro: number;
  outro: number;
  duration: number;
  segments: SegmentData[];
  markers: MarkerData[];
}
