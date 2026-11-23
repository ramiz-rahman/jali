/** A smoke test of the app's main paths, on the stand-in Kraken (kraken.ts), with the console guard on. */
import type { Page } from "@playwright/test";
import { expect, test } from "../../shared/e2e/quality";
import { desk, openDesk } from "./open";

const title = (page: Page, pane: string) =>
  page.locator(`.jali-pane[data-pane="${pane}"] .jali-pane-header`);

test.beforeEach(async ({ page }) => {
  await openDesk(page);
});

test("moving through the watchlist moves the chart and the quote", async ({ page }) => {
  await expect(title(page, "chart")).toContainText("LMNA chart");
  const list = page.getByRole("listbox", { name: "Equities" });
  await list.getByRole("option", { name: /LMNA/ }).click();
  await page.keyboard.press("j");
  await expect(list.getByRole("option", { selected: true })).toContainText("QBTL");
  await expect(title(page, "chart")).toContainText("QBTL chart");
  await expect(title(page, "quote")).toContainText("QBTL quote");
  await expect(title(page, "book")).toContainText("QBTL book");
  await expect(page.locator('.jali-pane[data-pane="quote"] .quote-id b')).toHaveText("QBTL");
});

test("a desk switches the layout, and a reload keeps it from the address", async ({ page }) => {
  await desk(page, "Rates").click();
  await expect(page.locator('.jali-pane[data-pane="curve"]')).toBeVisible();
  await expect(title(page, "chart")).toContainText("GOV10Y chart");
  expect(new URL(page.url()).searchParams.get("l")).toBeTruthy();

  await page.reload();
  await expect(page.locator('.jali-pane[data-pane="curve"]')).toBeVisible();
  await expect(desk(page, "Rates")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("listbox", { name: "Rates" })).toBeVisible();
});

test("a typed order is unsaved work: a desk without the blotter asks first", async ({ page }) => {
  await desk(page, "FX").click();
  const ticket = page.getByRole("form", { name: "Order ticket" });
  await ticket.getByLabel("Instrument").fill("HRBK");
  await ticket.getByLabel(/Quantity/).fill("200");
  // The Rates desk has no blotter, so the ticket would go.
  await desk(page, "Rates").click();
  // Markets asks itself, naming the order, and keeping it is the first choice.
  const question = page.getByRole("alertdialog", { name: "Discard the unsent order?" });
  await expect(question).toContainText(
    "This change takes the blotter away, and with it an unsent order to buy 200 HRBK.",
  );
  await expect(question.getByRole("button", { name: "Keep the order" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(question).toBeHidden();
  await expect(desk(page, "FX")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("form", { name: "Order ticket" }).getByLabel(/Quantity/)).toHaveValue(
    "200",
  );
  await desk(page, "Rates").click();
  await question.getByRole("button", { name: "Discard" }).click();
  await expect(desk(page, "Rates")).toHaveAttribute("aria-pressed", "true");
});

test("/ asks for an instrument in Jali's chooser and opens its chart", async ({ page }) => {
  await page.getByRole("listbox", { name: "Equities" }).getByRole("option").first().click();
  await page.keyboard.press("/");
  const input = page.getByRole("combobox", { name: "Open chart for…" });
  await expect(input).toBeFocused();
  await input.fill("orb");
  await expect(
    page.getByRole("listbox", { name: "Choices" }).getByRole("option").first(),
  ).toContainText("ORBD");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
  await expect(page.locator(".jali-pane-header", { hasText: "ORBD chart" })).toBeVisible();
});

test("the list menu opens over the desk without hiding a pane, and switches the list", async ({
  page,
}) => {
  // A modal menu marks everything outside it aria-hidden; the panes must stay on screen.
  await page.getByRole("combobox", { name: "List" }).click();
  await expect(page.getByRole("option", { name: "Crypto" })).toBeVisible();
  for (const pane of ["watch", "chart", "book", "tape", "quote", "news"])
    await expect(page.locator(`.jali-pane[data-pane="${pane}"]`)).toBeVisible();
  await page.getByRole("option", { name: "Rates" }).click();
  await expect(page.getByRole("listbox", { name: "Rates" })).toBeVisible();
});

test("a desk comes back as it was left, and Reset puts every desk back", async ({ page }) => {
  const news = page.locator('.jali-pane[data-pane="news"]');
  await desk(page, "Rates").click();
  await expect(news).toBeVisible();
  await news.getByRole("button", { name: /close/i }).first().click();
  await expect(news).toHaveCount(0);

  await desk(page, "Equities").click();
  await expect(title(page, "chart")).toContainText("LMNA chart");
  await desk(page, "Rates").click();
  await expect(page.locator('.jali-pane[data-pane="curve"]')).toBeVisible();
  await expect(news).toHaveCount(0);

  await page.getByRole("button", { name: "Reset every desk to the demo layout" }).click();
  await expect(news).toBeVisible();
});
