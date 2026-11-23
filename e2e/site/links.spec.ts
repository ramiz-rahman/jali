/**
 * Every link inside the built site goes somewhere: each internal address names a page the host serves (with
 * Netlify's rules, netlify.toml's redirects included), each #anchor names an id on that page, and no page has the
 * same id twice. Read from site/ itself, so it needs no browser.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "@playwright/test";

const SITE = new URL("../../site/", import.meta.url).pathname;
const TOML = readFileSync(new URL("../../netlify.toml", import.meta.url), "utf8");

/** netlify.toml's redirects: from → to. */
const redirects = new Map(
  [...TOML.matchAll(/\[\[redirects\]\][^[]*?from\s*=\s*"([^"]+)"[^[]*?to\s*=\s*"([^"]+)"/g)].map(
    (m) => [m[1]!, m[2]!],
  ),
);

const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "apps" ? [] : pages(path);
    return name.endsWith(".html") ? [path] : [];
  });

/** The file the host serves for a site path, after its redirect. */
function fileFor(path: string): string | undefined {
  const to = redirects.get(path);
  if (to) return fileFor(to.split("#")[0]!);
  const file = join(SITE, path);
  if (path.endsWith("/"))
    return existsSync(join(file, "index.html")) ? join(file, "index.html") : undefined;
  if (existsSync(file) && statSync(file).isFile()) return file;
  if (existsSync(`${file}.html`)) return `${file}.html`;
  if (existsSync(join(file, "index.html"))) return join(file, "index.html");
  return undefined;
}

const ids = new Map<string, string[]>();
const idsOf = (file: string) => {
  let list = ids.get(file);
  if (!list)
    ids.set(
      file,
      (list = [...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!)),
    );
  return list;
};

const docs = pages(SITE);

test("the site has its pages", () => {
  expect(docs.length).toBeGreaterThan(30);
});

test("every internal link names a page and an anchor that are there", () => {
  const broken: string[] = [];
  for (const file of docs) {
    const html = readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
      if (!href!.startsWith("/") || href!.startsWith("//")) continue;
      const url = new URL(href!.replace(/&amp;/g, "&"), "https://site");
      // The apps are checked by the showcase's own test, in a browser.
      if (url.pathname.startsWith("/apps/")) continue;
      const target = fileFor(decodeURIComponent(url.pathname));
      const where = `/${relative(SITE, file)}`;
      if (!target) {
        broken.push(`${where}: ${href} (no page)`);
        continue;
      }
      const anchor = url.hash.slice(1) || redirects.get(url.pathname)?.split("#")[1];
      if (anchor && target.endsWith(".html") && !idsOf(target).includes(decodeURIComponent(anchor)))
        broken.push(`${where}: ${href} (no #${anchor})`);
    }
  }
  expect(broken).toEqual([]);
});

test("no page has the same id twice", () => {
  const twice: string[] = [];
  for (const file of docs) {
    const seen = new Set<string>();
    for (const id of idsOf(file)) {
      if (seen.has(id)) twice.push(`/${relative(SITE, file)}: #${id}`);
      seen.add(id);
    }
  }
  expect(twice).toEqual([]);
});

test("every old guide address goes on to a page and section that are there", () => {
  for (const [from, to] of redirects) {
    const [path, anchor] = to.split("#");
    const file = fileFor(path!);
    expect(file, `${from} → ${to}`).toBeTruthy();
    if (anchor) expect(idsOf(file!), `${from} → ${to}`).toContain(anchor);
  }
});
