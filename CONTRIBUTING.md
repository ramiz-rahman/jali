# Contributing to Jali

How to set up the repo, what must pass before a change lands, and how work is done here. How Jali is built is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Set up

You need Node 22.23 or later (vite-plus requires it; Node 24 and 26 work) and pnpm.

```sh
pnpm install
pnpm data-studio      # an example app, on :5300
```

The repo is a pnpm workspace:

| Folder           | What it is                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/jali`  | `jali`, the one published package. Its entries re-export the two below; `vp pack` bundles them.                                                          |
| `packages/core`  | `@jali/core` (private): the framework-free core.                                                                                                         |
| `packages/react` | `@jali/react` (private): the React adapter, its parts and styles.                                                                                        |
| `apps/docs`      | The docs site (Astro): `pnpm --filter @jali/docs dev`, on :5400. See [apps/docs/AGENTS.md](apps/docs/AGENTS.md).                                         |
| `examples/`      | Five example apps, plus `minimal` (the Quickstart's app) and `own-icons` (a size check). Held to [docs/EXAMPLES-STANDARD.md](docs/EXAMPLES-STANDARD.md). |
| `e2e/`           | Jali's browser tests, against Data Studio and Loan review.                                                                                               |
| `tooling/`       | The checks and generators: `verify`, `size`, `docs-check`, `agent-docs`, `pack-check`, `public-types`, `consumers`, `icons`, the React 18 check.         |
| `skills/jali`    | The skill a coding agent loads to build with Jali.                                                                                                       |
| `docs/`          | The product brief, the decisions, the API review, the migration notes, and dated reviews.                                                                |

| App             | Start it           | Port |
| --------------- | ------------------ | ---- |
| Data Studio     | `pnpm data-studio` | 5300 |
| Loan review     | `pnpm loan-review` | 5350 |
| Markets         | `pnpm markets`     | 5320 |
| Studio          | `pnpm studio`      | 5330 |
| Trips           | `pnpm trips`       | 5340 |
| The minimal app | `pnpm minimal`     | 5310 |

## Before you commit: `pnpm verify`

`pnpm verify` runs every gate, carries on past a failure, and ends with one line per gate. Any failure exits 1, and each gate's full output is in `node_modules/.verify/<gate>.log`. Every gate must pass before a change merges. The gates without a browser run four at a time (`--jobs=N` to change it), except where one rebuilds what another reads: `size` waits for `unit`, and `pack` for `size`. The browser suites follow, one suite at a time, each running four tests at once (`WORKERS` in `e2e/fixtures/browsers.ts`; `--workers=1` runs a suite one test at a time).

| Gate             | What it checks                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typecheck`      | The packages, the examples, the docs site and its samples, and the type tests                                                                                                               |
| `lint`, `fmt`    | `vp lint`, and `vp fmt --check` (MDX and the generated Markdown are left as written)                                                                                                        |
| `case`           | Every tracked path is spelt in git as on disk, and every relative import in its file's own case: names that only work where case is ignored (`tooling/case-check.mjs`)                      |
| `unit`           | Every package's and example's unit tests                                                                                                                                                    |
| `docs-reference` | The reference covers every export, command, key and token; the Markdown export; the tests the guides show (the testing guide's, the router adapter's, the Quickstart's walkthrough)         |
| `docs-check`     | Every code block on the site typechecks, and every reference table matches the type it documents (`tooling/docs-check.mjs`)                                                                 |
| `agent-docs`     | `packages/jali/docs` is up to date with the site (run `pnpm agent-docs` to write it)                                                                                                        |
| `consumers`      | Every public name has a consumer: each value an app entry of `jali` exports, each `createJali` and pane-kind option, and each exported type is used by an example (`tooling/consumers.mjs`) |
| `react18`        | The committed HEAD's tests with React 18                                                                                                                                                    |
| `size`           | What each scenario ships of Jali, against its budget, and that no feature's code leaks into a scenario without it                                                                           |
| `pack`           | `jali` packed, every type its signatures name exported (`tooling/public-types.mjs`), `examples/minimal` built from the tarball, and a server render hydrated from it                        |
| `docs-build`     | The docs site prerenders every page                                                                                                                                                         |
| `e2e-*`          | The browser suites: Jali's (`e2e/`), each example's, and the docs site's                                                                                                                    |

- `pnpm verify --quick` skips the browser suites and the React 18 check. Enough while you work; run the full one before a change to `packages/`, or to anything a browser suite covers, is committed.
- `pnpm verify lint fmt` runs only the gates named.
- The browser suites start their own servers on free ports, so `pnpm verify` runs beside your dev servers. A suite run on its own uses the port its URL variable names (`DATA_STUDIO_URL`, `DOCS_URL`, …), stops if something else holds it, and reuses your server only with `REUSE_SERVER=1`.

CI (`.github/workflows/ci.yml`) runs the gates that need no browser on Linux, where case matters, on every push and pull request. It starts once the repository is on GitHub.

On their own: `pnpm test`, `pnpm e2e`, `pnpm exec playwright test -c examples/<name>` or `-c apps/docs`, `pnpm typecheck`, `pnpm size`, `pnpm docs-check`, `pnpm test:react18`, `pnpm pack-check`.

## How work is done

- **One branch per piece of work, in its own worktree** (`git worktree add .claude/worktrees/<name> -b <name>`), so several pieces of work and their dev servers never share a checkout. Never remove a worktree that isn't yours.
- **Test first.** A bug is first reproduced by a failing test, beside the code it covers (`packages/*/tests`, an example's `e2e/`, or the docs' tests); then it is fixed, and the test passes. A new behaviour lands with its test.
- **Small, focused commits**, staged by path (`git add <paths>`, never `-A`), with plain messages that say what changed and why.
- **Every public name has a consumer.** A value, an option or a type an app can reach is used for real by one of the examples (their tests count; the docs and the packages' own tests don't), or the `consumers` gate fails. A new name lands with its use in the example it belongs to; a name no example would ever use is a proposal to cut it, never an allowlist entry.
- **Decisions are written down.** A choice someone would otherwise ask about goes in [docs/DECISIONS.md](docs/DECISIONS.md), dated, with the reason. A change to the public API also updates [docs/MIGRATION.md](docs/MIGRATION.md).
- **Breaking changes are announced** to the apps that use Jali before they merge.

## Docs

- Every page is MDX in `apps/docs/src/docs`. A code sample that must stay true is a real file in `apps/docs/src/samples`, imported with `?raw`, and typechecked. A short block in a page is typechecked too, by `docs-check`, with the names in `apps/docs/src/samples/prelude.d.ts` in scope; a block that can't stand alone says `nocheck` in its meta.
- A new export needs a reference entry (`<Entry name="…">`), or `docs-reference` fails. A `<Params>` table is compared with its type by `docs-check`.
- After changing a page, run `pnpm agent-docs` and commit `packages/jali/docs` with it.
- Write plainly: short sentences, the answer first, no marketing words. Say "Jali", "panes" and "the layout" for what a person sees, and "the instance" for what `createJali` returns. British spelling (colour, maximise).

## Size budgets

`tooling/size.mjs` holds a gzipped budget for every scenario (the floor, each feature on its own, the full app) and a list of files each must not ship. Budgets sit about 5% above what ships.

- **A change that goes over a budget fails `pnpm verify`.** Make the change smaller, or move the new code behind a feature.
- **Raising a budget needs the owner's approval.** Ask with the numbers before and after and the reason, and record the approval in docs/DECISIONS.md. Never raise a budget to make a gate pass.
- Lowering a budget after a real saving is welcome.
