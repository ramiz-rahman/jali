/**
 * Syntax highlighting for every code block on the site, once, when the page is built: the HTML carries the colours
 * and the browser loads no highlighter. One Shiki theme whose colours are CSS variables (--shiki-token-*, set in
 * styles/code.css), so a block switches with light and dark without highlighting again and uses the site's warm
 * palette. Used while prerendering only; nothing in the browser imports this module.
 */
import {
  createCssVariablesTheme,
  createHighlighterCoreSync,
  type HighlighterCore,
  type ThemedToken,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import jsx from "shiki/langs/jsx.mjs";
import javascript from "shiki/langs/javascript.mjs";
import css from "shiki/langs/css.mjs";
import json from "shiki/langs/json.mjs";
import html from "shiki/langs/html.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import markdown from "shiki/langs/markdown.mjs";

/** The site's short language names, and the Shiki grammar each one uses. */
const GRAMMAR: Record<string, string> = {
  tsx: "tsx",
  ts: "typescript",
  jsx: "jsx",
  js: "javascript",
  css: "css",
  json: "json",
  html: "html",
  sh: "shellscript",
  md: "markdown",
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
  return ALIASES[l] ?? (l in GRAMMAR ? l : "text");
};

let highlighter: HighlighterCore | null = null;
const load = () =>
  (highlighter ??= createHighlighterCoreSync({
    themes: [
      createCssVariablesTheme({ name: "jali", variablePrefix: "--shiki-", fontStyle: true }),
    ],
    langs: [tsx, typescript, jsx, javascript, css, json, html, shellscript, markdown],
    engine: createJavaScriptRegexEngine(),
  }));

/** Lines of tokens for `code`, or null for plain text. */
export function tokenize(code: string, lang: string): ThemedToken[][] | null {
  const id = langOf(lang);
  if (id === "text") return null;
  return load().codeToTokensBase(code, { lang: GRAMMAR[id]!, theme: "jali" });
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
