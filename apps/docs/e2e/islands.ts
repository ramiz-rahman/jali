import { expect, type Page } from "@playwright/test";

/**
 * Scroll every island (a live part, src/shell/island.tsx) into view, then wait until each has hydrated
 * (src/client/islands.ts marks it `data-hydrated`). Returns how many the page has.
 */
export async function hydrateAll(page: Page): Promise<number> {
  const islands = page.locator("[data-island]");
  const n = await islands.count();
  for (let i = 0; i < n; i++) {
    const island = islands.nth(i);
    await island.evaluate((el) => (el.firstElementChild ?? el).scrollIntoView());
    await expect(island).toHaveAttribute("data-hydrated", "", { timeout: 15_000 });
  }
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
  return n;
}
