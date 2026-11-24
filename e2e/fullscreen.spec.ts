/** Full screen: a pane maximised with the page in the browser's full screen; from the pane's menu; Escape or the header's Exit full screen puts it back. */
import { test, expect } from "./fixtures/app";

test("a pane goes full screen from its header and comes back with Escape, exactly as it was", async ({
  app,
  page,
}) => {
  await app.open();
  const before = await app.snap();
  const pane = page.locator("section[data-pane]").first();
  const title = (await pane.getAttribute("aria-labelledby"))!;
  const name = await page.locator(`[id="${title}"]`).innerText();
  await pane.hover();
  // Full screen is in the pane's menu (⋯); while on, its way out is a header button.
  await page.getByRole("button", { name: `More for ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: /^Full screen/ }).click();

  await expect(pane).toHaveAttribute("data-full-screen", "true");
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  const box = (await pane.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(vp.width);
  expect(Math.round(box.height)).toBe(vp.height);
  await expect(
    page.getByRole("button", { name: `Exit full screen ${name}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // The pane itself is the browser's full-screen element, and Jali's dialogs open inside it.
  expect(await page.evaluate(() => document.fullscreenElement?.matches("section[data-pane]"))).toBe(
    true,
  );
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator(":fullscreen").getByRole("dialog", { name: "Commands" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.locator("section[data-full-screen]")).toHaveCount(0);
  await app.expectSnap(before, "after leaving full screen");
});

test("⌘K runs Full screen, and running it again exits", async ({ app, page }) => {
  await app.open();
  await page
    .locator("section[data-pane]")
    .first()
    .click({ position: { x: 120, y: 200 } });
  const run = async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();
    await page.keyboard.type("full screen");
    await page.keyboard.press("Enter");
  };
  await run();
  await expect(page.locator("section[data-full-screen]")).toHaveCount(1);
  await run();
  await expect(page.locator("section[data-full-screen]")).toHaveCount(0);
});

test("⌘K ⌘F puts the focused pane on the browser's full screen; again, or Escape, puts it back", async ({
  app,
  page,
}) => {
  await app.open();
  const before = await app.snap();
  const pane = page.locator("section[data-pane]").first();
  await pane.click({ position: { x: 120, y: 200 } });
  const chord = async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+f");
  };
  await chord();
  await expect(pane).toHaveAttribute("data-full-screen", "true");
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  // The palette the first step opened closes with the second: nothing is left over the full-screen pane.
  await expect(page.getByRole("dialog", { name: "Commands" })).toHaveCount(0);
  await chord();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.locator("section[data-full-screen]")).toHaveCount(0);
  await chord();
  await expect(pane).toHaveAttribute("data-full-screen", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("section[data-full-screen]")).toHaveCount(0);
  await app.expectSnap(before, "after leaving full screen");
});
