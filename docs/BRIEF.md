# Pane lab: brief

**What this is:** a throwaway spike that proves the shared Sixface pane system before any shared package is built. The founder agreed it on 17 Nov 2026.

**The specification:**
- `/Users/ramizrahman/Projects/Sixface-Initiate/workspaces/2026-11-16-sixface-design-system/pane-interaction-spec.md`: the interactions, plus §16 (decisions) and §18 (data).
- `pane-system-research.md`: library research.
- `multiplex-guidelines.md`, §9: minimum widths.

All three are in the same folder.

**Data:** Data Studio's fictional sample database, from `src/data/sample-sql.ts`, a copy of `packages/contracts/src/sample.ts`. It runs in the browser on PGlite, with no backend.

## What the lab must prove
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
```
src/layout-core/   framework-free model + ops + resolve (fit/collapse) + URL codec + validation   (no React)
src/data/          PGlite + sample + TanStack Query keys + entity invalidation + result store       (no layout knowledge)
src/ui/            React: workspace renderer over layout-core, pane frame/header, dividers via an
                   adapter interface (rrp | ark), peek, drag/drop zones, keyboard layer, announcer,
                   Sonner undo, URL sync, settings panel, ⌘K palette
src/panes/         pane kinds: table-list (catalog), table (grid), record, related, query (editor+results),
                   chart (of a result handle), structure, er (relations diagram), audit (audit_log)
e2e/               Playwright demo script that walks every interaction and asserts the key behaviours
docs/              BRIEF.md, DECISIONS.md (every deviation, with reason), FINDINGS.md (what we learned, for the founder)
```
**Contracts:** `src/layout-core/types.ts` and `src/data/types.ts`. The coordinator wrote them. Implement them; any signature change goes in `docs/DECISIONS.md`.

## Visual language
Sixface tokens, zinc neutrals and IBM Plex Sans, matching the design-system boards:
- ground `#F4F4F5`; islands white, 10px radius, 1px `#E4E4E7`, 6px gaps;
- focused pane: 1.5px `#5A2AFA` edge;
- pane header 40px;
- Plex Mono for code and numbers; numbers right-aligned.

There is **no app shell beyond a slim 48px top bar** (title, layout presets, settings, ⌘K) and a 28px status line (pane count, focus, zoom hint, fetch stats). The point is the pane system, not the shell.

## Rules
- Run `pnpm test` and `pnpm typecheck` before handing back. Keep `pnpm dev` working on port 5300.
- **No network installs:** dependencies are already installed. Ask the coordinator if something is missing.
- Commit small and often on `main`, with plain messages. The git identity is the machine's. Do not add a co-author line, and do not push (there is no remote).
- Touch only your work package's folders, plus `docs/DECISIONS.md` (append only).
