/** Tabs: made by you vs made by the layout; the overflow menu when a strip cannot show every tab. */
import { test, expect } from "./fixtures/lab";

const strip = (page: import("@playwright/test").Page) => page.locator(".jali-tabbar").filter({ has: page.locator(".jali-tab-more") }).first();

test.describe("tab overflow and marks", () => {
  test("folded tabs follow a hairline, carry a fold mark and a description; yours do not", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    const folded = page.locator('[role="tab"][data-folded]');
    expect(await folded.count()).toBeGreaterThan(3);
    await expect(folded.first()).toHaveAttribute("aria-description", "Folded: returns when there's room");
    await expect(folded.first().locator(".jali-tab-fold-mark")).toBeVisible();
    await expect(page.locator('[role="tab"]:not([data-folded])').first()).not.toHaveAttribute("aria-description", /Folded/);
    // Yours first, the layout's after the separator.
    const order = await page.locator(".jali-tabs").first().evaluate((el) => [...el.children].map((c) => (c.classList.contains("jali-tab-sep") ? "|" : c.classList.contains("is-folded") ? "f" : "m")).join(""));
    expect(order).toMatch(/^m+\|f+$/);
    // The shelf counts every folded pane (past three, one summary chip that lists them), with the same wording.
    const n = await folded.count();
    const summary = page.locator("[data-chip][data-summary]");
    await expect(summary).toContainText(`${n} folded`);
    await expect(summary.getByRole("button")).toHaveAttribute("aria-description", "Folded: returns when there's room");
    await summary.getByRole("button").click();
    await expect(page.getByRole("menu", { name: "Folded panes" }).getByRole("menuitem")).toHaveCount(n);
    await page.keyboard.press("Escape");
    await expect(summary.getByRole("button")).toBeFocused();
  });

  test("the overflow button counts hidden tabs; the menu lists all of them, keys work, the chosen tab is shown", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    const bar = strip(page);
    const more = bar.locator(".jali-tab-more");
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
    const [t, s] = await Promise.all([tab.boundingBox(), page.locator(".jali-tabs").first().boundingBox()]);
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
    await expect(page.locator(".jali-tab-more")).toHaveCount(0);
    await expect(page.locator('[data-folded]')).toHaveCount(0);
  });

  test("a narrow strip shows its active tab whole, the first one included (finding 30)", async ({ lab, page }) => {
    await lab.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    for (const width of [1280, 1100, 900, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await lab.stable();
      const cut = await page.locator(".jali-tabs").evaluateAll((strips) => strips.flatMap((s) => {
        const tab = s.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (!tab || !s.checkVisibility()) return [];
        const a = tab.getBoundingClientRect(), b = s.getBoundingClientRect();
        return a.left < b.left - 1 || a.right > b.right + 1 ? [`${tab.textContent} ${Math.round(a.left - b.left)}..${Math.round(a.right - b.right)}`] : [];
      }));
      expect(cut, `width ${width}`).toEqual([]);
    }
    // A strip narrower than its active tab shows the tab's start ("Ord…"), never its end ("ders").
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addStyleTag({ content: ".jali-tabs { max-width: 3rem; }" });
    const first = page.locator(".jali-tabs").first().locator('[role="tab"]').first();
    await first.click();
    await expect(first).toHaveAttribute("aria-selected", "true");
    const [t, s] = await Promise.all([first.boundingBox(), page.locator(".jali-tabs").first().boundingBox()]);
    expect(Math.round(t!.x)).toBeGreaterThanOrEqual(Math.round(s!.x) - 1);
  });
});
