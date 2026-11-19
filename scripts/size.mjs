#!/usr/bin/env node
/**
 * What an app ships of Jali. Builds each scenario in scripts/size/ with `vp build` in production mode against the
 * packed dist (run `pnpm build:packages` first; `pnpm size` does), each package in a chunk of its own, and prints
 * minified and gzipped bytes per package. Fails when a package's share of a scenario is over its budget.
 *
 *   node scripts/size.mjs              every scenario, with the budget check
 *   node scripts/size.mjs minimal      one scenario
 *   node scripts/size.mjs --modules    also list the source files of @jali/* each scenario ships, largest first
 *   node scripts/size.mjs --json       the numbers as JSON
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Scenario → entry file in scripts/size/; gzipped budgets in KB, about 10% over what each shipped on 19 Nov 2026
// (docs/DECISIONS.md has the numbers); and source files it must not ship (more than a stray mapping's few bytes).
const SCENARIOS = {
  // One kind, no curated page, no launcher: examples/minimal without its fonts.
  minimal: { entry: "minimal.tsx", budget: { core: 45, react: 13.5, css: 7.3, phosphor: 10 } },
  // Every feature: a curated page, presets, a launcher, URL sync, host commands and the hooks.
  full: { entry: "full.tsx", budget: { core: 45, react: 14, css: 7.3, phosphor: 11 } },
  // examples/bare-icons: @jali/react/bare with the host's own icons, so no Phosphor.
  bare: {
    entry: "../../examples/bare-icons/src/main.tsx",
    budget: { core: 45, react: 13, css: 7.3, phosphor: 0 },
  },
  // The workspace without React.
  headless: { entry: "headless.ts", budget: { core: 41.5 } },
  // Only the pure layout tree: the builders and the `layout` namespace. No workspace, keyboard or curated page.
  layout: {
    entry: "layout.ts",
    budget: { core: 9.6 },
    mustNotShip: [
      "core/src/state/store.ts",
      "core/src/state/apply.ts",
      "core/src/commands/keyboard.ts",
      "core/src/commands/registry.ts",
      "core/src/actions/page.ts",
      "core/src/url.ts",
    ],
  },
};
const PACKAGES = {
  core: "jali-core",
  react: "jali-react",
  react_dom: "react",
  phosphor: "phosphor",
};

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const showModules = args.includes("--modules");
const asJson = args.includes("--json");

for (const pkg of ["core", "react"])
  if (!existsSync(join(root, "packages", pkg, "dist", "index.js")))
    throw new Error(`packages/${pkg}/dist is missing: run pnpm build:packages first`);

const kb = (n) => (n / 1024).toFixed(1);
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

// ---------- source maps: which source file each shipped byte comes from ----------
const B64 = Object.fromEntries(
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].map((c, i) => [c, i]),
);
function vlq(segment) {
  const out = [];
  let value = 0;
  let shift = 0;
  for (const c of segment) {
    const digit = B64[c];
    value += (digit & 31) << shift;
    if (digit & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = shift = 0;
    }
  }
  return out;
}
/** Bytes of `code` per source file of `map`, minified (generated columns between one mapping and the next). */
function bytesPerSource(code, map) {
  const lines = code.split("\n");
  const per = {};
  let source = 0;
  map.mappings.split(";").forEach((line, row) => {
    let col = 0;
    const segs = line ? line.split(",").map(vlq) : [];
    const starts = [];
    for (const seg of segs) {
      col += seg[0];
      if (seg.length > 1) source += seg[1];
      starts.push([col, seg.length > 1 ? source : -1]);
    }
    const len = (lines[row] ?? "").length;
    starts.forEach(([c, src], i) => {
      if (src < 0) return;
      const name = map.sources[src];
      per[name] = (per[name] ?? 0) + ((starts[i + 1]?.[0] ?? len) - c);
    });
  });
  return per;
}

function build(name, entry) {
  execFileSync("pnpm", ["exec", "vp", "build", "--config", "scripts/size/vite.config.ts"], {
    cwd: root,
    env: { ...process.env, SIZE_SCENARIO: name, SIZE_ENTRY: entry, NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const assets = join(root, "node_modules", ".size", name, "assets");
  const parts = {};
  const modules = {};
  for (const file of readdirSync(assets)) {
    if (file.endsWith(".map")) continue;
    const chunk = file.replace(/-[\w-]{8}\.(js|css)$/, "");
    const ext = file.endsWith(".css") ? "css" : "js";
    const key =
      ext === "css"
        ? chunk === "jali-react"
          ? "css"
          : "app"
        : (Object.entries(PACKAGES).find(([, c]) => c === chunk)?.[0] ?? "app");
    const buf = readFileSync(join(assets, file));
    parts[key] ??= { min: 0, gzip: 0 };
    parts[key].min += buf.length;
    parts[key].gzip += gz(buf);
    if (ext === "js" && existsSync(join(assets, `${file}.map`))) {
      const map = JSON.parse(readFileSync(join(assets, `${file}.map`), "utf8"));
      for (const [src, n] of Object.entries(bytesPerSource(buf.toString("utf8"), map))) {
        const id = src.replace(/^.*?packages[\\/]/, "").replace(/^.*node_modules[\\/]/, "");
        modules[id] = (modules[id] ?? 0) + n;
      }
    }
  }
  return { parts, modules };
}

const results = {};
let failed = false;
for (const [name, { entry, budget }] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  const { parts, modules } = build(name, entry);
  const over = Object.entries(budget).filter(([k, limit]) => (parts[k]?.gzip ?? 0) / 1024 > limit);
  const leaks = (SCENARIOS[name].mustNotShip ?? []).filter((src) => (modules[src] ?? 0) > 50);
  if (over.length || leaks.length) failed = true;
  results[name] = { parts, budget, over: over.map(([k]) => k), leaks, modules };
}

if (asJson) {
  for (const r of Object.values(results)) delete r.modules;
  console.log(JSON.stringify(results, null, 2));
} else {
  const cols = ["core", "react", "css", "phosphor", "react_dom", "app"];
  const head = [
    "scenario",
    "@jali/core",
    "@jali/react",
    "styles.css",
    "phosphor",
    "react-dom",
    "app",
  ];
  console.log("Minified / gzipped KB, per package (budget on gzipped, in brackets)\n");
  console.log(head.map((h, i) => (i ? h.padStart(20) : h.padEnd(10))).join(""));
  for (const [name, { parts, budget, over }] of Object.entries(results)) {
    const cells = cols.map((c) => {
      const p = parts[c];
      const cell = p ? `${kb(p.min)} / ${kb(p.gzip)}` : "-";
      const b = budget[c] ? ` [${budget[c]}]` : "";
      return `${cell}${b}${over.includes(c) ? "!" : ""}`.padStart(20);
    });
    console.log(name.padEnd(10) + cells.join(""));
  }
  if (showModules)
    for (const [name, { modules }] of Object.entries(results)) {
      console.log(`\n${name}: @jali source files shipped (minified bytes)`);
      const rows = Object.entries(modules)
        .filter(([id]) => /^(core|react)[\\/]src/.test(id))
        .sort((a, b) => b[1] - a[1]);
      for (const [id, n] of rows) console.log(`  ${String(n).padStart(7)}  ${id}`);
    }
}

if (failed) {
  for (const [name, { over, leaks }] of Object.entries(results)) {
    for (const k of over) console.error(`size: ${name} ships more ${k} than its budget`);
    for (const src of leaks) console.error(`size: ${name} ships ${src}, which it should not`);
  }
  process.exit(1);
}
