/**
 * Pop out (experimental): a pane's content in a floating window that stays on top (Document Picture-in-Picture), still
 * part of the workspace: a row chosen in the window moves the detail that follows it. Bring back closes the window.
 */
import { test, expect } from "./fixtures/app";

test("a popped-out list still drives its following detail, and Bring back closes the window", async ({
  app,
  page,
  context,
}) => {
  await app.open();
  test.skip(
    !(await page.evaluate(() => "documentPictureInPicture" in window)),
    "no Document Picture-in-Picture in this browser",
  );
  const list = page.locator("section[data-pane]").first();
  await list.click({ position: { x: 150, y: 220 } });
  const opened = context.waitForEvent("page");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("pop out");
  await page.keyboard.press("Enter");
  const pip = await opened;
  await expect(list.locator(".jali-popped-out")).toBeVisible();

  // The detail beside follows the row chosen in the floating window.
  const detail = page.locator("section[data-pane]").nth(1);
  await pip.getByRole("row", { name: /^5\b/ }).first().click();
  await expect(detail.getByRole("heading", { level: 2 })).toHaveText(/5/);

  await list.getByRole("button", { name: "Bring back", exact: true }).click();
  await expect(list.locator(".jali-popped-out")).toHaveCount(0);
  await expect.poll(() => pip.isClosed()).toBe(true);
});

test("switching away from the page (blur, hidden) leaves the popped-out window open and the pane popped out", async ({
  app,
  page,
  context,
}) => {
  await app.open();
  test.skip(
    !(await page.evaluate(() => "documentPictureInPicture" in window)),
    "no Document Picture-in-Picture in this browser",
  );
  const list = page.locator("section[data-pane]").first();
  await list.click({ position: { x: 150, y: 220 } });
  const opened = context.waitForEvent("page");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("pop out");
  await page.keyboard.press("Enter");
  const pip = await opened;
  await expect(list.locator(".jali-popped-out")).toBeVisible();

  // What the page sees when the person switches to another app or another desktop.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(pip.isClosed()).toBe(false);
  await expect(list.locator(".jali-popped-out")).toBeVisible();
  await expect(pip.getByRole("row").first()).toBeVisible();
});
