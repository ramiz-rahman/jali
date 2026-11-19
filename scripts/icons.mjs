#!/usr/bin/env node
/**
 * Writes packages/react/src/icons/default-paths.ts: the path of every icon Jali draws by default, copied from Phosphor
 * (`@phosphor-icons/react`, a dev dependency only, so no app installs it). To change an icon, edit SOURCES and run
 *
 *   pnpm icons
 *
 * `src/tests/default-icons.test.ts` fails when the file and this script disagree.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = resolve(root, "packages/react/src/icons/default-paths.ts");

/** Jali's icon name → Phosphor's icon, with its weight (regular unless said) and whether it is mirrored. */
export const SOURCES = {
  close: "X",
  maximise: "ArrowsOutSimple",
  restore: "ArrowsInSimple",
  fullScreen: "CornersOut",
  exitFullScreen: "CornersIn",
  tuck: "Minus",
  putBack: "ArrowUUpLeft",
  newTab: "Plus",
  more: "CaretDown",
  current: "Check",
  fold: "ArrowsInLineHorizontal",
  grip: "DotsSix",
  follow: "LinkSimpleHorizontal",
  keep: "AnchorSimple",
  pin: "PushPin",
  // The cross in an activity dot is 8px: bold, since regular would be half a pixel.
  activityError: { icon: "X", weight: "bold" },
  defaultKind: "Square",
  // The peek keeps beside, on the right: the sidebar, mirrored.
  openBeside: { icon: "SidebarSimple", mirrored: true },
  openFull: "CornersOut",
  addToTabs: "Stack",
  singleView: "Square",
  splitView: "SquareSplitHorizontal",
  back: "ArrowUUpLeft",
  reset: "ArrowCounterClockwise",
  dropLeft: "ArrowLeft",
  dropRight: "ArrowRight",
  dropTop: "ArrowUp",
  dropBottom: "ArrowDown",
  dropSwap: "ArrowsLeftRight",
  dropTab: "PlusSquare",
};

/** The file's text. */
export async function generate() {
  const require = createRequire(import.meta.url);
  const { version } = JSON.parse(
    readFileSync(require.resolve("@phosphor-icons/react/package.json"), "utf8"),
  );
  const lines = [];
  for (const [name, source] of Object.entries(SOURCES)) {
    const {
      icon,
      weight = "regular",
      mirrored = false,
    } = typeof source === "string" ? { icon: source } : source;
    const mod = await import(`@phosphor-icons/react/${icon}`);
    const svg = renderToStaticMarkup(createElement(mod[`${icon}Icon`], { weight }));
    const paths = [...svg.matchAll(/<path d="([^"]+)"><\/path>/g)].map((m) => m[1]);
    const rest = svg.replace(/<path d="[^"]+"><\/path>/g, "").replace(/<svg[^>]*>|<\/svg>/g, "");
    if (paths.length === 0 || rest)
      throw new Error(`${icon} (${weight}) is not only paths: ${svg}`);
    const label = weight === "regular" ? icon : `${icon}, ${weight}`;
    lines.push(
      `  /** Phosphor's ${label}${mirrored ? ", mirrored" : ""}. */`,
      `  ${name}: ${mirrored ? "[" : ""}${JSON.stringify(paths.join(""))}${mirrored ? ", true]" : ""},`,
    );
  }
  return [
    `/**`,
    ` * Jali's default icons: Phosphor's (https://phosphoricons.com, MIT, © 2020 Phosphor Icons; see THIRD_PARTY_NOTICES),`,
    ` * from @phosphor-icons/react ${version}, as the path data of a 256 by 256 box. Written by scripts/icons.mjs: edit`,
    ` * that script and run \`pnpm icons\`, not this file.`,
    ` */`,
    `import type { JaliIconName } from "./types";`,
    ``,
    `/** A path, or a path and \`true\` for an icon drawn mirrored. */`,
    `export const defaultIconPaths: Record<JaliIconName, string | readonly [string, true]> = {`,
    ...lines,
    `};`,
    ``,
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, await generate());
  console.log(`wrote ${OUT}`);
}
