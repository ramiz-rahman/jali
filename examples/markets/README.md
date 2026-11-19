# Markets: a Jali example

A market terminal for shares, bonds, currencies and indices, built on `@jali/core` and `@jali/react` alone. It runs on a simulated market, so it needs no feed, keys or licences: every company, ticker and price in it is made up.

```sh
pnpm install          # at the repository's root
pnpm example:markets  # http://localhost:5320
```

Build it as a static site with `pnpm exec vp build` in this folder, and serve `dist/` from any path: assets are linked relative to the page, and the layout lives in the query string.

## What to try

- Move through the watchlist with J and K. The chart, quote, book, trades and news follow it.
- Press **Following** on the chart to pin it, move to another row and press Enter: two charts, side by side. The Compare desk starts that way.
- Switch desks in the top bar, then copy the address: the link opens the same desk. Reload, or press Back.
- Press / to find an instrument, or ⌘K for every command ("Open chart for…", "Add to watchlist…", "Buy…").
- Press Buy on a quote, type a quantity and leave it unsent. Switching to a desk without the blotter asks first.
- Narrow the window. Panes fold into tabs rather than squeeze, and come back as it widens.

## How it is built

| File                      | What it shows                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/market/types.ts`     | The `MarketData` interface: `snapshot(topic)` and `subscribe(topic, onData)`. A real feed fits here. |
| `src/market/simulator.ts` | A seeded random walk behind it: quotes, an order book, trades, bars and news.                        |
| `src/market/react.tsx`    | `useTopic(topic, paused)`: a pane stops listening while Jali says it is paused.                      |
| `src/panes/*.tsx`         | The eight pane kinds, each one `definePane` with params, a title, an icon and widths.                |
| `src/panes/follow.ts`     | How one watchlist drives followers of several kinds: each kind's `follow`.                           |
| `src/panes/blotter.tsx`   | The order ticket: `usePaneState` for the draft, `useUnsaved` for an unsent order, `useCommands`.     |
| `src/presets.ts`          | The four desks, written with `row`, `column` and `pane`; followers are `linkedTo: "watch"`.          |
| `src/workspace.ts`        | `createJali`: the kinds, presets, launcher, and the app's own ⌘K commands and keys.                  |
| `src/shell/`              | The app's chrome inside `<JaliRoot>`: a top bar, a status line with Jali's `<Shelf />`, the picker.  |
| `src/styles/tokens.css`   | The terminal's theme, set on Jali's `--jali-*` tokens, and the app's up and down colours.            |

Up and down are always shown three ways at once: the sign, an arrow and a colour, so neither a colour-blind reader nor a screen reader misses them. Prices flash when they tick, except under reduced motion.

## Tests

- `src/market/simulator.test.ts`: the simulator is deterministic for a seed, and its quotes, bars, book and bonds hold together.
- `src/workspace.test.ts`: a workspace made with the app's kinds and presets, in memory: following, pinning, links, folding, unsaved work and commands.
- `e2e/markets.spec.ts`: a Playwright smoke test against this app's own server. Run it from the repository's root with `pnpm exec playwright test -c examples/markets`.
