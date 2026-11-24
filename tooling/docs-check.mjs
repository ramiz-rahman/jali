#!/usr/bin/env node
/**
 * Checks what the docs show against the package's real types, with the TypeScript compiler:
 *
 * 1. **Code samples.** Every ```ts and ```tsx block in a page under apps/docs/src/docs is written out as a module and
 *    typechecked against `jali-layout` (the samples imported with `?raw` are checked by `tsc -p apps/docs` already). A block
 *    may use the names in apps/docs/src/samples/prelude.d.ts without declaring them (`jali`, `order`, …), so a short
 *    excerpt still checks, and a relative import (`./panes`) stands for a module of the reader's app: it resolves to
 *    apps/docs/src/samples/app.ts. A block that can't stand alone (a fragment of an object, a sketch with "…") says so with
 *    `nocheck` in its meta: ```ts nocheck. Every `nocheck` is counted in the output.
 * 2. **Prop and option tables.** Every `<Params>` table in the reference pages is compared with the type it
 *    documents: the names (none missing, none extra) and which are required. An interface or type entry is compared
 *    with that type; a component with its props; a function or hook with its parameters (their number, and the keys
 *    of any parameter whose fields are listed). An entry whose table is checked some other way, or not at all, is
 *    named in SKIP below with the reason.
 *
 *   node tooling/docs-check.mjs           both checks (pnpm docs-check; a gate of pnpm verify)
 *   node tooling/docs-check.mjs --list    also list each block and table checked
 *
 * The generated files go to apps/docs/node_modules/.docs-check/, so a failure can be opened and read there.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsApp = join(root, "apps/docs");
const pagesDir = join(docsApp, "src/docs");
const out = join(docsApp, "node_modules/.docs-check");
const list = process.argv.includes("--list");

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".mdx") ? [p] : [];
  });
/** Published pages only: a draft (a file or folder starting with "_") is never built. */
const pages = walk(pagesDir).filter((p) =>
  relative(pagesDir, p)
    .split("/")
    .every((s) => !s.startsWith("_")),
);
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "samples"), { recursive: true });

// Each generated line that can fail, mapped to where it came from: `${file}:${line}` → { where, what }.
const origins = new Map();

// ---------- 1. code samples ----------

let checked = 0;
const skipped = [];
for (const page of pages) {
  const text = readFileSync(page, "utf8");
  const rel = relative(pagesDir, page);
  let n = 0;
  for (const m of text.matchAll(/^([ \t]*)```(ts|tsx)\b([^\n]*)\n([\s\S]*?)^\1```/gm)) {
    n++;
    const [, indent, lang, meta, body] = m;
    const line = lineAt(text, m.index) + 1;
    if (/\bnocheck\b/.test(meta)) {
      skipped.push(`${rel}:${line - 1}`);
      continue;
    }
    const code = body
      .split("\n")
      .map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l))
      .join("\n");
    const name = `${rel.replace(/\.mdx$/, "").replace(/\//g, "--")}--${n}.${lang}`;
    const file = join(out, "samples", name);
    // Every block is a module of its own, so two blocks' names never meet. A relative import names a module of the
    // reader's app (`./panes`, `./chart-view`): it resolves to apps/docs/src/samples/app.ts, a stand-in for one.
    const appModule = relative(join(out, "samples"), join(docsApp, "src/samples/app")).replace(
      /\\/g,
      "/",
    );
    writeFileSync(
      file,
      `${code.replace(/(from\s+["'])\.\.?\/[^"']+(["'])/g, `$1${appModule}$2`)}\nexport {};\n`,
    );
    const lines = code.split("\n").length;
    for (let i = 1; i <= lines; i++)
      origins.set(`samples/${name}:${i}`, {
        where: `apps/docs/src/docs/${rel}:${line + i - 1}`,
        what: "code sample",
      });
    checked++;
    if (list) console.log(`sample  ${rel}:${line - 1}`);
  }
}

// ---------- 2. prop and option tables ----------

/**
 * Entries whose table isn't compared, and why. Anything else with a <Params> table is checked, so a new table is
 * either checked or named here.
 */
const SKIP = {
  // Overloaded builders: the table lists the arguments of both forms, `row(...children)` and `row(options, ...children)`.
  row: "overloads (children, or options then children)",
};
/** A function whose table lists the fields of one parameter (by index) rather than its parameters. */
const FIELDS_OF_PARAM = { urlSync: 0, "layout.arrange": 2 };
/** A table that lists only what an entry adds to another type: those keys are left out of the comparison. */
const BEYOND = {
  "definePane:options": "$jali_layout.PaneOptions<any>",
  MissingProps: "$jali_layout_react.PaneProps<any>",
};
/** Type arguments for a generic type with no defaults. */
const TYPE_ARGS = { ChooseOptions: "<any>" };
/** A table that lists the values of one field of a type: `CloseRequest`'s "reason" table is `CloseRequest["reason"]`. */
const FIELD_VALUES = { CloseRequest: "reason" };

/** The module an entry's `from` names first: "jali-layout, jali-layout/react" → "jali-layout/react"? No: the first one, "jali-layout". */
const moduleOf = (from) => /jali-layout(?:\/[\w-]+)?/.exec(from ?? "")?.[0] ?? "jali-layout";
const MODULES = [
  "jali-layout",
  "jali-layout/react",
  "jali-layout/page",
  "jali-layout/testing",
  "jali-layout/features",
  "jali-layout/url",
  "jali-layout/palette",
  "jali-layout/settings",
  "jali-layout/chooser",
  "jali-layout/rename",
  "jali-layout/pop-out",
  "jali-layout/pressed",
];
const alias = (mod) => `$${mod.replace(/[^a-z]/g, "_")}`;

/** The <Params> tables of a page: each Entry's, with its params nested as written (ChildParams inside a Param). */
function tablesOf(text) {
  const tables = [];
  for (const e of text.matchAll(/<Entry\s+([^>]*?)>([\s\S]*?)<\/Entry>/g)) {
    const attrs = e[1];
    const name = /\bname="([^"]+)"/.exec(attrs)?.[1];
    const kind = /\bkind="([^"]+)"/.exec(attrs)?.[1];
    const from = /\bfrom="([^"]+)"/.exec(attrs)?.[1];
    const bodyStart = e.index + e[0].indexOf(">", e[0].indexOf(e[1]) + e[1].length) + 1;
    const body = e[2];
    // Tokens in order: <Params>, </Params>, <ChildParams>, </ChildParams>, <Param …> (open or self-closing), </Param>.
    const tokens = [
      ...body.matchAll(
        /<(\/?)(Params|ChildParams|Param)\b((?:[^>"{]|"[^"]*"|\{`[\s\S]*?`\}|\{[^}]*\})*?)(\/?)>/g,
      ),
    ];
    const stack = [];
    let table;
    for (const t of tokens) {
      const [, close, tag, a, self] = t;
      const at = bodyStart + t.index;
      if (tag === "Params" && !close) {
        table = {
          entry: name,
          kind,
          from,
          title: /\btitle="([^"]*)"/.exec(a)?.[1] ?? "Parameters",
          line: lineAt(text, at),
          params: [],
        };
        stack.length = 0;
        stack.push(table.params);
      } else if (tag === "Params" && close) {
        tables.push(table);
        table = undefined;
      } else if (tag === "ChildParams" && !close) {
        const parent = stack.at(-1)?.at(-1);
        if (parent) {
          parent.children = [];
          parent.childLabel = /\blabel="([^"]*)"/.exec(a)?.[1];
          stack.push(parent.children);
        }
      } else if (tag === "ChildParams" && close) stack.pop();
      else if (tag === "Param" && !close && table) {
        stack.at(-1).push({
          name: /\bname="([^"]+)"/.exec(a)?.[1],
          required: /\srequired\b/.test(a),
          line: lineAt(text, at),
          self: !!self,
        });
      }
    }
  }
  return tables;
}

const union = (names) => (names.length ? names.map((n) => JSON.stringify(n)).join(" | ") : "never");

const checks = [];
let tableCount = 0;
const tableSkips = [];
let ts = `// Generated by tooling/docs-check.mjs: each table in the reference, compared with the type it documents.\n`;
for (const mod of MODULES) ts += `import type * as ${alias(mod)} from "${mod}";\n`;
for (const mod of MODULES) ts += `import * as ${alias(mod)}_v from "${mod}";\n`;
ts += `import type { AllHTMLAttributes, ComponentProps, RefAttributes } from "react";

/** The keys of T a value must have. */
type Req<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T];
/** The lengths a function's parameter list may have. */
type Arity<F> = F extends (...args: infer A) => unknown ? (number extends A["length"] ? number : A["length"]) : never;
type Keys<T> = T extends unknown ? Extract<keyof T, string> : never;
`;
let seq = 0;
const lineOfTs = () => ts.split("\n").length;

/** Add one comparison: the documented names (and the required ones) against a type expression's keys. */
function compareKeys(where, label, doc, real, { requiredCheck = true, restHtml = false } = {}) {
  const id = `C${++seq}`;
  const names = doc.map((p) => p.name);
  const req = doc.filter((p) => p.required).map((p) => p.name);
  const docU = union(names);
  const realExpr = restHtml
    ? `Exclude<${real}, Exclude<keyof AllHTMLAttributes<HTMLElement> | keyof RefAttributes<any>, ${docU}>>`
    : real;
  ts += `\n// ${where} ${label}\ntype ${id}_T = ${realExpr};\n`;
  origins.set(`tables.ts:${lineOfTs()}`, { where, what: `${label}: names` });
  ts += `const ${id}: { undocumented: never; notInType: never } = null! as { undocumented: Exclude<${id}_T, ${docU}>; notInType: Exclude<${docU}, ${id}_T> };\n`;
  if (requiredCheck && !restHtml) {
    origins.set(`tables.ts:${lineOfTs()}`, { where, what: `${label}: which are required` });
    ts += `const ${id}r: { requiredInTypeNotInTable: never; requiredInTableNotInType: never } = null! as { requiredInTypeNotInTable: Exclude<${id}_R & (${docU}), ${union(req)}>; requiredInTableNotInType: Exclude<${union(req)}, ${id}_R> };\n`;
  }
  checks.push(id);
}

for (const page of pages.filter((p) => relative(pagesDir, p).startsWith("reference"))) {
  const text = readFileSync(page, "utf8");
  const rel = relative(pagesDir, page);
  for (const t of tablesOf(text)) {
    const where = `apps/docs/src/docs/${rel}:${t.line}`;
    if (SKIP[t.entry]) {
      tableSkips.push(`${t.entry} (${SKIP[t.entry]})`);
      continue;
    }
    tableCount++;
    if (list) console.log(`table   ${rel}:${t.line} ${t.entry} (${t.title})`);
    const mod = moduleOf(t.from);
    const dotted = t.entry.includes(".");
    // A value: the entry's own path in its module (`layout.open` is `$jali_layout_v.layout.open`).
    const value = `typeof ${alias(mod)}_v.${t.entry}`;
    const type = `${alias(mod)}.${t.entry}`;
    const top = t.params.filter((p) => p.name && !p.name.startsWith("..."));
    const restHtml = t.params.some((p) => p.name?.startsWith("..."));
    const strip = (parent, kids) =>
      kids.map((k) => ({ ...k, name: k.name.replace(new RegExp(`^${parent}\\.`), "") }));

    if (t.kind === "component") {
      ts += `type ${"P" + (seq + 1)} = ComponentProps<${value}>;\n`;
      const props = `P${seq + 1}`;
      compareKeys(where, `${t.entry} props`, top, `keyof ${props}`, { restHtml });
      ts += `type C${seq}_R = Req<${props}>;\n`;
    } else if (t.entry in FIELDS_OF_PARAM) {
      const param = `NonNullable<Parameters<${value}>[${FIELDS_OF_PARAM[t.entry]}]>`;
      compareKeys(where, `${t.entry}'s options`, top, `Keys<${param}>`);
      ts += `type C${seq}_R = Req<${param}>;\n`;
    } else if (t.kind === "function" || t.kind === "hook" || (dotted && t.kind !== "type")) {
      // Positional parameters: their number must be one the function takes.
      const id = `A${++seq}`;
      const req = top.filter((p) => p.required).length;
      ts += `\n// ${where} ${t.entry} parameters\n`;
      origins.set(`tables.ts:${lineOfTs()}`, {
        where,
        what: `${t.entry}: ${top.length} parameters documented (${req} required)`,
      });
      // A rest parameter ("...values") takes any number.
      const arity = restHtml ? "number" : `Arity<${value}>`;
      ts += `const ${id}: [${top.length}, ${req}] extends [${arity}, ${arity}] ? true : false = true;\n`;
      top.forEach((p, i) => {
        if (!p.children) return;
        const param = `NonNullable<Parameters<${value}>[${i}]>`;
        const beyond = BEYOND[`${t.entry}:${p.name}`];
        compareKeys(
          where,
          `${t.entry}'s ${p.name}${p.childLabel ? ` (${p.childLabel})` : ""}`,
          strip(p.name, p.children),
          beyond ? `Exclude<Keys<${param}>, Keys<${beyond}>>` : `Keys<${param}>`,
          { requiredCheck: true },
        );
        ts += `type C${seq}_R = Req<${param}>;\n`;
        // A field's own fields (createJali's keyboard).
        for (const c of p.children.filter((c) => c.children)) {
          const field = `NonNullable<${param}[${JSON.stringify(c.name)}]>`;
          compareKeys(
            where,
            `${t.entry}'s ${p.name}.${c.name}`,
            strip(c.name, c.children),
            `Keys<${field}>`,
          );
          ts += `type C${seq}_R = Req<${field}>;\n`;
        }
      });
    } else {
      // A type: its keys, or for a union of strings, its members.
      const base = `${type}${TYPE_ARGS[t.entry] ?? ""}`;
      const of = FIELD_VALUES[t.entry]
        ? `NonNullable<${base}[${JSON.stringify(FIELD_VALUES[t.entry])}]>`
        : base;
      const beyond = BEYOND[t.entry];
      const keys = beyond ? `Exclude<Keys<${of}>, Keys<${beyond}>>` : `Keys<${of}>`;
      const literal = `${of} extends string ? ${of} : ${keys}`;
      compareKeys(where, `${t.entry} (${t.title})`, top, literal, {
        requiredCheck: true,
      });
      ts += `type C${seq}_R = ${of} extends string ? never : Req<${of}>;\n`;
      for (const p of top.filter((p) => p.children)) {
        const field = `NonNullable<${base}[${JSON.stringify(p.name)}]>`;
        compareKeys(
          where,
          `${t.entry}'s ${p.name}`,
          strip(p.name, p.children),
          `${field} extends string ? ${field} : Keys<${field}>`,
        );
        ts += `type C${seq}_R = ${field} extends string ? never : Req<${field}>;\n`;
      }
    }
  }
}
writeFileSync(join(out, "tables.ts"), ts);

// ---------- compile ----------

writeFileSync(
  join(out, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "../../tsconfig.json",
      compilerOptions: { noUnusedLocals: false, noUnusedParameters: false },
      include: ["tables.ts", "samples", "../../src/samples/prelude.d.ts", "../../src/mdx.d.ts"],
    },
    null,
    2,
  ),
);
let output = "";
try {
  execFileSync(
    join(root, "node_modules/.bin/tsc"),
    ["--noEmit", "-p", join(out, "tsconfig.json")],
    {
      cwd: out,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
} catch (e) {
  output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}

// Group tsc's lines by error: an error starts with "file(line,col): error"; the indented lines after it elaborate.
const errors = [];
for (const l of output.split("\n")) {
  const m = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(l);
  if (m)
    errors.push({ file: relative(out, resolve(out, m[1])), line: +m[2], code: m[3], text: [m[4]] });
  else if (l.trim() && errors.length) errors.at(-1).text.push(l.trim());
}
for (const e of errors) {
  const o = origins.get(`${e.file}:${e.line}`);
  console.error(
    `${o ? `${o.where}: ${o.what}` : `${e.file}:${e.line}`}\n  ${e.code}: ${e.text.join("\n  ")}\n`,
  );
}
console.log(
  `docs-check: ${checked} code samples typechecked (${skipped.length} marked nocheck), ${tableCount} reference tables compared with their types${tableSkips.length ? ` (not compared: ${tableSkips.join("; ")})` : ""}`,
);
if (output && !errors.length) console.error(output);
if (output) {
  console.error(
    `docs-check: ${errors.length} problem${errors.length === 1 ? "" : "s"}; generated files in ${relative(root, out)}`,
  );
  process.exit(1);
}
