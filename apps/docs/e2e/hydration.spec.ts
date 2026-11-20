import { expect, test, type Page } from "@playwright/test";

/**
 * The prerendered HTML must hydrate as it is, whatever machine built it and whatever machine reads it: React keeps
 * the server's DOM nodes (no mismatch), and the console stays clean. Best run against the built site
 * (`astro preview`), where the prerender is what readers get.
 */

const PLATFORMS = ["MacIntel", "Win32"] as const;

/** Pretend to be on `platform`, and keep the prerendered page's main node from before hydration. */
async function prepare(page: Page, platform: string) {
  await page.addInitScript((platform) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => platform });
    document.addEventListener("DOMContentLoaded", () => {
      (window as { prerendered?: Element | null }).prerendered = document.querySelector(
        "#content > article.article, #content .not-found",
      );
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

/** Wait until the island has hydrated and React has run its effects and the re-renders that follow. */
async function hydrated(page: Page) {
  await page.waitForSelector("astro-island:not([ssr])", { state: "attached" });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

const sameNode = (page: Page) =>
  page.evaluate(() => {
    const before = (window as { prerendered?: Element | null }).prerendered;
    return (
      !!before &&
      before.isConnected &&
      before === document.querySelector("#content > article.article, #content .not-found")
    );
  });

for (const platform of PLATFORMS) {
  const mac = platform === "MacIntel";

  test.describe(`on ${platform}`, () => {
    for (const path of ["/learn/fitting", "/", "/reference/react", "/learn/fitting#%"]) {
      test(`${path} hydrates the prerendered page as it is`, async ({ page }) => {
        const errors = await prepare(page, platform);
        await page.goto(path);
        await hydrated(page);
        expect(await sameNode(page)).toBe(true);
        await expect(page.locator(".search-button-kbd")).toHaveText(mac ? "⌘K" : "Ctrl K");
        await expect(page.locator("#content > article.article")).toBeVisible();
        expect(errors).toEqual([]);
      });
    }

    test("an unknown address hydrates the 404 file and names the address", async ({ page }) => {
      const errors = await prepare(page, platform);
      const res = await page.goto("/nope");
      expect(res?.status()).toBe(404);
      await hydrated(page);
      expect(await sameNode(page)).toBe(true);
      await expect(page.locator(".not-found .page-summary code")).toHaveText("/nope");
      expect(errors).toEqual([]);
    });
  });
}

test("Open in Claude sends the page's full Markdown address", async ({ page }) => {
  await page.goto("/learn/fitting");
  const href = await page.getByRole("link", { name: "Open in Claude" }).getAttribute("href");
  const prompt = new URL(href!).searchParams.get("q")!;
  expect(prompt).toMatch(/ at https?:\/\/[^/\s]+\/learn\/fitting\.md /);
});
