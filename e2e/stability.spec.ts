/**
 * Pane stability: sticky folding, deterministic resize. A click, a key or a resize must change only what it names.
 * Written against the intended behaviour; needs the dev server on :5300.
 */
import { test, expect, Lab } from "./fixtures/lab";

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
];

for (const size of SIZES) {
  test.describe(`stress ${size.width}x${size.height}`, () => {
    test("clicking any tab changes only its own group", async ({ lab }) => {
      await lab.open({ size });
      await lab.preset("Stress: 10 panes");
      const base = await lab.snap();
      const groupKeys = Object.keys(base.rects).filter((k) => k.startsWith("tabs:"));
      expect(
        base.groups.length,
        "stress preset should have tab groups at this size",
      ).toBeGreaterThan(0);
      for (const key of groupKeys) {
        const names = key.slice(5).split("|");
        for (const name of names) {
          // Re-find the group each time: it is keyed by its tab names.
          const g = await lab.group(names);
          await g.getByRole("tab").filter({ hasText: name }).first().click();
          await lab.stable();
          const now = await lab.snap();
          expect(Lab.diff(base, now, [key]), `click tab "${name}"`).toEqual([]); // the group's own rect is checked below
          expect(now.groups).toEqual(base.groups);
          const own = now.rects[key]!,
            was = base.rects[key]!;
          expect(
            Math.abs(own.w - was.w) + Math.abs(own.h - was.h),
            `${key} own rect`,
          ).toBeLessThanOrEqual(2);
        }
      }
    });

    test("F6 through every pane changes nothing", async ({ lab, page }) => {
      await lab.open({ size });
      await lab.preset("Stress: 10 panes");
      const base = await lab.snap();
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("F6");
        await lab.stable();
        expect(Lab.diff(base, await lab.snap()), `F6 press ${i + 1}`).toEqual([]);
      }
    });
  });
}

test("resize 1920 -> 1024 -> 1920 restores rects and membership", async ({ lab, page }) => {
  await lab.open({ size: { width: 1920, height: 1080 } });
  await lab.preset("Stress: 10 panes");
  const a = await lab.snap();
  const wide = await lab.visibleCount();
  await page.setViewportSize({ width: 1024, height: 1080 });
  await expect
    .poll(() => lab.visibleCount(), { message: "the layout folds at 1024" })
    .toBeLessThan(wide);
  await lab.stable();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await lab.expectSnap(a, "after round trip");
});
