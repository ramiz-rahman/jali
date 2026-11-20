# Findings: what building Data Studio taught us about Jali's public API

Data Studio is built on the public API alone (`@jali/core`, `@jali/react`). Each finding says what the app wanted, what happened, what the app does instead, and a suggested change. The most important come first. Written 21 Nov 2026, from the quality pass (QUALITY-REVIEW C12, P9, P20, P21).

## 1. Every param came from links, including ones that run code

**Wanted.** A query pane whose SQL and `autorun` come from the app's presets, so a preset can open with its result already shown.

**What happened.** Every param is part of the link. A link could carry any SQL with `autorun: true`, and the query ran on load. One link could hang the tab, or show the reader a result that isn't what it claims to be (C12).

**Workaround.** `autorun` runs only the app's own SQL (`OWN_SQL` in `src/panes/kinds/query.tsx`). Any other SQL that comes with a link is shown, with "This query came with the link, and hasn't run", and waits for Run.

**Now.** Jali has `appOnly(type)` (20 Nov 2026): a param that links never carry or set. Declaring `autorun: appOnly(Boolean)` would make the app's check a second line of defence, not the only one.

## 2. A run id in the link doesn't survive a reload

**Wanted.** A chart that follows a query shows that query's result, including after a reload.

**What happened.** The chart's `runId` param is in the link, but runs live in memory. Ids counted from 1 on every visit, so after a reload a stale `runId` could name another query's result.

**Workaround.** A run id now names its visit. A chart from an earlier visit says so and how to get the result back. The preset's query and chart come back after a reload, because the preset runs its own query again.

**Suggested change.** A param that is the pane's own state but stays out of the address (`link: false`), for values that mean nothing outside this page load. It is different from `appOnly`, which also keeps a value from being set by a link.

## 3. Settings rows and icon buttons are private

**Wanted.** The app's own settings and toolbar buttons, matching Jali's.

**What happened.** Jali's settings rows (`.jali-radio`) and icon buttons (`.jali-icon-btn`) are private classes. Data Studio used them until 20 Nov.

**Workaround.** The app has its own `.setting-check` and `.icon-btn`.

**Suggested change.** Export a settings row part and an `IconButton` from `@jali/react`.

**Now.** Both are public (21 Nov 2026): `IconButton` (part `iconButton`, `.jali-icon-btn`) and the Settings row part `settingRow` (`.jali-setting`). The shared top bar's Copy link and Settings are `IconButton`s, and the Status line setting is a `.jali-setting` row; the shared `.icon-btn` and `.setting-check` are gone.

## 4. The grid's active-descendant pattern belongs in the docs

**What happened.** The shared grid's `role="grid"` didn't announce row changes to screen readers (QUALITY-REVIEW P9).

**Now.** Rows are announced through `aria-activedescendant`. The header row is row 1, and the action cell is a gridcell (`examples/shared/src/panes/grid/Grid.tsx`). A list or grid pane in any Jali app needs the same pattern, so the guide to building list panes should show it.
