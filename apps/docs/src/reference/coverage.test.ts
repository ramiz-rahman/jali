/**
 * The reference stays true (docs/DOCS-PLAN.md): every name @jali/core and @jali/react export has an entry, and so does
 * every command, default key binding and public token. An entry is an <Entry name="…"> or <Member name="…"> in an MDX
 * page under src/pages/reference. A new export, command or token fails here until it is written up; a removed one
 * fails until its entry goes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import * as core from "@jali/core";
import * as react from "@jali/react";
import { COMMANDS, REFUSED, displayId } from "./command-data";
import { TOKEN_PURPOSE, publicTokensOf } from "./token-data";

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, "../pages/reference");
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

/** Type-only exports of an entry file: every `type X` inside `export { … }` and every name in `export type { … }`. */
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
  return out;
}

const missing = (expected: string[]) => expected.filter((n) => !documented.has(n));

describe("the reference covers the public API", () => {
  it("every value @jali/core exports has an entry", () => {
    expect(missing(Object.keys(core))).toEqual([]);
  });

  it("every member of the layout namespace, and of layout.tree, has an entry", () => {
    const names = [
      ...Object.keys(core.layout).map((k) => `layout.${k}`),
      ...Object.keys(core.layout.tree).map((k) => `layout.tree.${k}`),
    ];
    expect(missing(names)).toEqual([]);
  });

  it("every value @jali/react exports has an entry", () => {
    expect(missing(Object.keys(react))).toEqual([]);
  });

  it("every type the two packages export has an entry", () => {
    const types = [
      ...typeExports(join(packages, "core/src/index.ts")),
      ...typeExports(join(packages, "react/src/index.ts")),
    ];
    expect(types.length).toBeGreaterThan(50);
    expect(missing(types)).toEqual([]);
  });

  it("every workspace action has an entry", () => {
    const store = core.createWorkspace({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      url: false,
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
    expect(Object.keys(core.DEFAULT_KEYMAP).filter((id) => !ids.has(id))).toEqual([]);
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
});
