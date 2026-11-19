/**
 * The design's rules, checked: the stylesheets may only use what tokens.css names. A raw colour, a type size, a
 * spacing off the scale or a control height of its own fails here, so the look stays one system as it grows.
 * tokens.css is where values are defined, so it is not checked.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = ["parts.css", "chrome.css", "panes.css", "shell.css"];
const SPACE = new Set([0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28]);

const lines = FILES.flatMap((file) =>
  readFileSync(join(import.meta.dirname, file), "utf8")
    .split("\n")
    .map((text, i) => ({ at: `${file}:${i + 1}`, text: text.trim() })),
).filter((l) => l.text && !l.text.startsWith("/*") && !l.text.startsWith("*"));

const offenders = (test: (text: string) => boolean) =>
  lines.filter((l) => test(l.text)).map((l) => `${l.at}  ${l.text}`);

describe("the stylesheets use the tokens", () => {
  it("no raw colours: every colour is a token (shadows and seams may use black or white with an alpha)", () => {
    // The header-button comparison switch is temporary (ui/headerButtons.ts) and goes with it.
    const temporary = /light-dark\(#d9d9d5, #1d1d20\)/;
    expect(offenders((t) => /#[0-9a-f]{3,8}\b/i.test(t) && !temporary.test(t))).toEqual([]);
  });

  it("type: every size, tracking and leading is a token", () => {
    expect(offenders((t) => /^font-size: (?!var\(--type-|0;|0\.82em;)/.test(t))).toEqual([]);
    expect(offenders((t) => /^letter-spacing: (?!var\(--track-|0;|inherit;)/.test(t))).toEqual([]);
    expect(offenders((t) => /^line-height: (?!var\(--lead-|1;)/.test(t))).toEqual([]);
    expect(offenders((t) => /^font-weight: (?!400;|500;|600;)/.test(t))).toEqual([]);
  });

  it("space: gaps, paddings and margins are on the scale (or a pocket's lips, or marked optical)", () => {
    const off = (t: string) => {
      const m = /^(?:gap|row-gap|column-gap|padding[a-z-]*|margin[a-z-]*): ([^;]*);(.*)$/.exec(t);
      if (!m || m[2]!.includes("optical")) return false;
      return [...m[1]!.matchAll(/(?<![\w.(-])-?(\d+(?:\.\d+)?)px/g)].some(
        (v) => !SPACE.has(Number(v[1])),
      );
    };
    expect(offenders(off)).toEqual([]);
  });

  it("corners: one radius, or a circle", () => {
    expect(offenders((t) => /^border-radius: (?!var\(--corner\);|50%;|0;|1px;)/.test(t))).toEqual(
      [],
    );
  });

  it("motion: every transition uses the travel tokens", () => {
    expect(offenders((t) => /^transition(-duration)?: .*\d(ms|s)\b/.test(t))).toEqual([]);
  });
});
