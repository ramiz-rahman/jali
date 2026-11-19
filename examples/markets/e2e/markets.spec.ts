import { expect, test, type Page } from "@playwright/test";

const title = (page: Page, pane: string) =>
  page.locator(`.jali-pane[data-pane="${pane}"] .jali-pane-header`);
const desk = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Desks" }).getByRole("button", { name });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Equities" })).toBeVisible();
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
  await expect(page.getByRole("alertdialog")).toContainText("unsent order to buy 200 HRBK");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(desk(page, "FX")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("form", { name: "Order ticket" }).getByLabel(/Quantity/)).toHaveValue(
    "200",
  );
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
