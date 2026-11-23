# Loan review: a Jali example

A curated page: an underwriter at a US home lender works through a queue of mortgage applications (purchases with conventional, FHA, VA, USDA and jumbo loans; rate-and-term and cash-out refinances; HELOCs and home equity loans), one page per application. The queue sits at the left, the application's header above, and the views are tabs: Overview, Application, Borrower, Mortgages, Property and Loan officer. The database is the same in-browser sample as Data Studio's (PGlite), with no backend.

```sh
vp install                   # at the repository's root
vp dev examples/loan-review  # http://localhost:5350, or the next free port
```

## What to try

- Move through the queue with J and K while it has focus (F6 reaches it).
- Make room for the review: collapse the queue to a slim strip (⌘B, or its button), where each application is a square you can click or move through with J/K, and the header to one line that keeps the five figures (its chevron). ⌘. collapses both at once; all three are in ⌘K, and the choice stays in your browser.
- In Single, one view shows at a time and a link opens as a peek. Switch to Split view: the views sit side by side in a designed layout you can rearrange by dragging the tabs.
- Follow a link to something that is no view on this page: it opens a pane after the layout, and "Back to Loan review" returns.
- Copy the link: it carries only the content (`?page=loan-review&item=4&tab=application`). The mode and arrangement stay the reader's own.
- Read Overview as an underwriter would: what to check, grouped by credit, capacity and collateral; LTV, DTI, credit score and reserves against the program's limits; and what the monthly payment is made of (principal and interest, taxes, insurance, mortgage insurance, HOA).

## The code

- `src/main.tsx`: reads who each application is for, makes the workspace from it and mounts it; it imports the styles, in cascade order.
- `src/workspace.ts`: the workspace is the page and nothing else (`page`, with no layout or presets), so Jali opens on the page and stays in it. `createLoanReview(parties)` makes it once the parties are read.
- `src/parties.ts`: who each application is for (borrower, property, loan officer), read from the database before the page opens and handed to the workspace; the page binds its views from it.
- `src/page/`: the page. `definition.ts` (`loanReviewPage(parties)`, a `definePage`): how each view binds to an application (mapped from the roles), and Split view's starting layout. `header.tsx` (with `header.css`): the application's header, one markup that is a card or, collapsed, one line. `chrome.ts`: the queue and header collapsed or not, the reader's own, with their keys and ⌘K commands; `collapse-toggle.tsx` is the button for each. `queue/`: the queue at the left (`rail.tsx`, one markup that is a list or a strip, styled by `queue.css`), and as a sheet on phones (`sheet.tsx`).
- `src/kinds.tsx`: the pane kinds the views open in; `src/nav/`, which renders nothing: `refs.ts` (each table's word and icon, and the refs links open, with named list builders such as `mortgagesOf` and `liensOn`) and `roles.ts` (the views as tabs name them, each with the table and party it shows; the tests import it).
- `src/data.ts`: what the views read, typed, as hooks, each with a named row limit. `useAssessment` reads an application with who and what it is for and assesses it, for the header, Overview and the Application view. A pane's reads pause while it is out of sight (`<Paused>`, `usePaused()`).
- `src/model/`: pure and unit-tested. `rows.ts`: the typed rows, with each status and rate type read into its own type. `statuses.ts`: where an application, a mortgage or a payment stands, one table per kind (its words, the queue's order, which mortgages are open). `programs.ts`: each loan program's rules in one table (score, LTV, DTI, reserves, financed fee, mortgage insurance, closing costs, the conforming limit, a line's draw), so no call site tests a program's name. `scores.ts`: credit-score bands and thresholds. `underwriting.ts`: the arithmetic (payment, LTV/CLTV, DTI, down payment, reserves, the 2026 conforming limit). `case.ts`: what an application is assessed on. `signals/`: what Overview flags, one check per area (credit, capacity, collateral, the loan). `ratios.ts`: LTV, DTI, credit score and reserves, each against its limit, said once for the header and the gauges. `assessment.ts`: an application assessed once (how it qualifies, its signals and ratios, each one's tone), which the header, Overview and the Application view all read. `words.ts`: how the review says things. `fixtures.ts`: the sample case the tests share.
- `src/views/`: Overview (`overview/`), the record views (`records/`, one per table), the list views (`lists/`), the column sets their tables share (`columns/`; a column's `brief` is what it says under the first cell when narrow), and the parts every view uses (`parts/`, each with its stylesheet; `gate.tsx` shows a designed view once its data has loaded). The record and list panes (`records/index.tsx`, `lists/index.tsx`) show a designed view, given its rows read as their type, for what has one, and Data Studio's pane for the rest.
- `src/theme.css`: the app's own look, set on Jali's tokens: black on white with hairline frames and square corners, Be Vietnam Pro, and volt for what waits for a decision. Data Studio keeps Jali's default look.
- The data layer, the record and related panes it builds on, and the top bar come from [`examples/shared`](../shared).

The borrowers, properties, officers and mortgages are made up (`examples/shared/src/data/mortgage-book.ts`), and the top bar says so. Rates, limits and fees follow the US market as of November 2026: a 30-year fixed near 7.2%, the $832,750 baseline conforming limit, FHA's 1.75% upfront premium, VA's funding fee and USDA's guarantee fee.

## Tests

- `src/workspace.test.ts`: a link that names the Mortgages view's rows by another name goes to the view already showing them: a related list is its rows (`identity`), not its label.
- `e2e/`: Loan review's own browser tests, on their own server: the shared quality checks on every view and in Split view, in both themes (axe, a 360–2200px width sweep, nothing in the console; `examples/shared/e2e/quality.ts`). Run them from the repository's root with `pnpm exec playwright test -c examples/loan-review`.
- Jali's own browser tests (`e2e/` at the repository's root) also run against this app.
