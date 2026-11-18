/**
 * Syntax highlighting for every code block on the site, at runtime. One Shiki theme whose colours are CSS variables
 * (--shiki-token-*, set in styles/code.css), so a block switches with light and dark without re-highlighting and
 * uses the site's own warm palette. Loaded once, on the first code block.
 */
import type { HighlighterCore, ThemedToken } from "shiki/core";

const LANGS: Record<string, () => Promise<unknown>> = {
  tsx: () => import("shiki/langs/tsx.mjs"),
  ts: () => import("shiki/langs/typescript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  js: () => import("shiki/langs/javascript.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  sh: () => import("shiki/langs/shellscript.mjs"),
  md: () => import("shiki/langs/markdown.mjs"),
};
const ALIASES: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  bash: "sh",
  shell: "sh",
  shellscript: "sh",
  zsh: "sh",
  console: "sh",
  markdown: "md",
};
export const langOf = (lang: string) => {
  const l = lang.toLowerCase();
  return ALIASES[l] ?? (l in LANGS ? l : "text");
};

let highlighter: Promise<HighlighterCore> | null = null;

function load(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore, createCssVariablesTheme }, { createJavaScriptRegexEngine }] =
      await Promise.all([import("shiki/core"), import("shiki/engine/javascript")]);
    const theme = createCssVariablesTheme({
      name: "jali",
      variablePrefix: "--shiki-",
      fontStyle: true,
    });
    return createHighlighterCore({
      themes: [theme],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighter;
}

const loaded = new Map<string, Promise<void>>();

/** Lines of tokens for `code`, or null for plain text. */
export async function tokenize(code: string, lang: string): Promise<ThemedToken[][] | null> {
  const id = langOf(lang);
  if (id === "text") return null;
  const h = await load();
  if (!loaded.has(id))
    loaded.set(
      id,
      LANGS[id]!().then((m) => h.loadLanguage((m as { default: never }).default)),
    );
  await loaded.get(id);
  const name = h
    .getLoadedLanguages()
    .find(
      (l) =>
        l === id ||
        (id === "ts" && l === "typescript") ||
        (id === "js" && l === "javascript") ||
        (id === "sh" && (l === "shellscript" || l === "bash")) ||
        (id === "md" && l === "markdown"),
    );
  if (!name) return null;
  return h.codeToTokensBase(code, { lang: name, theme: "jali" });
}

/** "3-5,9" → {3,4,5,9} (1-based line numbers). */
export function parseRanges(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const [a, b] = part
      .trim()
      .split("-")
      .map((n) => Number.parseInt(n, 10));
    if (a === undefined || Number.isNaN(a)) continue;
    const end = b === undefined || Number.isNaN(b) ? a : b;
    for (let i = a; i <= end; i++) out.add(i);
  }
  return out;
}
