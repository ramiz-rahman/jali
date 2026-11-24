# Examples

Six real apps built on Jali, each running here: a database browser, a loan review, a market terminal, an audio editor, a trip planner and a network lab.

Each one is a whole app, not a demo of one feature, and each runs here in your browser with nothing to install. Each has a page with three things it shows about Jali, every one a link that opens the app in the state that shows it. The source of every app is in [Jali's repository](https://github.com/ramiz-rahman/jali/tree/master/examples), built on the public API alone.

- [Data Studio](https://jali.ramizrahman.com/examples/data-studio): A database browser where the person builds the layout: tables, records, related records, SQL queries and charts, each in a pane.
- [Loan review](https://jali.ramizrahman.com/examples/loan-review): An underwriter works through a queue of mortgage applications, one curated page per application.
- [Markets](https://jali.ramizrahman.com/examples/markets): A market terminal for shares, bonds, currencies, indices and crypto, laid out as desks.
- [Studio](https://jali.ramizrahman.com/examples/studio): An audio session editor: a transcript that lights up word by word, a timeline, a mixer and markers, all following one playhead.
- [Trips](https://jali.ramizrahman.com/examples/trips): A map-first planner for a week in Thailand: the days, each day's stops and travel, hotels to compare, and the budget, around a big map.
- [Handshake](https://jali.ramizrahman.com/examples/handshake): A network lab with the course beside the tools: read packets layer by layer, measure your connection, and learn how it all works.

## The smallest app

`examples/minimal` is the app the [Quickstart](get-started/quickstart.md) builds: one kind of pane, a note, two of them side by side, and a button that opens the next note beside it. It is one file, `src/main.tsx`, with a few lines of CSS. Run it with `pnpm minimal` at the repository's root, then [localhost:5310](http://localhost:5310). Start there, then read [Define a pane kind](guides/pane-kinds.md) to add your own.
