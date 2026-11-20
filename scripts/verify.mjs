#!/usr/bin/env node
/**
 * Every gate, in one command. Runs each in turn (all of them, even after a failure), writes each one's output to
 * node_modules/.verify/<gate>.log, prints the tail of any that fail, and ends with one line per gate. Exits 1 if any
 * gate failed.
 *
 *   pnpm verify               every gate
 *   pnpm verify --quick       without the browser suites and the React 18 check
 *   pnpm verify lint fmt      only the gates named (see GATES below)
 *
 * The browser suites start their own servers on free ports it picks, so they run beside anyone else's dev servers
 * and never test another checkout (e2e/fixtures/server.ts).
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logs = join(root, "node_modules", ".verify");
mkdirSync(logs, { recursive: true });

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const only = args.filter((a) => !a.startsWith("--"));

/** A port nobody is listening on now, distinct from the ones already picked. */
const picked = new Set();
async function freePort() {
  for (;;) {
    const port = await new Promise((done, fail) => {
      const server = createServer();
      server.once("error", fail);
      server.listen(0, () => {
        const { port } = server.address();
        server.close(() => done(port));
      });
    });
    if (!picked.has(port)) {
      picked.add(port);
      return port;
    }
  }
}
const url = async () => `http://localhost:${await freePort()}`;

/** The tests' own variables only: never reuse a server, whatever the shell says. */
const env = { ...process.env, FORCE_COLOR: "0" };
delete env.REUSE_SERVER;

const ports = {
  DATA_STUDIO_URL: await url(),
  LOAN_REVIEW_URL: await url(),
  MARKETS_URL: await url(),
  STUDIO_URL: await url(),
  TRIPS_URL: await url(),
  DOCS_URL: await url(),
};

/** The last line of a log that looks like a result (Playwright's "N passed", Vitest's "Tests  N passed", …). */
const lastMatch = (log, re) =>
  log
    .split("\n")
    .filter((l) => re.test(l))
    .at(-1)
    ?.trim();
const playwright = (log) =>
  [/^\s*\d+ (passed|failed|flaky|skipped|did not run)/, /^Error: /]
    .map((re) =>
      log
        .split("\n")
        .filter((l) => re.test(l))
        .map((l) => l.trim()),
    )
    .flat()
    .join(", ") || undefined;

// name, what it runs, and how to read a one-line result from its log. `full` gates are left out by --quick.
const GATES = [
  { name: "typecheck", cmd: ["pnpm", "-s", "typecheck"] },
  {
    name: "lint",
    cmd: ["pnpm", "exec", "vp", "lint"],
    detail: (log) => {
      const n = log.split("\n").filter((l) => /: warning /.test(l)).length;
      return n ? `${n} warning${n === 1 ? "" : "s"}` : undefined;
    },
  },
  {
    name: "fmt",
    cmd: ["pnpm", "exec", "vp", "fmt", "--check"],
    detail: (log) =>
      lastMatch(log, /Format issues found/)?.replace(
        /.*in above (\d+) files?.*/,
        "$1 files unformatted",
      ),
  },
  {
    name: "unit",
    cmd: ["pnpm", "exec", "vp", "test", "run"],
    detail: (log) => lastMatch(log, /^\s*Tests\s/),
  },
  {
    name: "docs-reference",
    cmd: [
      "pnpm",
      "exec",
      "vp",
      "test",
      "run",
      "--config",
      "apps/docs/src/reference/vitest.config.ts",
    ],
    detail: (log) => lastMatch(log, /^\s*Tests\s/),
  },
  { name: "agent-docs", cmd: ["node", "scripts/agent-docs.mjs", "--check"] },
  {
    name: "react18",
    full: true,
    cmd: ["bash", "scripts/test-react18.sh"],
    detail: (log) => lastMatch(log, /^\s*Tests\s|^React \d/),
  },
  {
    name: "size",
    cmd: ["pnpm", "size"],
    // "size: minimal ships more core than its budget" → "over budget: minimal core, react; full core".
    detail: (log) => {
      const over = {};
      for (const [, scenario, what] of log.matchAll(/^size: (\S+) ships (?:more )?(\S+)/gm))
        (over[scenario] ??= []).push(what);
      const list = Object.entries(over).map(([s, w]) => `${s} ${w.join(", ")}`);
      return list.length ? `over budget: ${list.join("; ")}` : undefined;
    },
  },
  {
    name: "docs-build",
    cmd: ["pnpm", "--filter", "@jali/docs", "build"],
    detail: (log) => lastMatch(log, /page\(s\) built/)?.replace(/^\S+ \[build\] /, ""),
  },
  {
    name: "e2e-jali",
    full: true,
    browser: true,
    cmd: ["pnpm", "exec", "playwright", "test"],
    detail: playwright,
  },
  ...["data-studio", "markets", "studio", "trips"].map((name) => ({
    name: `e2e-${name}`,
    full: true,
    browser: true,
    cmd: ["pnpm", "exec", "playwright", "test", "-c", `examples/${name}`],
    detail: playwright,
  })),
  {
    name: "e2e-docs",
    full: true,
    browser: true,
    cmd: ["pnpm", "exec", "playwright", "test", "-c", "apps/docs"],
    // Serve the dist/ the docs-build gate made, when it made one.
    env: (results) => (results["docs-build"]?.ok ? { DOCS_BUILT: "1" } : {}),
    detail: (log) =>
      [playwright(log), lastMatch(log, /^C14 \(known/)].filter(Boolean).join("; ") || undefined,
  },
];

const unknown = only.filter((n) => !GATES.some((g) => g.name === n));
if (unknown.length) {
  console.error(
    `verify: no gate named ${unknown.join(", ")}. Gates: ${GATES.map((g) => g.name).join(", ")}`,
  );
  process.exit(2);
}
const gates = GATES.filter((g) => (only.length ? only.includes(g.name) : !(quick && g.full)));

function run(gate, extra) {
  const file = join(logs, `${gate.name}.log`);
  const out = createWriteStream(file);
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn(gate.cmd[0], gate.cmd.slice(1), {
      cwd: root,
      env: { ...env, ...(gate.browser ? ports : {}), ...extra },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on("close", (code) =>
      out.end(() => done({ ok: code === 0, code, ms: Date.now() - started, file })),
    );
    child.on("error", (e) => out.end(() => done({ ok: false, code: e.message, ms: 0, file })));
  });
}

console.log(`verify: ${gates.map((g) => g.name).join(", ")}`);
if (gates.some((g) => g.browser))
  console.log(
    `verify: browser suites on ${Object.entries(ports)
      .map(([k, v]) => `${k.replace(/_URL$/, "").toLowerCase()} :${new URL(v).port}`)
      .join(", ")}`,
  );

const results = {};
for (const gate of gates) {
  process.stdout.write(`\n▶ ${gate.name}: ${gate.cmd.join(" ")}\n`);
  const r = await run(gate, gate.env?.(results));
  // eslint-disable-next-line no-control-regex
  const log = readFileSync(r.file, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
  r.detail = gate.detail?.(log);
  results[gate.name] = r;
  if (!r.ok) {
    const tail = log.trimEnd().split("\n").slice(-40).join("\n");
    process.stdout.write(
      `${tail}\n✘ ${gate.name} failed (exit ${r.code}); full log: ${relative(root, r.file)}\n`,
    );
  } else process.stdout.write(`✓ ${gate.name} (${(r.ms / 1000).toFixed(1)}s)\n`);
}

const width = Math.max(...gates.map((g) => g.name.length));
console.log(`\nverify${quick ? " --quick" : ""}: summary`);
for (const gate of gates) {
  const r = results[gate.name];
  const time = `${(r.ms / 1000).toFixed(1)}s`.padStart(7);
  const detail = r.detail ? `  ${r.detail}` : "";
  const log = r.ok ? "" : `  (${relative(root, r.file)})`;
  console.log(`${r.ok ? "pass" : "FAIL"}  ${gate.name.padEnd(width)}${time}${detail}${log}`);
}
const failed = gates.filter((g) => !results[g.name].ok).map((g) => g.name);
console.log(
  failed.length
    ? `\nverify: ${failed.length} failed: ${failed.join(", ")}`
    : "\nverify: all passed",
);
process.exit(failed.length ? 1 : 0);
