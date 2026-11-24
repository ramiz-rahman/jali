# Markets

A market terminal for shares, bonds, currencies, indices and crypto, laid out as desks.

[Open Markets](https://jali.ramizrahman.com/apps/markets/?preset=equities) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/markets)

## What it shows

Each link opens Markets in the state that shows it, so you can try it at once.

- **[Followers of many kinds](https://jali.ramizrahman.com/apps/markets/?preset=equities)**: Move through the watchlist with J and K. The chart, quote, order book, trades and news all follow it, each in its own way. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Keep one, compare with another](https://jali.ramizrahman.com/apps/markets/?preset=compare)**: One chart is kept, the other follows the watchlist. Press Following on any pane to keep what it shows. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Live data that pauses out of sight](https://jali.ramizrahman.com/apps/markets/?preset=crypto)**: The Crypto desk's panes are live. Fold one into a tab and it stops its subscription; show it again and it picks up. ([how it works](https://jali.ramizrahman.com/guides/pane-kinds))

## Its data

Crypto prices stream live from Kraken's public API. Everything else runs on a simulated market: every company, ticker and price outside crypto is made up.

## Run it yourself

Run `pnpm markets` at the repository's root, then open http://localhost:5320.
