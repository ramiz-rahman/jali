# Data Studio

A database browser where the person builds the layout: tables, records, related records, SQL queries and charts, each in a pane.

[Open Data Studio](https://jali.ramizrahman.com/apps/data-studio/?preset=order-chain) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/data-studio)

## What it shows

Each link opens Data Studio in the state that shows it, so you can try it at once.

- **[A list and the detail that follows it](https://jali.ramizrahman.com/apps/data-studio/?preset=order-chain)**: Move through the orders with J and K. The order beside the list follows, and its customer follows the order. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Unsaved work in a pane](https://jali.ramizrahman.com/apps/data-studio/?preset=query-chart)**: Edit the SQL. The draft is pane state, an edit that hasn't run is unsaved work, and ⌘K gains Run query and Chart this result. ([how it works](https://jali.ramizrahman.com/guides/unsaved-work-and-pane-state))
- **[Ten panes on one screen](https://jali.ramizrahman.com/apps/data-studio/?preset=stress-10)**: Narrow the window. Panes fold into tabs one at a time rather than squeeze, and come back as it widens. ([how it works](https://jali.ramizrahman.com/learn/fitting))

## Its data

A sample database of shop orders and a home-lending book, running in the browser (PGlite), with no backend.

## Run it yourself

Run `pnpm data-studio` at the repository's root, then open http://localhost:5300.
