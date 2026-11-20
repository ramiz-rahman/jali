#!/usr/bin/env node
/**
 * What a reader's browser loads and how the page settles, on the built site. Serve dist/ first
 * (`pnpm exec astro preview --port 5400 --ignore-lock` in apps/docs), then:
 *
 *   node apps/docs/scripts/measure.mjs [http://localhost:5400] [/ /learn/fitting …]
 *
 * For each page, twice: a phone profile like Lighthouse's mobile run (390×844, CPU 4× slower, 150 ms round trips,
 * 1.6 Mbps down) and a desktop one (1440×900, no throttling). It prints the JavaScript the page loads (each file's
 * size gzipped, from dist/, since the preview server doesn't compress), CSS likewise, LCP, CLS, and the total
 * blocking time of long tasks until the page is quiet. Interaction (search, demos) is not part of the numbers.
 */
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const args = process.argv.slice(2);
const base = args.find((a) => /^https?:/.test(a)) ?? "http://localhost:5400";
const paths = args.filter((a) => a.startsWith("/"));
if (!paths.length) paths.push("/", "/learn/fitting", "/guides/theming");

const gz = (file) => (existsSync(file) ? gzipSync(readFileSync(file), { level: 9 }).length : 0);

const PROFILES = {
  phone: {
    viewport: { width: 390, height: 844 },
    cpu: 4,
    net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: 96000 },
  },
  desktop: { viewport: { width: 1440, height: 900 }, cpu: 1, net: null },
};

async function measure(browser, path, profile) {
  const p = PROFILES[profile];
  const context = await browser.newContext({ viewport: p.viewport });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (p.net) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...p.net });
  if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  await page.addInitScript(() => {
    const w = window;
    w.__perf = { lcp: 0, cls: 0, tbt: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) w.__perf.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: "longtask", buffered: true });
  });
  const files = { js: new Set(), css: new Set() };
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(base).origin) return;
    if (u.pathname.endsWith(".js") || u.pathname.endsWith(".mjs")) files.js.add(u.pathname);
    if (u.pathname.endsWith(".css")) files.css.add(u.pathname);
  });
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const perf = await page.evaluate(() => window.__perf);
  // Inline <script> and <style> count too: they are part of the HTML the reader downloads.
  const html = await (await fetch(base + path)).text();
  const inlineJs = [
    ...html.matchAll(
      /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((m) => m[1])
    .join("");
  await context.close();
  const sum = (set) => [...set].reduce((t, f) => t + gz(join(dist, f)), 0);
  return {
    path,
    profile,
    jsFiles: files.js.size,
    jsKB: (sum(files.js) + gzipSync(inlineJs).length) / 1024,
    cssKB: sum(files.css) / 1024,
    htmlKB: gzipSync(html).length / 1024,
    lcp: perf.lcp,
    cls: perf.cls,
    tbt: perf.tbt,
  };
}

const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
for (const path of paths)
  for (const profile of Object.keys(PROFILES)) rows.push(await measure(browser, path, profile));
await browser.close();

console.log(
  "| Page | Profile | JS files | JS (KB gz) | CSS (KB gz) | HTML (KB gz) | LCP (ms) | CLS | TBT (ms) |",
);
console.log("| --- | --- | --: | --: | --: | --: | --: | --: | --: |");
for (const r of rows)
  console.log(
    `| ${r.path} | ${r.profile} | ${r.jsFiles} | ${r.jsKB.toFixed(1)} | ${r.cssKB.toFixed(1)} | ${r.htmlKB.toFixed(1)} | ${Math.round(r.lcp)} | ${r.cls.toFixed(3)} | ${Math.round(r.tbt)} |`,
  );
