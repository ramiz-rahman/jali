/**
 * The Examples page's screenshots: each hosted app at its first showcase link (apps/docs/src/examples/data.ts), at
 * 1440 × 900, in light and in dark, saved as WebP in apps/docs/public/media/examples/<id>-<theme>.webp. An app that
 * opens dark whatever the system says (`opens: "dark"`) has one, <id>-light.webp. Run it again when an app's look
 * changes; the files are committed.
 *
 *   node tooling/showcase-shots.mjs     (builds the site first; SITE_BUILT=1 uses the site/ already there)
 *
 * Needs `cwebp` (brew install webp).
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "apps/docs/public/media/examples");
const port = 5490;
const base = `http://localhost:${port}`;

if (process.env.SITE_BUILT !== "1")
  execFileSync("node", ["tooling/build-site.mjs"], { cwd: root, stdio: "inherit" });
const { EXAMPLES } = await import(join(root, "apps/docs/src/examples/data.ts"));

const server = spawn("node", ["tooling/serve-site.mjs", `--port=${port}`], { cwd: root });
await new Promise((ok) => server.stdout.once("data", ok));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    for (const app of EXAMPLES) {
      if (theme === "dark" && app.opens === "dark") continue;
      const page = await context.newPage();
      await page.goto(`${base}/apps/${app.id}/${app.shows[0].link}`);
      await page.locator("section[data-pane]").first().waitFor({ timeout: 30_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      // Fonts, map tiles and charts settle after the panes are there.
      await page.waitForTimeout(2500);
      const png = join(out, `${app.id}-${theme}.png`);
      await page.screenshot({ path: png });
      execFileSync("cwebp", ["-quiet", "-q", "82", png, "-o", png.replace(/\.png$/, ".webp")]);
      rmSync(png);
      console.log(`showcase-shots: ${app.id} (${theme})`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
