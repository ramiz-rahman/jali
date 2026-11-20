/** Opening Data Studio in the tests: on a preset, once every pane on screen has its data. */
import { expect, type Page } from "@playwright/test";

export const PRESETS = [
  "One table",
  "Order → customer chain",
  "Query + chart + inspector",
  "Stress: 10 panes",
] as const;

/** Waits until no pane on screen is loading. */
export async function loaded(page: Page) {
  await expect(page.locator("section[data-pane]:visible").first()).toBeVisible();
  await expect(
    page.locator('section[data-pane] [role="status"][aria-label="Loading"]'),
  ).toHaveCount(0, { timeout: 20_000 });
}

/** The app on `preset` (the default one when left out), with its data. */
export async function openPreset(page: Page, preset?: string, path = "/") {
  await page.goto(path);
  await loaded(page);
  if (preset) {
    const button = page.getByRole("navigation", { name: "Layout presets" }).getByRole("button", {
      name: preset,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await loaded(page);
  }
}
