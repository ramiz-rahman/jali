// When a page last changed: the last commit to its source under src/docs, from git, at build time. The sitemap's
// lastmod and an article's dateModified read it, so a search engine knows which pages to fetch again. A shallow clone
// holds one commit for every file, which would date every page alike: there, and for a file git doesn't know yet, it
// gives nothing rather than a wrong date.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// The pages, found from the repository the build runs in (src/site/config.ts's PAGES_DIR), not from this file's own
// address: the pages' build bundles this module, and a bundle's address is the output's.
const PAGES_DIR = "apps/docs/src/docs";
const run = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

let docs;
const dates = new Map();

/** The pages' folder in a full clone of the repository, or null (no git, a shallow clone, not in the repository). */
function docsDir() {
  if (docs === undefined) {
    try {
      const root = run(process.cwd(), "rev-parse", "--show-toplevel");
      const dir = join(root, PAGES_DIR);
      docs =
        existsSync(dir) && run(root, "rev-parse", "--is-shallow-repository") === "false"
          ? dir
          : null;
    } catch {
      docs = null;
    }
  }
  return docs;
}
const git = (...args) => run(docsDir(), ...args);

/** The ISO date of the last commit to `file` (a path under src/docs, "learn/fitting.mdx"), or undefined. */
export function lastModified(file) {
  if (!docsDir()) return undefined;
  if (!dates.has(file)) {
    let date;
    try {
      date = git("log", "-1", "--format=%cI", "--", file) || undefined;
    } catch {
      date = undefined;
    }
    dates.set(file, date);
  }
  return dates.get(file);
}

/** The source file of a page's address ("/learn/fitting" → "learn/fitting.mdx", "/examples" → "examples/index.mdx"). */
export function sourceOfPath(path) {
  if (path === "/" || path === "") return "index.mdx";
  const dir = docsDir();
  if (!dir) return undefined;
  const rel = path.replace(/^\/|\/$/g, "");
  for (const file of [`${rel}.mdx`, `${rel}/index.mdx`])
    if (existsSync(join(dir, file))) return file;
  return undefined;
}
