#!/usr/bin/env node
/**
 * Writes the docs into the published package as Markdown (packages/jali/docs/), so a coding agent reads the docs of
 * the version that is installed: node_modules/jali/docs/README.md lists every page. The pages are the docs site's own, in
 * reading order, through the same `toMarkdown` as "View as Markdown", with links made relative to the files.
 *
 *   pnpm agent-docs           write them
 *   pnpm agent-docs --check   fail if they are out of date (the docs test runs this)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite-plus";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsApp = join(root, "apps/docs");
export const OUT = join(root, "packages/jali/docs");
/** The docs site, for links to pages that aren't Markdown here (the home page, the examples). */
const SITE = "https://jali.ramizrahman.com";

/**
 * A site anchor as the heading's anchor in rendered Markdown (GitHub's rule, which most viewers follow): lower case,
 * punctuation dropped, spaces as hyphens. `#layout.arrange` → `#layoutarrange`, `#UrlSyncOptions` → `#urlsyncoptions`.
 */
const slug = (anchor) =>
  decodeURIComponent(anchor)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");

/** Every file to write, by path under docs/: README.md plus one per page. */
export async function render() {
  const server = await createServer({
    // The site is Astro now and has no vite.config. The sources are plain modules (the pages are read as text with
    // `?raw`), so no MDX or Astro plugin is needed here.
    configFile: false,
    root: docsApp,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    // jali (and the workspace packages it is made of) from their source, as the site has them: without this the SSR
    // loader takes the packages' dist, which is only as fresh as the last build.
    ssr: {
      noExternal: [/^@jali\//, /^jali(\/|$)/],
      resolve: { conditions: ["source"], externalConditions: ["source"] },
    },
  });
  try {
    const { readingOrder, sources, toMarkdown } =
      await server.ssrLoadModule("/src/site/sources.ts");
    const { MARKDOWN_TABLES } = await server.ssrLoadModule("/src/site/markdown-tables.ts");
    const order = readingOrder().filter((p) => sources[p.path]);
    const fileOf = (path) => `${path.replace(/^\//, "")}.md`;
    const known = new Set(order.map((p) => p.path));
    const files = new Map();
    for (const item of order) {
      const page = sources[item.path];
      const here = dirname(fileOf(item.path));
      const link = (href) => {
        const m = /^(\/[^#?]*)(#.*)?$/.exec(href);
        // A page the docs don't have as Markdown (the home page, an example) keeps its site URL.
        if (!m || !known.has(m[1])) return href.startsWith("/") ? `${SITE}${href}` : href;
        return `${relative(here, fileOf(m[1])) || fileOf(m[1])}${m[2] ? `#${slug(m[2].slice(1))}` : ""}`;
      };
      const md = toMarkdown(page, { tables: MARKDOWN_TABLES, link }).replace(
        /\]\((\/[^)\s]*)\)/g,
        (_, href) => `](${link(href)})`,
      );
      files.set(fileOf(item.path), md);
    }
    const version = JSON.parse(
      readFileSync(join(root, "packages/jali/package.json"), "utf8"),
    ).version;
    let section = "";
    const index = [
      "# Jali docs",
      "",
      `The docs for this version of Jali (${version}), as Markdown, for people and coding agents. Start with`,
      "[Using Jali with coding agents](get-started/coding-agents.md), then the Quickstart and Key concepts.",
      "Written from the docs site by tooling/agent-docs.mjs; don't edit these files.",
    ];
    for (const item of order) {
      if (item.section !== section) {
        section = item.section;
        index.push("", `## ${section}`, "");
      }
      const page = sources[item.path];
      index.push(`- [${item.title}](${fileOf(item.path)}): ${page.summary}`);
    }
    files.set("README.md", `${index.join("\n")}\n`);
    return files;
  } finally {
    await server.close();
  }
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      )
    : [];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await render();
  if (process.argv.includes("--check")) {
    const stale = [...files].filter(([f, md]) => {
      const p = join(OUT, f);
      return !existsSync(p) || readFileSync(p, "utf8") !== md;
    });
    const extra = walk(OUT).filter((p) => !files.has(relative(OUT, p)));
    if (stale.length || extra.length) {
      console.error(
        `packages/jali/docs is out of date (${[...stale.map(([f]) => f), ...extra.map((p) => relative(OUT, p))].join(", ")}): run pnpm agent-docs`,
      );
      process.exit(1);
    }
    console.log(`packages/jali/docs: ${files.size} files, up to date`);
  } else {
    // Files no page writes any more are reported, not removed: move them out by hand.
    const extra = walk(OUT).filter((p) => !files.has(relative(OUT, p)));
    if (extra.length)
      console.warn(`not written by any page: ${extra.map((p) => relative(OUT, p)).join(", ")}`);
    for (const [f, md] of files) {
      mkdirSync(dirname(join(OUT, f)), { recursive: true });
      writeFileSync(join(OUT, f), md);
    }
    console.log(`wrote ${files.size} files to packages/jali/docs`);
  }
}
