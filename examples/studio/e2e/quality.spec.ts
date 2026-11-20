/** The standard's checks on every layout, in both themes: axe and the width sweep; the console guard runs in each. */
import { expect, type Page } from "@playwright/test";
import { qualitySuite } from "../../shared/e2e/quality";

const LAYOUTS = ["Edit", "Mix", "Review", "Compare"];

/** The studio on `name`'s layout, once the session's tracks have decoded (Play is enabled). */
async function open(page: Page, name: string) {
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Sessions" })).toBeVisible();
  const play = page
    .getByRole("group", { name: "Transport" })
    .getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeEnabled({ timeout: 20_000 });
  const key = page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
  await key.click();
  await expect(key).toHaveAttribute("aria-pressed", "true");
}

qualitySuite({
  storage: "studio",
  layouts: LAYOUTS.map((name) => ({ name, open: (page) => open(page, name) })),
});
