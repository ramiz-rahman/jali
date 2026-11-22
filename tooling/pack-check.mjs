#!/usr/bin/env node
/**
 * The packages as an app installs them, not as the workspace links them. Packs @jali/core and @jali/react with
 * `pnpm pack` (which builds them, and writes the published package.json: publishConfig's exports, no workspace:
 * ranges), unpacks both into a throwaway app's node_modules beside React, and then:
 *
 *   - checks each package.json: no workspace: range, and every export points at a file in the tarball;
 *   - checks every JavaScript file of @jali/react starts with "use client" (React Server Components hosts);
 *   - typechecks a consumer against the packed .d.ts;
 *   - builds examples/minimal against the tarballs with Vite (no "source" condition, so no workspace source);
 *   - renders a workspace on the server with the packed packages and hydrates it in jsdom, with no recoverable error.
 *
 *   pnpm pack-check
 *
 * Leaves nothing behind (node_modules/.pack-check/<pid> is removed). React is the repo's own (19); the React 18 gate
 * (tooling/test-react18.sh) covers 18 against the source.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, "node_modules", ".pack-check", String(process.pid));
const app = join(work, "app");
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`pack-check: ${msg}`);
};
const run = (cmd, args, cwd, env = process.env) =>
  execFileSync(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

rmSync(work, { recursive: true, force: true });
mkdirSync(join(app, "node_modules", "@jali"), { recursive: true });

try {
  // ---------- pack and unpack ----------
  for (const name of ["core", "react"]) {
    const dir = join(root, "packages", name);
    run("pnpm", ["pack", "--pack-destination", work], dir);
    const tgz = readdirSync(work).find((f) => f.startsWith(`jali-${name}-`) && f.endsWith(".tgz"));
    if (!tgz) throw new Error(`pnpm pack made no tarball for @jali/${name}`);
    const to = join(app, "node_modules", "@jali", name);
    mkdirSync(to, { recursive: true });
    run("tar", ["-xzf", join(work, tgz), "-C", to, "--strip-components", "1"], work);
    console.log(
      `pack-check: @jali/${name} ${(statSync(join(work, tgz)).size / 1024).toFixed(1)} KB packed`,
    );
  }

  // ---------- the published package.json ----------
  for (const name of ["core", "react"]) {
    const dir = join(app, "node_modules", "@jali", name);
    const text = readFileSync(join(dir, "package.json"), "utf8");
    if (text.includes("workspace:")) fail(`@jali/${name}'s package.json keeps a workspace: range`);
    const pkg = JSON.parse(text);
    const targets = [];
    const walk = (v) =>
      typeof v === "string" ? targets.push(v) : v && Object.values(v).forEach(walk);
    walk(pkg.exports);
    for (const t of targets)
      if (!existsSync(join(dir, t))) fail(`@jali/${name} exports ${t}, which the tarball lacks`);
    if (JSON.stringify(pkg.exports).includes('"source"'))
      fail(`@jali/${name}'s published exports keep the "source" condition`);
  }
  const reactDist = join(app, "node_modules", "@jali", "react", "dist");
  for (const f of readdirSync(reactDist).filter((f) => f.endsWith(".js")))
    if (!readFileSync(join(reactDist, f), "utf8").startsWith('"use client";'))
      fail(`@jali/react's dist/${f} doesn't start with "use client"`);

  // ---------- the app: examples/minimal, with the repo's React and fonts beside the tarballs ----------
  const minimal = join(root, "examples", "minimal");
  cpSync(join(minimal, "src"), join(app, "src"), { recursive: true });
  cpSync(join(minimal, "index.html"), join(app, "index.html"));
  const link = (from, name) => {
    const to = join(app, "node_modules", name);
    mkdirSync(dirname(to), { recursive: true });
    symlinkSync(join(from, "node_modules", name), to, "dir");
  };
  for (const name of ["react", "react-dom", "@fontsource/atkinson-hyperlegible-next"])
    link(minimal, name);
  link(minimal, "@fontsource/atkinson-hyperlegible-mono");
  for (const name of ["@types/react", "@types/react-dom", "jsdom"]) link(root, name);
  writeFileSync(join(app, "package.json"), '{ "name": "pack-check-app", "type": "module" }\n');

  // ---------- types ----------
  writeFileSync(
    join(app, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "es2022",
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      include: ["src/main.tsx", "src/css.d.ts"],
    }),
  );
  writeFileSync(join(app, "src", "css.d.ts"), 'declare module "*.css";\n');
  try {
    run(join(root, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], app);
  } catch (e) {
    fail(`the app doesn't typecheck against the packed types:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  }

  // ---------- the build ----------
  const { build, defaultClientConditions } = await import(
    pathToFileURL(
      join(root, "examples", "minimal", "node_modules", "vite-plus", "dist", "index.js"),
    ).href
  ).catch(() => import("vite-plus"));
  const react = (await import("@vitejs/plugin-react")).default;
  const out = await build({
    configFile: false,
    root: app,
    logLevel: "error",
    cacheDir: join(work, "vite-cache"),
    plugins: [react()],
    resolve: { conditions: [...defaultClientConditions] },
    build: { write: false, minify: true },
  });
  const chunks = (Array.isArray(out) ? out : [out])
    .flatMap((o) => o.output)
    .filter((c) => c.type === "chunk");
  const code = chunks.map((c) => c.code).join("\n");
  if (!code.includes("Open the next note beside")) fail("the app's build lacks the app");
  if (!code.includes("data-jali-icon")) fail("the app's build lacks Jali's icons");
  if (code.includes("/src/") && /packages\/(core|react)\/src\//.test(code))
    fail("the app's build reached the workspace's source");
  console.log(
    `pack-check: examples/minimal built from the tarballs, ${(code.length / 1024).toFixed(1)} KB of JavaScript`,
  );

  // ---------- server render, then hydrate ----------
  writeFileSync(
    join(app, "ssr.mjs"),
    `
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const note = definePane("note", { params: { id: Number }, title: ({ id }) => "Note " + id,
  Component: ({ params }) => h("p", null, "Note body " + params.id) });
const make = () => createJali({ panes: [note], layout: row(note({ id: 1 }), note({ id: 2 })),
  url: { location: memoryLocation() }, storage: memoryStorage(), size: { width: 1200, height: 800 },
  moveFocus: false });
const html = renderToString(h(JaliRoot, { jali: make() }));
if (!html.includes("Note body 2")) throw new Error("the server render lacks the panes");
const dom = new JSDOM("<!doctype html><div id=root>" + html + "</div>", { pretendToBeVisual: true });
const quiet = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "HTMLElement", "Element", "Node", "MutationObserver", "getComputedStyle",
  "requestAnimationFrame", "cancelAnimationFrame"])
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
dom.window.matchMedia ??= quiet;
globalThis.matchMedia = dom.window.matchMedia;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { hydrateRoot } = await import("react-dom/client");
const { act } = (await import("react")).default;
const errors = [];
await act(async () => {
  hydrateRoot(document.getElementById("root"), h(JaliRoot, { jali: make() }), {
    onRecoverableError: (e) => errors.push(String(e)),
  });
});
if (errors.length) throw new Error("hydration recovered from: " + errors.join("; "));
if (!document.body.textContent.includes("Note body 1")) throw new Error("hydration lost the panes");
console.log("pack-check: rendered on the server and hydrated, with no mismatch");
`,
  );
  try {
    process.stdout.write(
      run(process.execPath, ["ssr.mjs"], app, { ...process.env, NODE_ENV: "development" }),
    );
  } catch (e) {
    fail(`server render and hydrate failed:\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`pack-check: ${failures.length} problem${failures.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log("pack-check: ok");
