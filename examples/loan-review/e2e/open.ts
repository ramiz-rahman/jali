/** Opening Loan review in the tests: an application on one view, or in Split view, once its panes have their data. */
import { expect, type Page } from "@playwright/test";

/** The page's views, as its tabs name them, by the `tab` a link carries. */
export const VIEWS = {
  overview: "Overview",
  application: "Application",
  borrower: "Borrower",
  history: "Loan history",
  group: "Group",
  officer: "Field officer",
} as const;

export const mode = (page: Page, name: "Single" | "Split view") =>
  page.getByRole("radiogroup", { name: "View mode" }).getByRole("radio", { name });

/** Waits until no pane on screen is loading. */
export async function loaded(page: Page) {
  await expect(page.locator("section[data-pane]:visible").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
  await expect(
    page.locator('section[data-pane] [role="status"][aria-label="Loading"]'),
  ).toHaveCount(0, { timeout: 20_000 });
}

/** Application `item` on `tab` in Single, or in Split view when `split`. */
export async function openReview(
  page: Page,
  {
    item = 4,
    tab = "overview",
    split = false,
  }: { item?: number; tab?: string; split?: boolean } = {},
) {
  await page.goto(`/?page=loan-review&item=${item}&tab=${tab}`);
  await loaded(page);
  if (split) {
    await mode(page, "Split view").click();
    await expect(mode(page, "Split view")).toHaveAttribute("aria-checked", "true");
    await loaded(page);
  }
}
