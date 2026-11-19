import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** screens/<name>.png, beside e2e/. */
const shot = (name: string) => join(test.info().project.testDir, "..", "screens", `${name}.png`);

// The screenshots in screens/: every layout at a wide, a medium and a narrow width, a phone, and dark mode.
// Only with SCREENS=1: `SCREENS=1 pnpm exec playwright test -c examples/studio screens`.
test.skip(!process.env.SCREENS, "SCREENS=1 writes the screenshots");

const SIZES = [
  { name: "wide", width: 1440, height: 900 },
  { name: "medium", width: 1100, height: 800 },
  { name: "narrow", width: 760, height: 900 },
] as const;
const LAYOUTS = ["edit", "mix", "review", "compare"] as const;

/** Open a layout, go to the winter storm and play a moment: a session in the middle, every pane following it. */
async function stage(page: Page, preset: string, { dark = false } = {}) {
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("group", { name: "Transport" }).getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  const select = page.locator(".layouts-select select");
  if (await select.isVisible()) await select.selectOption(preset);
  else
    await page
      .getByRole("navigation", { name: "Layouts" })
      .locator("button")
      .nth(LAYOUTS.indexOf(preset as (typeof LAYOUTS)[number]))
      .click();
  await page.waitForTimeout(300);
  await page.locator("body").press("/");
  await page.getByRole("combobox", { name: "Go to segment…" }).fill("winter storm");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await page.waitForTimeout(2600);
}

for (const size of SIZES) {
  for (const preset of LAYOUTS) {
    test(`${preset} at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await stage(page, preset);
      await page.screenshot({ path: shot(`${preset}-${size.name}`) });
    });
  }
}

for (const preset of ["edit", "mix"] as const) {
  test(`${preset} in dark`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stage(page, preset, { dark: true });
    await page.screenshot({ path: shot(`${preset}-wide-dark`) });
  });
}

test("a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stage(page, "edit");
  await page.screenshot({ path: shot("edit-phone") });
});
