/**
 * The screenshots in screens/: each layout at 1440, 1024 and 390 pixels wide, and Plan and Stay in dark.
 * Only with SCREENS=1: `SCREENS=1 pnpm exec playwright test -c examples/trips screens`.
 */
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.SCREENS, "SCREENS=1 writes the screenshots");

/** screens/<name>.png, beside e2e/. */
const shot = (name: string) => join(test.info().project.testDir, "..", "screens", `${name}.png`);

const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;
const LAYOUTS = ["Plan", "Days", "Stay", "Budget"] as const;

/** The layout at rest: chosen, its map's tiles and the photos on screen loaded, the fonts in, and two frames drawn. */
async function stage(page: Page, name: string, dark: boolean) {
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".jali-pane").first()).toBeVisible();
  const key = page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
  // A phone picks the layout from a menu instead.
  if (await key.isVisible()) await key.click();
  else
    await page
      .getByRole("combobox", { name: "Layout", exact: true })
      .selectOption(name.toLowerCase());
  await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
  // Every map on screen has drawn its tiles (it is busy until then).
  for (const map of await page.getByRole("region", { name: /^Map\. / }).all())
    if (await map.isVisible())
      await expect(map).not.toHaveAttribute("aria-busy", "true", { timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // The photos on screen; one further down a list loads lazily, and may never.
    const onScreen = (img: HTMLImageElement) => {
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    };
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete && onScreen(img))
        .map((img) => img.decode().catch(() => null)),
    );
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

for (const size of SIZES)
  for (const name of LAYOUTS)
    test(`${name} at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await stage(page, name, false);
      await page.screenshot({ path: shot(`${name.toLowerCase()}-${size.width}`) });
    });

for (const name of ["Plan", "Stay"])
  test(`${name} at 1440, dark`, async ({ page }) => {
    await page.setViewportSize(SIZES[0]);
    await stage(page, name, true);
    await page.screenshot({ path: shot(`${name.toLowerCase()}-1440-dark`) });
  });
