# Pane lab: findings

> 17 Nov 2026, for the founder.
>
> **Final state:** 218 unit tests and 44 browser walkthrough checks pass (Chrome), and type checks are clean.
>
> **How it was built:** Codex Sol (layout core), Codex Terra (data), Claude Opus (UI, the drag rewrite, the launcher and merge) and Claude Sonnet (pane kinds, the walkthrough, the phone single view). The coordinator integrated it and wrote this.
>
> Detail and numbers are in `DECISIONS.md`; screenshots are in `screens/`.

## Headline

**The architecture holds:**

1. We own the model.
2. We own the drag mechanics.
3. A thin accessibility layer sits on top.
4. A shared cache holds the data.

Every behaviour in the spec works in the browser. Two library assumptions turned out wrong, and that is the most useful result.

## What works

- **Open beside** replaces the linked pane of the same kind. Focus stays in the list, so J/K keep working. (`screens/01-open-beside-replaces.png`)
- **Peek:** Space, J/K follow, Pin beside, Open full, Esc, and `?peek=` in the URL. (`02-peek.png`)
- **Split** opens a "New pane" launcher (search, recent, tables, new query). Opening something already open focuses it instead of duplicating it (queries excepted). (`15-launcher.png`)
- **Merge without dragging:** ⌥⌘T "Add to tabs of…" and ⌥⇧⌘T "Move out of tabs". A "+" on every tab strip. (`16-merge-chooser.png`, `17-tab-plus.png`)
- **Drag to rearrange:** by the header grip, edge zones place beside, the centre swaps or adds a tab, and Esc cancels. The drag label says what will happen ("Swap with orders"). (`03`–`05`)
- **Resize:** 1:1 with the pointer, clamped at minimums, centre snap at 10/16px, double-click reset, the APG keyboard (arrows, Home/End, Enter collapses), and one save after release. (`06`)
- **Maximise and restore** (button, double-click header, ⇧⌘↵, Esc); **minimise** to a rail or a 40px header. (`07`, `08`)
- **Focus:** F6, ⌥1–9, directional by most-recently-used with no wrap; it also works while zoomed.
- **Close:** focus returns where it came from; a Sonner "Pane closed · Undo" toast; ⌘Z restores. (`09`)
- **⌘K** lists every command by stable ID. (`10`)
- **The URL:** an 8-pane layout round-trips through a link exactly. Back and Forward step through structural changes only. A broken link falls back to the preset, and a toast explains.
- **Folding:** never squeezes, and folds one pane at a time:

  | Width                        | 1920 | 1600 | 1440 | 1280 | 1024 | 390 |
  | ---------------------------- | ---- | ---- | ---- | ---- | ---- | --- |
  | Panes shown (10-pane stress) | 4    | 3    | 2    | 2    | 2    | 1   |

  It unfolds the same way. Below a pane's minimum, a phone **single view** shows one full-width pane with a switcher. (`14-*`, `15-single-view-390.png`)

- **Accessibility:**
  - every pane is a named region;
  - dividers are `role="separator"` with value, min, max and controls;
  - layout changes are announced politely.

## What the lab taught us

1. **Off-the-shelf resize libraries fight a model-driven layout.**
   - **react-resizable-panels** runs its own document-wide drag. It overwrote our ARIA values, dropped drags when sizes changed, and on the stress layout its divider **did not move at all**. It was dropped.
   - **Ark UI Splitter** behaved better and accepts our ARIA, but it adds nothing our own separator doesn't already do. It remains switchable, for ARIA only.
   - **Conclusion:** build our own divider (about 150 lines), following the W3C window splitter pattern, as Rex and herdr both do.
2. **"Laggy and off" was architecture, not tuning.** Each pointer move re-rendered the whole workspace two or three times and wrote the URL, and the line trailed the pointer by up to 88px. Moving the preview to direct DOM writes, with one commit on release (Rex's approach), fixed it:

   |                          | Before     | After |
   | ------------------------ | ---------- | ----- |
   | Handler per move         | up to 10ms | 0.1ms |
   | Re-renders during a drag | 195–302    | 0     |
   | Pointer lag              | up to 88px | 0     |

   **Rule for the package:** never route a 60fps interaction through app state.

3. **The shared cache works, with one hard limit.**
   - Editing a customer updates every pane showing it, and unaffected panes do not refetch.
   - A pane in a background tab does not fetch until shown.
   - **But a query result can only be refreshed after an edit if it includes the rows' primary keys.** `SELECT id, name` refreshes; `SELECT name` stays stale. In real products, every query that feeds a pane must carry entity IDs, or be marked "may be stale". That is a rule for the data contract, not a bug.
4. **The data layer must never change rows in place.** QA caught an edited row that didn't show in other panes, and another that jumped to the bottom of tables. Both were fixed with immutable rows (unchanged rows keep their identity, so their panes don't redraw) and primary-key default ordering.
5. **Folding needed real care.** The first version collapsed all 10 panes into one tab group even at 1920px. One-pane-at-a-time folding, which protects the focused pane and its source, is what makes "many arbitrary panes" usable.

## Centre drop: swap vs tab

Both are in Settings → Centre drop (default **swap**).

- **Swap** keeps the same number of panes and trades places: predictable, and nothing disappears.
- **Tab** hides the dragged pane inside the target (3 panes become 2): powerful for grouping, but surprising when it was not wanted.

Now that the drag label says "Swap with orders" or "Add as tab to orders", either is safe. **This is yours to judge by feel.** The QA agent only drove it by script and leaned towards tab. The keyboard commands make merging possible without any drag either way.

## Known gaps

- After the window widens back out of single view, the focused pane is the one shown in its fold, so the visible set can differ slightly from before. The spec says it should restore exactly.
- The top bar clips its preset labels at 390px.
- 200% browser zoom has not been tested by hand.
- The chart reads the first 200 rows of a result.
- Table filters are exact-match only.

## Recommendation for the shared package

1. **`@sixface/layout` core:** keep this lab's model, fitting and codec (src/layout-core), seeded together with Data Studio's `packages/layout`.
2. **Our own divider and drag,** with no resize library in the drag path.
3. **The pane contract:** kind, minimums and heavy, plus `load(ref)` and `prefetch(ref)`.
4. **A shared TanStack Query cache** with entity invalidation and immutable rows. Every pane query carries entity IDs.
5. **Next:** the founder tries swap vs tab and the overall feel. Then decide where the package lives, and start one app and one screen at a time.

## After the design review (17 Nov, later)

All twelve review findings were fixed by four Sonnet agents. Result: 242 unit tests and 44 walkthrough checks pass, and type checks are clean.

- **Folding** protects the focused pane, its source and its direct details, and folds from the far end of the chain first.
  - In the chain preset at 1440, 1280 and 1024, orders and order 1 stay side by side, with customer 1 as a tab behind order 1.
  - Folded panes join their source's group, and groups report a home pane and a folded count.
  - Stress: 3/3/2/2/2/1 at 1920/1600/1440/1280/1024/390.
- **Affordances:** 24px close targets (tab × on hover); a distinct focus handle on dividers with a live size label; an in-zone drop label ("Swap with orders") with an outlined area, while the pointer chip shows only the dragged pane; ⌘K shows titles and shortcuts, not IDs; a readable status line.
- **Grids:** the row action appears on hover or selection only (24px), plus a row context menu (right-click, Shift+F10). Timestamps read "1 Jan 2026, 10:30" (shown in UTC), `_cents` columns become money with plain headers, and JSON is compact with an expander.
- **Dark mode** uses Sixface dark tokens, with a System / Light / Dark setting. Dark tertiary text was raised to #8F8F99 for contrast.
- **Small screens:** below 768px the presets collapse into a Layouts menu, with no clipping at 320, 390 or 430. The layout restores exactly after single view.

**Still open:**

- **Unlinked panes** (audit log, structure, relations) still group with their nearest neighbour, which can read as a mixed group. The spec should decide whether unlinked panes get their own "Other" group.
- **Record money values** right-align at the far edge of a two-column record. They should align with the value column.
- **Timestamps** show in UTC; real products need the viewer's time zone setting (see i18n.md).

## After the architecture refactor (17 Nov)

We restructured the code behind the approved UI, following `ARCHITECTURE-REVIEW.md`. Nothing you approved should look or behave differently. The review's own audit, item by item, is at the end of that file: 56 done, 6 partly, none left undone.

**What changed in how it is built**

- **Hiding a pane is one idea now.** Tucking a pane and folding it for lack of room were two systems; both are now notes kept beside the layout, and the layout itself never changes. That is why put back restores the exact original, in any order.
- **The layout engine has no hidden memory.** It used to remember things between calls, and a settings change silently wiped that memory. Now everything it needs is passed in or stored in the layout.
- **The 758-line store is gone.** Its jobs are separate: actions that only decide what should happen, one place that applies a decision (state, address bar, announcement, toast, focus), one description of what is on screen, one list of commands that owns its shortcuts, and one file holding every sentence the app speaks.
- **Each pane kind is defined in one place**, and the data layer is split into small files with its own provider.
- **The tests share one toolkit**, and the one 888-line browser spec became twelve small ones. The unused alternative divider (Ark) and its library are deleted.

**Size**

|                          | Before                    | After                                       |
| ------------------------ | ------------------------- | ------------------------------------------- |
| `src/` total (all files) | 8,749 lines in 77 files   | 8,969 lines in 142 files                    |
| Largest file             | 758 lines (`ui/store.ts`) | 278 (a test); 189 for the largest code file |
| Files over 300 lines     | 5                         | 0                                           |

The total did not shrink: we removed duplicated code, but the new seams (types, small modules, tests) cost about the same. The gain is that no file does twelve jobs.

**Tests:** 285 unit tests (was 275) and 58 browser tests (plus 12 screenshot runs; the old 75 counted five tests that exercised the deleted Ark divider). All pass, typecheck is clean.

**Fixed along the way**

- The Tuck button said "Only open pane" for every refusal; it now says the real reason, the same words the screen reader hears.
- A flaky browser test (it failed about one run in six): the test pressed an arrow key while the app was still moving focus after a tuck. The app was right; the test now waits for that.
- The Ark dependency, an unused sizing duplicate and some dead styles are removed.

**Two visible differences, for you to judge**

1. **Tab and shelf order after tucking.** Tucked panes now sit in reading order (left to right as the layout was), not in the order you tucked them. It is steadier and makes put back predictable, but at 1920 on the chain layout the order differs from before. Say if you want tuck order back.
2. **The "Own separator" label in the top bar is gone** with the alternative divider it described.

**What's left (bigger, for you to decide)**

- A few long functions: the data API builder (129 lines), the divider drag (159, kept as one closure on purpose), and the layout resolver (74).
- The Shelf, Launcher and Grid components are each over 110 lines and could be split.
- Pane kinds still import their contract from `ui/`; a shared package would move it to a neutral place.
- Pane colours still run through a small private token set (`.pk`) with a dark remap, rather than the shared tokens.
- Stack groups carry a one-value `origin` field that could be dropped from the URL format.
- Grid column widths are still guessed from column names.
