/**
 * Every page in the built sitemap loads, and every island on it hydrates, cleanly: no console error, no uncaught
 * error, and no React hydration mismatch (a mismatch makes React throw an island's prerendered HTML away and render
 * it again). Runs in both platform projects (playwright.config.ts), since the same HTML must hydrate for Mac and
 * other readers (C14 in docs/QUALITY-REVIEW.md).
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./platform";
import { hydrateAll } from "./islands";

/** What React says about a mismatch: in development, and as the production build's minified errors. */
const HYDRATION =
  /hydrat|didn't match|did not match|Minified React error #(418|419|421|422|423|425)\b/i;

/** The page paths in the sitemap the server serves, whatever host the sitemap names. */
async function sitemapPaths(page: Page): Promise<string[]> {
  const locs = async (path: string) => {
    const res = await page.request.get(path);
    expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
    return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => new URL(m[1]!).pathname,
    );
  };
  const paths: string[] = [];
  for (const sitemap of await locs("/sitemap-index.xml")) paths.push(...(await locs(sitemap)));
  return paths;
}

test("every page in the sitemap loads and hydrates without an error", async ({ page }) => {
  const paths = await sitemapPaths(page);
  expect(paths.length, "pages in the sitemap").toBeGreaterThan(10);
  test.setTimeout(30_000 + paths.length * 10_000);

  let messages: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || (m.type() === "warning" && HYDRATION.test(m.text())))
      messages.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));

  const failures: string[] = [];
  for (const path of paths) {
    messages = [];
    await test.step(path, async () => {
      const res = await page.goto(path, { waitUntil: "load" });
      expect(res?.status(), `${path}: HTTP status`).toBe(200);
      await hydrateAll(page);
      // Effects after hydration, and anything they load.
      await page.waitForLoadState("networkidle");
    });
    for (const m of messages) failures.push(`${path}  ${m}`);
  }
  expect(failures, "console errors, page errors and hydration warnings").toEqual([]);
});
