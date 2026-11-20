# Loan review: a Jali example

A curated page: a credit reviewer works through a queue of loan applications, one page per application. The queue sits at the left, the application's header above, and the views are tabs: Overview, Application, Borrower, Loan history, Group and Field officer. The database is the same in-browser sample as Data Studio's (PGlite), with no backend.

```sh
vp install                   # at the repository's root
vp dev examples/loan-review  # http://localhost:5350, or the next free port
```

## What to try

- Move through the queue with J and K while it has focus (F6 reaches it).
- In Single, one view shows at a time and a link opens as a peek. Switch to Split view: the views sit side by side in a designed layout you can rearrange by dragging the tabs.
- Follow a link to something that is no view on this page: it opens a pane after the layout, and "Back to Loan review" returns.
- Copy the link: it carries only the content (`?page=loan-review&item=4&tab=application`). The mode and arrangement stay the reader's own.

## The code

- `src/workspace.ts`: the workspace is the page and nothing else (`page`, with no layout or presets), so Jali opens on the page and stays in it.
- `src/review/profile.ts`: the page (`definePage`): its views, how each binds to an application, and Split view's starting layout.
- `src/review/`: the queue, the header, the Overview and the views' panes.
- `src/review/facts.ts`: who each application is for, read from the database before the page opens; the page binds its views from it.
- The data layer, the record and related panes it builds on, and the top bar come from [`examples/shared`](../shared).

The borrowers, groups, officers and loans are made up, and the top bar says so.

## Tests

- `e2e/`: Loan review's own browser tests, on their own server: the shared quality checks on every view and in Split view, in both themes (axe, a 360–2200px width sweep, nothing in the console; `examples/shared/e2e/quality.ts`). Run them from the repository's root with `pnpm exec playwright test -c examples/loan-review`.
- Jali's own browser tests (`e2e/` at the repository's root) also run against this app.
