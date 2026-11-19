/**
 * `@import "@jali/react/styles.css"` works from CSS. Vite's CSS resolver asks for the "style" condition, not
 * "source", so in this repository each stylesheet export names its source under "style" too; the published package
 * (`publishConfig.exports`) has only "default", the built file in `dist`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../packages/react/package.json"), "utf8"),
) as {
  exports: Record<string, Record<string, string> | string>;
  publishConfig: { exports: Record<string, Record<string, string> | string> };
};
const sheets = Object.keys(pkg.exports).filter((k) => k.endsWith(".css"));

describe("@jali/react's stylesheets", () => {
  it("are styles.css, theme.css and tailwind.css", () => {
    expect(sheets).toEqual(["./styles.css", "./theme.css", "./tailwind.css"]);
  });

  it.each(sheets)("%s resolves to its source from CSS here, and to dist when published", (key) => {
    const here = pkg.exports[key] as Record<string, string>;
    expect(here.style).toBe(here.source);
    expect(Object.keys(here)).toEqual(["source", "style", "default"]);
    expect(pkg.publishConfig.exports[key]).toEqual({ default: here.default });
    expect(here.default).toMatch(/^\.\/dist\/.+\.css$/);
  });
});
