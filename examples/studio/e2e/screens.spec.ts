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
    page
      .getByRole("group", { name: "Transport" })
      .getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  const select = page.locator(".layout-menu select");
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

// Close-ups of the top row: one row of full-height blocks at every width.
for (const [name, width, height, dark] of [
  ["toprow-wide", 1440, 900, false],
  ["toprow-wide-dark", 1440, 900, true],
  ["toprow-medium", 1100, 800, false],
  ["toprow-phone", 390, 844, false],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await stage(page, "edit", { dark });
    const box = (await page.locator(".topbar").boundingBox())!;
    await page.screenshot({ path: shot(name), clip: { x: 0, y: 0, width: box.width, height: box.height + 16 } });
  });
}

// The header-button treatments (a temporary comparison switch, ui/headerButtons.ts), each light and dark: the
// headers of the first three panes, with the pointer over the transcript's close button.
for (const [letter, variant] of [
  ["a", "printed"],
  ["b", "wells"],
  ["c", "strip"],
  ["d", "round"],
] as const) {
  for (const dark of [false, true]) {
    test(`header buttons ${variant}${dark ? " dark" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width: 1100, height: 700 });
      await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
      await page.addInitScript(
        (v) => localStorage.setItem("studio:header-buttons", JSON.stringify(v)),
        variant,
      );
      await page.goto("/");
      await expect(page.locator(".jali-pane").first()).toBeVisible();
      await page.waitForTimeout(800);
      const box = (await page.locator(".jali-pane").first().boundingBox())!;
      await page
        .locator('.jali-pane[data-pane="transcript"] .jali-pane-actions button')
        .last()
        .hover();
      await page.screenshot({
        path: shot(`header-buttons-${letter}${dark ? "-dark" : ""}`),
        clip: { x: 0, y: box.y - 4, width: 1100, height: 60 },
      });
    });
  }
}

// The top bar at 2x device scale, light and dark: the slab's edges, grain and pockets at full resolution.
for (const dark of [false, true]) {
  test(`toprow-wide@2x${dark ? " dark" : ""}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    await stage(page, "edit", { dark });
    const box = (await page.locator(".topbar").boundingBox())!;
    await page.screenshot({
      path: shot(`toprow-wide${dark ? "-dark" : ""}@2x`),
      clip: { x: 0, y: 0, width: box.width, height: box.height + 16 },
    });
    await context.close();
  });
}
