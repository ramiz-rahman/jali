/**
 * The delivered sessions, checked against the types and against each other: every track the same length, words
 * inside their segments and spelling the text, every reference to a track or a speaker real, credits present, and the
 * catalogue covering every track with a distinct colour. Plus the helpers that read them, overlaps included.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { catalogueOf, CATALOGUE, PALETTE } from "./catalog";
import { segmentIndexAt, segmentsAt, trackInput, trackName } from "./derive";
import { missionTime } from "./format";
import { loadSessions } from "./load";

// Loaded as the app loads them, one chunk each (load.ts).
const SESSIONS = await loadSessions();

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../../public");
const at = (file: string) => join(PUBLIC, file);
const PEAKS = 50;

describe("every session", () => {
  it("has its title, running time and track count in the catalogue, for before its data loads", () => {
    for (const s of SESSIONS) {
      const c = catalogueOf(s);
      expect([c.title, c.duration, c.tracks]).toEqual([s.title, s.duration, s.tracks.length]);
    }
  });

  it("is the three the library shows, Apollo first", () => {
    expect(SESSIONS.map((s) => s.id)).toEqual([
      "apollo11-landing",
      "light-caught-by-the-stone",
      "dinner-party",
    ]);
    expect(SESSIONS.map((s) => s.tracks.length)).toEqual([3, 8, 4]);
  });

  for (const s of SESSIONS) {
    describe(s.id, () => {
      it("has tracks of one length, each a file that is there", () => {
        expect(s.duration).toBeGreaterThan(60);
        const ids = s.tracks.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const t of s.tracks) {
          expect(t.kind === "voice" || t.kind === "music", t.id).toBe(true);
          expect(t.file, t.id).toBe(`audio/${s.id}/${t.id}.mp3`);
          expect(existsSync(at(t.file)), t.file).toBe(true);
          // One envelope value per 20 ms, across the whole session.
          expect(Math.abs(t.peaks.length - s.duration * PEAKS), t.id).toBeLessThanOrEqual(1);
          expect(
            t.peaks.every((v) => v >= 0 && v <= 99),
            t.id,
          ).toBe(true);
          if (t.speaker)
            expect(
              s.speakers.some((p) => p.id === t.speaker),
              t.id,
            ).toBe(true);
        }
      });

      it("has segments in start order, on real tracks, by real speakers, with words inside them", () => {
        expect(s.segments.length).toBeGreaterThan(10);
        s.segments.forEach((seg, i) => {
          const where = `${s.id}/${seg.id}`;
          if (i) expect(seg.start, where).toBeGreaterThanOrEqual(s.segments[i - 1]!.start);
          expect(
            s.tracks.some((t) => t.id === seg.track),
            where,
          ).toBe(true);
          expect(
            s.speakers.some((p) => p.id === seg.speaker),
            where,
          ).toBe(true);
          expect(seg.start, where).toBeLessThan(seg.end);
          expect(seg.end, where).toBeLessThanOrEqual(s.duration);
          expect(seg.words.map((w) => w[0]).join(" "), where).toBe(
            seg.text.split(/\s+/).filter(Boolean).join(" "),
          );
          for (const [, a, b] of seg.words) {
            expect(a, where).toBeGreaterThanOrEqual(seg.start - 0.01);
            expect(b, where).toBeLessThanOrEqual(seg.end + 0.01);
            expect(a, where).toBeLessThanOrEqual(b);
          }
        });
      });

      it("has markers inside the session, and credits with a licence and a source", () => {
        for (const m of s.markers) {
          expect(m.time).toBeGreaterThanOrEqual(0);
          expect(m.time).toBeLessThanOrEqual(s.duration);
        }
        expect(s.credits.line.length).toBeGreaterThan(20);
        expect(s.credits.license).toBeTruthy();
        expect(s.credits.sources.every((u) => u.startsWith("https://"))).toBe(true);
      });

      it("is in the catalogue: a credit, a licence link, and a distinct colour and a mix for every track", () => {
        const c = CATALOGUE[s.id];
        expect(c).toBeDefined();
        expect(c.credit.length).toBeGreaterThan(40);
        expect(c.short.length).toBeGreaterThan(20);
        expect(c.licence.url).toMatch(/^https:\/\//);
        const colours = s.tracks.map((t) => c.colours[t.id]);
        expect(colours.every((x) => x && PALETTE.includes(x))).toBe(true);
        expect(new Set(colours).size).toBe(s.tracks.length);
        for (const t of s.tracks) expect(c.mix[t.id], t.id).toBeDefined();
      });
    });
  }

  it("keeps each licence's conditions in what the app shows", () => {
    const nasa = catalogueOf("apollo11-landing");
    expect(nasa.credit).toContain("NASA");
    expect(nasa.credit).toContain("does not imply endorsement");
    expect(nasa.short).toContain("No endorsement");
    const song = catalogueOf("light-caught-by-the-stone");
    expect(song.credit).toContain("Pablo Carlos Budassi");
    expect(song.credit).toContain("CC BY 4.0");
    expect(song.short).toContain("CC BY 4.0");
    const dinner = catalogueOf("dinner-party");
    expect(dinner.notice).toMatch(/modified/);
    expect(dinner.short).toMatch(/^Modified from DiPCo/);
    expect(dinner.licence.url).toBe("https://cdla.dev/permissive-1-0/");
    expect(readFileSync(at("audio/dinner-party/NOTICE.txt"), "utf8")).toMatch(/modified/);
  });
});

const apollo = SESSIONS[0]!;
const song = SESSIONS[1]!;
const dinner = SESSIONS[2]!;

describe("reading the sessions", () => {
  it("finds every segment under the playhead when people talk over each other, and the one started last", () => {
    // The dinner party's lines overlap; find a moment inside two of them.
    const i = dinner.segments.findIndex(
      (seg, k) => k > 0 && seg.start < dinner.segments[k - 1]!.end,
    );
    expect(i).toBeGreaterThan(0);
    const a = dinner.segments[i - 1]!;
    const b = dinner.segments[i]!;
    const t = (b.start + Math.min(a.end, b.end)) / 2;
    expect(segmentsAt(dinner, t)).toEqual(expect.arrayContaining([i - 1, i]));
    expect(segmentIndexAt(dinner, t)).toBe(i);
    expect(segmentIndexAt(dinner, 0)).toBe(-1);
  });

  it("says who is on a track: the mic's wearer, the callsigns heard, a song group's name, or no transcript", () => {
    const name = (s: typeof apollo) => (id: string) => s.speakers.find((p) => p.id === id)!.name;
    const t = (s: typeof apollo, id: string) => s.tracks.find((x) => x.id === id)!;
    expect(trackName(dinner, t(dinner, "p05"), name(dinner))).toBe("Speaker 1 (P05)");
    expect(trackName(apollo, t(apollo, "air-ground"), name(apollo))).toMatch(/CC.*LMP|LMP.*CC/);
    expect(trackName(apollo, t(apollo, "flight-loop"), name(apollo))).toBe("no transcript");
    expect(trackName(apollo, t(apollo, "pao"), name(apollo))).toBe("PAO");
    expect(trackName(song, t(song, "drums"), name(song))).toBe("Drums");
    expect(trackInput(t(song, "drums"))).toBe("8 stems");
    expect(trackInput(t(apollo, "flight-loop"))).toBe("Flight Director loop");
  });

  it("gives the landing's mission clock, and none for the others", () => {
    expect(missionTime(apollo, 0)).toBe("102:42:40");
    expect(missionTime(apollo, 81.4)).toBe("102:44:01");
    expect(missionTime(song, 10)).toBeNull();
  });

  it("names a song's rows lines and its transcript lyrics", () => {
    expect(catalogueOf(song).words).toEqual({ transcript: "Lyrics", segment: "line" });
    expect(catalogueOf(apollo).words.segment).toBe("segment");
  });

  it("keeps the speakers' labels as given", () => {
    expect(dinner.speakers.map((p) => p.name)).toEqual([
      "Speaker 1 (P05)",
      "Speaker 2 (P06)",
      "Speaker 3 (P07)",
      "Speaker 4 (P08)",
    ]);
    expect(apollo.speakers.map((p) => p.code)).toEqual(["CDR", "LMP", "CC", "PAO"]);
  });
});
