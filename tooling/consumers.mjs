#!/usr/bin/env node
/**
 * Every public name has a consumer. A name nothing in the repo uses is a name nobody has tried: its shape, its words
 * and its docs are guesses. So each name an app can reach must be used by an app in the repo:
 *
 * - every runtime value an app entry of `jali-layout` exports (the entries come from packages/jali/package.json's exports,
 *   followed through aliases and re-exports to what they declare), used for real by an example: called, rendered as
 *   a JSX element, read or passed. An import, a re-export, a comment or a type position isn't a use.
 * - every `createJali` option and every pane-kind option (`definePane`), given a value by an example: a property of an
 *   object literal typed as those options (an argument, `satisfies`, an annotation, a helper's parameter), or a
 *   property an object literal declares that reaches where those options are expected (an argument or a spread),
 *   through constants and helper returns (`testJaliOptions()`'s `size`). A value typed as the options themselves (a
 *   `Partial<JaliOptions>` passed along) gives no option a value: only a literal's own properties count.
 * - every type an app entry exports, named by an example (in a type, too) or reachable from a public value's
 *   signature: what a function takes and returns, an un-annotated constant's shape, and the types those name in turn.
 *
 * The app entries are every entry but `jali-layout/adapter`: that one is for people writing a framework adapter, may change in
 * any minor version, and no app imports it (tooling/public-types.mjs leaves it out the same way).
 *
 * The examples are examples/* (their unit tests included). The docs site and the packages' own tests are not
 * consumers: a sample shows a name, and a test checks it, without either being an app that needed it. There is no
 * allowlist: a name no example would ever use is a proposal to cut it. Real Data Studio, when its checkout is beside
 * this one, is read as an extra witness and reported next to each missing name; it never makes one pass.
 *
 *   node tooling/consumers.mjs
 *
 * It reads the repo through TypeScript's own checker (typescript/unstable/sync, over the root tsconfig.json), so a
 * name is matched by what it resolves to, never by its spelling.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { API, SymbolFlags } from "typescript/unstable/sync";
import { SyntaxKind } from "typescript/unstable/ast";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_STUDIO = join(
  homedir(),
  "Projects/Sixface-Initiate/sixface/products/data-studio/code/data-studio/packages/workbench/src",
);

const api = new API({ cwd: root });
const project = api
  .updateSnapshot({ openProjects: [join(root, "tsconfig.json")] })
  .getProjects()
  .find((p) => resolve(p.configFileName) === join(root, "tsconfig.json"));
const { checker, program } = project;

// ---------- where things are ----------
const lower = (p) => p.toLowerCase();
const rel = (p) => relative(lower(root), lower(p));
const files = new Map(); // lowercased path → source file
for (const name of program.getSourceFileNames()) {
  if (name.includes("/node_modules/")) continue;
  const sf = program.getSourceFile(name);
  if (sf) files.set(lower(sf.fileName), sf);
}
const inExamples = (p) => rel(p).startsWith("examples/");

/** "packages/core/src/x.ts:12" for a node, or a symbol's first declaration. */
const at = (node) => {
  const sf = node.getSourceFile();
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  return `${relative(root, sf.fileName)}:${line}`;
};
const declOf = (symbol) => symbol.declarations?.[0]?.resolve(project);
const declaredAt = (symbol) => {
  const node = declOf(symbol);
  return node ? at(node) : "(no declaration)";
};
const original = (symbol) =>
  symbol && symbol.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
const handleKey = (h) => `${lower(h.path)}#${h.index}`;

const walk = (node, visit) => {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
};
const isTypeNode = (kind) =>
  (kind >= SyntaxKind.FirstTypeNode && kind <= SyntaxKind.LastTypeNode) ||
  kind === SyntaxKind.InterfaceDeclaration ||
  kind === SyntaxKind.TypeAliasDeclaration ||
  kind === SyntaxKind.HeritageClause;
/** Inside an import or export declaration (its specifiers name things; they don't use them). */
const inModuleSyntax = (node) => {
  for (let n = node.parent; n; n = n.parent)
    if (
      n.kind === SyntaxKind.ImportDeclaration ||
      n.kind === SyntaxKind.ExportDeclaration ||
      n.kind === SyntaxKind.ImportEqualsDeclaration ||
      n.kind === SyntaxKind.ExportAssignment
    )
      return true;
  return false;
};
const inTypePosition = (node) => {
  for (let n = node.parent; n; n = n.parent) if (isTypeNode(n.kind)) return true;
  return false;
};

// ---------- the public names ----------
const pkg = JSON.parse(readFileSync(join(root, "packages/jali/package.json"), "utf8"));
const entries = Object.entries(pkg.exports)
  .filter(([, e]) => typeof e === "object" && /\.tsx?$/.test(e.source ?? ""))
  .filter(([sub]) => sub !== "./adapter")
  .map(([sub, e]) => ({
    name: sub === "." ? pkg.name : `${pkg.name}/${sub.slice(2)}`,
    file: join(root, "packages/jali", e.source),
  }));

const values = new Map(); // symbol id → { name, entry, symbol }
const types = new Map(); // symbol id → { name, entry, symbol }
for (const entry of entries) {
  const sf = files.get(lower(entry.file));
  const module = sf && checker.getSymbolAtLocation(sf);
  if (!module) throw new Error(`consumers: can't read ${relative(root, entry.file)}`);
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol = original(exported);
    const record = { name: exported.name, entry: entry.name, symbol };
    if (symbol.flags & SymbolFlags.Value) {
      if (!values.has(symbol.id)) values.set(symbol.id, record);
    } else if (symbol.flags & SymbolFlags.Type && !types.has(symbol.id))
      types.set(symbol.id, record);
  }
}

/** The options a type declares (inherited ones included): declaration key → name. */
const optionsOf = (typeName) => {
  const record = [...types.values()].find((t) => t.name === typeName);
  if (!record) throw new Error(`consumers: no public type ${typeName}`);
  const out = new Map();
  for (const prop of checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(record.symbol)))
    for (const d of prop.declarations ?? [])
      out.set(handleKey(d), { name: prop.name, symbol: prop, of: typeName });
  return out;
};
const optionSets = {
  createJali: optionsOf("JaliOptions"),
  pane: optionsOf("PaneOptionsReact"),
};
const optionNames = (set) => [...new Map([...set.values()].map((o) => [o.name, o])).values()];

// ---------- the uses ----------
const valueWitness = new Map(); // symbol id → where
const typeWitness = new Map();
const optionWitness = { createJali: new Map(), pane: new Map() }; // name → where
const OBJECT_VALUES = new Set([
  SyntaxKind.PropertyAssignment,
  SyntaxKind.ShorthandPropertyAssignment,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.GetAccessor,
]);
/** Which options `name` is in a value typed `contextual`: the sets whose declaration it resolves to. */
const optionIn = (contextual, name) => {
  const type = checker.getNonNullableType(contextual) ?? contextual;
  const prop = checker.getPropertyOfType(type, name);
  const sets = [];
  for (const d of prop?.declarations ?? [])
    for (const [set, options] of Object.entries(optionSets))
      if (options.has(handleKey(d)) && !sets.includes(set)) sets.push(set);
  return sets;
};
const witnessOption = (sets, name, node) => {
  for (const set of sets) if (!optionWitness[set].has(name)) optionWitness[set].set(name, at(node));
};
/**
 * A value of type `actual` given where `contextual` is expected (an argument, a spread): each option it has that an
 * object literal declares, wherever that literal is (a constant, a helper's return). A property only a type declares
 * (a `Partial<JaliOptions>` passed along) gives nothing.
 */
const concreteOptions = (actual, contextual, fallback) => {
  if (!actual || !contextual) return;
  for (const prop of checker.getPropertiesOfType(actual)) {
    const concrete = (prop.declarations ?? []).find((d) => OBJECT_VALUES.has(d.kind));
    if (!concrete) continue;
    const sets = optionIn(contextual, prop.name).filter(
      (set) => !optionWitness[set].has(prop.name),
    );
    if (sets.length) witnessOption(sets, prop.name, concrete.resolve(project) ?? fallback);
  }
};

for (const [path, sf] of files) {
  if (!inExamples(path)) continue;
  const ids = [];
  const literals = [];
  const args = [];
  walk(sf, (node) => {
    if (node.kind === SyntaxKind.Identifier && !inModuleSyntax(node)) ids.push(node);
    if (node.kind === SyntaxKind.ObjectLiteralExpression) literals.push(node);
    if (node.kind === SyntaxKind.CallExpression || node.kind === SyntaxKind.NewExpression)
      args.push(...(node.arguments ?? []));
  });
  if (!ids.length) continue;
  const symbols = checker.getSymbolAtLocation(ids);
  ids.forEach((id, i) => {
    let symbol = symbols[i];
    if (id.parent.kind === SyntaxKind.ShorthandPropertyAssignment && id.parent.name === id)
      symbol = checker.getShorthandAssignmentValueSymbol(id.parent) ?? symbol;
    symbol = original(symbol);
    if (!symbol) return;
    if (values.has(symbol.id) && !inTypePosition(id) && !valueWitness.has(symbol.id))
      valueWitness.set(symbol.id, at(id));
    if (types.has(symbol.id) && !typeWitness.has(symbol.id)) typeWitness.set(symbol.id, at(id));
  });

  // An object literal typed as the options (an argument, `satisfies`, an annotation): each option it gives, and the
  // concrete options of what it spreads.
  for (const literal of literals) {
    const contextual = checker.getContextualType(literal);
    if (!contextual) continue;
    for (const property of literal.properties) {
      if (property.kind === SyntaxKind.SpreadAssignment)
        concreteOptions(checker.getTypeAtLocation(property.expression), contextual, property);
      else if (OBJECT_VALUES.has(property.kind) && property.name?.kind === SyntaxKind.Identifier)
        witnessOption(optionIn(contextual, property.name.text), property.name.text, property);
    }
  }
  // A value passed where the options are expected: its concrete options.
  for (const arg of args)
    if (arg.kind !== SyntaxKind.ObjectLiteralExpression)
      concreteOptions(checker.getTypeAtLocation(arg), checker.getContextualType(arg), arg);
}

// ---------- types reachable from a public value's signature ----------
// Every type a value's signature names, and the types those name, through to the fields of each. A function's body
// is never followed: only what it takes and returns. An un-annotated constant's shape is what its initializer is made
// of (`en` is its areas, each its messages), so its names are followed, short of any function body in it.
const reached = new Set();
{
  const queue = [];
  const seen = new Set();
  const visit = (symbol) => {
    if (!symbol || seen.has(symbol.id)) return;
    seen.add(symbol.id);
    queue.push(symbol);
  };
  const FUNCTIONS = new Set([
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction,
    SyntaxKind.MethodDeclaration,
    SyntaxKind.Constructor,
    SyntaxKind.GetAccessor,
    SyntaxKind.SetAccessor,
  ]);
  /** The names a declaration's shape is made of. */
  const shapeNames = (node, out = []) => {
    if (node.kind === SyntaxKind.Block) return out;
    if (FUNCTIONS.has(node.kind)) {
      for (const part of [...(node.typeParameters ?? []), ...(node.parameters ?? []), node.type])
        if (part) shapeNames(part, out);
      return out;
    }
    if (node.kind === SyntaxKind.VariableDeclaration && node.type)
      return shapeNames(node.type, out);
    if (node.kind === SyntaxKind.Parameter) return node.type ? shapeNames(node.type, out) : out;
    if (node.kind === SyntaxKind.Identifier) {
      const { parent } = node;
      const isName =
        parent.name === node &&
        [SyntaxKind.PropertyAccessExpression, SyntaxKind.PropertyAssignment].includes(parent.kind);
      if (!isName) out.push(node);
      return out;
    }
    node.forEachChild((child) => void shapeNames(child, out));
    return out;
  };
  for (const v of values.values()) visit(v.symbol);
  while (queue.length) {
    const symbol = queue.shift();
    if (types.has(symbol.id)) reached.add(symbol.id);
    for (const handle of symbol.declarations ?? []) {
      if (lower(handle.path).includes("/node_modules/")) continue;
      const node = handle.resolve(project);
      const ids = node ? shapeNames(node) : [];
      if (!ids.length) continue;
      checker.getSymbolAtLocation(ids).forEach((s, i) => {
        const shorthand = ids[i].parent.kind === SyntaxKind.ShorthandPropertyAssignment;
        const o = original(
          shorthand ? checker.getShorthandAssignmentValueSymbol(ids[i].parent) : s,
        );
        if (o && o.flags & (SymbolFlags.Type | SymbolFlags.Value) && o.declarations?.length)
          visit(o);
      });
    }
  }
}

// ---------- Real Data Studio, an extra witness ----------
// Read as text (it is its own program, with its own copy of Jali): a value counts where a file that imports it from a
// `jali-layout` entry uses it outside the import; an option, where a file that calls `createJali` or `definePane` gives it.
const dataStudio = existsSync(DATA_STUDIO) ? [] : null;
if (dataStudio) {
  const read = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === "node_modules") continue;
      if (statSync(p).isDirectory()) read(p);
      else if (/\.tsx?$/.test(name)) {
        const text = readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
          .replace(/\/\/.*$/gm, "");
        const imported = new Set();
        for (const m of text.matchAll(
          /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']jali(?:\/[\w-]+)?["']/g,
        ))
          for (const part of m[1].split(","))
            imported.add(
              part
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)
                .at(-1),
            );
        const body = text.replace(/import\s[^;]*?from\s+["'][^"']+["'];?/g, (c) =>
          c.replace(/[^\n]/g, " "),
        );
        dataStudio.push({ file: p, imported, lines: body.split("\n"), body });
      }
    }
  };
  read(DATA_STUDIO);
}
/** Where real Data Studio uses a name: `option`, the call whose options it is. */
const inDataStudio = (name, option) => {
  if (!dataStudio) return null;
  const re = option
    ? new RegExp(`(^|[{,\\s])${name}\\s*(:|\\(|,|\\})`)
    : new RegExp(`(<|\\b)${name}\\b`);
  for (const { file, imported, lines, body } of dataStudio) {
    if (option ? !body.includes(`${option}(`) : !imported.has(name)) continue;
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) return `${relative(DATA_STUDIO, file)}:${i + 1}`;
  }
  return null;
};

// ---------- the report ----------
const missing = [];
const note = (name, option) => {
  const ds = inDataStudio(name, option);
  return ds ? `  (real Data Studio: ${ds})` : "";
};
for (const v of values.values())
  if (!valueWitness.has(v.symbol.id))
    missing.push(
      `${v.entry}: ${v.name} (${declaredAt(v.symbol)}) is used by no example${note(v.name, false)}`,
    );
for (const [set, options] of Object.entries(optionSets))
  for (const o of optionNames(options))
    if (!optionWitness[set].has(o.name)) {
      const call = set === "pane" ? "definePane" : "createJali";
      missing.push(
        `${call} option ${o.name} (${declaredAt(o.symbol)}) is given by no example${note(o.name, call)}`,
      );
    }
for (const [id, t] of types)
  if (!typeWitness.has(id) && !reached.has(id))
    missing.push(
      `${t.entry}: type ${t.name} (${declaredAt(t.symbol)}) is named by no example and reached by no public value's signature`,
    );

const counts = `${values.size} values, ${optionNames(optionSets.createJali).length} createJali options, ${optionNames(optionSets.pane).length} pane-kind options, ${types.size} types`;
api.close();
if (missing.length) {
  for (const line of missing.sort()) console.error(`consumers: ${line}`);
  console.log(
    `consumers: ${missing.length} public name${missing.length === 1 ? "" : "s"} without a consumer (of ${counts})${dataStudio ? "" : "; real Data Studio not found"}`,
  );
  process.exit(1);
}
console.log(
  `consumers: every public name has a consumer (${counts})${dataStudio ? "; real Data Studio read" : ""}`,
);
