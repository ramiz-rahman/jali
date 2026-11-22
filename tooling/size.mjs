#!/usr/bin/env node
/**
 * What an app ships of Jali. Builds each scenario in tooling/size/ with `vp build` in production mode against the
 * packed dist (run `pnpm build:packages` first; `pnpm size` does), each package in a chunk of its own, and prints
 * minified and gzipped bytes per package. Fails when a package's share of a scenario is over its budget.
 *
 *   node tooling/size.mjs              every scenario, with the budget check
 *   node tooling/size.mjs minimal      one scenario
 *   node tooling/size.mjs --modules    also list the source files of @jali/* each scenario ships, largest first
 *   node tooling/size.mjs --json       the numbers as JSON
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Gzipped KB budgets per scenario and package: about 5% over what each shipped after phase 3b, and never above the
// budget the same app had before it (minimal, full, own-icons, layout: the owner's, 22 Nov 2026). docs/DECISIONS.md,
// "Phase 3b's size", has the numbers and what each feature adds over the floor.
const BUDGETS = {
  bare: { core: 54.5, react: 24.7, css: 8.6, phosphor: 0 },
  minimal: { core: 55.5, react: 24.7, css: 8.6, phosphor: 0 },
  full: { core: 60.9, react: 29.9, css: 8.6, phosphor: 1.7 },
  "own-icons": { core: 55.5, react: 27.5, css: 8.6, phosphor: 0 },
  headless: { core: 48.7 },
  layout: { core: 10.7 },
  "+url": { core: 55.5, react: 24.7 },
  "+palette": { core: 54.7, react: 25.7 },
  "+settings": { core: 55, react: 25.6 },
  "+chooser": { core: 54.7, react: 26 },
  "+rename": { core: 54.6, react: 25.1 },
  "+popOut": { core: 54.6, react: 25.9 },
  "+pressed": { core: 54.5, react: 25.1 },
  "+defaults": { core: 55.5, react: 27.5 },
  "+page": { core: 59.7, react: 25.9 },
};

// What each feature brings, by source file: no scenario without the feature may ship any of it (more than a stray
// mapping's few bytes). Words live in one file, one export per feature, so they are checked by scenario too.
const FEATURE_FILES = {
  url: ["core/src/features/url-sync.ts", "core/src/url.ts"],
  palette: ["react/src/dialogs/Palette.tsx"],
  settings: ["react/src/dialogs/Settings.tsx"],
  chooser: ["react/src/dialogs/Chooser.tsx"],
  rename: ["react/src/pane/RenameField.tsx", "core/src/features/rename.ts"],
  popOut: ["react/src/features/pop-out.tsx", "core/src/features/pop-out.ts"],
  pressed: ["react/src/features/pressed.ts"],
  page: [
    "core/src/actions/page.ts",
    "core/src/state/page-messages.ts",
    "react/src/chrome/PageBar.tsx",
  ],
};
// Development-only code, which no production build ships (dev-options.ts: unknown options and where they went).
const DEV_ONLY = ["core/src/dev-options.ts"];
const without = (...have) =>
  Object.entries(FEATURE_FILES)
    .filter(([name]) => !have.includes(name))
    .flatMap(([, files]) => files)
    .concat(DEV_ONLY);

// The per-feature scenarios: the floor (bare.tsx) and one feature, written as they
// run (tooling/size/.entries/). Each one's budget is set from what it ships (docs/DECISIONS.md, "Phase 3b's size").
const FEATURE_SCENARIOS = {
  url: { imports: 'import { urlSync } from "jali/url";', features: "[urlSync()]" },
  palette: { imports: 'import { palette } from "jali/palette";', features: "[palette()]" },
  settings: { imports: 'import { settings } from "jali/settings";', features: "[settings()]" },
  chooser: { imports: 'import { chooser } from "jali/chooser";', features: "[chooser()]" },
  rename: {
    imports: 'import { rename } from "jali/rename";',
    features: "[rename({ run: () => {} })]",
  },
  popOut: { imports: 'import { popOut } from "jali/pop-out";', features: "[popOut()]" },
  pressed: { imports: 'import { pressed } from "jali/pressed";', features: "[pressed()]" },
  defaults: {
    imports: 'import { defaultFeatures } from "jali/features";',
    features: "defaultFeatures()",
  },
};

// Scenario → entry file in tooling/size/ (or a generated one); gzipped budgets in KB, about 5% over what each
// shipped after phase 3b (docs/DECISIONS.md has the numbers); and source files it must not ship.
const SCENARIOS = {
  // The floor: one kind, a starting layout, no feature, no curated page, no launcher.
  bare: { entry: "bare.tsx", budget: BUDGETS.bare, mustNotShip: without() },
  // examples/minimal without its fonts: the floor and the address (`urlSync()`).
  minimal: { entry: "minimal.tsx", budget: BUDGETS.minimal, mustNotShip: without("url") },
  // Every feature: defaultFeatures(), rename and pop out, a curated page, presets, a launcher, host commands and hooks.
  full: { entry: "full.tsx", budget: BUDGETS.full, mustNotShip: DEV_ONLY },
  // examples/own-icons: the host's own icon for every name, with defaultFeatures().
  "own-icons": {
    entry: "../../examples/own-icons/src/main.tsx",
    budget: BUDGETS["own-icons"],
    mustNotShip: without("url", "palette", "settings", "chooser", "pressed"),
  },
  // The workspace without React, and without any feature.
  headless: { entry: "headless.ts", budget: BUDGETS.headless, mustNotShip: without() },
  // Only the pure layout tree: the builders and the `layout` namespace. No workspace, keyboard or curated page.
  layout: {
    entry: "layout.ts",
    budget: BUDGETS.layout,
    mustNotShip: [
      "core/src/state/store.ts",
      "core/src/state/apply.ts",
      "core/src/commands/keyboard.ts",
      "core/src/commands/registry.ts",
      ...without(),
    ],
  },
  // Each feature on its own, over the floor: what that feature adds.
  ...Object.fromEntries(
    Object.keys(FEATURE_SCENARIOS).map((name) => [
      `+${name}`,
      {
        entry: null,
        feature: name,
        budget: BUDGETS[`+${name}`],
        mustNotShip:
          name === "defaults"
            ? without("url", "palette", "settings", "chooser", "pressed")
            : without(name),
      },
    ]),
  ),
  // A curated page over the floor (definePage, from jali/page).
  "+page": { entry: "page.tsx", budget: BUDGETS["+page"], mustNotShip: without("page") },
};

/** The entry of a generated feature scenario: bare.tsx with the feature's import and `features`. */
function featureEntry(name) {
  const { imports, features } = FEATURE_SCENARIOS[name];
  const bare = readFileSync(join(root, "tooling/size/bare.tsx"), "utf8");
  // Beside the scenarios, so it resolves React as they do; git ignores the folder.
  const dir = join(root, "tooling", "size", ".entries");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.tsx`);
  writeFileSync(
    file,
    bare
      .replace('import "jali/styles.css";', `${imports}\nimport "jali/styles.css";`)
      .replace(
        "  layout: row(note({ id: 1 }), note({ id: 2 })),\n",
        `  layout: row(note({ id: 1 }), note({ id: 2 })),\n  features: ${features},\n`,
      ),
  );
  return file;
}

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

if (!existsSync(join(root, "packages", "jali", "dist", "index.js")))
  throw new Error("packages/jali/dist is missing: run pnpm build:packages first");

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
  execFileSync("pnpm", ["exec", "vp", "build", "--config", "tooling/size/vite.config.ts"], {
    cwd: root,
    env: {
      ...process.env,
      SIZE_SCENARIO: name.replace("+", "plus-"),
      SIZE_ENTRY: entry,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const assets = join(root, "node_modules", ".size", name.replace("+", "plus-"), "assets");
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
for (const [name, { entry, feature, budget }] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  const { parts, modules } = build(name, entry ?? featureEntry(feature));
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
    "jali (core)",
    "jali (react)",
    "styles.css",
    "phosphor",
    "react-dom",
    "app",
  ];
  console.log("Minified / gzipped KB, per package (budget on gzipped, in brackets)\n");
  console.log(head.map((h, i) => (i ? h.padStart(20) : h.padEnd(12))).join(""));
  for (const [name, { parts, budget, over }] of Object.entries(results)) {
    const cells = cols.map((c) => {
      const p = parts[c];
      const cell = p ? `${kb(p.min)} / ${kb(p.gzip)}` : "-";
      const b = budget[c] ? ` [${budget[c]}]` : "";
      return `${cell}${b}${over.includes(c) ? "!" : ""}`.padStart(20);
    });
    console.log(name.padEnd(12) + cells.join(""));
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
