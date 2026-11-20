/**
 * The type scale, checked: every size, leading and tracking in the stylesheets is a token from tokens.css, and every
 * weight is one of three, so the type stays one system as it grows. tokens.css is where values are defined, so it is
 * not checked; its scale is checked for its floor.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const FILES = ["shell.css", "panes.css", "photos.css", "map.css"];

const lines = FILES.flatMap((file) =>
  readFileSync(join(import.meta.dirname, file), "utf8")
    .split("\n")
    .map((text, i) => ({ at: `${file}:${i + 1}`, text: text.trim() })),
).filter((l) => l.text && !l.text.startsWith("/*") && !l.text.startsWith("*"));

const offenders = (test: (text: string) => boolean) =>
  lines.filter((l) => test(l.text)).map((l) => `${l.at}  ${l.text}`);

describe("the stylesheets use the type scale", () => {
  it("every size is a --type-* token", () => {
    expect(offenders((t) => /^font-size: (?!var\(--type-[a-z]+\);|inherit;)/.test(t))).toEqual([]);
  });

  it("every leading and tracking is a token", () => {
    expect(offenders((t) => /^line-height: (?!var\(--lead-[a-z]+\);|1;)/.test(t))).toEqual([]);
    expect(offenders((t) => /^letter-spacing: (?!var\(--track-[a-z]+\);|0;)/.test(t))).toEqual([]);
  });

  it("every weight is 500, 600 or 700", () => {
    expect(offenders((t) => /^font-weight: (?!500;|600;|700;)/.test(t))).toEqual([]);
  });

  it("nothing on the scale is smaller than 11px", () => {
    const tokens = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");
    const sizes = [...tokens.matchAll(/--type-[a-z]+: (\d+(?:\.\d+)?)px;/g)].map((m) =>
      Number(m[1]),
    );
    expect(sizes.length).toBeGreaterThan(5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });
});
