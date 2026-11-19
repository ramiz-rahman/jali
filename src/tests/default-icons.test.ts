// @vitest-environment node
/**
 * Jali's default icons are Phosphor's paths, copied into @jali/react by scripts/icons.mjs. This fails when the copy
 * and the script disagree (an edited file, or a changed SOURCES or Phosphor version): run `pnpm icons`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
// @ts-expect-error: a plain ES module script, without types.
import { OUT, SOURCES, generate } from "../../scripts/icons.mjs";
import type { JaliIconName } from "../../packages/react/src/icons/types";

const words = (s: string) => s.replace(/\s+/g, "").replace(/,(?=[\]}])/g, "");

describe("default icons", () => {
  it("default-paths.ts is what scripts/icons.mjs writes", async () => {
    expect(words(readFileSync(OUT, "utf8"))).toBe(words(await generate()));
  }, 30_000);

  it("the script names a source for every icon Jali draws", () => {
    const names: Record<JaliIconName, true> = {
      close: true,
      fullScreen: true,
      exitFullScreen: true,
      maximise: true,
      restore: true,
      tuck: true,
      putBack: true,
      newTab: true,
      more: true,
      current: true,
      fold: true,
      grip: true,
      follow: true,
      keep: true,
      pin: true,
      activityError: true,
      defaultKind: true,
      openBeside: true,
      openFull: true,
      addToTabs: true,
      singleView: true,
      splitView: true,
      back: true,
      reset: true,
      dropLeft: true,
      dropRight: true,
      dropTop: true,
      dropBottom: true,
      dropSwap: true,
      dropTab: true,
    };
    expect(Object.keys(SOURCES).sort()).toEqual(Object.keys(names).sort());
  });
});
