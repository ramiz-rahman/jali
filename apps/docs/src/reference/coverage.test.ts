/**
 * The reference stays true (docs/DOCS-PLAN.md): every name `jali` exports, from every entry an app imports, has an entry, and so does
 * every command, default key binding and public token. An entry is an <Entry name="…"> or <Member name="…"> in an MDX
 * page under src/docs/reference. A new export, command or token fails here until it is written up; a removed one
 * fails until its entry goes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import * as core from "jali";
import { DEFAULT_KEYMAP } from "jali/adapter";
import { defaultIcons } from "../../../../packages/react/src/icons/default";
import * as react from "jali/react";
import * as page from "jali/page";
import * as testing from "jali/testing";
import * as features from "jali/features";
import * as url from "jali/url";
import * as palette from "jali/palette";
import * as settings from "jali/settings";
import * as chooser from "jali/chooser";
import * as rename from "jali/rename";
import * as popOut from "jali/pop-out";
import * as pressed from "jali/pressed";
import { COMMANDS, REFUSED, displayId } from "./command-data";
import { TOKEN_PURPOSE, inPlaceTokensOf, publicTokensOf, readsOf } from "./token-data";

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, "../docs/reference");
const packages = join(here, "../../../../packages");

function mdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? mdxFiles(p) : p.endsWith(".mdx") ? [p] : [];
  });
}

/** Every name with an entry, from the MDX sources. `name` is the first attribute of <Entry> and <Member>. */
const documented = (() => {
  const names = new Map<string, number>();
  for (const file of mdxFiles(pagesDir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/<(?:Entry|Member)\s+name="([^"]+)"/g))
      names.set(m[1]!, (names.get(m[1]!) ?? 0) + 1);
  }
  return names;
})();

/** Type-only exports of an entry file: every `type X` inside `export { … }`, every name in `export type { … }`, and every `export interface` or `export type` declared in it. */
function typeExports(file: string): string[] {
  const src = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const out: string[] = [];
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[2]!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const t = /^type\s+(\w+)/.exec(part);
      if (m[1])
        out.push(
          part
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)
            .pop()!
            .trim(),
        );
      else if (t) out.push(t[1]!);
    }
  }
  // Declared in place: `export interface X` and `export type X =`.
  for (const m of src.matchAll(/^export\s+(?:interface|type)\s+(\w+)/gm)) out.push(m[1]!);
  return out;
}

const missing = (expected: string[]) => expected.filter((n) => !documented.has(n));

describe("the reference covers the public API", () => {
  it("every value `jali` exports has an entry", () => {
    expect(missing(Object.keys(core))).toEqual([]);
  });

  it("every member of the layout namespace, and of layout.tree, has an entry", () => {
    const names = [
      ...Object.keys(core.layout).map((k) => `layout.${k}`),
      ...Object.keys(core.layout.tree).map((k) => `layout.tree.${k}`),
    ];
    expect(missing(names)).toEqual([]);
  });

  it("every value jali/react, jali/page and jali/testing export has an entry", () => {
    expect(missing([react, page, testing].flatMap((entry) => Object.keys(entry)))).toEqual([]);
  });

  it("every feature has an entry", () => {
    const all = [features, url, palette, settings, chooser, rename, popOut, pressed];
    expect(missing(all.flatMap((entry) => Object.keys(entry)))).toEqual([]);
  });

  it("every icon name has an entry", () => {
    expect(missing(Object.keys(defaultIcons).map((k) => `icons.${k}`))).toEqual([]);
  });

  it("every type an app's entries export has an entry", () => {
    const types = [
      ...typeExports(join(packages, "core/src/index.ts")),
      ...["react", "page", "testing", "url"].flatMap((e) =>
        typeExports(join(packages, `jali/src/${e}.ts`)),
      ),
    ];
    expect(types.length).toBeGreaterThan(50);
    expect(missing(types)).toEqual([]);
  });

  it("every workspace action has an entry", () => {
    const store = core.createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      storage: core.memoryStorage(),
      moveFocus: false,
    });
    expect(missing(Object.keys(store.actions).map((k) => `actions.${k}`))).toEqual([]);
  });

  it("no entry is written twice", () => {
    expect([...documented].filter(([, n]) => n > 1).map(([name]) => name)).toEqual([]);
  });
});

describe("the commands page covers every command", () => {
  it("every command says when it is refused", () => {
    const ids = [...new Set(COMMANDS.map((c) => displayId(c.id)))];
    expect(ids.filter((id) => !REFUSED[id])).toEqual([]);
    expect(Object.keys(REFUSED).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it("every default binding names a command or the palette", () => {
    const ids = new Set(["palette.toggle", ...COMMANDS.map((c) => c.id)]);
    expect(Object.keys(DEFAULT_KEYMAP).filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe("the tokens page covers every public token", () => {
  it("every public --jali-* token has a purpose, and no purpose names a token that is gone", () => {
    // Read from disk: the ?raw import the page uses is empty under the test runner.
    const PUBLIC_TOKENS = publicTokensOf(
      readFileSync(join(packages, "react/src/styles/jali-theme.css"), "utf8"),
    );
    expect(PUBLIC_TOKENS.length).toBeGreaterThan(30);
    expect(PUBLIC_TOKENS.filter((t) => !TOKEN_PURPOSE[t])).toEqual([]);
    expect(Object.keys(TOKEN_PURPOSE).filter((t) => !PUBLIC_TOKENS.includes(t))).toEqual([]);
  });

  it("every token read in place is read by the parts, each time with the default the theme lists", () => {
    const theme = readFileSync(join(packages, "react/src/styles/jali-theme.css"), "utf8");
    const stylesDir = join(packages, "react/src/styles");
    const styles = readdirSync(stylesDir)
      .filter((f) => f.endsWith(".css") && !/theme|tailwind/.test(f))
      .map((f) => readFileSync(join(stylesDir, f), "utf8"))
      .join("\n");
    const inPlace = inPlaceTokensOf(theme);
    expect(Object.keys(inPlace).length).toBeGreaterThan(0);
    const reads = readsOf(styles);
    for (const [token, fallback] of Object.entries(inPlace)) {
      const mine = reads.filter((r) => r.token === token);
      expect(mine.length, token).toBeGreaterThan(0);
      for (const r of mine) expect(r.fallback, token).toBe(fallback);
    }
  });
});
