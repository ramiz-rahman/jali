/**
 * axe on Jali's own parts: a tab strip with tabs and a tucked tab, the shelf, the palette and a curated page's tabs.
 * Scoped to the workspace root and its dialog layer, so the app's own panes and chrome are not what is judged.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, review } from "./fixtures/app";

/** What Jali renders: the panes (or a curated page's tabs and panes), the shelf and the dialog layer. The app's top bar
 *  and status line sit inside the root but are the app's, and a pane's content is the app's. */
const JALI = [
  ".jali-workspace",
  ".jali-page-tabs",
  "[data-shelf]",
  "[data-jali-layer]",
  ".jali-tab-menu",
];

async function axe(page: Page) {
  let b = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "best-practice",
  ]);
  for (const s of JALI) if (await page.locator(s).count()) b = b.include(s);
  b = b.exclude(".jali-pane-content-inner");
  const { violations } = await b.analyze();
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 4),
  }));
}

test.describe("axe", () => {
  test("tab strips with a tucked tab, and the shelf", async ({ app, page }) => {
    await app.open();
    await app.tuck("customer").click();
    await expect.poll(() => app.homeOf("customer 1")).not.toBeNull();
    await expect(page.locator('[role="tab"][data-tucked]')).toHaveCount(1);
    await expect(app.shelf()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("a tab's menu, opened from the keyboard", async ({ app, page }) => {
    await app.open();
    await app.tuck("customer").click();
    const t = page.locator('[role="tab"][data-tucked]');
    await t.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(t).toBeFocused();
  });

  test("the palette", async ({ app, page }) => {
    await app.open();
    await app.pane("orders").click({ position: { x: 100, y: 10 } });
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("a curated page's tabs", async ({ app, page }) => {
    await app.open({ path: review("?page=loan-review&item=4&tab=borrower") });
    await expect(page.getByRole("tablist", { name: "Loan review views" })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("the check catches a control nested in a tab", async ({ app, page }) => {
    await app.open();
    await app.tuck("customer").click();
    await expect(page.locator('[role="tab"][data-tucked]')).toHaveCount(1);
    await page.evaluate(() => {
      const tab = document.querySelector('[data-jali] [role="tab"]')!;
      const b = document.createElement("button");
      b.textContent = "Nested";
      tab.append(b);
    });
    expect((await axe(page)).map((v) => v.id)).toContain("nested-interactive");
  });
});
