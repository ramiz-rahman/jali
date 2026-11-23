/**
 * The public site, in one folder: the docs at the root and each example app under /apps/<name>/, built from the
 * same commit, so a docs link into an example always opens the build it describes. Netlify serves the folder
 * (netlify.toml); `pnpm preview:site` serves it here.
 *
 *   node tooling/build-site.mjs            → site/
 *   node tooling/build-site.mjs --out=dir
 *
 * The examples build with relative asset paths (`base: "./"`) and keep their state in the query string, so each
 * works from its folder with no server rules. They sit under /apps, not /examples: the docs' Examples page is
 * examples.html (pages have no trailing slash), and a folder of the same name beside it would make /examples
 * ambiguous to the host.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const out = resolve(root, outArg ? outArg.slice("--out=".length) : "site");

/** The example apps the site hosts, by folder. The docs' examples page links into each. */
export const HOSTED = ["data-studio", "loan-review", "markets", "studio", "trips", "handshake"];

const run = (cmd, args, label) => {
  const started = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (r.status !== 0) {
    process.stderr.write(r.stdout + r.stderr);
    console.error(`build-site: ${label} failed`);
    process.exit(1);
  }
  console.log(`build-site: ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

run("pnpm", ["--filter", "@jali/docs", "build"], "docs");
cpSync(join(root, "apps/docs/dist"), out, { recursive: true });

for (const name of HOSTED) {
  const dist = join(root, "node_modules/.site", name);
  run("pnpm", ["exec", "vp", "build", `examples/${name}`, "--outDir", dist, "--emptyOutDir"], name);
  if (!existsSync(join(dist, "index.html"))) {
    console.error(`build-site: ${name} built no index.html`);
    process.exit(1);
  }
  cpSync(dist, join(out, "apps", name), { recursive: true });
}

// What is in the folder, for the site's own check (e2e/site) and for anyone reading a deploy.
writeFileSync(
  join(out, "site.json"),
  JSON.stringify({ examples: HOSTED.map((name) => ({ name, path: `/apps/${name}/` })) }, null, 2) +
    "\n",
);
console.log(`build-site: ${out}`);
