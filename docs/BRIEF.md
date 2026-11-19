# Jali: brief

**What this is:** a throwaway spike that proves the shared Sixface pane system before any shared package is built. The founder agreed it on 17 Nov 2026.

**The specification:**

- `/Users/ramizrahman/Projects/Sixface-Initiate/workspaces/2026-11-16-sixface-design-system/pane-interaction-spec.md`: the interactions, plus §16 (decisions) and §18 (data).
- `pane-system-research.md`: library research.
- `multiplex-guidelines.md`, §9: minimum widths.

All three are in the same folder.

**Data:** Data Studio's fictional sample database, from `examples/shared/src/data/sample-sql.ts`, a copy of `packages/contracts/src/sample.ts`. It runs in the browser on PGlite, with no backend.

## What Jali must prove

1. **Many arbitrary panes fit or fold, and are never squeezed.** Chains of 6–10 panes built by following relations, for example order → customer → their orders → product → supplier → reviews. Required behaviours:
   - pixel minimums per pane kind;
   - the collapse plan: rail, then auto-tabs, then a single pane with a switcher;
   - unfolding when room returns;
   - a pane cap.
2. **Every interaction in the spec, with pointer, keyboard and ⌘K:**
   - **Open:** open beside, which replaces the linked pane of the same kind; peek with Space, then Pin beside or Open full.
   - **Move:** centre drop swap vs add-as-tab (a setting); drag by the header grip with a 4px threshold and 25% edge zones; move with keys.
   - **Resize:** hit area wider than the line; centre snap 10/16; double-click reset; APG keyboard; resize mode; 120ms persist.
   - **Maximise:** button, double-click header, ⇧⌘↵, Esc.
   - **Minimise:** to a rail or header.
   - **Focus:** F6, ⌥1–9, directional by most-recently-used, no wrap.
   - **Close:** focus returns; a Sonner "Pane closed · Undo"; ⌘Z.
3. **URL round-trip.** Copy an 8-pane layout as a link, open it in a new tab, and get it exactly back. Back and Forward step through deliberate structural changes only. A broken URL falls back to the preset, and a pane whose object is gone stays with an error.
4. **Shared data.** Edit a customer's name in a record pane, and every grid, relation list and query result showing that customer updates with **no extra fetch** for unaffected panes (show `stats()`). Large query results are shared by handle between grid, chart and inspector. Hidden, collapsed and tabbed-away panes pause.
5. **Two resize adapters:** **react-resizable-panels 4.24.0** (pinned) and **Ark UI Splitter**. Switched by a setting, compared on behaviour, keyboard, accessibility and bundle size.
6. **Accessibility.** Each pane is `role="region"` with a name. Dividers follow the WAI-ARIA window splitter pattern. Changes are announced in a live region. The collapse plan works at 200% zoom.

## Architecture

The engine is two packages in a pnpm workspace (since 19 Nov 2026). Five example apps are built on them (since 20 Nov 2026; before that, Data Studio and the loan review were one app, "the lab", at the root).

```
packages/core/     @jali/core, no framework: layout/ (model, ops, fit, codec, validation), the workspace store,
                   actions, commands and keymap, URL and storage ports, the pane and active-item contracts
packages/react/    @jali/react: workspace renderer, pane frame and tabs, dividers, peek, drag/drop zones, shelf,
                   curated page, palette, settings, chooser, announcer; styles.css (theme + workspace, @layer jali)
                   and tailwind.css (the bridge to a host's Tailwind theme)
apps/docs/         the docs site; scripts/agent-docs.mjs writes its pages into packages/core/docs as Markdown
examples/          five example apps, each with `vp dev examples/<name>`:
  data-studio/     a database browser: catalog, query, chart, structure, er, audit, launcher; its presets
  loan-review/     a curated page: the loan review's profile, kinds and views
  markets/ studio/ trips/   a market terminal, an audio editor, a trip planner
  shared/          not an app: what Data Studio and Loan review share. data/ (PGlite + sample + TanStack Query
                   keys + entity invalidation + result store, no layout knowledge), the table, record and related
                   panes and the grid, and shell/ (top bar, status line, toasts with Sonner)
fixtures/          minimal and own-icons: the quickstart's app and the bundle-size checks' apps
tests/             engine tests that run against Data Studio's and Loan review's kinds in one store
e2e/               Playwright demo script that walks every interaction and asserts the key behaviours, against
                   Data Studio (:5300) and Loan review (:5350)
docs/              BRIEF.md, DECISIONS.md (every deviation, with reason), FINDINGS.md (what we learned, for the founder)
```

**Contracts:** `packages/core/src/layout/types.ts` and `examples/shared/src/data/types.ts`. The coordinator wrote them. Implement them; any signature change goes in `docs/DECISIONS.md`.

## Visual language

Sixface tokens, zinc neutrals and IBM Plex Sans, matching the design-system boards:

- ground `#F4F4F5`; islands white, 10px radius, 1px `#E4E4E7`, 6px gaps;
- focused pane: 1.5px `#5A2AFA` edge;
- pane header 40px;
- Plex Mono for code and numbers; numbers right-aligned.

There is **no app shell beyond a slim 48px top bar** (title, layout presets, settings, ⌘K) and a 28px status line (pane count, focus, zoom hint, fetch stats). The point is the pane system, not the shell.

## Rules

- Run `pnpm test` and `pnpm typecheck` before handing back. Keep `vp dev` working on port 5300.
- **No network installs:** dependencies are already installed. Ask the coordinator if something is missing.
- Commit small and often on `main`, with plain messages. The git identity is the machine's. Do not add a co-author line, and do not push (there is no remote).
- Touch only your work package's folders, plus `docs/DECISIONS.md` (append only).
