# Markets: a Jali example

A market terminal for shares, bonds, currencies, indices and crypto, built on `jali` alone. The crypto prices are real; everything else runs on a simulated market, so it needs no keys or licences: every company, ticker and price outside crypto is made up.

```sh
vp install              # at the repository's root
vp dev examples/markets # http://localhost:5320, or the next free port
```

### Live prices

Ten crypto pairs stream from [Kraken](https://docs.kraken.com/api/docs/websocket-v2/ticker)'s public API, with no key and no backend. On the Crypto desk, the quote, chart (up to a year), order book and trades are all real. A green dot marks them in the top bar, the quote says "Live · Kraken", and the status line says the rest is simulated. If Kraken can't be reached, the app opens anyway: a crypto price says it is not known yet (and a market order in it is refused), the status line says Kraken is offline, and the prices fill in when it answers again.

There is no live news: no free news feed tagged by coin works from a browser. Shares, bonds and currencies stay simulated because no free source gives real-time quotes with an order book. Before putting the example on a public site, read Kraken's terms on showing its data.

Build it as a static site with `pnpm exec vp build` in this folder, and serve `dist/` from any path: assets are linked relative to the page, and the layout lives in the query string.

## What to try

- Move through the watchlist with J and K. The chart, quote, book, trades and news follow it.
- Press **Following** on the chart to pin it, move to another row and press Enter: two charts, side by side. The Compare desk starts that way.
- Switch desks in the top bar, then copy the address: the link opens the same desk. Reload, or press Back.
- Rearrange a desk, switch to another and come back: it is as you left it, even after a reload. The Reset button (↺) beside the desks puts every desk back to the demo's layout.
- Press / to find an instrument, or ⌘K for every command ("Open chart for…", "Add to watchlist…", "Buy…").
- Press Buy on a quote, type a quantity and leave it unsent. Switching to a desk without the blotter asks first: Markets asks itself, naming the order, and Esc keeps it.
- Narrow the window. Panes fold into tabs rather than squeeze, and come back as it widens.

## How it is built

| File                      | What it shows                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/market/types.ts`     | The `MarketData` interface: `snapshot(topic)` and `subscribe(topic, onData)`. A real feed fits here.                                                                                                                                             |
| `src/market/simulator.ts` | A seeded random walk behind it: quotes, an order book, trades, bars and news.                                                                                                                                                                    |
| `src/market/kraken.ts`    | The live feed: Kraken's websocket and REST API behind the same `MarketData`, in front of the simulator.                                                                                                                                          |
| `src/market/react.tsx`    | `useTopic(topic, paused)`: a pane stops listening while Jali says it is paused.                                                                                                                                                                  |
| `src/panes/*.tsx`         | The eight pane kinds, each one `definePane` with params, a title, an icon and widths.                                                                                                                                                            |
| `src/panes/follow.ts`     | How one watchlist drives followers of several kinds: each kind's `follow`.                                                                                                                                                                       |
| `src/panes/blotter.tsx`   | The order ticket: `usePaneState` for the draft, `useUnsaved` for an unsent order, `useCommands`.                                                                                                                                                 |
| `src/presets.ts`          | The five desks, written with `row`, `column` and `pane`; followers are `linkedTo: "watch"`.                                                                                                                                                      |
| `src/desks.ts`            | Each desk as it was left, in `localStorage`: a preset's `saved`, kept from `jali.on("layout")`.                                                                                                                                                  |
| `src/workspace.ts`        | `createJali`: the kinds, presets, launcher, and the app's own ⌘K commands and keys; the "…" commands ask for an instrument with `jali.actions.choose`; `beforeClose` with `confirmDiscard: false` asks about an unsent order in the app's words. |
| `src/shell/`              | The app's chrome inside `<JaliRoot>`: a top bar, a status line with Jali's `<Shelf />`, and the app's own question before an unsent order is lost.                                                                                               |
| `src/ui/select.tsx`       | The list and desk menus: shadcn/ui's Select on Radix, styled on Jali's tokens in plain CSS (the example has no Tailwind).                                                                                                                        |
| `src/styles/tokens.css`   | The terminal's theme, set on Jali's `--jali-*` tokens, and the app's up and down colours.                                                                                                                                                        |

Up and down are always shown three ways at once: the sign, an arrow and a colour, so neither a colour-blind reader nor a screen reader misses them. Prices flash when they tick, except under reduced motion.

## Tests

- `src/market/simulator.test.ts`: the simulator is deterministic for a seed, and its quotes, bars, book and bonds hold together.
- `src/workspace.test.ts`: a workspace made with the app's kinds and presets, in memory: following, pinning, links, folding, unsaved work and commands.
- `src/market/kraken.test.ts`, `src/trading/trading.test.ts`, `src/kept.test.ts`: Kraken's frames are parsed, not trusted; the paper book trades only on real prices; kept data that is wrong falls back and never crashes.
- `e2e/`: Playwright tests against this app's own server, on a stand-in Kraken (`e2e/kraken.ts`), so they never need the network: a smoke test, the live feed (a price not known yet, a dropped feed, a bad frame, failing history), and the shared quality checks on every desk in both themes (axe, a 360–2200px width sweep, nothing in the console; `examples/shared/e2e/quality.ts`). Run them from the repository's root with `pnpm exec playwright test -c examples/markets`.
