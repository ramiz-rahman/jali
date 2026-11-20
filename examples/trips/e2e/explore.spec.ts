/**
 * Explore's results: a list of buttons with the add button beside each, never inside it, so nothing interactive
 * nests in another (axe's nested-interactive). The keyboard moves through them as through a day's stops.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await layout(page, "Stay").click();
  await expect(pane(page, "explore").getByRole("list", { name: "Places" })).toBeVisible();
});

test("the results have no accessibility violations, in light and dark", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const { violations } = await new AxeBuilder({ page })
      .include('.jali-pane[data-kind="explore"]')
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual(
      [],
    );
  }
});

test("one Tab stop for the list; the arrows move through it, A adds and Space peeks", async ({
  page,
}) => {
  const explore = pane(page, "explore");
  const list = explore.getByRole("list", { name: "Places" });
  // Down from the search field to the first result, which becomes the cursor.
  await explore.getByRole("searchbox").focus();
  await page.keyboard.press("ArrowDown");
  const first = list.locator(".result-main").first();
  await expect(first).toBeFocused();
  await expect(list.locator(".result").first()).toHaveAttribute("aria-current", "true");
  // Only the cursor's row is in the Tab order; the add buttons never are.
  await expect(list.locator('button[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  const second = list.locator(".result-main").nth(1);
  await expect(second).toBeFocused();
  await expect(list.locator(".result").nth(1)).toHaveAttribute("aria-current", "true");
  await expect(second).toHaveAttribute("tabindex", "0");
  // The place pane follows the cursor.
  const name = (await list.locator(".result-name").nth(1).textContent()) ?? "";
  await expect(pane(page, "place").locator(".place-name")).toHaveText(name);
  // A: stay at it (a stay is chosen at once), and the row says so.
  await page.keyboard.press("a");
  await expect(list.locator(".result").nth(1).locator(".result-yours")).toBeVisible();
  // Space peeks at it.
  await page.keyboard.press("Space");
  await expect(page.locator(".jali-peek")).toBeVisible();
});
