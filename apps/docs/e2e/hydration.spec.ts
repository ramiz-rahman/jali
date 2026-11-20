import { expect, test, type Page } from "@playwright/test";
import { hydrateAll } from "./islands";

/**
 * Pages are static HTML; only their islands (the live parts) hydrate. Each island must hydrate the HTML the build
 * wrote as it is, whatever machine built it and whatever machine reads it: React keeps the server's DOM nodes (no
 * mismatch), and the console stays clean. Run against the built site (`astro preview`), which is what readers get.
 */

const PLATFORMS = ["MacIntel", "Win32"] as const;

/** Pretend to be on `platform`, and keep each island's first element from before hydration. */
async function prepare(page: Page, platform: string) {
  await page.addInitScript((platform) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => platform });
    document.addEventListener("DOMContentLoaded", () => {
      (window as { prerendered?: (Element | null)[] }).prerendered = [
        ...document.querySelectorAll("[data-island]"),
      ].map((el) => el.firstElementChild);
    });
  }, platform);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // The 404 file is served with status 404, which Chrome reports as a failed load of the document itself.
    if (/^Failed to load resource: .*404/.test(m.text()) && m.location().url === page.url()) return;
    errors.push(m.text());
  });
  return errors;
}

const sameNodes = (page: Page) =>
  page.evaluate(() => {
    const before = (window as { prerendered?: (Element | null)[] }).prerendered ?? [];
    const now = [...document.querySelectorAll("[data-island]")].map((el) => el.firstElementChild);
    return before.length === now.length && before.every((el, i) => !!el && el === now[i]);
  });

for (const platform of PLATFORMS) {
  const mac = platform === "MacIntel";

  test.describe(`on ${platform}`, () => {
    for (const path of ["/learn/fitting", "/", "/get-started/quickstart", "/learn/fitting#%"]) {
      test(`${path} hydrates its islands on the prerendered HTML`, async ({ page }) => {
        const errors = await prepare(page, platform);
        await page.goto(path);
        expect(await hydrateAll(page)).toBeGreaterThan(0);
        expect(await sameNodes(page)).toBe(true);
        await expect(page.locator(".search-button-kbd")).toHaveText(mac ? "⌘K" : "Ctrl K");
        await expect(page.locator("#content > article.article")).toBeVisible();
        expect(errors).toEqual([]);
      });
    }

    test("a page with no live parts loads no React", async ({ page }) => {
      const errors = await prepare(page, platform);
      let bytes = 0;
      page.on("response", async (r) => {
        if (r.request().resourceType() === "script") bytes += (await r.body()).length;
      });
      await page.goto("/reference/react", { waitUntil: "networkidle" });
      await expect(page.locator("[data-island]")).toHaveCount(0);
      await expect(page.locator(".search-button-kbd")).toHaveText(mac ? "⌘K" : "Ctrl K");
      // The page's own script and Astro's prefetch, uncompressed: React alone would be ten times this.
      expect(bytes).toBeLessThan(20_000);
      expect(errors).toEqual([]);
    });

    test("an unknown address gets the 404 file, which names the address", async ({ page }) => {
      const errors = await prepare(page, platform);
      const res = await page.goto("/nope");
      expect(res?.status()).toBe(404);
      await expect(page.locator(".not-found .page-summary code")).toHaveText("/nope");
      expect(errors).toEqual([]);
    });
  });
}

test("a demo whose code fails to load says so, and Try again loads it", async ({ page }) => {
  // The islands' own code (the error boundary is one of their chunks), failing as on a dropped connection.
  let failing = true;
  await page.route(/\/_astro\/ErrorBoundary\.[^/]+\.js$/, (route) =>
    failing ? route.abort("internetdisconnected") : route.continue(),
  );
  await page.goto("/learn/fitting");
  const island = page.locator("[data-island]").first();
  await island.evaluate((el) => (el.firstElementChild ?? el).scrollIntoView());
  const alert = page.getByRole("alert").filter({ hasText: "This demo didn't load" }).first();
  await expect(alert).toBeVisible();
  await expect(island).not.toHaveAttribute("data-hydrated");

  // A try that fails again says so again, on the same button.
  const retry = alert.getByRole("button", { name: "Try again" });
  await retry.click();
  await expect(retry).toBeVisible();
  await expect(island).not.toHaveAttribute("data-hydrated");

  failing = false;
  await retry.click();
  await expect(island).toHaveAttribute("data-hydrated", "", { timeout: 15_000 });
  await expect(page.getByRole("alert").filter({ hasText: "This demo didn't load" })).toHaveCount(0);
});

test("Open in Claude sends the page's full Markdown address", async ({ page }) => {
  await page.goto("/learn/fitting");
  const href = await page.getByRole("link", { name: "Open in Claude" }).getAttribute("href");
  const prompt = new URL(href!).searchParams.get("q")!;
  expect(prompt).toMatch(/ at https?:\/\/[^/\s]+\/learn\/fitting\.md /);
});
