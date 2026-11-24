/**
 * The Examples page's screenshots: each hosted app at its first showcase link (apps/docs/src/examples/data.ts), at
 * 1440 × 900 with twice the pixels (sharp on a high-density screen), in light and in dark, without the app's status
 * line (the panes take its room), saved as WebP in
 * apps/docs/public/media/examples/<id>-<theme>.webp. An app that opens dark whatever the system says
 * (`opens: "dark"`) has one, <id>-light.webp. Run it again when an app's look
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
      deviceScaleFactor: 2,
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
      // The status line (the full-width bar that holds the maker's mark) says who made the app, not what it does:
      // collapsed, so the panes take its room.
      const hid = await page.evaluate(() => {
        let el = document.querySelector(".maker");
        while (el && el.getBoundingClientRect().width < innerWidth * 0.9) el = el.parentElement;
        if (!el || el === document.body || el.getBoundingClientRect().height > 64) return false;
        // Collapsed rather than removed, so it keeps its place in the app's grid (Studio's rows go by order).
        el.style.cssText +=
          ";height:0;min-height:0;padding:0;border:0;overflow:hidden;box-shadow:none";
        // The shared shell gives it a fixed row (--status-h).
        for (const at of [document.documentElement, el.parentElement])
          at?.style.setProperty("--status-h", "0px");
        return true;
      });
      if (!hid) console.warn(`showcase-shots: ${app.id} has no status line to hide`);
      await page.waitForTimeout(800);
      const png = join(out, `${app.id}-${theme}.png`);
      await page.screenshot({ path: png });
      execFileSync("cwebp", ["-quiet", "-q", "78", png, "-o", png.replace(/\.png$/, ".webp")]);
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
