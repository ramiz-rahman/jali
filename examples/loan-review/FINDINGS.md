# Findings: what building Loan review taught us about Jali's public API

Loan review is the curated-page example: one application at a time, with its views as tabs. It is built on the public API alone (`@jali/core`, `@jali/react`). Each finding says what the app wanted, what happened, what the app does instead, and a suggested change. The most important come first. Written 21 Nov 2026, from the quality pass (QUALITY-REVIEW P9, P20, P21).

## 1. A page's `bind` is synchronous

**Wanted.** Bind each application's views to its records in the database: which documents, which checks, which notes.

**What happened.** `definePage({ bind })` must return the views at once. It can't wait for data. Until 20 Nov the app bound its views with a formula copied from the seed generator, so the views and the database could disagree.

**Workaround.** `src/review/facts.ts` reads the facts the binding needs from the database before the page opens, and `bind` reads those facts. Jali's unit tests seed the same facts (`tests/workspace.ts`).

**Suggested change.** Let `bind` return a promise, with the page showing its loading state until it settles, or document "load before `createJali`" as the pattern.

**Now.** "Load before `createJali`" is the documented pattern (21 Nov 2026; DECISIONS says why `bind` stays synchronous: it runs inside every page step, each of which answers and writes the address at once). The Curated pages guide shows it, as `src/review/facts.ts` does it.

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
