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

test("the pane's content moves into the window whole and comes back whole; Jali's keys and the theme follow it there", async ({
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
  // A mark on the content's own first element: a remount would make a new one, without it.
  await list.evaluate((el) => {
    const content = el.querySelector("[data-jali-host] > *") as HTMLElement & { mark?: string };
    content.mark = "kept";
  });
  const opened = context.waitForEvent("page");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("pop out");
  await page.keyboard.press("Enter");
  const pip = await opened;
  await expect(pip.locator(".jali-popout[data-jali]")).toHaveCount(1);
  expect(
    await pip.evaluate(
      () =>
        (document.querySelector("[data-jali-host] > *") as HTMLElement & { mark?: string })?.mark,
    ),
  ).toBe("kept");

  // Jali's keys work in the window: ⌘K there opens the palette in the page.
  await pip.locator("[data-jali-host]").click({ position: { x: 20, y: 20 } });
  await pip.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The theme follows: the window's root takes the workspace's.
  await page.evaluate(() =>
    (
      window as unknown as {
        __jali: { actions: { changeSettings(s: { theme: string }): unknown } };
      }
    ).__jali.actions.changeSettings({ theme: "dark" }),
  );
  await expect(pip.locator(".jali-popout")).toHaveAttribute("data-theme", "dark");

  await list.getByRole("button", { name: "Bring back", exact: true }).click();
  await expect.poll(() => pip.isClosed()).toBe(true);
  expect(
    await list.evaluate(
      (el) =>
        (el.querySelector("[data-jali-host] > *") as (HTMLElement & { mark?: string }) | null)
          ?.mark,
    ),
  ).toBe("kept");
});
