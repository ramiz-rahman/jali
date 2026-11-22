# Examples

Five working apps built on Jali: a database browser, a loan review, a market terminal, an audio editor and a trip planner.

Each example is a real app in Jali's repository, running on the packages' source. Run `vp install` at the repository's root, then start the one you want. Each has its own port; if something already holds it, the server takes the next free one and prints the address.

## Data Studio

A database browser where the person builds the layout, on a sample database of shop orders and microloans that runs in the browser (PGlite), with no backend: `examples/data-studio`.

```sh
vp dev examples/data-studio
```

It serves on [localhost:5300](http://localhost:5300). It shows:

- ten pane kinds: a catalog of tables, a table, a record, related records, an audit log, a table's structure, an entity diagram, a SQL query, a chart of a query's result, and a launcher for new panes;
- presets: "One table", "Order → customer chain", "Query + chart + inspector" and a ten-pane stress test;
- a list and its following detail: move through orders with J and K, and the order beside the list follows;
- following relations to build long chains (an order, its customer, their orders), and panes folding into tabs when they don't fit;
- the pane contract in the query pane: its draft SQL is pane state, an edit that has not run is unsaved work, and it adds "Run query" and "Chart this result" to ⌘K;
- the address keeping every size (`sizes: "link"`), so a link reopens exactly;
- the app's own chrome around `<JaliRoot>`: a top bar, a status line, and toasts from `jali.onToast`, shown with Sonner.

## Loan review

A curated page on the same sample database: `examples/loan-review`.

```sh
vp dev examples/loan-review
```

It serves on [localhost:5350](http://localhost:5350). A credit reviewer works through a queue of loan applications, one page per application. It shows:

- a profile: the queue at the left, the application's header, and tabs for its views (Overview, Application, Borrower, Loan history, Group, Field officer);
- Single mode, one view at a time with links opening as a peek, and Split view, the views side by side in a designed layout the person can rearrange;
- following a link from a view, which opens a pane after the layout, and "Back to Loan review" to return;
- two kinds of viewer, a credit reviewer with full access and a loan officer who stays in Single;
- a link that carries only the content (`?page=loan-review&item=4&tab=application`), while the mode and arrangement stay the person's own.

The workspace has the page and nothing else (`page`, with no layout or presets), so it opens on the page and stays in it.

Data Studio and Loan review share `examples/shared`: the sample database and its React hooks, the record, related and table panes, and the top bar and status line around `<JaliRoot>`.

## Markets

A market terminal for shares, bonds, currencies, indices and crypto, on the public API alone: `examples/markets`. The crypto prices are real, from Kraken's public API; everything else runs on a simulated market, so it needs no keys or licences. Every company, ticker and price outside crypto is made up.

```sh
vp dev examples/markets
```

It serves on [localhost:5320](http://localhost:5320). It shows:

- eight pane kinds, each defined with `definePane` and a realistic `width.min`: a watchlist, a chart, a quote, an order book, time and sales, news, a yield curve, and a blotter with an order ticket;
- one list driving details of several kinds: move through the watchlist with J and K, and the chart, quote, book, trades and news beside it follow (each kind's `follow` says what it shows for the selected quote), until you keep one;
- comparing two instruments: keep a chart or quote by clicking **Following** in its header (it says **Kept**), then open another row with Enter, or choose the Compare desk;
- five presets, the desks (Equities, Crypto, Rates, FX and Compare), switched from the top bar or ⌘K; each comes back as the person left it (a preset's `saved`), and Reset in the top bar puts every desk back;
- the layout kept in the address, so a desk is a link you can send, and a reload or Back brings it back;
- the app's own commands in ⌘K ("Open chart for…", "Add to watchlist…", "Buy…"), which ask for an instrument in Jali's chooser with `jali.actions.choose`, and each pane's own with `useCommands`;
- the order ticket's draft in `usePaneState`, and a typed order reported with `useUnsaved`, so a desk that would lose it asks first;
- panes that pause their market subscriptions while they are folded, tucked or behind a tab, using the `paused` prop;
- a dark theme set on Jali's `--jali-*` tokens, light mode, and layouts that fold from a wide screen down to a phone.

The market sits behind a small `MarketData` interface (`snapshot` and `subscribe`), so a real feed plugs in without changing a pane. The crypto pairs show one: Kraken's websocket sits in front of the simulator, and the panes can't tell the difference. To publish it as a static site, run `pnpm exec vp build` in `examples/markets` and serve `dist` from any path. The README in that folder walks through the code.

## Studio

An audio session editor for a short podcast episode: `examples/studio`. A library of sessions, a transcript that lights up word by word, a timeline, a mixer on the real audio graph, segment details and markers, all following one playhead.

```sh
vp dev examples/studio
```

It serves on [localhost:5330](http://localhost:5330). The README in that folder lists what to try.

## Trips

A map-first trip planner for a week in Thailand: `examples/trips`. A big map in the middle, with the days, each day's stops and travel, the place you picked, hotels to compare and the budget around it.

```sh
vp dev examples/trips
```

It serves on [localhost:5340](http://localhost:5340). The README in that folder lists what to try.

## Smaller: the quickstart app

The smallest Jali app, on the public API alone, is not one of the example apps above but a small app the [quickstart](get-started/quickstart.md) builds and the bundle-size checks use: `examples/minimal`.

```sh
vp dev examples/minimal
```

It serves on [localhost:5310](http://localhost:5310). It shows:

- one pane kind, a note, defined with `definePane`, with typed params, a title and a component;
- a starting layout of two notes side by side, built with `row`;
- a button in each note that opens the next note beside it, with `openBeside`;
- a launcher, so Split (⌘\\) and a stack's "+" open a pane to choose a note in;
- the layout kept in the address, the default, so reloading and Back and Forward work;
- the default theme from `@jali/react/styles.css`, with the layer order declared in `index.html` before any stylesheet, and the workspace filling the window.

The app is one file, `examples/minimal/src/main.tsx`, with a few lines of CSS. Start here, then read [Define a pane kind](guides/pane-kinds.md) to add your own.

## Coming

More example apps are planned, including one with a router and one with Chakni. Until then, the guides show the pieces: [Keep the layout in the URL](guides/url-and-routers.md) has router adapters, and [Use Jali with Chakni](guides/chakni.md) the active-item port.
