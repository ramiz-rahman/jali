# Shared: what Data Studio and Loan review are built on

Not an app. [Data Studio](../data-studio) and [Loan review](../loan-review) both import from here:

- `src/data/`: the sample database (shop orders and microloans in PGlite, in the browser), its SQL and its React hooks (`useRows`, `useRecord`, ...).
- `src/panes/`: the table, record and related panes, the grid, and the small parts they share (loading and empty states, refs, formatting), with their styles.
- `src/shell/`: the app's chrome around `<JaliRoot>`: the top bar, the status line, toasts with Sonner, and the styles and tokens.
- `src/maker/`: who made this. `<Maker />` (the mark and the name, linking to the site) and `makerCommand` (⌘K "About"), used by every example, not only these two, and by the docs site's footer.
- `src/start.tsx`: `start(jali)`, which mounts an app on all of the above. Each app's `main.tsx` is one call to it.
