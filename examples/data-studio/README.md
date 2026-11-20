# Data Studio: a Jali example

A database browser where the person builds the layout: a catalog of tables, tables, records, related records, an audit log, a table's structure, an entity diagram, SQL queries and charts of their results, each in a pane. The database is a sample of shop orders and microloans that runs in the browser (PGlite), with no backend.

```sh
vp install                   # at the repository's root
vp dev examples/data-studio  # http://localhost:5300, or the next free port
```

## What to try

- Choose a preset in the top bar: "One table", "Order → customer chain", "Query + chart + inspector", or the ten-pane stress test.
- Move through orders with J and K: the order beside the list follows.
- Follow relations to build a long chain (an order, its customer, their orders), and watch panes fold into tabs when they don't fit.
- Edit the SQL in a query pane: the draft is pane state, an edit that has not run is unsaved work, and ⌘K has "Run query" and "Chart this result".
- Copy the link and open it in another window: the address keeps every size (`sizes: "link"`), so it reopens exactly.

## The code

- `src/workspace.ts`: the workspace (`createJali`), with Pop out as an experimental command.
- `src/panes/`: Data Studio's own pane kinds (catalog, query, chart, structure, entity diagram, audit, launcher) and its presets.
- The table, record and related panes, the data layer and the top bar come from [`examples/shared`](../shared), which Loan review uses too.

The people, shops and orders are made up, and the top bar says so.

## Tests

- `e2e/`: Data Studio's own browser tests, on their own server: the shared quality checks on every preset in both themes (axe, a 360–2200px width sweep, nothing in the console; `examples/shared/e2e/quality.ts`), and what a link can and can't do to a query and a chart. Run them from the repository's root with `pnpm exec playwright test -c examples/data-studio`.
- Jali's own browser tests (`e2e/` at the repository's root) also run against this app and Loan review.
