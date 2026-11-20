# Shared: what Data Studio and Loan review are built on

Not an app. [Data Studio](../data-studio) and [Loan review](../loan-review) both import from here:

- `src/data/`: the sample database (shop orders and microloans in PGlite, in the browser), its SQL and its React hooks (`useRows`, `useRecord`, ...).
- `src/panes/`: the table, record and related panes, the grid, and the small parts they share (loading and empty states, refs, formatting), with their styles.
- `src/shell/`: the app's chrome around `<JaliRoot>`: the top bar, the status line, toasts with Sonner, and the styles and tokens.
- `src/maker/`: who made this. `<Maker />` (the mark and the name, linking to the site) and `makerCommand` (⌘K "About"), used by every example, not only these two, and by the docs site's footer.
- `src/start.tsx`: `start(jali)`, which mounts an app on all of the above. Each app's `main.tsx` is one call to it.

And, for every example:

- `src/store.ts`: a small external store, and what a store keeps on this device, with a version and a check when it is read back (Markets uses both; Studio the store, with its own versioned keys).
- `src/theme.ts`: ⌘K's "Switch between light and dark".
- `e2e/quality.ts`: the standard's checks for each example's browser tests: an axe scan per layout and theme, a 360–2200px width sweep (nothing scrolls sideways, is off screen, cut off or covered), and a console guard that fails a test on any error or warning. A spec imports `test` and `expect` from it and calls `qualitySuite` with its layouts.
