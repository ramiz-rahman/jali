/**
 * The hosted site works from its folders: the docs at the root, each example app under /apps/<name>/, every asset
 * from its own path, with no error on the page. Requests to other sites (map tiles, a market feed, live
 * measurements) are theirs to fail; everything the site serves must load.
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const { examples } = JSON.parse(
  readFileSync(new URL("../../site/site.json", import.meta.url), "utf8"),
) as { examples: { name: string; path: string }[] };

/** Watches a page for errors and for the site's own requests that fail. */
function watch(page: Page, origin: string) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().startsWith(origin) && r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(origin) && r.failure()?.errorText !== "net::ERR_ABORTED")
      problems.push(`failed ${r.url()}: ${r.failure()?.errorText}`);
  });
  return problems;
}

for (const { name, path } of examples) {
  test(`${name} opens from ${path}, with its panes and no errors`, async ({ page, baseURL }) => {
    const problems = watch(page, baseURL!);
    await page.goto(path);
    await expect(page.locator("section[data-pane]").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(problems).toEqual([]);
  });
}

test("an app's folder without its slash is sent to it", async ({ page }) => {
  await page.goto(examples[0]!.path.replace(/\/$/, ""));
  expect(new URL(page.url()).pathname).toBe(examples[0]!.path);
});

test("the docs open at the root, and their pages without a trailing slash", async ({
  page,
  baseURL,
}) => {
  const problems = watch(page, baseURL!);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/examples");
  await expect(page.getByRole("heading", { level: 1, name: "Examples" })).toBeVisible();
  expect(problems).toEqual([]);
});
