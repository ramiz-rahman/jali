# Examples

Six real apps built on Jali, each running here: a database browser, a loan review, a market terminal, an audio editor, a trip planner and a network lab.

Each one is a whole app, not a demo of one feature, and each runs here in your browser with nothing to install. Under each app are three things it shows about Jali. Each opens the app in the state that shows it, so you can try it at once. The source of every app is in [Jali's repository](https://github.com/ramiz-rahman/jali/tree/master/examples), built on the public API alone.

## Data Studio

A database browser where the person builds the layout: tables, records, related records, SQL queries and charts, each in a pane.

[Open Data Studio](https://jali.ramizrahman.com/apps/data-studio/?preset=order-chain) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/data-studio)

- **[A list and the detail that follows it](https://jali.ramizrahman.com/apps/data-studio/?preset=order-chain)**: Move through the orders with J and K. The order beside the list follows, and its customer follows the order. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Unsaved work in a pane](https://jali.ramizrahman.com/apps/data-studio/?preset=query-chart)**: Edit the SQL. The draft is pane state, an edit that hasn't run is unsaved work, and ⌘K gains Run query and Chart this result. ([how it works](https://jali.ramizrahman.com/guides/unsaved-work-and-pane-state))
- **[Ten panes on one screen](https://jali.ramizrahman.com/apps/data-studio/?preset=stress-10)**: Narrow the window. Panes fold into tabs one at a time rather than squeeze, and come back as it widens. ([how it works](https://jali.ramizrahman.com/learn/fitting))

A sample database of shop orders and a home-lending book, running in the browser (PGlite), with no backend.

Run it yourself: `pnpm data-studio` at the repository's root, then http://localhost:5300.

## Loan review

An underwriter works through a queue of mortgage applications, one curated page per application.

[Open Loan review](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=overview) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/loan-review)

- **[A curated page](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=overview)**: The queue, the application's header and its views as tabs. Switch to Split view to see the views side by side, then rearrange them. ([how it works](https://jali.ramizrahman.com/learn/curated-pages))
- **[A link carries the content only](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=7&tab=borrower)**: This link names the application and the view. Single or Split view, and how the panes are arranged, stay the reader's own. ([how it works](https://jali.ramizrahman.com/learn/opening-and-linking))
- **[What a persona may do](https://jali.ramizrahman.com/apps/loan-review/?page=loan-review&item=4&tab=borrower&role=processor)**: The processor's links open as a peek, never beside: `allow: { open: false }`. Switch persona in the header. ([how it works](https://jali.ramizrahman.com/guides/pane-controls))

The same in-browser database: a fictional US home lender's borrowers, properties, mortgages and applications.

Run it yourself: `pnpm loan-review` at the repository's root, then http://localhost:5350.

## Markets

A market terminal for shares, bonds, currencies, indices and crypto, laid out as desks.

[Open Markets](https://jali.ramizrahman.com/apps/markets/?preset=equities) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/markets)

- **[Followers of many kinds](https://jali.ramizrahman.com/apps/markets/?preset=equities)**: Move through the watchlist with J and K. The chart, quote, order book, trades and news all follow it, each in its own way. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Keep one, compare with another](https://jali.ramizrahman.com/apps/markets/?preset=compare)**: One chart is kept, the other follows the watchlist. Press Following on any pane to keep what it shows. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Live data that pauses out of sight](https://jali.ramizrahman.com/apps/markets/?preset=crypto)**: The Crypto desk's panes are live. Fold one into a tab and it stops its subscription; show it again and it picks up. ([how it works](https://jali.ramizrahman.com/guides/pane-kinds))

Crypto prices stream live from Kraken's public API. Everything else runs on a simulated market: every company, ticker and price outside crypto is made up.

Run it yourself: `pnpm markets` at the repository's root, then http://localhost:5320.

## Studio

An audio session editor: a transcript that lights up word by word, a timeline, a mixer and markers, all following one playhead.

[Open Studio](https://jali.ramizrahman.com/apps/studio/?preset=edit) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/studio)

- **[Every pane follows one playhead](https://jali.ramizrahman.com/apps/studio/?preset=edit)**: Press Space to play. The transcript lights each word as it is spoken; the timeline, library and markers follow the same playhead. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Unsaved work that travels](https://jali.ramizrahman.com/apps/studio/?preset=review)**: Press E on a segment to correct it. Mix has no transcript, so choosing it asks first; Review takes the transcript and its draft along. ([how it works](https://jali.ramizrahman.com/guides/unsaved-work-and-pane-state))
- **[Kept and following, side by side](https://jali.ramizrahman.com/apps/studio/?preset=compare)**: One segment is kept, the other follows the transcript's selection: two moments of the landing, read against each other. ([how it works](https://jali.ramizrahman.com/learn/following))

Three real recordings: radio traffic from the Apollo 11 landing, a song from its multitrack masters, and a dinner-party conversation from a research corpus.

Run it yourself: `pnpm studio` at the repository's root, then http://localhost:5330.

## Trips

A map-first planner for a week in Thailand: the days, each day's stops and travel, hotels to compare, and the budget, around a big map.

[Open Trips](https://jali.ramizrahman.com/apps/trips/?preset=plan) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/trips)

- **[The map is the hub](https://jali.ramizrahman.com/apps/trips/?preset=plan)**: Pick a pin: the place pane and the day both show it. Move through the days with J and K, and the map frames each one. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[A row that scrolls sideways](https://jali.ramizrahman.com/apps/trips/?preset=days)**: The whole week, every day at a comfortable width, in a row that scrolls instead of folding. Drag a stop from one day to another. ([how it works](https://jali.ramizrahman.com/guides/scrolling-rows))
- **[Compare against a kept pane](https://jali.ramizrahman.com/apps/trips/?preset=stay)**: Two hotels side by side. The left one is kept; pick another and the right one shows it, read against the kept one. ([how it works](https://jali.ramizrahman.com/learn/following))

Real sights, beaches and airports at their real places. Every hotel, restaurant and price is made up, and says so.

Run it yourself: `pnpm trips` at the repository's root, then http://localhost:5340.

## Handshake

A network lab with the course beside the tools: read packets layer by layer, measure your connection, and learn how it all works.

[Open Handshake](https://jali.ramizrahman.com/apps/handshake/?preset=course) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/handshake)

- **[A lesson drives the tools](https://jali.ramizrahman.com/apps/handshake/?preset=course)**: Step through a lesson: each step selects a packet, a probe or a scan, and the tools beside it follow. Following, two deep. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Four followers of one packet](https://jali.ramizrahman.com/apps/handshake/?preset=lab)**: Pick a packet: the dissection, the bytes, the layers and the sequence diagram each show it their own way. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Another component system](https://jali.ramizrahman.com/apps/handshake/?preset=connection)**: Built with CyberSpec's components, with Jali's frames, tabs and ⌘K set from CyberSpec's tokens. ([how it works](https://jali.ramizrahman.com/guides/theming))

Bundled captures are generated, and say so. Your own .pcap files are read in the tab and never uploaded. Live measurements come from public endpoints, each named.

Run it yourself: `pnpm handshake` at the repository's root, then http://localhost:5360.

## The smallest app

`examples/minimal` is the app the [Quickstart](get-started/quickstart.md) builds: one kind of pane, a note, two of them side by side, and a button that opens the next note beside it. It is one file, `src/main.tsx`, with a few lines of CSS. Run it with `pnpm minimal` at the repository's root, then [localhost:5310](http://localhost:5310). Start there, then read [Define a pane kind](guides/pane-kinds.md) to add your own.
