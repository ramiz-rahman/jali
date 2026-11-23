# Findings: what building Loan review taught us about Jali's public API

Loan review is the curated-page example: one application at a time, with its views as tabs. It is built on the public API alone (`@jali/core`, `@jali/react`). Each finding says what the app wanted, what happened, what the app does instead, and a suggested change. The most important come first. Written 21 Nov 2026, from the quality pass (QUALITY-REVIEW P9, P20, P21).

## 1. A page's `bind` is synchronous

**Wanted.** Bind each application's views to its records in the database: which documents, which checks, which notes.

**What happened.** `definePage({ bind })` must return the views at once. It can't wait for data. Until 20 Nov the app bound its views with a formula copied from the seed generator, so the views and the database could disagree.

**Workaround.** `src/parties.ts` reads the facts the binding needs from the database before the page opens, `main.tsx` hands them to `createLoanReview(parties)`, and the page's `bind` closes over them. Jali's unit tests seed the same facts (`packages/core/tests/fixtures/workspace.ts`).

**Suggested change.** Let `bind` return a promise, with the page showing its loading state until it settles, or document "load before `createJali`" as the pattern.

**Now.** "Load before `createJali`" is the documented pattern (21 Nov 2026; DECISIONS says why `bind` stays synchronous: it runs inside every page step, each of which answers and writes the address at once). The Curated pages guide shows it, as `src/parties.ts` does it.

## 2. A page's view tabs sit outside every landmark

**What happened.** axe's `region` rule fails on a curated page: the view tabs (`.jali-page-tabs`) aren't inside any landmark, so a screen-reader user who moves by landmarks skips them.

**Workaround.** The Loan review scan leaves that one rule out for the tabs, as Jali's to fix (`examples/loan-review/e2e`).

**Suggested change.** Put the page bar in a named landmark (a `navigation` for the views, or inside the page's region).

**Now.** The view tabs are in a `nav` landmark named "Loan review views" (21 Nov 2026). The scan's `region` exception is gone (`e2e/quality.spec.ts`).

## 3. The page's root is not a part

**Wanted.** Style the curated page's frame (its background and spacing) to match the app.

**What happened.** The page's root is `.jali-page`, a private class, not a documented part.

**Suggested change.** Make the page root a part, like the panes' parts.

**Now.** `.jali-page` is the public part `page` (21 Nov 2026), documented in the Parts reference.

## 4. There is no public icon button

As in Markets and Data Studio: the app has its own `.icon-btn` because `.jali-icon-btn` is private. **Suggested change:** export an `IconButton`.

**Now.** `IconButton` is in `@jali/react` (21 Nov 2026). The queue sheet's close and the shared top bar's Copy link and Settings use it; the shared `.icon-btn` is gone.

## 5. A hidden pane doesn't hear a query it shares

**Wanted.** The header (always on, outside every pane) and the record panes read the same rows: the application, its borrower, its property.

**What happened.** The examples' data hooks pause a hidden pane by turning its query off and unsubscribing it (`examples/shared/src/data/hooks.ts`: `enabled` and `subscribed` follow `paused`). A hidden pane then renders the state its query had when it rendered and hears nothing after. When the header read a record by the same key a hidden pane did, the header's fetch filled the cache, but the hidden pane stayed "loading" until it was shown: its tab showed activity for nothing, and with nobody fetching it could even say the record no longer exists.

**Workaround.** The header reads its rows as queries (`where id`), whose cache entries are its own, not as records (`src/data.ts`: `useUnsharedRow`, used by `useAssessment`). Overview and the Application view read the same way, and their gates don't depend on those reads.

**Suggested change.** Keep a paused query subscribed but not fetching, or let a paused pane's gate treat "paused, no data yet" as waiting rather than loading or gone. Not changed in the shared hooks yet: keeping hidden panes subscribed re-renders every hidden pane on every cache update in every example (Studio's and Markets' live panes among them), so it needs its own pass.

## 6. A command has no keys

**Wanted.** ⌘B collapses the queue and ⌘. collapses the queue and header together (`src/page/chrome.ts`), each also a ⌘K command, with the key shown beside it.

**What happened.** A `Command` is `{ id, title, group, run }`: it can't carry its keys, and it can't say when it doesn't apply (⌘B does nothing below 768px, where the queue is a sheet). `keyboard.keymap` can bind a host command by id, but the binding then lives apart from the command, and nothing would stop ⌘B on a phone.

**Workaround.** `chrome.ts` hand-rolls a `keydown` handler on the window (`useChromeKeys`, mounted by the header), checks the width itself, prints the keys per platform itself (`KEYS`) and writes them into the commands' titles.

**Suggested change.** Give `Command` optional `keys` (merged into the keymap, which the app can still rebind) and a check that says when it can't run, so the palette greys it out and prints its key, and the app keeps no handler of its own.
