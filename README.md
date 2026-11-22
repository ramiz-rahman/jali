# Jali

Panes that fit the screen: a workspace of panes that fold into tabs rather than squeeze, follow each other, and come back from a link exactly as they were.

```sh
vp install
vp dev examples/data-studio   # or any example below
```

## Jali

- `packages/jali`: `jali`, the one published package, with subpaths (`jali`, `jali/react`, `jali/page`, each feature's, `jali/testing`, …), built from the two below.
- `packages/core`: `@jali/core` (private), no framework. The layout, the workspace store, actions, commands and keys, the features' framework-free halves, the URL and storage ports.
- `packages/react`: `@jali/react` (private). The workspace, panes and tabs, dividers, peek, the shelf, curated pages, the palette and settings, and their styles.
- `apps/docs`: the docs site (`pnpm --filter @jali/docs dev`, on :5400). `pnpm agent-docs` writes its pages into `packages/jali/docs`.
- `tooling/`: the repo's checks and generators (`pnpm verify`, `pnpm size`, `pnpm agent-docs`, `pnpm icons`, `pnpm test:react18`, `pnpm pack-check`).

## The example apps

| App                                 | What it is                                        | Start it           | Port |
| ----------------------------------- | ------------------------------------------------- | ------------------ | ---- |
| [Data Studio](examples/data-studio) | A database browser: the person builds the layout  | `pnpm data-studio` | 5300 |
| [Loan review](examples/loan-review) | A curated page: a queue of loan applications      | `pnpm loan-review` | 5350 |
| [Markets](examples/markets)         | A market terminal, with live crypto from Kraken   | `pnpm markets`     | 5320 |
| [Studio](examples/studio)           | An audio session editor that follows one playhead | `pnpm studio`      | 5330 |
| [Trips](examples/trips)             | A map-first trip planner                          | `pnpm trips`       | 5340 |

Each example is a workspace package with its own `package.json` and dependencies. Data Studio and Loan review share a sample database, panes and chrome in [`examples/shared`](examples/shared), the package `@jali-examples/shared`. [`examples/minimal`](examples/minimal) and [`examples/own-icons`](examples/own-icons) are not example apps: they are the quickstart's app and the bundle-size checks' apps.

## Checks

**Every session runs `pnpm verify` before it commits**, and says in its report which gates fail and why. It runs every gate, carries on past a failure, and ends with one line per gate; any failure exits 1. Each gate's output is in `node_modules/.verify/<gate>.log`.

- `pnpm verify`: typecheck, lint, `vp fmt --check`, the unit tests, the docs reference tests, the agent docs check, the React 18 check, `size`, the packed package (`pnpm pack-check`), the docs build, and every browser suite: Jali's (`e2e/`, against Data Studio and Loan review), each example's own (Markets, Studio, Trips) and the docs site's (against the built site).
- `pnpm verify --quick`: the same without the browser suites and the React 18 check. Enough for a small change; run the full one before a change to `packages/` or anything a browser suite covers is committed.
- `pnpm verify lint fmt`: only the gates named.

The browser suites start their own servers, each on the port its URL variable names (`DATA_STUDIO_URL`, `LOAN_REVIEW_URL`, `MARKETS_URL`, `STUDIO_URL`, `TRIPS_URL`, `DOCS_URL`; the defaults are the ports below, and the docs' is 5400), and only there. If something else holds the port, the suite stops rather than test it. `pnpm verify` picks free ports, so it runs beside other sessions' dev servers. To run a suite against a server you started yourself, set `REUSE_SERVER=1`.

On its own: `pnpm test` (unit, docs reference, agent docs), `pnpm e2e` (Jali's browser tests), `pnpm exec playwright test -c examples/<name>` or `-c apps/docs`, `pnpm typecheck`, `pnpm size`, `pnpm test:react18` (the committed HEAD, with React 18), `pnpm pack-check` (`jali` packed, examples/minimal built and a workspace hydrated from the tarball).

The examples are held to [docs/EXAMPLES-STANDARD.md](docs/EXAMPLES-STANDARD.md).

Jali and its example apps are designed and built by [Ramiz Rahman](https://ramizrahman.com/).

See [docs/BRIEF.md](docs/BRIEF.md) for how it came to be, and [docs/DECISIONS.md](docs/DECISIONS.md) for every decision since.
