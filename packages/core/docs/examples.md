# Examples

Working apps built on Jali, from the smallest one to a market terminal and the two fuller apps in the lab.

Each example is a real app in Jali's repository, running on the packages' source. Run `pnpm install` at the repository's root, then start the one you want.

## Minimal

The smallest Jali app, on the public API alone: `examples/minimal`.

```sh
pnpm example:minimal
```

It serves on [localhost:5310](http://localhost:5310). It shows:

- one pane kind, a note, defined with `definePane`, with typed params, a title and a component;
- a starting layout of two notes side by side, built with `row`;
- a button in each note that opens the next note beside it, with `openBeside`;
- a launcher, so Split (⌘\\) and a stack's "+" open a pane to choose a note in;
- the layout kept in the address, the default, so reloading and Back and Forward work;
- the default theme from `@jali/react/styles.css`, with the layer order declared in `index.html` before any stylesheet, and the workspace filling the window.

The app is one file, `examples/minimal/src/main.tsx`, with a few lines of CSS. Start here, then read [Define a pane kind](guides/pane-kinds.md) to add your own.

## Markets

A market terminal for shares, bonds, currencies and indices, on the public API alone: `examples/markets`. It runs on a simulated market, so it needs no data feed, keys or licences. Every company, ticker and price in it is made up.

```sh
pnpm example:markets
```

It serves on [localhost:5320](http://localhost:5320). It shows:

- eight pane kinds, each defined with `definePane` and a realistic `width.min`: a watchlist, a chart, a quote, an order book, time and sales, news, a yield curve, and a blotter with an order ticket;
- one list driving details of several kinds: move through the watchlist with J and K, and the chart, quote, book, trades and news beside it follow (each kind's `follow` says what it shows for the selected quote), until you keep one;
- comparing two instruments: keep a chart or quote by clicking **Following** in its header (it says **Kept**), then open another row with Enter, or choose the Compare desk;
- four presets, the desks (Equities, Rates, FX and Compare), switched from the top bar or ⌘K;
- the layout kept in the address, so a desk is a link you can send, and a reload or Back brings it back;
- the app's own commands in ⌘K ("Open chart for…", "Add to watchlist…", "Buy…"), which ask for an instrument in Jali's chooser with `jali.actions.choose`, and each pane's own with `useCommands`;
- the order ticket's draft in `usePaneState`, and a typed order reported with `useUnsaved`, so a desk that would lose it asks first;
- panes that pause their market subscriptions while they are folded, tucked or behind a tab, using the `paused` prop;
- a dark theme set on Jali's `--jali-*` tokens, light mode, and layouts that fold from a wide screen down to a phone.

The market sits behind a small `MarketData` interface (`snapshot` and `subscribe`), so a real feed could replace the simulator without changing a pane. To publish it as a static site, run `pnpm exec vp build` in `examples/markets` and serve `dist` from any path. The README in that folder walks through the code.

## The lab: Data Studio and Loan review

The lab is where Jali is built and tested. It holds two fuller apps in one workspace, on a sample database that runs in the browser (PGlite), with no backend. Start it from the repository's root:

```sh
pnpm dev
```

It serves on [localhost:5300](http://localhost:5300). The switch in its top bar moves between the two apps.

### Data Studio

A database browser where the person builds the layout. It shows:

- ten pane kinds: a catalog of tables, a table, a record, related records, an audit log, a table's structure, an entity diagram, a SQL query, a chart of a query's result, and a launcher for new panes;
- presets: "One table", "Order → customer chain", "Query + chart + inspector" and a ten-pane stress test;
- a list and its following detail: move through orders with J and K, and the order beside the list follows;
- following relations to build long chains (an order, its customer, their orders), and panes folding into tabs when they don't fit;
- the pane contract in the query pane: its draft SQL is pane state, an edit that has not run is unsaved work, and it adds "Run query" and "Chart this result" to ⌘K;
- the address keeping every size (`sizes: "link"`), so a link reopens exactly;
- the app's own chrome around `<JaliRoot>`: a top bar, a status line, and toasts from `jali.onToast`, shown with Sonner.

### Loan review

A curated page: a credit reviewer works through a queue of loan applications, one page per application. It shows:

- a profile: the queue at the left, the application's header, and tabs for its views (Overview, Application, Borrower, Loan history, Group, Field officer);
- Single mode, one view at a time with links opening as a peek, and Split view, the views side by side in a designed layout the person can rearrange;
- following a link from a view, which opens a pane after the layout, and "Back to Loan review" to return;
- two kinds of viewer, a credit reviewer with full access and a loan officer who stays in Single;
- a link that carries only the content (`?page=loan-review&item=4&tab=application`), while the mode and arrangement stay the person's own.

Open it directly at [localhost:5300/?page=loan-review](http://localhost:5300/?page=loan-review).

The lab's code is in `src/` at the repository's root: `src/panes` for Data Studio's kinds, `src/review` for the loan review, and `src/lab.ts` for the workspace that holds both.

## Coming

More example apps are planned, including one with a router and one with Chakni. Until then, the guides show the pieces: [Keep the layout in the URL](guides/url-and-routers.md) has router adapters, and [Use Jali with Chakni](guides/chakni.md) the active-item port.
