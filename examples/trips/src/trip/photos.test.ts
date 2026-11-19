// @vitest-environment node
/** The photos: one for every place and each city's cover, on disk in both widths, credited, and honest. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { PHOTOS } from "./photos";
import { PLACES } from "./places";

const dir = fileURLToPath(new URL("../../public/photos/", import.meta.url));

describe("photos", () => {
  it("every place and both city covers have one, in both widths", () => {
    for (const id of [...PLACES.map((p) => p.id), "cover-bkk", "cover-hkt"]) {
      const p = PHOTOS[id];
      expect(p, id).toBeDefined();
      expect(existsSync(`${dir}${p!.file}.webp`), `${id} large`).toBe(true);
      expect(existsSync(`${dir}${p!.file}-s.webp`), `${id} small`).toBe(true);
    }
  });

  it("a made-up business's photo is a stand-in that says so; a real place's never is", () => {
    for (const p of PLACES) {
      const photo = PHOTOS[p.id]!;
      if (p.fictional) expect(photo.standIn, p.id).toMatch(/made up\.$/);
      else expect(photo.standIn, p.id).toBeUndefined();
    }
  });

  it("each is credited under a licence that allows reuse, with its alt text and tone", () => {
    for (const [id, p] of Object.entries(PHOTOS)) {
      expect(p.credit.length, id).toBeGreaterThan(1);
      expect(p.credit.length, id).toBeLessThanOrEqual(60);
      expect(p.license, id).toMatch(/^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/);
      expect(p.source, id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.alt.length, id).toBeGreaterThan(10);
      expect(p.tone, id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
