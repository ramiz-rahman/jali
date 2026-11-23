/**
 * Folding screens: with a fold across the workspace (the browser's viewport segments, emulated through Chromium's
 * DevTools protocol), a pane sits each side of the hinge and none straddles it. Unfolding brings the layout back.
 * Emulation doesn't model the physical seam: check a real Fold or Flip before calling fold support done.
 */
import { test, expect } from "./fixtures/app";

const SIZE = { width: 690, height: 840 };

test("a fold puts a pane each side of the hinge, and unfolding restores the layout", async ({
  app,
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "the fold is emulated through Chromium's DevTools protocol; Safari has none",
  );
  await app.open({ size: SIZE });
  const cdp = await page.context().newCDPSession(page);
  const fold = (displayFeature?: object) =>
    cdp.send("Emulation.setDeviceMetricsOverride", {
      ...SIZE,
      deviceScaleFactor: 1,
      mobile: true,
      ...(displayFeature ? { displayFeature } : {}),
    } as never);
  const panes = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("section[data-pane]")]
        .filter((e) => getComputedStyle(e).display !== "none")
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
    );
  const before = await app.snap();

  // Book posture: the hinge runs down the middle.
  await fold({ orientation: "vertical", offset: 345, maskLength: 0 });
  await expect(page.locator("[data-fold='row']")).toHaveCount(1);
  const book = await panes();
  expect(book).toHaveLength(2);
  for (const p of book) expect(p.right <= 345.5 || p.left >= 344.5).toBe(true);

  // Tabletop: the hinge runs across.
  await fold({ orientation: "horizontal", offset: 420, maskLength: 0 });
  await expect(page.locator("[data-fold='column']")).toHaveCount(1);
  for (const p of await panes()) expect(p.bottom <= 420.5 || p.top >= 419.5).toBe(true);

  // A dual screen: a 28px mask between the halves, which no pane covers.
  await fold({ orientation: "vertical", offset: 331, maskLength: 28 });
  await expect
    .poll(async () => (await panes()).every((p) => p.right <= 331.5 || p.left >= 358.5))
    .toBe(true);

  await fold();
  await expect(page.locator("[data-fold]")).toHaveCount(0);
  await app.expectSnap(before, "after unfolding");
});
