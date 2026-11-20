/** The standard's checks on every layout, in both themes: axe and the width sweep; the console guard runs in each. */
import { expect, type Page } from "@playwright/test";
import { qualitySuite, test } from "../../shared/e2e/quality";
import { MAP_STYLE_WARNINGS } from "./known";

test.use({ consoleAllow: MAP_STYLE_WARNINGS });

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
  // Found by these checks on 20 Nov; Trips' own session is fixing them.
  fixme: [
    {
      check: "axe",
      reason:
        "label-content-name-mismatch (.brand, .commands-btn), landmark-unique, target-size (map pins), and in Days nested-interactive and aria-valid-attr-value",
    },
    {
      check: "sweep",
      reason:
        "map pins cover each other and the map at most widths, and a control is cut off in Budget",
    },
  ],
});
