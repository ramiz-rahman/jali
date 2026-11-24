import { expect, test, type Page } from "@playwright/test";

/** The landing hero's tour (src/live/hero/tour). */
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

/** Nothing the tour does has taken keyboard focus. */
const onBody = (page: Page) => page.evaluate(() => document.activeElement === document.body);
/** The tab strip's tabs, in order, with a pin mark. */
const tabs = (page: Page) =>
  ws(page)
    .locator(".jali-tab-item [data-tab]")
    .evaluateAll((els) =>
      els.map(
        (e) => `${(e as HTMLElement).dataset.tab}${e.hasAttribute("data-pinned") ? "*" : ""}`,
      ),
    );

test("a click mid-drag stops it for good and leaves the workspace as it was", async ({ page }) => {
  await page.goto("/");
  await expect(hero(page)).toHaveAttribute("data-tour", "playing", { timeout: 10_000 });
  // The drag: Huda's earlier order carried to the right of the kept one, with the drop's outcome in words.
  await expect(caption(page)).toHaveText(/^Drag it next to the first/, { timeout: 25_000 });
  await expect(ws(page).locator(".jali-drop-label")).toHaveText(/^Place right of Order 1048/, {
    timeout: 4_000,
  });
  await expect(ws(page).locator(".jali-drag-chip")).toBeVisible();
  expect(await onBody(page)).toBe(true);

  await hero(page).locator('[data-pane="orders"] .live-k-toolbar').click();
  await expect(hero(page)).toHaveAttribute("data-tour", "stopped");
  // The drag is put away without dropping: no preview, no chip, and the two orders are still apart.
  await expect(ws(page).locator(".jali-drop-label, .jali-drag-chip")).toHaveCount(0);
  expect(await tabs(page)).toEqual([]);
  const order = (id: number) =>
    ws(page)
      .locator(".jali-pane")
      .filter({ has: page.getByRole("heading", { name: `Order ${id}` }) });
  const [kept, earlier] = [await order(1048).boundingBox(), await order(1044).boundingBox()];
  expect(earlier!.x).toBeLessThan(kept!.x);
  const at = await snapshot(page);
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
  // The hero mounts in the browser only: compare from its first layout, not from before it shows.
  await expect.poll(async () => (await snapshot(page)).panes.length).toBeGreaterThan(0);
  const before = await snapshot(page);
  await page.waitForTimeout(3000);
  await expect(hero(page)).toHaveAttribute("data-tour", "idle");
  expect(await snapshot(page)).toEqual(before);

  const play = hero(page).getByRole("button", { name: "Play tour" });
  await play.click();
  await expect(hero(page)).toHaveAttribute("data-tour", "playing");
  // A drag is shown as its drop, held still: the preview, no cursor moving to it.
  await expect(ws(page).locator(".jali-drop-label")).toBeVisible({ timeout: 10_000 });
  await expect(hero(page).locator(".live-tour-cursor[data-on]")).toHaveCount(0);
  await expect(caption(page)).toHaveText(/^All of it is one layout tree: plain data/, {
    timeout: 25_000,
  });
  // Cut, not animated: no cursor.
  await expect(hero(page).locator(".live-tour-cursor[data-on]")).toHaveCount(0);
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
  // Mid-drag: what it scheduled for the drop never runs.
  await expect(ws(page).locator(".jali-drop-label")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Docs", exact: true }).first().click();
  await expect(hero(page)).toHaveCount(0);
  // Nothing the tour scheduled runs later.
  await page.waitForTimeout(4000);
  expect(errors).toEqual([]);
});

test("the story's moves happen without taking keyboard focus, and end on the layout tree", async ({
  page,
}) => {
  await page.goto("/");
  const pane = (name: string) =>
    ws(page)
      .locator(".jali-pane")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  // Huda's order: his notes open beside him.
  await expect(caption(page)).toHaveText(/^Big order/, { timeout: 15_000 });
  await expect(pane("Notes on Huda")).toBeVisible({ timeout: 5_000 });
  expect(await onBody(page)).toBe(true);
  // Kept, and his earlier order opened beside: two orders on screen, the first kept.
  await expect(caption(page)).toHaveText(/^Keep this order/, { timeout: 8_000 });
  await expect(pane("Order 1044")).toBeVisible({ timeout: 6_000 });
  await expect(pane("Order 1048").getByRole("button", { name: /Kept|Follow again/ })).toHaveCount(
    1,
  );
  expect(await onBody(page)).toBe(true);
  // Dragged to the right of the kept one: the two line up, side by side.
  await expect(caption(page)).toHaveText(/^Drag it next to the first/, { timeout: 8_000 });
  await expect(caption(page)).toHaveText(/^All of it is one layout tree: plain data/, {
    timeout: 10_000,
  });
  const [kept, earlier] = [
    await pane("Order 1048").boundingBox(),
    await pane("Order 1044").boundingBox(),
  ];
  expect(earlier!.x).toBeGreaterThan(kept!.x);
  expect(Math.abs(earlier!.y - kept!.y)).toBeLessThan(2);
  // The tree beside the workspace, and nothing took focus on the way.
  await expect(hero(page).locator(".live-json")).toBeVisible();
  expect(await onBody(page)).toBe(true);
});
