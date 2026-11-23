/**
 * Names that only work on a disk that ignores case (macOS's, Windows'): checked here, so they fail on this machine
 * and not first on a Linux checkout or in CI.
 *
 *  - Every tracked path is spelt in git as it is on disk. A file renamed only in case (App.tsx → app.tsx) keeps its
 *    old name in git until it is renamed with `git mv`, and a fresh checkout then has the old one.
 *  - Every relative import names its file in the file's own case (`./shell/app` for `shell/app.tsx`).
 *
 *   node tooling/case-check.mjs
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const listings = new Map();
/** The names in `dir`, as the disk spells them; empty when it isn't a directory. */
const names = (dir) => {
  let list = listings.get(dir);
  if (!list) {
    try {
      list = readdirSync(dir);
    } catch {
      list = [];
    }
    listings.set(dir, list);
  }
  return list;
};
/** Whether `path` (absolute) exists with every part spelt exactly as on disk. */
const exact = (path) => {
  const rel = path.slice(root.length + 1);
  let dir = root;
  for (const part of rel.split("/")) {
    if (!names(dir).includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
};
/** Whether `path` exists when case is ignored: the disk's answer on a Mac. */
const loose = (path) => {
  const rel = path.slice(root.length + 1);
  let dir = root;
  for (const part of rel.split("/")) {
    const found = names(dir).find((n) => n.toLowerCase() === part.toLowerCase());
    if (!found) return false;
    dir = join(dir, found);
  }
  return true;
};

const problems = [];

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
for (const file of tracked) {
  const path = join(root, file);
  // A file deleted on disk but not yet in git is git's business, not a case problem.
  if (loose(path) && !exact(path))
    problems.push(`${file}: git spells it differently from the disk`);
}

const SOURCE = /\.(m?[jt]sx?|css)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|@import\s+(?:url\()?\s*)["'](\.{1,2}\/[^"']+)["']/g;
const TRY = ["", ".ts", ".tsx", ".js", ".mjs", ".jsx", "/index.ts", "/index.tsx", "/index.js"];
let imports = 0;
for (const file of tracked) {
  if (!SOURCE.test(file)) continue;
  const path = join(root, file);
  let text;
  try {
    if (!statSync(path).isFile()) continue;
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1].replace(/[?#].*$/, "");
    const base = resolve(dirname(path), spec);
    const candidates = TRY.map((ext) => base + ext);
    if (candidates.some(exact)) {
      imports++;
      continue;
    }
    if (candidates.some(loose))
      problems.push(`${file}: "${m[1]}" matches a file only if case is ignored`);
  }
}

if (problems.length) {
  for (const p of problems) console.error(p);
  const n = problems.length;
  console.error(
    `case-check: ${n} name${n === 1 ? " that only works" : "s that only work"} where case is ignored`,
  );
  process.exit(1);
}
console.log(
  `case-check: ${tracked.length} tracked paths and ${imports} relative imports spelt as on disk`,
);
