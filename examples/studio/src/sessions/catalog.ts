/**
 * What the app says about each session beyond its data: the kind of material, the words its panes use, a short
 * source line for the library, its licence and the credit to show, each track's channel colour and its starting mix.
 * The credit lines are the ones CREDITS.md settles on; the data's own `credits` stay as delivered.
 */
import type { SessionData } from "./types";

/** Radio traffic with callsigns, a song with its words, or people talking over each other. */
export type Material = "radio" | "song" | "conversation";

/** Eight channel colours, so a session of eight tracks has eight distinct strips. */
export type ChannelColour =
  | "blue"
  | "green"
  | "white"
  | "orange"
  | "violet"
  | "yellow"
  | "cyan"
  | "rose";
export const PALETTE: readonly ChannelColour[] = [
  "blue",
  "green",
  "white",
  "orange",
  "violet",
  "yellow",
  "cyan",
  "rose",
];

export interface Licence {
  name: string;
  /** For a cartridge's tag. */
  short: string;
  url: string;
}

export interface Catalogue {
  /** What the library and every pane title show before the session's data has loaded: its title, running time in
   *  seconds and number of tracks, as in its data (sessions.test.ts checks they agree). */
  title: string;
  duration: number;
  tracks: number;
  material: Material;
  /** Under the title in the library: who made it and when. */
  source: string;
  licence: Licence;
  /** The attribution to display, as CREDITS.md words it. */
  credit: string;
  /** The same in a few words, for the status line: what a licence asks to be seen first. */
  short: string;
  /** A notice the licence asks for: files changed (CDLA 3.1(b)). */
  notice?: string;
  /** The transcript pane's name, and what one of its rows is called. */
  words: { transcript: string; segment: string; segments: string };
  colours: Record<string, ChannelColour>;
  mix: Record<string, { gain: number; pan: number }>;
}

export const CATALOGUE: Record<string, Catalogue> = {
  "apollo11-landing": {
    title: "The Eagle has landed",
    duration: 213,
    tracks: 3,
    material: "radio",
    source: "NASA · 20 July 1969",
    licence: {
      name: "Public domain (Public Domain Mark 1.0)",
      short: "Public domain",
      url: "https://creativecommons.org/publicdomain/mark/1.0/",
    },
    credit:
      "Apollo 11 audio and transcripts: NASA (Johnson Space Center, Houston Audio Control Room), via the Internet Archive (archive.org/details/Apollo11Audio). Public domain. Use does not imply endorsement by NASA.",
    short: "Audio: NASA, via the Internet Archive. Public domain. No endorsement by NASA implied.",
    words: { transcript: "Transcript", segment: "segment", segments: "segments" },
    colours: { "air-ground": "blue", "flight-loop": "white", pao: "green" },
    mix: {
      "air-ground": { gain: 0, pan: 0 },
      "flight-loop": { gain: -6, pan: -0.35 },
      // The commentary carries the air-to-ground loop as well: kept low, it adds the commentator without doubling.
      pao: { gain: -12, pan: 0.35 },
    },
  },
  "light-caught-by-the-stone": {
    title: "The Light caught by the Stone",
    duration: 146.441,
    tracks: 8,
    material: "song",
    source: "Awe Plant · Pablo C. Budassi · 2016",
    licence: {
      name: "Creative Commons Attribution 4.0 (CC BY 4.0)",
      short: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
    },
    credit:
      "“The Light caught by the Stone” by Pablo Carlos Budassi / Awe Plant, performed by Nueve Millas. Licensed CC BY 4.0 (creativecommons.org/licenses/by/4.0). Source: archive.org/details/thelightmasters. Excerpt, stems grouped and re-encoded.",
    short:
      "“The Light caught by the Stone”, Pablo C. Budassi / Awe Plant, CC BY 4.0. Excerpt, stems grouped.",
    words: { transcript: "Lyrics", segment: "line", segments: "lines" },
    colours: {
      drums: "white",
      bass: "violet",
      guitars: "yellow",
      keys: "cyan",
      horns: "orange",
      vox1: "blue",
      vox2: "green",
      chorus: "rose",
    },
    // The masters are raw and bass-heavy: a starting balance, spread across the field.
    mix: {
      drums: { gain: 0, pan: 0 },
      bass: { gain: -6, pan: 0 },
      guitars: { gain: 2, pan: 0.45 },
      keys: { gain: 0, pan: -0.45 },
      horns: { gain: 0, pan: 0.25 },
      vox1: { gain: 3, pan: -0.1 },
      vox2: { gain: 3, pan: 0.1 },
      chorus: { gain: 0, pan: -0.25 },
    },
  },
  "dinner-party": {
    title: "Never had an orange",
    duration: 127.5,
    tracks: 4,
    material: "conversation",
    source: "DiPCo · Amazon · session S02",
    licence: {
      name: "Community Data License Agreement, Permissive 1.0 (CDLA-Permissive-1.0)",
      short: "CDLA-P 1.0",
      url: "https://cdla.dev/permissive-1-0/",
    },
    credit:
      "Conversation audio and transcript: DiPCo, Dinner Party Corpus, Amazon (zenodo.org/record/8122551), licensed under the Community Data License Agreement, Permissive 1.0 (cdla.dev/permissive-1-0).",
    notice:
      "These files are modified from the original data: excerpted, filtered, gated, levelled and re-encoded.",
    short: "Modified from DiPCo (Amazon). CDLA-Permissive 1.0.",
    words: { transcript: "Transcript", segment: "segment", segments: "segments" },
    colours: { p05: "blue", p06: "green", p07: "yellow", p08: "violet" },
    // Around the table, left to right.
    mix: {
      p05: { gain: 0, pan: -0.45 },
      p06: { gain: 0, pan: -0.15 },
      p07: { gain: 0, pan: 0.15 },
      p08: { gain: 0, pan: 0.45 },
    },
  },
};

const FALLBACK: Catalogue = {
  title: "",
  duration: 0,
  tracks: 0,
  material: "radio",
  source: "",
  licence: { name: "", short: "", url: "" },
  credit: "",
  short: "",
  words: { transcript: "Transcript", segment: "segment", segments: "segments" },
  colours: {},
  mix: {},
};

/** A link can name anything: only the catalogue's own entries count, never a name from Object.prototype. */
const own = <T>(r: Record<string, T>, k: string): T | undefined =>
  Object.hasOwn(r, k) ? r[k] : undefined;

export const catalogueOf = (session: SessionData | string): Catalogue =>
  own(CATALOGUE, typeof session === "string" ? session : session.id) ?? FALLBACK;
