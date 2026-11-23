/**
 * Every link on the Examples page opens its app in the state it promises (apps/docs/src/examples/data.ts): the app
 * loads from its folder with its panes and no error, a preset link opens that preset, and each "How it works" page
 * is there. The hosted apps and the page's apps are the same six.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { EXAMPLES, appPath } from "../../apps/docs/src/examples/data";

const site = JSON.parse(readFileSync(new URL("../../site/site.json", import.meta.url), "utf8")) as {
  examples: { name: string }[];
};

test("the site hosts exactly the apps the Examples page shows", () => {
  expect(site.examples.map((e) => e.name).sort()).toEqual(EXAMPLES.map((a) => a.id).sort());
});

for (const app of EXAMPLES)
  for (const show of app.shows)
    test(`${app.name}: "${show.title}" opens ${show.link}`, async ({ page, baseURL }) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("response", (r) => {
        if (r.url().startsWith(baseURL!) && r.status() >= 400)
          problems.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(appPath(app.id, show.link));
      await expect(page.locator("section[data-pane]").first()).toBeVisible({ timeout: 30_000 });
      const preset = new URLSearchParams(show.link).get("preset");
      // The preset the link names is the one the app opened: it is still in the address once the panes are there.
      if (preset) await expect(page).toHaveURL(new RegExp(`[?&]preset=${preset}(&|$)`));
      expect(problems).toEqual([]);
    });

test('every "How it works" page on the Examples page is there', async ({ request }) => {
  const pages = [...new Set(EXAMPLES.flatMap((a) => a.shows.map((s) => s.learn).filter(Boolean)))];
  for (const path of pages) expect((await request.get(path!)).status(), path).toBe(200);
});
