#!/usr/bin/env node
/**
 * Every gate, in one command. Runs all of them (even after a failure), writes each one's output to
 * node_modules/.verify/<gate>.log, prints the tail of any that fail, and ends with one line per gate. Exits 1 if any
 * gate failed.
 *
 *   pnpm verify               every gate
 *   pnpm verify --quick       without the browser suites and the React 18 check
 *   pnpm verify lint fmt      only the gates named (see GATES below)
 *   pnpm verify --jobs=1      one gate at a time (default 4)
 *
 * The gates without a browser run side by side, up to --jobs at once; a gate waits for the ones in its `after`. The
 * browser suites run after them, one suite at a time: each runs its own tests in parallel (e2e/fixtures/browsers.ts),
 * and they read rendered positions, so they get the machine to themselves. They start their own servers on free
 * ports it picks, so they run beside anyone else's dev servers and never test another checkout
 * (e2e/fixtures/server.ts).
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
const jobsArg = args.find((a) => a.startsWith("--jobs="));
const jobs = jobsArg ? Math.max(1, Number(jobsArg.slice("--jobs=".length)) || 1) : 4;

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
  // Names that only work on a disk that ignores case: a Linux checkout or CI would fail on them first.
  {
    name: "case",
    cmd: ["node", "tooling/case-check.mjs"],
    detail: (log) => lastMatch(log, /^case-check:/)?.replace(/^case-check: /, ""),
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
  {
    name: "docs-check",
    cmd: ["node", "tooling/docs-check.mjs"],
    detail: (log) =>
      lastMatch(log, /^docs-check: \d+ (code samples|problems?)/)?.replace(/^docs-check: /, ""),
  },
  { name: "agent-docs", cmd: ["node", "tooling/agent-docs.mjs", "--check"] },
  {
    name: "consumers",
    cmd: ["node", "tooling/consumers.mjs"],
    detail: (log) =>
      lastMatch(log, /^consumers: \d+ public names? without/)?.replace(
        /^consumers: | \(of .*/g,
        "",
      ),
  },
  {
    name: "react18",
    full: true,
    cmd: ["bash", "tooling/test-react18.sh"],
    detail: (log) => lastMatch(log, /^\s*Tests\s|^React \d/),
  },
  {
    name: "size",
    // Rebuilds packages/*/dist, which unit's bundle test builds from when it is there: never both at once.
    after: ["unit"],
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
    name: "pack",
    // `pnpm pack` rebuilds packages/jali/dist, which size builds and reads: never both at once.
    after: ["size"],
    cmd: ["node", "tooling/pack-check.mjs"],
    detail: (log) => lastMatch(log, /^pack-check: \d+ problems?/),
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
  ...["data-studio", "loan-review", "markets", "studio", "trips", "handshake"].map((name) => ({
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

console.log(`verify: ${gates.map((g) => g.name).join(", ")} (${jobs} at once)`);
if (gates.some((g) => g.browser))
  console.log(
    `verify: browser suites on ${Object.entries(ports)
      .map(([k, v]) => `${k.replace(/_URL$/, "").toLowerCase()} :${new URL(v).port}`)
      .join(", ")}`,
  );

const results = {};
const selected = new Set(gates.map((g) => g.name));

function finish(gate, r) {
  // eslint-disable-next-line no-control-regex
  const log = readFileSync(r.file, "utf8").replace(/\x1b\[[0-9;]*m/g, "");
  r.detail = gate.detail?.(log);
  results[gate.name] = r;
  if (!r.ok) {
    const tail = log.trimEnd().split("\n").slice(-40).join("\n");
    process.stdout.write(
      `\n${tail}\n✘ ${gate.name} failed (exit ${r.code}); full log: ${relative(root, r.file)}\n`,
    );
  } else process.stdout.write(`✓ ${gate.name} (${(r.ms / 1000).toFixed(1)}s)\n`);
}

/** Runs `list` up to `limit` at once, in order, each once the gates in its `after` (those selected) have finished. */
async function pool(list, limit) {
  const waiting = [...list];
  const running = new Set();
  const ready = (g) => (g.after ?? []).every((n) => !selected.has(n) || results[n]);
  while (waiting.length || running.size) {
    for (const gate of waiting.filter(ready)) {
      if (running.size >= limit) break;
      waiting.splice(waiting.indexOf(gate), 1);
      process.stdout.write(`▶ ${gate.name}: ${gate.cmd.join(" ")}\n`);
      const job = run(gate, gate.env?.(results)).then((r) => {
        finish(gate, r);
        running.delete(job);
      });
      running.add(job);
    }
    if (!running.size) throw new Error(`verify: ${waiting.map((g) => g.name)} wait on each other`);
    await Promise.race(running);
  }
}

const started = Date.now();
await pool(
  gates.filter((g) => !g.browser),
  jobs,
);
await pool(
  gates.filter((g) => g.browser),
  1,
);

const width = Math.max(...gates.map((g) => g.name.length));
console.log(
  `\nverify${quick ? " --quick" : ""}: summary (${((Date.now() - started) / 1000).toFixed(1)}s in all)`,
);
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
