import { expect, test, type Page } from "@playwright/test";

/** The landing hero's tour (src/live/Tour.tsx). */
const hero = (page: Page) => page.locator('.landing-stage figure[data-live="tree-view"]');
const ws = (page: Page) => hero(page).locator(".live-ws");
const caption = (page: Page) => hero(page).locator(".live-tour-text");

/** What is on screen: each pane's id and whether it shows, and the workspace's width. */
async function snapshot(page: Page) {
  return ws(page).evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    panes: [...el.querySelectorAll<HTMLElement>("[data-pane]")].map(
      (p) => `${p.dataset.pane}:${p.style.display === "none" ? "hidden" : p.style.width}`,
    ),
    selected: el.querySelector('[role="option"][aria-selected="true"]')?.id,
  }));
}

test("a click mid-tour stops it for good and leaves the workspace as it was", async ({ page }) => {
  await page.goto("/");
  await expect(hero(page)).toHaveAttribute("data-tour", "playing", { timeout: 10_000 });
  // Nothing the tour does takes keyboard focus.
  await expect(caption(page)).toHaveText(/^Less room/, { timeout: 15_000 });
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.waitForTimeout(600); // mid-way through the narrowing

  await hero(page).locator('[data-pane="orders"] .live-k-toolbar').click();
  await expect(hero(page)).toHaveAttribute("data-tour", "stopped");
  const at = await snapshot(page);
  expect(at.width).toBeLessThan(800);
  await page.waitForTimeout(2500);
  expect(await snapshot(page)).toEqual(at);
  await expect(caption(page)).toHaveCount(0);
  await expect(hero(page).getByRole("list", { name: "Things to try" })).toBeVisible();
  await expect(hero(page).locator(".live-tour-cursor[data-on]")).toHaveCount(0);
});

test("Replay plays it again from the start, and a reload in the same session doesn't", async ({
  page,
}) => {
  await page.goto("/");
  await expect(caption(page)).toHaveText(/^Pick an order/, { timeout: 10_000 });
  await expect(ws(page).locator('[aria-selected="true"]')).toHaveId(/-o-1046$/, { timeout: 6_000 });
  await hero(page).locator('[data-pane="order"]').click();
  await expect(hero(page)).toHaveAttribute("data-tour", "stopped");

  const replay = hero(page).getByRole("button", { name: "Replay" });
  await replay.click();
  await expect(hero(page)).toHaveAttribute("data-tour", "playing");
  // While it plays, the button says what it will do.
  await expect(hero(page).getByRole("button", { name: "Pause tour" })).toBeVisible();
  // Back to the start: order 1048, then the steps again.
  await expect(caption(page)).toHaveText(/^Pick an order/);
  await expect(ws(page).locator('[aria-selected="true"]')).toHaveId(/-o-1048$/);
  await expect(ws(page).locator('[aria-selected="true"]')).toHaveId(/-o-1047$/, { timeout: 4_000 });
  await expect(hero(page).locator('.live-tour-bar [aria-live="polite"]')).toHaveText(
    /^Pick an order/,
  );

  // Pause holds it on its step; Play carries on.
  await hero(page).getByRole("button", { name: "Pause tour" }).click();
  await expect(hero(page)).toHaveAttribute("data-tour", "paused");
  const toggle = hero(page).getByRole("button", { name: "Play tour" });
  const held = await snapshot(page);
  await page.waitForTimeout(2500);
  expect((await snapshot(page)).selected).toBe(held.selected);
  await toggle.click();
  await expect(hero(page)).toHaveAttribute("data-tour", "playing");

  // Seen this session: a reload doesn't play it by itself.
  await page.reload();
  await page.waitForTimeout(3000);
  await expect(hero(page)).toHaveAttribute("data-tour", "idle");
});

test("with reduced motion it doesn't play by itself, and Play cuts between steps", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const before = await snapshot(page);
  await page.waitForTimeout(3000);
  await expect(hero(page)).toHaveAttribute("data-tour", "idle");
  expect(await snapshot(page)).toEqual(before);

  const play = hero(page).getByRole("button", { name: "Play tour" });
  await play.click();
  await expect(hero(page)).toHaveAttribute("data-tour", "playing");
  await expect(caption(page)).toHaveText(/^Less room/, { timeout: 15_000 });
  // Cut, not animated: no cursor, and the width changes without a transition.
  await expect(hero(page).locator(".live-tour-cursor[data-on]")).toHaveCount(0);
  await expect(ws(page)).not.toHaveAttribute("data-tour-anim", /.*/);
  await context.close();
});

test("a phone doesn't play it by itself", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await expect(hero(page)).toHaveAttribute("data-tour", "idle");
  await expect(hero(page).getByRole("button", { name: "Play tour" })).toBeVisible();
  await context.close();
});

test("leaving the page mid-tour leaves nothing running", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(hero(page)).toHaveAttribute("data-tour", "playing", { timeout: 10_000 });
  // The tour holds focus through the workspace, not by patching the browser.
  expect(await page.evaluate(() => HTMLElement.prototype.focus.name)).toBe("focus");
  await page.getByRole("link", { name: "Docs", exact: true }).first().click();
  await expect(hero(page)).toHaveCount(0);
  // Nothing the tour scheduled runs later.
  await page.waitForTimeout(4000);
  expect(errors).toEqual([]);
});

test("nothing the tour does takes keyboard focus, the palette included", async ({ page }) => {
  await page.goto("/");
  await expect(caption(page)).toHaveText(/^Press ⌘K/, { timeout: 25_000 });
  // While the palette is open and being typed into, focus stays on the page.
  await expect(hero(page).locator(".jali-palette-input")).toBeVisible({ timeout: 4_000 });
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(caption(page)).toHaveText(/^Close the notes/, { timeout: 15_000 });
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(hero(page)).toHaveAttribute("data-tour", "playing");
});
