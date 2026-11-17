/** Tabs: made by you vs made by the layout; the overflow menu when a strip cannot show every tab. */
import { test, expect } from "./fixtures/lab";

const strip = (page: import("@playwright/test").Page) => page.locator(".tabbar").filter({ has: page.locator(".tab-more") }).first();

test.describe("tab overflow and marks", () => {
  test("folded tabs follow a hairline, carry a fold mark and a description; yours do not", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    const folded = page.locator('[role="tab"][data-folded]');
    expect(await folded.count()).toBeGreaterThan(3);
    await expect(folded.first()).toHaveAttribute("aria-description", "Folded: returns when there's room");
    await expect(folded.first().locator(".tab-fold-mark")).toBeVisible();
    await expect(page.locator('[role="tab"]:not([data-folded])').first()).not.toHaveAttribute("aria-description", /Folded/);
    // Yours first, the layout's after the separator.
    const order = await page.locator(".tabs").first().evaluate((el) => [...el.children].map((c) => (c.classList.contains("tab-sep") ? "|" : c.classList.contains("is-folded") ? "f" : "m")).join(""));
    expect(order).toMatch(/^m+\|f+$/);
    // The shelf lists every folded pane with the same wording.
    const chips = page.locator('[data-chip][data-reason="folded"]');
    expect(await chips.count()).toBe(await folded.count());
    await expect(chips.first().getByRole("button").first()).toHaveAttribute("aria-description", "Folded: returns when there's room");
  });

  test("the overflow button counts hidden tabs; the menu lists all of them, keys work, the chosen tab is shown", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    const bar = strip(page);
    const more = bar.locator(".tab-more");
    await expect(more).toBeVisible();
    const total = await bar.getByRole("tab").count();
    const n = Number(await more.getAttribute("data-hidden-count"));
    expect(n).toBeGreaterThan(0);
    await expect(more).toHaveText(new RegExp(`\\+${n}`));
    await more.click();
    const menu = page.getByRole("menu", { name: "Tabs in this group" });
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitem");
    await expect(items).toHaveCount(total);
    await expect(items.first()).toBeFocused(); // the active tab leads
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
    // Choose the last tab: it becomes the shown one and scrolls into the strip.
    await more.click();
    await page.keyboard.press("End");
    const target = await items.last().getAttribute("data-item");
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    const tab = page.locator(`[role="tab"][data-tab="${target}"]`);
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const [t, s] = await Promise.all([tab.boundingBox(), page.locator(".tabs").first().boundingBox()]);
    expect(t!.x).toBeGreaterThanOrEqual(s!.x - 1);
    expect(t!.x + t!.width).toBeLessThanOrEqual(s!.x + s!.width + 1);
  });

  test("a tab's width does not change when it is hovered or its state shows", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1440, height: 900 } });
    const tab = page.locator('[role="tab"][data-folded]').first();
    const before = (await tab.boundingBox())!.width;
    await tab.hover();
    expect((await tab.boundingBox())!.width).toBe(before);
  });

  test("the loan review shows no overflow button and no folded marks for its page views", async ({ lab, page }) => {
    await lab.open({ path: "/?app=review&item=4&tab=application", size: { width: 1280, height: 900 } });
    await expect(page.locator(".tab-more")).toHaveCount(0);
    await expect(page.locator('[data-folded]')).toHaveCount(0);
  });
});
