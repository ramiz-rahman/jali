/**
 * Every page in the built sitemap loads and hydrates cleanly: no console error, no uncaught error, and no React
 * hydration mismatch (a mismatch makes React throw the prerendered page away and render it again in the browser).
 * Runs in both platform projects (playwright.config.ts), since the same HTML must hydrate for Mac and other readers.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "./platform";

/**
 * C14 (docs/QUALITY-REVIEW.md): the shell reads the platform during render, so the prerendered HTML matches the
 * machine that built it, and readers on the other platform get a hydration mismatch on every page. Until that fix is
 * merged, hydration errors on the other platform are expected: they are listed as annotations instead of failing,
 * any other error still fails, and the test fails once they stop happening, so this allowance is removed with the fix.
 * Set to true (or delete the allowance) when C14 lands.
 */
const C14_FIXED = false;

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

test("every page in the sitemap loads and hydrates without an error", async ({
  page,
  platform,
}, info) => {
  const builtOnMac = process.platform === "darwin";
  const known = !C14_FIXED && builtOnMac !== /Mac/.test(platform);
  if (known)
    info.annotations.push({
      type: "known issue",
      description: `C14: built on ${builtOnMac ? "a Mac" : "another platform"}, read on ${platform}; hydration errors are expected until C14 is merged`,
    });

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
  const hydration: string[] = [];
  for (const path of paths) {
    messages = [];
    await test.step(path, async () => {
      const res = await page.goto(path, { waitUntil: "load" });
      expect(res?.status(), `${path}: HTTP status`).toBe(200);
      // The shell is one island (client:load); it has hydrated when Astro drops its `ssr` attribute.
      await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"), null, {
        timeout: 15_000,
      });
      // Effects after hydration, and anything they load.
      await page.waitForLoadState("networkidle");
    });
    for (const m of messages) {
      if (known && HYDRATION.test(m)) hydration.push(path);
      else failures.push(`${path}  ${m}`);
    }
  }

  if (known) {
    const pages = [...new Set(hydration)];
    const said = `C14 (known, expected until merged): ${pages.length} of ${paths.length} pages fail to hydrate on ${platform}`;
    info.annotations.push({ type: "C14", description: said });
    console.log(said);
    expect(
      pages.length,
      "C14 looks fixed (no hydration errors on the other platform): set C14_FIXED",
    ).toBeGreaterThan(0);
  }
  expect(failures, "console errors, page errors and hydration warnings").toEqual([]);
});
