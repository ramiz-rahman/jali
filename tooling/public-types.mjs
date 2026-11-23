#!/usr/bin/env node
/**
 * Every type a public signature names is exported. Reads the built declarations of `jali` (its `dist/*.d.ts`), starts
 * from each name an app can import (every entry's exports, the `layout` namespace's members), and follows the types
 * each declaration names. A type it reaches that no app entry exports is a failure: an app can read it in a hover but
 * can't write it down (DOCS-25: `row` returned a `SplitDraft` nobody could import).
 *
 * `jali/adapter` is for adapter authors and may change in any minor version, so what only it exports doesn't count
 * as exported here, and its own signatures aren't followed.
 *
 *   node tooling/public-types.mjs [dist]   default: packages/jali/dist (run `pnpm build:packages` first)
 *
 * Run by `pnpm pack-check` against the packed tarball. It reads the bundler's output as text: declarations start at
 * the start of a line, and a bundled copy of a type may carry a `$1` suffix, which is dropped.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Types a public signature names on purpose without exporting them, and why. */
export const NOT_EXPORTED = {
  // The slots `definePage` fills on a page, never an app: their keys and contents are the adapter's.
  PAGE: "definePage's slot on a page (adapters)",
  PageEngine: "definePage's engine on a page (adapters)",
  PAGE_PARTS: "definePage's React parts on a page (adapters)",
  PageParts: "definePage's React parts on a page (adapters)",
  // Type-level machinery inside a signature: an app writes the type it produces, never these.
  IsAny: "helper of ParamsOf",
  OptionalKeys: "helper of ParamsOf",
  RequiredKeys: "helper of ParamsOf",
  ReadAs: "helper of ParamsOf",
  ParamsFrom: "helper of PaneProps",
  ParamsOfPane: "helper of usePane",
  Words: "helper of Messages",
  Child: "a builder's argument: a Draft or an ObjectRef",
  NodeBase: "the fields every LayoutNode shares",
  Node: "helper of layout.find",
  Read: "helper of layout.find",
  // An adapter's kind registry (`createPaneKinds`, jali/adapter), which `createJali({ panes })` also takes.
  PaneKinds: "an adapter's kind registry, which createJali({ panes }) also takes",
  PaneKind: "inside an adapter's kind registry",
  KindRegistry: "inside an adapter's kind registry",
};

/**
 * Exported types whose insides are an adapter's business, so the types inside them aren't followed: `Feature` is the
 * contract between a feature and an adapter (apps pass features, never write one), and `en`'s type is spelled with
 * each feature's English, which an app reads as `Messages`.
 */
export const OPAQUE = ["Feature", "en"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = (name) => name.replace(/\$\d+$/, "");

/** Strips comments and string literals, so a word in a doc comment or a string is never read as a type. */
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');

/** `a as b` → [a, b]; `a` → [a, a]; a leading `type` is dropped. */
const pair = (part) => {
  const [local, alias] = part
    .trim()
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/);
  return [local, alias ?? local];
};
const list = (text) => text.split(",").filter((p) => p.trim());

/**
 * One declaration file: its top-level declarations (local name → whether it is a value, and its texts), what it
 * imports (local name → file and name there) and what it exports (name → local name). A value (a function, a const)
 * counts as named by a type only through `typeof x` or a `[x]` key.
 */
function parse(dist, file) {
  const raw = readFileSync(join(dist, file), "utf8");
  const decls = new Map();
  const imports = new Map();
  const exports = new Map();
  const namespaces = new Map();
  for (const m of raw.matchAll(/^import \{([^}]*)\} from "\.\/([^"]+)\.js";/gm))
    for (const part of list(m[1])) {
      const [there, local] = pair(part);
      imports.set(local, { file: `${m[2]}.d.ts`, name: there });
    }
  for (const m of raw.matchAll(/^export \{([^}]*)\}/gm))
    for (const part of list(m[1])) {
      const [local, name] = pair(part);
      exports.set(name, local);
    }
  for (const m of raw.matchAll(/^declare namespace (\w+) \{\s*export \{([^}]*)\}/gm))
    namespaces.set(m[1], list(m[2]).map(pair));
  const start =
    /^(?:export\s+)?(?:declare\s+)?(interface|type|class|enum|function|const|namespace|abstract class)\s+([A-Za-z_$][\w$]*)/;
  let name = null;
  let value = false;
  let body = [];
  const flush = () => {
    if (!name) return;
    const d = decls.get(name) ?? { value, texts: [] };
    d.texts.push(body.join("\n"));
    decls.set(name, d);
  };
  for (const line of code(raw).split("\n")) {
    const m = start.exec(line);
    if (m || /^(?:import|export \{|\/\/# )/.test(line)) {
      flush();
      name = m ? m[2] : null;
      value = !!m && /^(function|const|namespace)$/.test(m[1]);
      body = m ? [line.slice(m[0].length)] : [];
    } else if (name) body.push(line);
  }
  flush();
  return { decls, imports, exports, namespaces };
}

/** `[{ type, from }]`: each type a public signature names that no app entry exports. */
export function check(dist) {
  const pkg = JSON.parse(readFileSync(join(dist, "..", "package.json"), "utf8"));
  const exportsMap = pkg.publishConfig?.exports ?? pkg.exports;
  const entries = Object.entries(exportsMap)
    .filter(([sub, e]) => sub !== "./adapter" && typeof e === "object" && e.types)
    .map(([, e]) => e.types.replace(/^\.\/dist\//, ""));
  const files = new Map(
    readdirSync(dist)
      .filter((f) => f.endsWith(".d.ts"))
      .map((f) => [f, parse(dist, f)]),
  );
  /** Where `local` in `file` is declared: `[file, name]`, through imports and re-exports. */
  const resolveName = (file, local, depth = 0) => {
    const f = files.get(file);
    if (!f || depth > 20) return null;
    if (f.decls.has(local)) return [file, local];
    const i = f.imports.get(local);
    if (!i) return null;
    const there = files.get(i.file)?.exports.get(i.name) ?? i.name;
    return resolveName(i.file, there, depth + 1);
  };

  // What an app can import: every entry's exports, and the `layout` namespace's members.
  const starts = [];
  const exported = new Set();
  for (const entry of entries) {
    const f = files.get(entry);
    for (const [name, local] of f.exports) {
      exported.add(base(name));
      const at = resolveName(entry, local);
      if (!at) continue;
      const ns = files.get(at[0]).namespaces.get(at[1]);
      if (ns)
        for (const [m, alias] of ns) {
          exported.add(base(alias));
          const inner = resolveName(at[0], m);
          if (inner) starts.push([...inner, alias]);
        }
      else starts.push([...at, name]);
    }
  }
  for (const [, , name] of starts) exported.add(base(name));

  /** An interface's fields: name → the text of its type. */
  const fieldsOf = ([file, local]) => {
    const fields = new Map();
    for (const text of files.get(file).decls.get(local)?.texts ?? []) {
      let field = null;
      for (const line of text.split("\n")) {
        const m = /^ {2}(?:readonly\s+)?([A-Za-z_$][\w$]*)\??[:(<]/.exec(line);
        if (m) fields.set((field = m[1]), line);
        else if (field && /^ {3,}|^ {2}[})\]|&]/.test(line))
          fields.set(field, `${fields.get(field)}\n${line}`);
      }
    }
    return fields;
  };
  /** The declarations `text` (in `file`) names, as `[at, fields]`: `fields`, what `Pick` or `Omit` keeps of it. */
  const named = (file, text) => {
    const out = [];
    let rest = text;
    for (const m of text.matchAll(/\b(Pick|Omit)<\s*([A-Za-z_$][\w$]*),\s*([^>]*)>/g)) {
      const at = resolveName(file, m[2]);
      rest = rest.replace(m[0], m[3]);
      if (!at) continue;
      const keys = [...m[3].matchAll(/"([^"]*)"/g)].map((k) => k[1]);
      const all = [...fieldsOf(at).keys()];
      out.push([at, m[1] === "Pick" ? keys : all.filter((f) => !keys.includes(f))]);
    }
    for (const m of rest.matchAll(/(typeof\s+|\[)?(?<![\w$.])([A-Za-z_$][\w$]*)/g)) {
      const at = resolveName(file, m[2]);
      if (at && (!files.get(at[0]).decls.get(at[1]).value || m[1])) out.push([at, null]);
    }
    return out;
  };

  const missing = new Map();
  const seen = new Set();
  const walk = (at, from, only = null) => {
    const key = `${at.join(":")}${only ? `.${only.join(",")}` : ""}`;
    if (seen.has(key) || seen.has(at.join(":"))) return;
    seen.add(key);
    const texts = only
      ? [...fieldsOf(at)].filter(([f]) => only.includes(f)).map(([, t]) => t)
      : files.get(at[0]).decls.get(at[1]).texts;
    for (const body of texts)
      for (const [ref, fields] of named(at[0], body)) {
        if (ref.join(":") === at.join(":") || OPAQUE.includes(base(ref[1]))) continue;
        if (fields) walk(ref, from, fields);
        else if (!exported.has(base(ref[1])) && !(base(ref[1]) in NOT_EXPORTED)) {
          if (!missing.has(base(ref[1]))) missing.set(base(ref[1]), from);
          walk(ref, from);
        }
      }
  };
  for (const [file, local, name] of starts) if (!OPAQUE.includes(name)) walk([file, local], name);
  return [...missing]
    .map(([type, from]) => ({ type, from }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dist = resolve(process.argv[2] ?? join(root, "packages", "jali", "dist"));
  const missing = check(dist);
  for (const { type, from } of missing)
    console.error(
      `public-types: ${type} is named by a public signature (from ${from}) but not exported`,
    );
  console.log(
    `public-types: ${missing.length ? `${missing.length} unexported` : "every type a public signature names is exported"}`,
  );
  process.exit(missing.length ? 1 : 0);
}
