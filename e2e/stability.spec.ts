/**
 * Pane stability: sticky folding, deterministic resize. A click, a key or a resize must change only what it names.
 * Written against the intended behaviour; needs the dev server on :5300.
 */
import { test, expect, App } from "./fixtures/app";

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
];

for (const size of SIZES) {
  test.describe(`stress ${size.width}x${size.height}`, () => {
    test("clicking any tab changes only its own group", async ({ app }) => {
      await app.open({ size });
      await app.preset("Stress: 10 panes");
      const base = await app.snap();
      const groupKeys = Object.keys(base.rects).filter((k) => k.startsWith("tabs:"));
      expect(
        base.groups.length,
        "stress preset should have tab groups at this size",
      ).toBeGreaterThan(0);
      for (const key of groupKeys) {
        const names = key.slice(5).split("|");
        for (const name of names) {
          // Re-find the group each time: it is keyed by its tab names.
          const g = await app.group(names);
          await g.getByRole("tab").filter({ hasText: name }).first().click();
          await app.stable();
          const now = await app.snap();
          expect(App.diff(base, now, [key]), `click tab "${name}"`).toEqual([]); // the group's own rect is checked below
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

    test("F6 through every pane changes nothing", async ({ app, page }) => {
      await app.open({ size });
      await app.preset("Stress: 10 panes");
      const base = await app.snap();
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("F6");
        await app.stable();
        expect(App.diff(base, await app.snap()), `F6 press ${i + 1}`).toEqual([]);
      }
    });
  });
}

test("resize 1920 -> 1024 -> 1920 restores rects and membership", async ({ app, page }) => {
  await app.open({ size: { width: 1920, height: 1080 } });
  await app.preset("Stress: 10 panes");
  const a = await app.snap();
  const wide = await app.visibleCount();
  await page.setViewportSize({ width: 1024, height: 1080 });
  await expect
    .poll(() => app.visibleCount(), { message: "the layout folds at 1024" })
    .toBeLessThan(wide);
  await app.stable();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await app.expectSnap(a, "after round trip");
});
