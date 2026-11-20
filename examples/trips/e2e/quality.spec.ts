/** The standard's checks on every layout, in both themes: axe and the width sweep; the console guard runs in each. */
import { expect, type Page } from "@playwright/test";
import { qualitySuite } from "../../shared/e2e/quality";

const LAYOUTS = ["Plan", "Days", "Stay", "Budget"];

/** The trip on `name`'s layout, once its panes are on screen. */
async function open(page: Page, name: string) {
  await page.goto("/");
  await expect(page.locator(".jali-pane").first()).toBeVisible();
  const key = page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
  await key.click();
  await expect(key).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".jali-pane").first()).toBeVisible();
}

qualitySuite({
  storage: "trips-thailand",
  layouts: LAYOUTS.map((name) => ({ name, open: (page) => open(page, name) })),
  // Days' week is a row that scrolls: the six dividers between its seven days.
  axeKnown: Array.from({ length: 6 }, (_, i) => ({
    rule: "aria-valid-attr-value",
    target: `div[data-divider="week:${i}"]`,
    reason:
      'Jali gives a divider in a row that scrolls aria-valuemax="Infinity" (trips/FINDINGS.md, 12)',
  })),
});
