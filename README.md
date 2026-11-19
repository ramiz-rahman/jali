# Jali

Panes that fit the screen: a workspace of panes that fold into tabs rather than squeeze, follow each other, and come back from a link exactly as they were.

```sh
vp install
vp dev examples/data-studio   # or any example below
```

## Jali

- `packages/core`: `@jali/core`, no framework. The layout, the workspace store, actions, commands and keys, the URL and storage ports.
- `packages/react`: `@jali/react`. The workspace, panes and tabs, dividers, peek, the shelf, curated pages, the palette and settings, and their styles.
- `apps/docs`: the docs site (`pnpm --filter @jali/docs dev`, on :5400). `pnpm agent-docs` writes its pages into `packages/core/docs`.

## The example apps

| App                                 | What it is                                        | Start it           | Port |
| ----------------------------------- | ------------------------------------------------- | ------------------ | ---- |
| [Data Studio](examples/data-studio) | A database browser: the person builds the layout  | `pnpm data-studio` | 5300 |
| [Loan review](examples/loan-review) | A curated page: a queue of loan applications      | `pnpm loan-review` | 5350 |
| [Markets](examples/markets)         | A market terminal, with live crypto from Kraken   | `pnpm markets`     | 5320 |
| [Studio](examples/studio)           | An audio session editor that follows one playhead | `pnpm studio`      | 5330 |
| [Trips](examples/trips)             | A map-first trip planner                          | `pnpm trips`       | 5340 |

Data Studio and Loan review share a sample database, panes and chrome in [`examples/shared`](examples/shared). [`fixtures/`](fixtures) holds the quickstart's minimal app and the bundle-size checks' apps.

## Checks

- `pnpm test`: the unit tests (`tests/` for the engine, plus each package's and example's own) and the agent docs check.
- `pnpm e2e`: Jali's browser tests (`e2e/`), against Data Studio and Loan review. Set `DATA_STUDIO_URL` and `LOAN_REVIEW_URL` to run them on other ports.
- `pnpm typecheck`, `pnpm size`.

See [docs/BRIEF.md](docs/BRIEF.md) for how it came to be, and [docs/DECISIONS.md](docs/DECISIONS.md) for every decision since.
