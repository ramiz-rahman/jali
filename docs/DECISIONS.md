# Decisions and deviations

Append-only. Each entry: date · who · what · why.

2026-11-17 · WP2 · Added the missing PostgreSQL products price-audit trigger to the sample SQL. The PostgreSQL variant previously created no trigger, so PGlite could not demonstrate the audit side effect.

- 2026-11-17 · WP3 (UI) · PaneKind React interface in `src/ui/pane-kinds.ts`: `registerPaneKind({ kind, title, minWidth, minHeight, maxWidth?, preferredWidth?, heavy?, icon?, Component })`. Component props are `{ node, ref, paused, focused, openBeside, peek, select }` as asked, plus `setActivity` and `inPeek`. `ref` is the ObjectRef (React 19 passes `ref` to function components as a plain prop). `useDataLayer()` and `<DataLayerProvider>` live in `src/data/react.tsx`. `kindRegistry()` derives the framework-free `KindRegistry` for layout-core. `src/panes/index.ts` is loaded before first render if it exists.

2026-11-17 · WP1 (layout-core) · Implemented the framework-free core against `docs/BRIEF.md`, `src/layout-core/types.ts`, the pane interaction spec (private design notes, not in this repo) §§1–12, 15–16 and that folder's `multiplex-guidelines.md` §9. No existing operation signature changed. Additions: `LayoutCoreOptions` and optional factory argument `{ paneCap?: number }` (default 10); optional `StackNode.axis` to restore an automatic stack's row/column orientation; optional `DividerBox.neighbours` containing the pane IDs on both sides after fitting. `snapToCentre(value, centre, wasSnapped)` is a separate numeric helper exported from the entry point.

2026-11-17 · WP1 (layout-core) · `resolve()` is a pure geometry projection because its contract returns no Layout. Automatic groups receive deterministic synthetic stack IDs; `PaneBox.stackId` / `hiddenInStack` describe their tabs, and `folded` lists panes newly hidden by the projection rather than deliberate inactive tabs. Re-resolving the canonical tree unfolds automatic groups as space returns; user stacks retain their structure and active child. UI synthetic-tab selection should focus the selected pane (the projection selects the focused automatic tab); `setActiveTab` selects tabs in actual Layout stack nodes. The UI must use `DividerBox.neighbours` for grouped divider membership rather than assuming its projected index addresses the original pair of children. APG values are the first neighbour's local length in pixels, excluding the gap. Inherited maximum widths may leave unused space after all children hit their maxima.

2026-11-17 · WP1 (layout-core) · The pane cap counts displayed slots, since turning an object into a tab cannot reduce the number of retained objects. The oldest eligible existing slot is tabbed while the newly opened pane remains beside (`mode: "beside"`); `mode: "tab"` means the newly opened pane itself was tabbed. Birth order is tracked per core instance; imported layouts use reading order as the deterministic age fallback because the contract has no creation timestamp. Pins are not replaced by linked same-kind opens. Automatic fit folds prefer unpinned linked contexts, then a single switcher containing the remaining slots; all objects survive.

2026-11-17 · WP1 (layout-core) · Collapsed geometry consumes 56px at a parent's edge and 40px in its middle, along that parent's split axis. This follows WP1's explicit 40px requirement instead of the draft spec's older 32px column header. Fixed pixel preferences yield toward their minimums if they would crowd out a weighted sibling's minimum after a viewport shrink; saved intent is retained in the canonical Layout. The mathematically impossible case of a lone pane whose minimum exceeds the entire viewport preserves its intrinsic minimum (for example a 480px record in 390px). A phone/reflow renderer must provide an appropriate single-page presentation; the core does not silently weaken a kind's declared minimum.

2026-11-17 · WP1 (layout-core) · Divider reset restores the pre-drag proportions remembered by the core instance, or the last reset preset's sizes; imported already-userSized nodes without a baseline reset to equal weights. Open balances undragged siblings to equal weights, since Layout has no preset identity/proportion field. Close preserves the recipient's transferred share and balances the other undragged siblings. `close()` has no FitOptions argument: exact mixed px/weight space transfer uses the most recent `resolve()`/open/resize fit for that Layout; before any geometry exists, same-unit sizes add and mixed units release the fixed allocation into the remaining weighted space. Call `resolve()` on the current Layout before closing to retain the exact rendered mixed-unit allocation. `toggleZoom(view, pane)` likewise has no Layout argument, so the UI owns the single-pane zoom guard. No extra undo-bearing return types were added to structural methods; close and closeOthers return the UndoEntry specified by the contract.

- 2026-11-17 · WP3 (UI) · **Panes are positioned absolutely from `resolve()` rects, not rendered inside the resize library's flex tree.** Pane elements keep stable keys, so no structural change (split, drop, fold, zoom, minimise) remounts pane content or loses its state. The library is only the divider interaction engine.
- 2026-11-17 · WP3 (UI) · **Divider adapter = a "ghost" two-panel group per divider.** Each adapter (`src/ui/dividers/rrp.tsx`, `ark.tsx`) renders an invisible two-panel group over the divider's two neighbours (taken from `DividerBox.neighbours`), with the library's real separator in the 6px gap. The library proposes a size; a shared controller (`DividerLayer.tsx`) clamps it to `DividerBox.min/max`, snaps it (in at 10px, out at 16px from the pair's centre), and calls `resizeDivider`. APG keys (16/64px, Home/End, Enter collapse), double-click reset and the 120ms persist are shared, so the two adapters differ only where the libraries do. During a drag, the visible line is drawn from the model, not by the library, so the clamp and snap show truthfully.
- 2026-11-17 · WP3 (UI) · rrp 4.24 ignores consumer `aria-valuenow` and `aria-controls` on `Separator`: it writes a percentage, and the ghost panel's id. A MutationObserver re-applies ours, pointing `aria-controls` at the real pane region(s). Ark's `ResizeTrigger` accepts the overrides as props. rrp also drops an in-progress drag if `defaultSize` changes, or if `panel.resize()` is called mid-drag, so both are frozen during a drag.
- 2026-11-17 · WP3 (UI) · The pane cap comes from layout-core (`createLayoutCore({ paneCap })`). Settings swaps the core instance when the cap changes; the UI has no cap logic of its own.
- 2026-11-17 · WP3 (UI) · Focus after "open beside" stays in the source pane (founder decision 2), even when layout-core's view says otherwise. Peek, zoom and resizes use `history.replaceState`; only deliberate structural changes (open, close, split, move, drop, preset, undo) push history entries. `?peek=` encodes the ref as `kind~key=value~key=#number`.
- 2026-11-17 · WP3 (UI) · Preset "Query + chart + inspector" starts the chart with `runId: ""` and links it to the query, so "Chart this result" replaces it in place through open-beside. The inspector is a `structure` pane on `sample_orders`.
- 2026-11-17 · WP3 (UI) · **Split opens a launcher, not a duplicate** (founder-approved). New pane kind `launcher` ("New pane", min 320×200) in `src/panes/LauncherPane.tsx`: an autofocused search over Recent (last 8 objects opened this session, seeded with the panes on screen at boot or preset), Tables (catalog, with row counts) and New query; typing "customer 3" also offers a direct record jump. Choosing calls the new `openHere(ref)` prop: same node, ref replaced in the UI (no core op exists for this). Esc on an untouched launcher calls the new `dismiss()` prop: a quiet close with no undo toast. `PaneComponentProps` gains `openHere` and `dismiss`. Split right/down/auto use `core.split` with the launcher ref and move focus into it (unlike open beside, which keeps focus in the source).
- 2026-11-17 · WP3 (UI) · **One object, one pane** (launcher only): choosing an object that is already open focuses that pane (selecting its tab, restoring it if minimised), drops the launcher and announces "Already open: focused …". Identity is kind plus params with ids compared as text and `autorun` ignored; `query` panes are scratch editors and never deduplicate. Open beside keeps its existing replace-the-linked-pane rule.
- 2026-11-17 · WP3 (UI) · **Merge without dragging (WCAG 2.5.7).** `pane.merge` "Add to tabs of…" (⌥⌘T) opens a chooser of the other visible panes and stacks (stacks listed by their tab titles) and runs `core.drop(…, "centre", "tab")`; `pane.unmerge` "Move out of tabs" (⌥⇧⌘T) runs `core.drop(tab, sibling, "right")`, which places it right of its stack. Unmerge applies to deliberate (tree) stacks only; automatic stacks are folds for lack of room. ⌥⌘T is untested against Safari's own binding (spec §14 caveat).
- 2026-11-17 · WP3 (UI) · **Tab strip "+" and `stack.new-tab`** add a launcher tab and focus it. For a deliberate stack, or a lone pane (which becomes a user stack of two), the UI inserts the node directly rather than split-then-drop, because `split` can trip the pane cap and tab an unrelated pane on the way. For an automatic stack it uses `core.split`, and the fold keeps it as a focused tab.
- 2026-11-17 · WP3 (UI) · The drag chip names the outcome before release: "Swap with orders", "Add as tab to orders", "Place left of orders", "Place above orders".
- 2026-11-17 · WP3 (UI) · **Divider drag: presentation separate from the model (Rex).** The founder reported that dragging felt laggy and off. The pointer drag is now ours (`src/ui/dividers/drag.ts`). Pointer down calls `setPointerCapture` and snapshots the committed layout. One `requestAnimationFrame` per frame turns the pointer into the first neighbour's size: 1:1, clamped at both minimums, with the centre snap (in at 10px, out at 16px). It calls `core.resizeDivider` on the snapshot, resolves the result, and writes it straight to the DOM: left/top/width/height of only the frames whose rect changed, the dividers inside the neighbours, and one accent drag line. Nothing enters React state and nothing reaches the URL during the drag. Pointer up commits that same layout object once (`actions.commitDividerDrag`), so the committed rects equal the last preview exactly. The URL is written once, 120ms later (history "debounce"). Escape or pointercancel restores the start. Heavy panes hold their content (data-holding plus a fixed inner size, set on the DOM) and reflow on release; light panes reflow live. During the drag the whole document shows col-resize or row-resize and blocks text selection. Double-click still resets. The `holding` pane prop and the `dividerDrag` state are gone: no kind read them, and toggling them re-rendered every frame.
- 2026-11-17 · WP3 (UI) · **Pane frames are memoised by node and rect** (`sameFrameProps` in PaneFrame.tsx), and dividers by their geometry. A keyboard resize, which still commits per keypress, re-renders only the frames on either side of that divider. Checked on Stress: ArrowLeft on the first divider re-rendered s1–s6 (the two neighbour stacks) and nothing else; a pointer drag rendered no frames until release.
- 2026-11-17 · WP3 (UI) · **rrp vs Ark: both libraries are out of the drag path; rrp is dropped; Ark stays as an element-and-ARIA shell; the default is our own APG separator.** react-resizable-panels 4.24 hit-tests separators from a capture-phase `pointerdown` listener on the document. It therefore starts its own drag on every press near a separator, and no element-level handler can stop it short of a window-level suppressor. It also ignored our `aria-valuenow` and `aria-controls` (MutationObserver), and it dropped drags when `defaultSize` changed or `resize()` was called. Its keyboard was already fully overridden by ours, so it added nothing except workarounds. Ark's ResizeTrigger uses element-level React props, so `onPointerDownCapture` plus `stopPropagation` keeps zag's drag machine out cleanly, and it takes our ARIA as props. Ark coexists, but it adds nothing our separator lacks, so it is kept only to show that the controller is library-agnostic. Settings now switches between "Own APG separator (no library)" and "Ark UI Splitter 5.40 (element and ARIA only)". A saved "rrp" setting falls back to our own separator. The `react-resizable-panels` dependency remains in package.json (no installs or uninstalls in this pass) and is unused. Recommendation for the shared pane system: our own separator, no resize library.
- 2026-11-17 · WP3 (UI) · **Drag measurements.** Headless Chrome (channel chrome), 2560×1000, 100 pointer moves of 4px (400px). Order → customer chain: first divider, 400px left. Stress: first divider, 240px left then 160px right. Three runs each; medians, with maxima in brackets. "Handler" is the synchronous pointermove dispatch. Script and task are Chrome's ScriptDuration and TaskDuration per move (task includes style, layout and paint). Lag is the distance from the drawn line to the pointer, measured each frame.

  |                     | handler ms | script ms/move | task ms/move | long tasks (>50ms) during drag | frames dropped   | React commits during drag | line lag px | moved                       |
  | ------------------- | ---------- | -------------- | ------------ | ------------------------------ | ---------------- | ------------------------- | ----------- | --------------------------- |
  | Before, rrp, chain  | 0.5 (1.6)  | 3.1            | 4.3          | 0                              | 0–1              | 302 (3 per move)          | 0 (88)      | 312 of 400                  |
  | Before, rrp, stress | 1.6 (2.6)  | 1.5            | 3.5          | 0                              | 0                | 107                       | 116 (236)   | **0**: divider did not move |
  | Before, Ark, chain  | 3.9 (10.1) | 4.0            | 5.2          | 0                              | 0–1              | 195 (2 per move)          | 1 (15)      | 399 of 400                  |
  | Before, Ark, stress | 0.4 (3.4)  | 0.5            | 1.6          | 0                              | 0–1              | 7                         | 116 (236)   | **0**: divider did not move |
  | After, own, chain   | 0.1 (0.6)  | 0.5            | 3.0          | 0                              | 0                | 4                         | 0 (15)      | 400 of 400                  |
  | After, own, stress  | 0.1 (0.2)  | 0.6            | 3.0          | 0                              | 0                | 4                         | 0 (14)      | 80 net, as dragged          |
  | After, Ark, chain   | 0.1 (0.2)  | 0.6            | 2.9          | 0                              | 0                | 4                         | 0 (15)      | 400 of 400                  |
  | After, Ark, stress  | 0.1 (0.4)  | 0.6            | 2.8          | 0                              | 0 (1 in one run) | 3–4                       | 0 (14)      | 80 net, as dragged          |

  The 3–4 commits that remain during a 1.7s drag are the status line's 500ms fetch-stats poll; the drag itself makes none. The release makes 1–3 commits: the one layout commit, plus the URL-saved stamp. The maximum lag of 14–15px after the change is the centre snap holding the line at the centre (16px hysteresis), by design. Baseline "laggy and off" was, in measured terms: 2–3 full-workspace renders per move; the line trailing or slipping the pointer by up to 88px (rrp); and, on Stress, a divider that does not move at all with either library. One 12-run pass showed a 100ms long task on release on Stress (heavy table reflow), which is allowed. `e2e/walkthrough.spec.ts` now asserts, with both adapters, no long task during a 400px drag, a 1:1 frame, the resize cursor and no selection, no URL write during the drag, a URL write after it, and no jump at release.

2026-11-17 · WP2 (data) · Result-store edits now replace changed rows and retain unchanged row references; TanStack Query can detect result changes without the row-copy workaround in `src/panes/data.ts`, which is now unnecessary. List queries default to primary-key order and refetch once per invalidated mounted list.

2026-11-17 · layout-core · Fixed fitting to fold one displayed pane at a time, recheck both minimum dimensions plus gaps after each fold, and stop immediately when the projection fits. Unpinned, unfocused linked contexts go first by minimum width; the focused pane's source is protected until other slots have folded. Remaining slots also fold incrementally instead of jumping to one switcher. Equally near neighbours prefer an existing auto stack, whose tabs are flattened as it grows; deliberate stacks retain their active tab. Canonical geometry remains untouched, so widening reverses the same fold sequence. The copied ten-pane stress preset resolves to 4/3/2/2/2/1 visible panes at 1920/1600/1440/1280/1024/390px, respectively (900px high).

2026-11-17 · layout-core · Corrected the earlier collapse-geometry decision: a middle pane in a row retains its width and renders only its 40px-high header; an edge pane retains its 56px-wide rail. Column collapse remains 56px at the edges and 40px in the middle. No public signatures changed.

2026-11-17 · WP3 (UI) · **Phone rule: single view.** When any visible pane's rect (layout-core keeps kind minimums) runs past the workspace width, `Workspace` switches to single view, in `src/ui` only. One pane fills the full width with no radius, gaps or border; a pane switcher (`PaneSwitcher.tsx`, a tablist with title, kind icon and activity for every pane and tab) sits on top and focuses the chosen pane. Other panes stay mounted but hidden, so state survives. Dividers are not rendered, header drag/double-click zoom/zoom/minimise are off, Peek is a full-width sheet, and wide content scrolls inside the pane body. Layout, URL and history are untouched; widening restores the normal render. Entering and leaving are announced (fold announcements are suppressed while single). Choosing a pane moves focus, so on widening the focused pane is the selected tab of its fold.

2026-11-17 · layout-core · **Collapse priority and stack homes (design review High 1 and 2).** Supersedes the earlier "narrowest unpinned context first" rule. Protected: the focused pane, its source and its direct details. Fold order: unprotected unpinned, unprotected pinned (or minimised), protected unpinned, protected pinned, the focused slot last. Within a tier: unlinked panes first; then the far end of link chains (greatest undirected link distance from the focused pane; chains unrelated to it count as infinitely far); then least recently focused (`view.focusHistory`, never-focused first); then narrowest, then reading order. A folded slot joins the stack of its source; if that source is itself folded it joins the source's stack; a chain root joins a direct detail's stack; only an unlinked slot joins its nearest neighbour (preferring an existing auto stack). A whole stack that folds again travels to the home of any of its outside links, so a pane never leaves its source's stack. Auto stack tabs are kept in reading order. Result for the Order → customer chain focused on orders: 1920 all three; 1440, 1280, 1024 orders and order visible, customer a tab behind order; 390 orders only. The stress preset (focus s1) now shows 3/3/2/2/2/1 visible at 1920/1600/1440/1280/1024/390, because folding a pane out of a column no longer frees width when its column partner stays. Types: `ResolvedLayout.stacks: ResolvedStack[]` (required) with `{ id, origin: "auto", homeId, foldedCount, paneIds }` for each auto stack, so the UI can label "+2 folded"; `homeId` is the pane the group formed around, `foldedCount` the panes folded into it. Old tests changed because they encoded the old rule: the stress visible counts and unfold thresholds, and "grows an adjacent auto stack" (now "joins a folded pane to the stack of its source").

2026-11-17 · coordinator (founder review) · The founder found the layout "much worse than before": panes did not fill empty space, and a minimised middle pane became a full-width 40px header with a black void beneath. Three fixes in layout-core:

1. Dragged sizes are stored as proportions (weights in px units), not fixed px. Untouched siblings are re-expressed in the same units, so a split keeps filling its space after a close, a minimise or a window resize. Reset also returns re-expressed siblings to their defaults.
2. `shares()` hands any leftover space to children that can still grow, so a row never shows a void.
3. In a row, every minimised pane (edge or middle) becomes a 56px rail; in a column, a 40px header strip. The last expanded pane can never be minimised.
   Tests updated where they encoded the old behaviour, with new tests for fill-after-drag and last-pane protection.

2026-11-17 · layout-core + store (founder: "on the first pane, if I click on the third tab, I expect only the third tab to show") · **Sticky folding: the layout never depends on focus.** Root cause: `resolve()` re-derived the folds from `view.focused` and `focusHistory`, so a tab click (which focuses) or any focus move pulled that pane out of its stack and refolded everything. Supersedes the WP1 entry "resolve() is a pure geometry projection… the projection selects the focused automatic tab".

1. **Folds are recorded on the Layout.** New optional `Layout.fold: { order, active? }` (types.ts): `order` lists the displayed slots folded so far, in fold order (pane ids, deliberate stack ids, or `@auto:<home>`). `active` holds each automatic stack's shown tab, keyed by its home pane. The tree stays canonical. Fold records were chosen over materialised `origin: "auto"` StackNodes because a fold moves a pane next to its source, and the tree cannot unfold that without keeping the pane's original place. The codec carries `fold` (an optional third array element), so reload and Back show the same arrangement. `validate` checks its shape; replay skips stale ids.
2. **`resolve()` is a pure function of layout plus size.** `view` only places the zoom overlay. If recorded folds do not fit yet, it folds further by a focus-free rule (the first pane in reading order stands in for focus) rather than squeeze. Automatic stack ids are now `@auto:<homeId>` and stay stable while a group grows or a tab is chosen. A deliberate stack's home is its first tab, never its active tab.
3. **New `LayoutCore.refit(layout, view, fit, mode)`** is the only place fold decisions are made, and it returns the same object when nothing changes. The "protect the focused pane, its source and direct details" priority applies only here, when a fold is needed. Unfolding pops to the shortest recorded prefix that fits, so the same width always restores the same arrangement. A new fold that hides the focused pane shows it as the tab; unfolding never changes a shown tab. Modes: `full` for structural and size changes; `fold` when restoring a minimised pane, which never unfolds; `load` for a layout from a link, reload or Back, which unfolds only what would fit with every minimised pane expanded. `openBeside`/`split` record their own fold: with no room the new pane becomes a tab of its source, and over the cap the oldest unpinned, unfocused pane does. They no longer write auto StackNodes into the tree. With no room, the new pane now joins its source's group rather than the nearest deliberate stack (test renamed). `close`, `drop` and `swap` forget the fold records of the panes they move or remove.
4. **Store.** Refits run on window or container resize, a pane-cap change, a layout arriving from outside an action (link, Back, boot), and structural commits. Focus, tab clicks, zoom, minimise and divider drags never refit; a divider drag changes sizes, not minimums, so it cannot change what fits. `setActiveTab` works on automatic stacks (`@auto:` ids) and moves nothing. `commit` announces, writes history and toasts only when the layout actually changed (or, where asked, the focus); "can't move", closeOthers with one pane and no-op drops no longer announce false outcomes.
5. **Minimise.** A minimised pane's space goes to its nearest expanded sibling in the same split, the one before first. The space is allocated as if the pane were expanded, so other panes keep their rects and expanding takes exactly that space back. Minimise never unfolds anything. By pointer or palette, focus moves to the neighbour that grew ("orders minimised; focus on order 1"). With ⌥⌘M, focus stays on the rail button, so Enter or ⌥⌘M expands it; with no pane focused, ⌥⌘M acts on the most recently focused pane, or says "No pane focused". Expand focuses the restored pane. A divider's Enter keeps focus on the divider. `canMinimise(id)` (store) is false for a pane that is already minimised, or when no other expanded pane would stay on screen. Refusals say why: "customer 1 is the only open pane and can't be minimised", or "…the only expanded pane on screen…". Announcements say "minimised" and "expanded", never "collapsed".
   Tests: the collapse, stress and resolve priority tests now go through `refit` (decided at fold time). Open tests check recorded folds instead of tree auto stacks. New: on the stress preset at 1920 and 1440, activating every tab and focusing every pane leaves every rect and membership unchanged (and refit at the same size returns the same object); resizing 1920→390→1920 restores each width exactly, with focus moved in between; minimise and expand only touch the neighbour and never unfold; reload never unfolds into space a minimise freed; the codec round-trips folds.

2026-11-17 · layout-core + store (founder rejected minimise-to-rail) · **Tuck + shelf replaces minimise and collapse.**

1. **API** (types.ts). `PaneNode.tuckedFrom?: TuckOrigin` = `{ parent, axis, index, beside, side, size, userSized?, home, extent?, resized? }`. `StackNode.origin` gains `"tuck"`. `LayoutOps.canTuck(layout, pane, fit?) → { ok: true, home } | { ok: false, reason: "missing" | "tab" | "hidden" | "last" }`, `tuck(layout, view, pane, fit?) → { ok, layout, view, home, undo }`, `putBack(layout, view, pane, fit?) → { ok, layout, view, restored: "origin" | "beside", home }`. `ResolvedLayout.shelf: ShelfEntry[]` = `{ paneId, homeId, stackId, reason: "tucked" | "folded" | "tab", activity? }`. `UndoEntry.tucked?`. `setCollapsed` and `PaneNode.collapsed` are gone, with the 56px rail and 40px strip geometry. Store: `canTuck(id): boolean`, `tuckHome(id)`, `shelfEntries()` (adds activity), actions `tuck(id?)`, `putBack(id?)`, `reveal(id)`; `setCollapsed`, `minimiseFromKeyboard` and `canMinimise` are removed.
2. **Home.** The source, if it is on screen in an adjacent sibling slot; else the nearest previous sibling slot with something on screen; else the nearest next one; within a slot, the source, else the on-screen pane nearest by centre. If no sibling qualifies, the search moves out one split. A pane shown inside an automatic fold joins the fold's home in the tree, so the fold record still replays. The home keeps its shown tab.
3. **Space.** The home's slot absorbs the pane's extent plus the gap, so every rect outside the home's group stays, to 1e-6 px. With all weights, only the slot's weight changes (it gains the pane's weight plus `W·gap/A`). Otherwise, or if a resolve check shows another rect moved, the split is restated as px-proportional weights. A split emptied to one child is kept, so the origin id survives. Tuck never refits.
4. **Origin "tuck", not "user".** putBack must know whether it created the stack: a "tuck" stack dissolves into its single pane at the stack's size when the last tucked tab leaves, and the person's own stacks never do. A deliberate centre drop into a tuck stack turns it "user" (existing `tab()`).
5. **Put back.** It goes after or before the sibling it sat beside (matched by containment, so a home turned stack still matches), restoring the siblings' sizes where they are unchanged since the tuck. That gives an exact round trip: the tree is `toEqual` the original. If sizes changed in between, it carves its old extent out of that sibling. If the origin split is gone, it goes beside its current home on the side it came from (`beside()`, balanced). Refit is "fold" only. Order (18 Nov): `tuckedFrom` also records `seq` (tuck sequence) and `order` (the split's children at the tuck, each named by its first pane). The earliest record still tucked from a split is the reference: a pane goes before the nearest following sibling that is on screen, else after the nearest preceding one, and hands its fuller `order` to panes tucked later. Two panes tucked into one home come back in their original order whichever comes back first. LIFO is still exact to the tree; out of order the order is right but sibling weights restart equal.
6. **Folding stays sticky.** `refit` judges unfolding as if every tucked pane were back in its slot (`untuckAll`). So a tuck never unfolds anything, whether on reload, Back or a resize, and a width always gives the same arrangement. "load" now behaves like "full", since the minimise-specific probe is gone.
7. **Shelf includes "tab" (inactive tabs of user and tuck stacks).** The contract is "every pane not on screen", so no consumer needs to know which mechanism hid a pane. The single-view switcher and a future full shelf can use the whole list, and a revealed tucked pane swaps places with its home, which must stay findable. Precedence: tucked, then folded, then tab. `homeId` is the pane shown in that place. The current Shelf UI and status line list every pane with `tuckedFrom`, including one revealed in its home (revealing is not putting back), grouped by `tuckedFrom.home` (`src/ui/pane/tuck.ts` `useShelf`, `StatusLine.tsx`).
8. **Undo.** A tuck pushes an UndoEntry with `tucked`; ⌘Z puts that pane back instead of restoring `before`, so later changes survive. Stale tuck entries are skipped. Put back removes the pane's entry.
9. **Keys and commands.** ⌥⌘M tucks the focused pane (else the most recently focused one), and focus goes to the home ("customer 1 tucked into order 1"). ⌥⇧⌘M puts back the tucked tab with DOM focus, else the focused pane if it is tucked, else the most recently tucked pane. ⌘K: `pane.tuck`, `pane.putBack`, `shelf.reveal` (one pane: reveal it; several: focus the shelf toolbar). F6 stops at the shelf region after the last pane, and ⇧F6 before the first. Dragging a tucked tab out of its home on its origin side is a put back. Any other deliberate move (drop, swap) clears `tuckedFrom`. Refusals are truthful: "…is the only pane on screen and can't be tucked", "…is already a tab of …", "…is not on screen", "Nothing is tucked".
10. **Migration.** Rail-era links with `c: true` decode as tucked (structural home rule, no geometry), and `c: false` is dropped. `validate` still accepts a boolean `collapsed` for that reason only.
11. **Divider Enter does nothing.** Tucking from a divider would pick a side arbitrarily and remove the focused divider, so it was not done.
    Tests: rail tests replaced. New `tuck.test.ts`: home rule; other rects unchanged; exact round trip at the edges and middle in rows and columns; px and dragged sizes; joining an existing stack; two tucks; an emptied split kept; origin gone; no unfold at 1440; refusals; shelf reasons; reveal; codec; legacy migration; undo entry. Stress: a tuck never unfolds on load, full refit or reload.

2026-11-18 · UI · **The shelf lives in the 28px status line.** The 32px strip above the status line shrank every pane by 32px when one pane was tucked, which broke the rule that a tuck only changes the home's group. The shelf is now the left side of the status line (chips grouped by home, 20px high, same toolbar, F6 stop, fade edges and +N menu); the pane count and focus text move to the right, beside the hint and stats. With nothing hidden the left side shows the count as before. The status line is always 28px and the grid has three rows, so the workspace height is identical with and without hidden panes (e2e asserts it). On a narrow desktop the hint steps aside for the shelf; on a phone the shelf folds into the pane switcher and F6 skips it.

2026-11-17 · panes + data · **Pane kind definitions and shared data context.** Pane definitions now carry their ref factory and optional identity, transient and recordable policy for the upcoming UI refactor; the existing store still owns its current policy until that refactor. Data hooks read their layer from a provider in `src/data/react.tsx`, and result page keys are produced by the key factory. Audit links use both the entity type and ID, mapping singular entity names through the data catalog. The UI's existing `useDataLayer` import remains as a deprecated compatibility re-export.

2026-11-17 · e2e · **Fixture layer and specs split by area (ARCHITECTURE-REVIEW E1).**

1. **`e2e/fixtures/lab.ts`** is a `test.extend({ lab })` page object (`open`, `preset`, `pane`, `header`, `visibleIds`, `snap`, `tuck`, `firstTuckable`, `setting`, `recordAnnouncements`, `fetches`, `settle`, `stable`, `shot`, `fork`). `e2e/fixtures/layouts.ts` holds the layout builders. Selectors are roles, accessible names, `data-pane`, `data-tab` and the live region; the few that still use a class are named in one `HOOKS` table in lab.ts, so the ui restructure has a single list to satisfy.
2. **Specs by area:** open-peek, move, launcher-tabs, divider, zoom-focus-close, url, shared-data, a11y, responsive, tuck-shelf, stability, screens. One test maps to one old test, assertions kept; the 75 tests are 63 behaviour tests plus the 12 shelf screenshot runs (screens.spec.ts).
3. **Screens.** Normal runs write nothing to docs/screens: `lab.shot()` is a no-op outside the `screens` project. `pnpm screens` (`SCREENS=1`) runs every spec with shots on, plus screens.spec.ts. `webServer` reuses a server already on :5300.
4. **No fixed sleeps.** `waitForTimeout` (22 before, 0 after) is replaced by `lab.stable()` (layout unchanged on three reads), `lab.settle()` (fetch counter flat for 1.1s) and `expect.poll`. The bogus `"customer1".slice(0, 0)` assertion now checks the query result's columns and its name cell against the record.

2026-11-17 · panes + data · **Shared windows, relation counts and launcher sources.** Table and result grids share a windowing hook and page size; result pages keep the same cache keys and retain the last page while loading. Relation counts come back with relations in one database query. Pane kinds receive launcher workspace sources through the pane contract, and the audit grid resolves targets using both entity type and ID.

2026-11-17 · layout-core · **Canonical overlays and a pure API (architecture review L1–L4).** The tree now contains only panes, deliberate stacks and splits. `Layout.overlay?: { tucks: { pane, home, seq }[], folds: NodeId[], shown: Record<NodeId, NodeId> }` replaces both structural tuck origins and `Layout.fold`. Projection replays tucks before folds; allocation uses the same folds with tucks disabled so the home absorbs the vacated extent and gap without moving other groups. Put back removes its record and fits in fold-only mode; either restoration order preserves the exact canonical tree. Unfolding probes the tree without tucks. The codec carries overlays, `NodeBase.base` reset preferences and `PaneNode.born` ages; legacy materialised auto/tuck stacks and rail-era links are unsupported.

The public API is standalone exports (`import * as core from "…/layout-core"`), with an explicit final `ctx: { fit: FitOptions, paneCap: number }` on every operation, including view operations. Structural operations fit their own result; public `refit(layout, view, ctx)` handles resize, cap changes and arriving URLs, with no public mode. New operations are `addTab`, `setRef` and `reveal`; `tree` exports `panes`, `find`, `parentOf`, `stackOf`, `map`, `newId`, `shape` and shared draft helpers. Geometry exports include `extentAlong`, `minSize` and `snapToCentre`. No-op operations preserve input identity. `UndoEntry.kind` replaces labels; a successful put back returns `{ ok, layout, view, home }`. `PaneBox.hidden` distinguishes `tab` from `zoom`, `ResolvedStack.kind` distinguishes fold from tuck, and folded counts derive from shelf reasons instead of redundant projections. Activity and heavy-rendering policy remain in UI. The factory, remembered fits, closure clocks/defaults, structural tuck repair, legacy unfold/migration paths, dead `fits`/`minimum`, duplicate tree/geometry code and import cycle are removed. Modules live under `tree/`, `geometry/`, `fit/`, `ops/`, `codec/` and `test/`, with shared fixtures. UI edits only adapt these contracts and external refit call sites; the separate UI restructuring remains its own work package.

2026-11-17 · ui · **src/ui restructured (architecture review U1–U5, ui findings, CSS, store side of P1).** Behaviour, copy, announcements, keys, URLs and visuals are unchanged.

1. **Shape.** `state/` (`store.ts` createUiStore, `model.ts`, `apply.ts`, `messages.ts`, `settings.ts`, `undo.ts`, `react.tsx`), `actions/` (focus, open, close, tuck, move, tabs, resize, peek, layout), `commands/` (`registry.ts`, `keyboard.ts`, `format.ts`), `dom/` (`focus.ts`, `ids.ts`), `workspace/` (`Workspace`, `frames.ts`, `single-view.ts`, `useSingleView`, `dnd.ts`, `DropIndicator`), `pane/` (`PaneFrame`, `PaneBody` + `PaneHost`, `TabStrip`, `HeaderActions`, `chrome.ts`, `icons.tsx`, `Activity`), `dividers/` (`DividerLayer`, `Divider`, `drag.ts`, `resize.ts`), `chrome/` (TopBar, StatusLine, Shelf, PaneSwitcher, Peek, Announcer), `dialogs/` (`ListDialog`, Palette, Chooser, Settings), `styles/` (tokens, base, pane, dividers, shelf, chrome, dialogs). `pane-kinds.ts` stays at its path as the panes' registration contract.
2. **Actions and apply (U1).** An action is pure: `(x: Snapshot{ s, m, ctx }, ...args) => Outcome`, where `Outcome = Change | Refusal | null | step | Outcome[]` and `Change = { op, layout?, view?, msg?, undo?, patch?, toast?, focusDom?, result? }`. `apply()` commits it: state, then URL, announcement, toast and DOM focus, as `POLICY[op] = { writes: "view" | "layout", history, announceWhen: "layout" | "change" | "always" }` says. A step `(x) => Outcome` sees the state the previous step left (pin peek = close peek, then open beside). `bindActions(store)` gives `store.actions.close(id)`, returning the action's `result`. Refusals carry their reason (`refuse(msg)`, silent without one). `CommitOptions`, `announceView`, the hand-written write/announce paths and the copied undo slices are gone. `closedStack`/`undoClose` are `undoStack`/`undo`.
3. **One model (U2).** `store.model()` / `useModel()` returns `WorkspaceModel { layout, resolved, flat, panes, pane(), title(), visible, flatVisible, groups, stackOf(), tuckOf(), shownWith(), shelf, folded, single }`, memoised on layout, zoom, area, the kind registry's version and the pane cap.
4. **Commands own their keys (U3).** `Command { id, title, group, keys?: Chord[], check?(x) => Refusal | undefined, run(store) }`. The keyboard matches chords from the registry after three modal handlers (resize mode, F6 into the shelf, the Escape chain); a matched command whose check refuses still takes the key and announces the reason, if any. The palette disables a command while its check refuses. `shortcutLabel(id)` prints keys for tooltips, the palette and the status hint (⌘ on a Mac, `Ctrl` elsewhere).
5. **Explicit boot (U4).** `main.tsx`: `registerAllPaneKinds(); const url = createUrlSync(); const store = createUiStore({ url, focusPane }); boot(store, url); startUi(store, url); render(<App store data />)`. `startUi` installs the keyboard, Back/Forward, theme and settings persistence and the dev `__lab` hook. Announcements are state (`{ text, seq }`), so nothing said before the live region mounts is lost; toasts queue until the toaster listens. `hooks`, `bumpKinds`, `lastKv`, `booted`, `initialBroken`, `savedAt` and the drag/URL module variables are gone (drag state is the body class and the `dnd` field; the URL debounce timer lives in `createUrlSync`).
6. **Pane host and chrome (U5).** `PaneHost { openBeside, peek, select, openHere, dismiss, setActivity }`; the peek sheet supplies its own host, so nothing checks `id === "peek"`. `Presentation = "tiled" | "single"` maps to `Chrome { draggable, zoomable, tuckable, island }`. `frames(model, view, mode, size)` feeds one render loop; switching single view no longer remounts pane content.
7. **Kind policy (P1, store side).** `identity` (undefined: scratch, never deduplicated), `transient` (closes quietly when its object is already open; receives Recent, isOpen, KindIcon and titleFor) and `recordable` (Recent) replace `SCRATCH`, every kind-name check and the `autorun` exception. Presets build refs with each kind's `ref()`.
8. **Deleted.** The Ark divider adapter (its setting, palette command, top-bar tag, ghost CSS and adapter types) and `react-resizable-panels`; `dropLabel`, `minAlong`, `allPaneKinds`, `lastA`, `nearestDivider().sign`, `usePaneKindsVersion`, the `useDataLayer` re-export (callers use `src/data/react`), `pane/tuck.ts`, two activity components (one `Activity`, with `data-shape` on the shelf shapes), the duplicate Palette/Chooser combobox (`ListDialog`), and the duplicate direction tables.
9. **CSS.** `affordances.css` was loaded before `styles.css`, so equal-specificity ties went to `styles.css`; the merge keeps the values that actually rendered. `data-theme` is always the resolved theme, so dark is written once (plus the `.pk` remap, now on shared tokens). Geometry tokens (`--gap`, `--topbar-h`, `--status-h`, `--switcher-h`) come from `tokens.ts`. Dead rules removed: `.placeholder*`, `.status-sep`, `.status-warn`, `.activity-done`, `.ra-done`, `.drag-chip span`, the unreachable divider focus ring.
10. **Test hooks.** `data-testid` on the drag chip, divider preview and status main; `data-zoomed` on the zoomed pane's section; `data-shape` on shelf activity shapes. Settings focuses the first theme radio on open (the adapter radios it used to focus are gone).

## 17 Nov 2026: curated workspaces (loan review)

- **Two control models, one engine.** Data Studio keeps full per-pane control. A curated workspace (`ui/profile.ts`, first one `src/review/`) moves layout control to the top bar: arrangement (Review / Focus), a toggle per supporting pane, the investigation with "Back to review", and Reset.
- **Roles.** Arrangement panes carry `role` and `priority` (primary | supporting) on the `PaneNode`. A supporting pane has a single "hide" button, and close or tuck on it also hides it. The primary pane has no dismiss at all. Panes without a role were opened by following links; they are free (tuck, close, move) and carry a sand tint and an "Opened" tag (Settings: tint or none).
- **Hide is a third overlay** (`overlay.hidden`), beside tucks and folds. There is no slot and no tab, the tree is untouched, and showing the pane restores its exact rect.
- **Fold priority.** When room runs out, supporting panes give way first, but only those whose fold actually frees room. If yielding can't make room, nothing yields and the old rule applies. The primary pane folds last. Panes without priority behave exactly as before.
- **Placement.** Panes opened from a role pane go after the whole arrangement (`openBeside(..., place)`), so the investigation is one region at the right.
- **Three layers of layout state.**
  - The arrangement is the product's.
  - Adjustments (hand-set sizes and hidden roles) belong to the person: they are saved per arrangement in localStorage, and Reset drops them.
  - The link carries content only: `?app=review&arr=&item=&open=…`, with no `l=`. The same link opens in each reader's own layout.
- **Permission.** "Viewing as loan officer" makes links peek instead of opening beside (lab setting; in a product it would be set by the user's role).
- **Known limit:** at 1440, the arrangement plus one opened pane fits. A second opened pane folds into a tab group with a role pane, which mixes the two regions. This is still to be decided.

## 17 Nov 2026: curated pages, Single and Multiplexed (supersedes the top-bar toggles above)

- **Why.** Review and Focus differed only in which panes were hidden, so they duplicated the pane toggles (and maximise). A familiar tab strip already says which view is on screen. Letting it show more than one view gives splitting without a second set of controls.
- **The page.** Queue at the left, the application's header, then tabs: Overview, Application, Borrower, Loan history, Group, Field officer. Overview is the designed page: one section per question, each leading to its tab.
- **Two modes, the person's choice** (top bar):
  - **Single (default)** shows one view, chosen from the tabs; its pane has no visible header, since the tab names it. Links peek.
  - **Multiplexed** turns the tabs into a palette of views. You can drag a tab into the panes (an edge places it beside, the centre adds it to that tab group), ⌥-click a tab to open it beside the view in use, or click it to bring it on screen. Each view exists once, and closing one sends it back to the tabs. Tab marks: focused (accent underline), on screen (light underline and dot), behind another tab (dashed), not on screen (plain).
- **Getting between the modes:**
  - The first switch to Multiplexed starts from Overview's sections as panes (Application, Borrower, Loan history). Overview itself stays in the tabs.
  - Switching to Single keeps the multiplexed layout exactly, opened panes included, and switching back restores it.
  - Dragging a tab out of Single switches mode for you.
- **What is whose.** The mode and the multiplexed layout belong to the person (saved on this device; opened panes are not saved). A link carries the item, the view in use and the opened panes (`?app=review&item=&tab=&open=`). A link with opened panes opens in Multiplexed, in the reader's own layout (or the design).
- **Investigation.** In Multiplexed, following a link opens a sand-tinted "Opened" pane after the layout. Back to review returns to the layout exactly as it was before the first link, unless the views were rearranged in the meantime. ⌘Z reopens the opened panes.
- **Role permission.** A loan officer works in Single only, and links peek.
- **Engine changes:**
  - Hiding a tab of a group first lifts it out beside the group.
  - A fix: a hidden pane's minimum size no longer counted toward the room needed. Before the fix, any hidden pane could fold panes that had room.
- **Removed:** arrangements, pane toggles, per-arrangement adjustments (`state/adjustments.ts`), and the queue as a pane.

## 17 Nov 2026: layout stability (one rule for every action)

- **Problem.** Clicking a tab moved things in three ways:
  - the tab strip itself shifted, because a dot appeared and disappeared;
  - a view that wasn't on screen was inserted into the layout, shrinking or folding everything else;
  - where that view landed couldn't be seen in advance.
- **Rule.** Every op declares a geometry class in `POLICY` (`state/apply.ts`):
  - **focus**: nothing moves;
  - **swap**: what a slot shows changes, and every rect stays the same;
  - **reshape**: rects change, and only for deliberate gestures (drag, open beside, close, reset, following a link);
  - **direct**: rects follow the pointer (divider drags).

  A single action can upgrade its class with `geometry` (another application that also closes the opened panes is a reshape).

- **Enforced.** In development, `apply()` compares the rects on screen before and after every focus or swap op, and reports a breach (`console.error`, or the store's `unstable` callback). `src/ui/stability.test.ts` drives every tab click, choosing another application, and Data Studio tab and focus changes, in both modes. An e2e test checks pane and tab positions around tab clicks.
- **A tab click is never a reshape.**
  - Single: the one view is swapped.
  - Multiplexed:
    - a view on screen is focused;
    - a view behind another tab is chosen in its group;
    - a view not on screen takes the exact slot and size of the view in use (`core.replace`), and that view goes back to the tabs.
  - Adding a view is always a deliberate gesture: drag, or ⌥-click. Holding ⌥ over a tab previews where it would open.
- **Reshapes are visible.** Panes slide to their new place in 180ms, and dividers wait until they land. With reduced motion, panes move instantly; the e2e suite runs with reduced motion so it reads end positions.
- **Tab marks never take space.** Focused, on screen, behind another tab and not on screen are shown by underline and colour only.
- **Engine.** `replace(current, incoming)` swaps positions and keeps each position's size, tab slot and fold, tuck and hidden records. It reports `reshaped` when the incoming view can't fit the slot (its minimum is too large); the action then counts as a reshape and says why.
- **Following a link in Multiplexed (18 Nov, design review).**
  - One object, one pane. A link to a record that is already a view on the page goes to that view instead of opening a copy. "Already" means the same record (table and id), whichever kind shows it: kinds declare an `object` type (`record`, `related`), and the loan review's kinds inherit it. Going there follows the tab-click rules: focus on screen, choose its tab if behind another, if off screen, placed beside the pane the link is in, because following a link never takes away the pane you followed it from (unlike a tab click, which swaps in place). A link to an opened pane already on screen focuses that pane.
  - Nothing the person placed gives way to an opened pane. Every view in the multiplexed layout stays (`core.open(..., { yields: false })`). Short of room, only the opened pane gives: it opens as a tab of its source, in the source's slot at its size, shown and focused, and the announcement says so. If even that tab needs more room than the slot has, views go back to the page tabs (as below); none folds. This replaces the "known limit" above: an opened pane never folds a view into its tab group.
- **Placing a view (⌥-click, drag).** A view never folds into a tab group, because that would repeat page tabs inside a pane. Only opened panes form in-pane tabs, and an in-pane tab strip lists a page view only while it is the shown tab; the page tabs reach it otherwise. Exception (18 Nov): a group of two or more page views lists each of them. Only a centre drop ("Add as tab") makes one, so you asked for those tabs; hiding all but the shown one made the drop look like a replace. Views the layout folds into a group are still listed only while shown. When there is no room, the least recently used views (supporting before primary, never the target or the view placed) go back to the page tabs, and the announcement names them. A view that frees enough room on its own goes first. A resize still folds as before.
- **The ⌥ preview is the commit.** `besidePreview` and `openTabBeside` run one pure placement (`beside()` → `placeRole`). The preview draws the new view's real rect, a fainter outline at each view that moves, and the views that would go back to the tabs.
- **Fold announcements** ("folded into tabs: not enough room") are only for a change of room (a resize). An action that folds something says so in its own message.

## 18 Nov 2026: tabs: made by you vs made by the layout

- **One distinction.** A pane can be a tab for three reasons, but a person only needs to know whether it will come back by itself.
  - **Made by you:** a tab you merged or opened, or one you tucked. It stays until you change it. A tucked tab keeps its "Put back" button (restores its slot).
  - **Made by the layout:** _folded_, because the window ran out of room. It returns to its own place when there is room. Nothing to do.
- **Model.** `Tab` in `workspace/frames.ts` carries `tucked` and `folded` (never both; `folded` comes from `resolved.shelf`). Wording lives in `pane/tabState.ts` and is shared by the strip, the overflow menu and the shelf.
- **How folded shows (shape, not colour alone).** A trailing segment after a hairline; italic title; a fold icon in every folded tab; tooltip "Folded: not enough room · returns when there's space"; `aria-description` "Folded: returns when there's room". Marks use `--text-3` (at least 3:1 against the pane in light and dark, WCAG 1.4.11). Tucked keeps its dashed underline, now `--text-3`, and a visible Put back button.
- **Stability.** The Put back button and the fold icon reserve their space, so a tab's width does not change on hover or state. Tabs have a 72-200px width, an ellipsis, and the full title as tooltip and accessible name.
- **Overflow.** When tabs don't fit, a "+N" button ends the strip (N = tabs out of view) and opens a menu of every tab with the same marks. Arrow keys, Home/End, Enter, Esc (focus returns to the button). The chosen tab is shown and scrolled into view; the active tab is always visible. Keys are handled inside the menu only.
- **Shelf.** Lists tucked panes (by home, with Put back) and folded panes (a "Folded:" segment, dotted chips with the fold icon, no Put back). Past three folded panes, one "N folded" chip opens a menu of them: they come back on their own, so they don't earn a row of chips.
- **Edges.** A strip with tabs past an edge fades that edge (a mask, so it works on any header background), as the shelf does. Italic titles get 2px so the last letter isn't clipped.
- **Loan review.** Page views never fold into groups, so no folded marks or page-tab repeats appear there; the overflow menu serves opened panes only.
- **Fix.** The inert wrapper of a bare pane's header no longer sizes the strip (`display: contents`); before, strips grew wider than their pane and were clipped.

## 18 Nov 2026: linked detail follows the list

- **Problem (design review).** In a list → detail chain (orders → order 1), J/K moved the list's row but not the detail; only an open peek followed. Updating the detail took ⌥↵ on every row. With a detail open, Space slid a peek sheet over it: two answers to one question.
- **Model.** Following is a property of the link, on the pane: `linkedTo` (opened from) plus `follows: true` (shows that pane's selection). A pinned detail (`pinned: true`) keeps its object. At most one follower per source and kind. URL key `f`.
- **Core.** `follower(layout, source, kind)`, `follow(layout, view, source, ref, ctx)` (replace the follower's object in place: same node, slot and size), `setFollows(layout, id, on)` (unpinning one pins the previous follower), `selectionLink`. `open(..., { fromSelection })`: opening the source's selected item makes a follower, or a pinned detail when one already follows. A plain link (an FK cell) never reuses a follower or a pinned pane. Closing the source drops `linkedTo` and `follows`.
- **Rules.**
  - A detail follows when the list's selection rests for 150ms (`FOLLOW_MS`), so holding J doesn't fetch every row. Op `follow`: geometry swap, URL history replaced (Back skips the rows passed through). Focus stays in the list.
  - ⌥↵ (or a row's open button) on the row the following detail shows pins that detail in place: keep it, browse on. The next ⌥↵ makes a new follower from there, so comparing is "pin this one, keep going". Within the follow delay, opening the row shows it in the follower at once. Never a second copy of one row (superseded 18 Nov: "opens a second, pinned detail" left two panes on the same row). A row's open button selects the row first, so what it opens follows. The header's Pin toggle ("Following" / "Pinned", `aria-pressed`) switches; unpinning catches up with the selection.
  - Space with a following detail of that kind on screen shows the row there, at once. No detail, or none on screen (folded, behind a tab, tucked): the peek sheet.
  - A filter that removes the followed row: the detail keeps it, with "Not in the current results of orders". Only said when the whole result is loaded; tables keep the selection on the same row (not index) across filter and sort.
  - A failed load shows the detail's own error state; it keeps following.
  - The loan review is unchanged: its views have roles and no selection links; an opened pane follows only when it was opened from a list's selected row.
- **Timing is declared.** A change can carry `defer: { key, ms, run }`; the store runs the latest per key later against the state then. No timers inside actions.
- **Announcements.** One polite "Showing order 5" when the detail settles, not one per row.

## 18 Nov 2026: Pane sizing: minimum, comfortable, max

- **Problem (design review).** Data Studio's table, record and related panes needed 480px, so at 1440 table + record + record (1452px with gaps, 1428 available) folded the third pane by 24px while the record left on screen was 834px wide and used a third of it. `preferredWidth`/`maxWidth` were declared but the fit step ignored the first and treated the second as a hard cap that left a void. Content did not use its room either: table columns stayed at natural width beside a white field, and record amounts sat at the far edge away from their labels.
- **Contract (`PaneKind`, `definePaneKind`).** Three widths, each with one job:
  - `minWidth`: the narrowest the content works at once it adapts. The only fold threshold: a pane folds into a tab when the minimums of what is shown do not fit, never because it would be below comfortable.
  - `comfortableWidth` (default: min): where spare space takes the pane first.
  - `maxWidth` (default: none): the widest the content usefully uses. **Soft:** spare space past it goes to siblings that can use it; when every sibling is at its max the pane grows on, so a split never shows a void (founder review, 17 Nov), and the content holds its measure. A divider drag may pass it. Replaces the unused `preferredWidth` and the old hard-cap meaning of `maxWidth` (no kind used either).
- **The share rule** (`geometry/shares.ts`, `"flex"` mode), for a split none of whose children the person has sized: each child starts at its minimum; spare space brings children up to comfortable, evenly (comfort is a need; weight does not favour anyone yet); then up to their max, in proportion to weight; then past it, in proportion to weight. Fixed px children keep their length (shrinking toward their minimum when room runs out) and grow only when no weighted child can. With no comfortable or max declared this is exactly the old weighted rule, so kinds that declare nothing (the loan review's views, the launcher) lay out as before.
  - **Person-sized splits** (`"weights"` mode): any child `userSized` (a divider drag) and the split keeps exact proportions; comfortable and max are ignored. A divider reset hands the split back to the share rule.
  - **Nesting.** A row needs and can use the sum of its children; a column what its widest needs and what any child can use. A tab group (a stack, a fold) needs its widest tab's minimum and is measured as its home (a stack's first tab, the pane a fold formed around), so choosing a tab never resizes it and folded tables do not turn a record's slot into a table's.
  - Pure and deterministic: a function of the layout and the room only.
- **Stability.** Under the share rule a slot's width follows what it shows, so a swap op (setRef, swap, centre-drop swap, replace) can change widths: a record shown where a launcher was stops at its measure. `fit/hold.ts` `holdGeometry(before, after, ctx)`: when the rects would change, every split whose children would move keeps the lengths it had as px-unit weights (as a divider drag stores them: moved children `userSized`, the others re-expressed, `base` kept for reset). It applies only when the hold restores every rect exactly; a minimum that forces a change stays a reshape. Filling a placeholder (an object chosen in a launcher) is not a swap: it's a reshape, `setRef(..., { hold: false })`, so the object settles to its own measure. A pane added to a split with sized children (px-unit weights from a drag or a hold) gets the mean of their weights, a fair share, not a weight of 1 beside lengths (`tree.balance`). Focus and tab choice never change measures, so they never move anything.
- **Data Studio widths** (min / comfortable / max): table 440 / 560 / -, related 360 / 480 / -, audit 360 / 480 / -, record 360 / 440 / 600, structure 380 / 440 / 720, query 400 / 560 / -, ER 400 / 560 / -, chart 360 / 480 / -, catalog 240 / - / 320, launcher 320 (unchanged). The table keeps 440, not 400: at 1920 the stress preset otherwise packs five slots at bare minimums; at 440 it shows four with room (table 530, records 440, related 480). Results: 1280 table + 2 records at 440 / 408 / 408; 1440 at 536 / 440 / 440 (nothing folded, was a fold by 24px); 1920 order chain at 781 / 558 / 558 (the preset's 1.4 weight shares the room past comfortable).
- **Pane content contract.** A pane's content either fills it (grids, charts, diagrams) or sits at a stated maximum measure aligned to the pane's start edge, with the pane's background beyond; it never stretches a form across the room or leaves an accidental field. Applied:
  - **Record.** Fields at a 600px measure: a fixed 136px label column (112px under 420px), values left-aligned beside it; amounts right-aligned in one shared 10ch slot right after the label, so they line up with each other near their labels. Related records read as link then count. From 880px (alone, or with nothing beside it that can use the room) the fields flow into two columns, top to bottom, up to 1200px. Container queries on the record body, as in the loan review's views.
  - **Table (and related, audit).** Chosen: text columns share the width beyond the grid's natural width, up to twice their own; ids and numbers stay tight under their right-aligned headers. Past that the grid holds its measure, and header, rows and the open-beside action end at a ruled right edge. Rejected: stretching every column (a status 600px from its total, rows hard to follow across) and rules running to the pane's edge past the last column (reads as a missing column, the original white field with lines in it).
- **Tests.** `layout-core/test/sizing.test.ts` (1440 fits three, records capped, lists absorb, fold only below min, person-sized untouched and reset, tab stability, swap and setRef holds, purity) and new cases in `shares.test.ts`. Changed with reasons: three resolve/divider cases expected a hard `maxWidth` (a lone pane at 200 in 1000; a drag stopped at 600); two shares cases (a px size cut by a hard max); two review-placement cases used a Data Studio record as the "too wide" pane and now use a table (min 440), since a record needs 360. `e2e/divider.spec.ts`: the table's clamp is 440, and End now grows orders past its start (the records start above their minimum).

## 2026-11-18 · Keyboard: content first, one ⌘K prefix, a keymap per store

Research, sources and the full table: `docs/research/keyboard-shortcuts.md`. Code: `src/ui/commands/` (`keymap.ts`, `keyboard.ts`, `format.ts`, `regions.ts`).

- **The ladder.** (1) Modal states first, in the capture phase and only while active: a chord's second step, resize mode (arrows, Enter, Esc), and a pointer drag (Esc cancels it). (2) The focused content: it claims a key with `preventDefault()` or by stopping propagation. Single character keys, ⌘Z/Ctrl+Z, Enter, Space and the first Esc are content's. `data-pane-keys="content"` keeps every key except F6 and ⇧F6. (3) The pane layer, on `window` in the bubble phase: the keymap, then the Esc ladder (peek, then maximise). An open dialog owns the keyboard, except ⌘K.
- **⌘K / Ctrl+K opens the palette and starts a chord.** A second key with Mod still held runs a command and closes the palette (⌘K ⌘M maximise). Any other key goes to the palette's search. There is no timeout. This follows VS Code and Zed, and vscode.dev ships the same chords in every browser. Direct chords: ⌘K, ⌘\ (split right), F6 and ⇧F6. Everything else is ⌘K + ⌘(key): arrows focus, ⇧arrows move, M maximise, [ tuck, ] put back, R resize mode, ⌫ close, Z restore closed pane (also the Undo toast), \ split down, G add to tabs, ⇧G move out of tabs. Removed: every ⌥⌘ chord (Chrome tab switching, the toolbar cycle, DevTools, macOS minimise-all; and on Windows it became Ctrl+Alt, which is AltGr), ⌥1–9 (Linux tab switching; it types characters on a Mac; "Focus pane N" is now palette-only), ⇧⌘↵, and ⌘Z.
- **Keymap API.** `createUiStore({ keymap: { "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }, keymapOptions: { platform } })`. `DEFAULT_KEYMAP` is exported `as const`. There are no module globals: tooltips, the status line, the palette, Settings (new "Keyboard" list) and toasts all read `store.keymap.label(id)`. That prints ⌘ and ⌥ on a Mac and Ctrl+ and Alt+ elsewhere. `createKeymap` refuses a single character key (WCAG 2.1.4) and sequences longer than two. Matching uses `code` for letters, digits and punctuation, and `key` for named keys.
- **J/K.** Character keys act only while their own list has focus: grids, the catalog, the review queue. List keys ignore ⌘, Ctrl and Alt. F6 now visits panes, then the shelf, then host regions marked `data-pane-region` (the review queue), so moving from a grid to the queue is one key.
- **Pane kinds.** Removed the blanket `stopPropagation` from the SQL editor and the grid's column filters, so ⌘K and F6 work there. Content hints are printed per platform (`keyHint("Alt+Enter")`, `altClick()`).

## 18 Nov 2026 · Jali packaging, step 1: one workspace is one store, with nothing shared

- **Pane kinds belong to a store.** `createPaneKinds(defs)` makes a registry; `createUiStore({ kinds, profile })` takes it. The module-level kind map, its version counter and `registerPaneKind`, `registerProfile` and `getProfile` are gone. Actions read `x.env` (kinds and profile) from their snapshot; the model carries `env` too; components use `useEnv()`, `useProfile()` and `useTitleOf()`. Data Studio exports `dataStudioKinds`, the loan review `loanReviewKinds` and `loanReview`; `src/lab.ts` puts both in one store (`createLabStore`), for the app and the tests.
- **Keys stay in their workspace.** `installKeyboard(store, { root })`: given a root, the store takes only keys from inside it, plus keys with nothing focused while it was the last place focus or a click landed. Without a root it takes every key on the page, as before (the lab: one workspace per page).
- **The DOM is scoped too.** `store.dom` holds the workspace's id prefix (`createUiStore({ id })`, default `"jali"`) and its root element (the app shell attaches itself). Pane DOM ids are `<id>-pane-<pane>`, and focus, the divider drag, the drag chip, F6 regions and the shelf look inside the root only.
- **Why:** a package must allow two workspaces on one page, one inside a dialog, and tests that never share a registry. Tested by "two workspaces on one page" (`keyboard.test.ts`).
- **Still global, on purpose:** the body class during a drag (one pointer drags one thing at a time), and the theme on `<html>` (it moves to the token layer, step 4). The URL and saved settings are step 2.

## 18 Nov 2026 · Jali packaging, step 2: the address and saved settings are ports

- **Location port** (`ui/ports.ts`): `search()`, `href()`, `navigate(search, "push" | "replace")`, `subscribe(fn)`. `browserLocation()` is the default; `memoryLocation()` is for tests, server rendering and a workspace that must not touch the page's address. A router app passes a three-function adapter (React Router and TanStack Router sketches are in the file), so the router stays the one owner of the address. `createUrlSync({ location, storage, prefix })`.
- **Jali writes only its own params.** Every other param is the host's and is kept (as before; now tested). `prefix` names a second workspace's params apart (`b.l`, `b.zoom`), so two workspaces can share one address.
- **Storage port**: `get` and `set`, never throwing. `browserStorage("pane-lab")` is the default, with the same keys as before, so nothing saved is lost. Settings, a curated page's mode and layout, and the copy of an unreadable link all go through it. `createUiStore({ storage })`.
- **"Copy link"** asks the store (`store.href()`), which asks the URL port, not `window.location`.
- **Not changed, and open:** Data Studio's link still carries the whole layout with sizes, so a link reopens exactly (the founder's round-trip rule from 17 Nov). The 17 Nov review suggests links carry objects only, with sizes personal, as the loan review already does. For the package, that is an option of the URL sync, not a fixed rule.

## 18 Nov 2026 · Jali packaging, step 3: the pane contract carries unsaved work, own state and commands

- **Unsaved work is never lost without asking.** Content reports it with `setUnsaved(what | null)`. The check lives in one place, `apply()`: a change that would remove a pane with unsaved work, or show another object in it, is held and the person is asked ("Discard unsaved changes?", Keep editing focused, Esc keeps). Discard applies the held change exactly. That covers close, close others, presets, Back and Forward, a new item in a curated page and any action added later, with no per-action code. Moving, tabbing, folding, tucking and hiding never ask: every pane in the layout stays mounted, so its work stays too. Leaving the page with unsaved work triggers the browser's own prompt.
- **A following detail with unsaved work keeps its object** and says so ("The detail stays put: it has …"). It moves on its own while the person browses the list; a question on each row would be worse than a detail that waits.
- **A pane's own state:** `usePaneState(key, initial)` (`ui/pane/usePaneState.ts`). The workspace keeps it through folds, tabs and reloads (the storage port, saved 400ms after the last change) and drops it when the pane is gone for good (not while an undo could bring it back) or shows another object. JSON values only. In the peek sheet it is plain React state.
- **Pane commands:** `setCommands([...])` lists commands in ⌘K, first and under the pane's title, while the pane is focused. `keys` is a label only; the content handles its own keys (content first). They go with the pane.
- **First user:** the query pane. Its draft SQL is pane state, an edit that has not run is unsaved work, and it adds "Run query" and "Chart this result" to ⌘K.

## 18 Nov 2026 · Jali packaging, step 4: the theme is tokens, a layer and a Tailwind bridge

- **No Tailwind inside Jali.** Its styles are plain CSS on `--jali-*` tokens. Most of it is geometry the model computes; Tailwind would add a peer dependency and shut out apps without it. What makes Jali and Chakni look alike is a shared token contract, not a shared build tool.
- **`jali-theme.css`**: the default theme (Nil). The palette lives in `--jali-default-*`; the public `--jali-*` tokens read it and are declared on every theme scope (`:root`, `.light`, `.dark`, `[data-theme]`), all in `:where()`, so a host's declaration wins at any specificity. Dark follows the system, or a `.dark` or `[data-theme="dark"]` scope; `.light` keeps light (Chakni's selectors). Accent tints (`-weak`, `-mid`, `drop`, the focus ring) derive from `--jali-accent` with `color-mix` on each Jali root (`[data-jali]`), so a host retunes one colour, and a subtree with its own accent gets matching tints.
- **`jali-tailwind.css`**: points the tokens at the host's Tailwind theme, using Chakni's token names (`--color-primary`, `--color-card`, `--color-border`, `--radius-card`, …), each falling back to Jali's default for the theme in use. Plain CSS; no Tailwind build needed for the file itself.
- **The `jali` cascade layer.** Every workspace rule is in `@layer jali`. A host declares `@layer theme, base, jali, components, utilities;` and its utilities win over Jali without `!important`. Page resets go below it: the lab's globals moved from `base.css` to `app.css` in a `lab-base` layer, because an unlayered `button { font: inherit }` beat Jali's button font sizes (the parity check caught it).
- **rem** for type, spacing and boxes; px only for hairlines, rings and shadows. No layout code reads those sizes (the workspace's geometry is GAP and the bar heights, set from `tokens.ts`).
- **Parts carry state as attributes**: panes `data-pane`, `data-kind`, `data-focused`, `data-zoomed`; tabs `aria-selected`, `data-folded`, `data-tucked`; dividers `data-divider`; the drop preview `data-drop-zone`. A Tailwind app styles them with `data-[focused]:…`.
- **Proof:** screenshots of 6 states in light and dark (chains, query and chart, 10 panes, a drag, ⌘K, the loan review) are pixel-identical before and after (the one difference is a query's run time in ms). `e2e/theme.spec.ts`: a host token wins with no specificity and the tints follow; the bridge takes host tokens; with the bridge and no host token Jali keeps its dark default; a host rule on a part wins over Jali's layer.
- **The lab keeps its own names** (`--accent`, `--line`, …) as aliases in `tokens.css`, for the app styles in `src/panes` and `src/review`. Data Studio's pane palette (`.pk`) now reads Jali's neutrals; its dark-mode patch in `tokens.css` is gone, leaving three ramp steps and a few labels of its own per theme in `panes.css`.
- **For extraction:** class names are still generic (`.pane`, `.tab`, `.divider`) and will collide in a host app; the package prefixes them (`jali-…`).

## 18 Nov 2026 · Jali packaging, step 5: the active item is a shared shape, not a dependency

- **What "the active item" means:** the one item a list is on, its cursor (what J/K moves). Not the multi-select set and not DOM focus. That settles the review's "focus, selection and Quick Look are separate" collision: Chakni's Quick Look item and Jali's `select` are the same thing.
- **The shape is Chakni's Quick Look persistence port**: `{ itemId, write(itemId, "open" | "close" | "step") }`, returning `{ status: "accepted" }`. `src/contracts/active-item.ts` holds it, matching Chakni by shape (it is internal in Chakni today; the review recommends Chakni publish it, and then this file becomes that import).
- **Jali implements it for a pane:** `activeItemPort(store, pane, { toRef, idOf })` and `useActiveItemPort(...)` (`ui/pane/activeItem.ts`). `step` selects (the following detail follows once the cursor rests; an open sheet steps at once); `open` shows the item in the following detail if one is on screen, else a sheet; `close` shuts this list's sheet and keeps the cursor. A Chakni collection in a Jali pane passes the port as its Quick Look persistence, and the review's options B and C work with neither package importing the other.
- **Not built yet:** the Chakni side (a public port, and a collection that accepts one), and Chakni's docked rail (option A). Both are Chakni work.

## 19 Nov 2026 · Jali extraction, step 1: two packages in the lab's workspace

- **Where:** `packages/core` (`@jali/core`) and `packages/react` (`@jali/react`), in a pnpm workspace inside this repo, so the history of every file is kept (`git mv`) and the lab keeps working as their first consumer. The repo can be split out (or renamed `jali`) later without changing either package. The scope `@jali` is a working name until the npm scope is settled.
- **No build during development.** Each package's `exports` has a `source` condition pointing at `src/`; Vite (`resolve.conditions`) and TypeScript (`customConditions`) use it, so the lab runs the packages' source with HMR. The `dist` entries are for publishing (next step).
- **What went where.** Core: the layout model (`layout/`, was `src/layout-core`), the store and actions, commands and keymap, URL and storage ports, the DOM helpers (focus, ids, drag and divider pointer handling, which another framework's adapter would share), the pane-kind registry and the active-item port. React: every component, the hooks, `define.ts` (`definePaneKind`, `PaneComponentProps`, `RoleDef`, `WorkspaceProfile` with its rail and header) and the styles. The lab (`src/shell`) keeps its own top bar, status line, Sonner toasts and the Data Studio / Loan review switch: a host app has its own chrome.
- **Before the move**, two commits took the lab out of the engine: presets, the workspace's name and the viewers' names are store options (`createUiStore({ presets, preset, name })`, `profile.viewers`), and kind and profile definitions have a framework-free base (`PaneKindBase`, `RoleBase`, `ProfileBase`) that React extends.
- **Tests:** the engine tests that need real kinds run against the lab's (`src/tests`); the layout tests moved with the layout. One Vitest run covers both.
- **Entry points are broad for now** (`export *` from each module, except the actions, which run through `store.actions`). Choosing the public API, and checking it with an API report, is the publishing step.

## 19 Nov 2026 · Jali extraction, step 2: every class Jali renders is prefixed `jali-`

- **Why:** generic names (`.pane`, `.tab`, `.divider`, `.palette`) collide with a host app's own CSS. All 110 classes Jali styles, and the hooks it renders, are now `jali-*`. State modifiers stay short (`is-focused`, `is-active`): they only ever appear on a `jali-` element. The body classes a drag sets are prefixed too (`jali-pane-dragging`, `jali-resizing`), since the body is the host's.
- **What Jali renders, Jali styles.** The curated page's layout, its tabs, the ⌥ preview ghost and the Single-mode header rule were in the lab's `review.css`; they are now `@jali/react`'s `page.css`. So is the screen-reader-only class the announcer needs (`jali-sr-only`). The lab keeps what its profile renders into the page (the queue rail, the application header, the phone queue sheet).
- **The host's chrome is the host's.** Keeping DOM focus on the focused pane no longer names the lab's top bar or Sonner: it leaves focus alone anywhere outside the workspace root, and inside it on anything marked `data-jali-chrome` (the lab's top bar has it).
- **Proof:** the parity screenshots (6 states, light and dark) are pixel-identical, apart from a query's run time.

## 19 Nov 2026 · Jali extraction, step 3: what a link carries about sizes is the app's choice

- **The option:** `createUrlSync({ sizes })`. `"link"` writes the whole layout, so a link reopens exactly (the founder's round-trip rule of 17 Nov); Data Studio passes it, so the lab behaves as before. `"local"`, the default for new apps, writes the layout as designed: every divider the person moved is put back (its `base`, else an equal share), and the sizes they dragged are kept on their device, keyed by the layout's structure (ids, types and what each pane shows; the last 12 layouts). Their own reloads and Back/Forward keep them; a colleague opening the link gets the designed proportions.
- **Why "local" by default:** a link is usually sent to say "look at this", and the sender's 1440px proportions are rarely right on the reader's screen. It also matches a curated page, whose link already carries only its content. An app whose layouts are the work itself (Data Studio) opts into `"link"`.
- **Tests:** `src/tests/ports.test.ts`, both modes.

## 19 Nov 2026 · Jali extraction, step 4: the curated page is a "page", not a "review"

- **Why:** "review" was the lab's app (the loan review) leaking into the engine's API: `state.review`, `enterReview`, `ReviewPage`, command ids `review.*`, `?app=review`. A host's curated page may be a customer, a case or a ticket.
- **Now:** `state.page` (`PageState`, which now carries its profile's id), `actions.openPage` / `leavePage` / `backToPage` / `resetPage`, `<CuratedPage>` and `<PageBar>`, command ids `page.open`, `page.leave`, `page.back`, `page.reset`, `page.single`, `page.multi`, `page.as_full`, `page.as_limited`. Files: `actions/page.ts`, `state/page-prefs.ts`, `chrome/PageBar.tsx`.
- **Links** write `?page=<profile id>` (`?page=loan-review&item=4&tab=application`); the old `?app=review` still opens. The saved mode and layout keep their storage key (`review:<id>`), so nothing saved is lost.
- **Wording** names the page: "Back to Loan review", "Open Loan review", from the profile's `name`.

## 19 Nov 2026 · Jali extraction, step 5: public entry points, a build, and the shortest start

- **Entry points.** `@jali/core` exports the API an app uses (the layout types and `layout` namespace, `createPaneKinds`, `createUiStore`, `boot`/`startUi`, `createUrlSync` and the ports, commands and keymap, the active-item port). `@jali/core/adapter` exports everything, for framework adapters; `@jali/react` imports only that. `@jali/react` exports `<Jali>`, `<JaliView>`, `definePaneKind`, the hooks and the parts. `src/tests/public-api.test.ts` lists both exactly, so a change to either is made on purpose.
- **`<Jali store>`** provides the store, renders the workspace root (`data-jali`, where DOM lookups stay) and the dialogs every workspace has; `overlays` renders things that must sit outside the root (a toaster). **`<JaliView>`** is the panes, or the curated page while one is open. The lab's App is now `<Jali><TopBar /><JaliView /><StatusLine /></Jali>`.
- **Shorter start-up.** DOM focus defaults to Jali's own helper (`focusPane: null` turns it off), and the store keeps its URL sync, so `boot(store)` and `startUi(store)` need nothing else. Passing the sync to both still works.
- **Build:** tsdown per package (ESM, `.d.ts`, source maps). `@jali/react`'s `dist/styles.css` inlines its imports; `theme.css` and `tailwind.css` ship beside it. Core is 55 kB gzipped unminified, React 21 kB. `pnpm build:packages`.
- **`examples/minimal`**: the smallest app on the public API alone (one kind, two panes, the default theme). `vp dev examples/minimal` serves it on :5310.

## 19 Nov 2026 · Jali's default neutrals are stone (founder)

- The default theme's neutrals move from cool zinc to the brand's stone: canvas `#EFEAE2`, warm surfaces, borders and text, and warm-tinted shadows and scrims; dark mode a warm near-black (`#0E0D0B`). Nil stays the only accent. Values are the ones the docs site was already using, so the docs and a default Jali app now match.
- Contrast: subtle text `#685F54` on the surface is above 4.5:1; control borders `#8A8274` above 3:1. Theme and accessibility specs pass.

## 19 Nov 2026 · Icons are Phosphor (founder)

- Jali switches from Lucide to Phosphor (`@phosphor-icons/react`), the set Chakni uses, so an app with both shows one icon style. Done on branch jali-phosphor, with the lab and the docs.
- **Dependency:** `@jali/react` lists `@phosphor-icons/react` (^2.1.10) as a peer dependency, as Chakni does, plus a dev dependency to build; `vp pack` never bundles it. The lab and the docs site depend on it directly. Install line: `npm install @jali/core @jali/react @phosphor-icons/react`.
- **Names:** the `*Icon` exports (`XIcon`, `FileTextIcon`); the bare names are deprecated in 2.1.
- **Weight:** regular everywhere. Phosphor's regular stroke is 16 on a 256 grid, 1/16 of the box, the same ratio as Lucide's 1.5 on 24, so the 1.5px places match exactly and the 1.75 and 2 places are a little lighter, which reads as one consistent weight. Two exceptions: the 8px error cross in a pane's activity dot is bold (regular would be half a pixel), and the docs' GitHub mark is fill (a brand mark, solid as before).
- **Sizes:** kept as they were (12 to 20px); side-by-side shots at 1440 and 390, light and dark, showed the same optical size, so no icon was resized.
- **Jali passes `size` and `aria-hidden` (and sometimes `className`), never `weight`.** A host's `IconContext` can change the weight of Jali's icons along with its own. A kind's `icon` is a `JaliIcon`, `ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>`: any Phosphor icon fits, `strokeWidth` is gone.
- **Default kind icon:** Phosphor's `SquareIcon`.
- **Hosts bring their own icons (Data Studio's request).** Every icon Jali draws in its own chrome has a name (`JaliIconName`, 27: close, maximise, restore, tuck, putBack, newTab, more, current, fold, grip, follow, pin, activityError, defaultKind, pinBeside, openFull, addToTabs, singleView, splitView, back, reset, dropLeft/Right/Top/Bottom, dropSwap, dropTab), and `<JaliRoot icons>` / `<JaliProvider icons>` take a map of them, read through context (`useJaliIcons()`), so every part uses the host's. Why on `<JaliRoot>` and not `createJali`: icons are React components and `@jali/core` has no React; the workspace model doesn't care how chrome is drawn. Jali renders no settings, palette or switcher button of its own (those are the host's), so they have no names.
- **Three entries keep Phosphor out of a host that doesn't want it.** `@jali/react` is zero-config: `icons` is `Partial<JaliIcons>` over `phosphorIcons`. `@jali/react/bare` exports the same names and never imports Phosphor: `icons` is a required, complete `JaliIcons`, enforced by the types. `@jali/react/icons` exports `phosphorIcons`, imported icon by icon (`@phosphor-icons/react/X`). `@phosphor-icons/react` is an optional peer (`peerDependenciesMeta`). `packages/react/src/bundle.test.ts` builds `examples/bare-icons` (the bare entry with its own SVG icons) from source, and from dist when built, and checks the bundle has no Phosphor in it; `examples/minimal` is the control that must.
- **Mapping (Lucide → Phosphor):** Columns2 → SquareSplitHorizontal, Rows2 → Rows, RotateCcw → ArrowCounterClockwise, Undo2 → ArrowUUpLeft, Maximize → CornersOut, Maximize2 / Minimize2 → ArrowsOutSimple / ArrowsInSimple, PanelRightOpen → SidebarSimple (mirrored, panel on the right), FoldHorizontal → ArrowsInLineHorizontal, Layers → Stack, Link2 → LinkSimpleHorizontal, Pin → PushPin, GripHorizontal → DotsSix, ChevronDown → CaretDown, ArrowLeftRight → ArrowsLeftRight, SquarePlus → PlusSquare, History → ClockCounterClockwise, BarChart3 → ChartBar, Search → MagnifyingGlass, Table2 → Table, TerminalSquare → TerminalWindow, ListTree → TreeView, Network → TreeStructure, LayoutDashboard → Layout, LayoutGrid → SquaresFour, AlertTriangle and TriangleExclamationPoint → Warning, OctagonAlert → WarningOctagon, ListFilter → FunnelSimple, UserRound / UsersRound → User / Users, Settings → GearSix, EyeOff → EyeSlash, MousePointerClick → CursorClick, MoveHorizontal → ArrowsHorizontal, LifeBuoy → Lifebuoy, ClipboardList → ClipboardText, StickyNote → Note, NotebookPen → NotePencil, Pencil → PencilSimple, CornerDownLeft → ArrowElbowDownLeft, Menu → List, Activity → Pulse, ListOrdered → ListNumbers, WrapText → ArrowUDownLeft; the rest keep their names (X, Check, Plus, Minus, Square, ArrowUp/Down/Left/Right, ArrowUpRight, FileText, File, Database, GitFork, Info, Briefcase, Phone, Command, Archive, Hand, ShoppingCart, Copy, Hash, Monitor, Moon, Sun, Receipt, Lightbulb, Link). The docs' hand-drawn GitHub mark is now Phosphor's `GithubLogoIcon`.

## 19 Nov 2026 · ⇧⌘↵ stays (founder)

- `pane.zoom` keeps ⇧⌘↵ beside ⌘K ⌘M. This supersedes the 18 Nov keyboard entry that removed it; the code already binds it.

## 19 Nov 2026 · Jali's API, simplified: define a pane, create a workspace, render it

- **Why:** the shortest app took four calls in a fixed order (`createPaneKinds`, `createUiStore`, `boot`, `startUi`), a kind repeated its name in a `ref` factory nothing called, refs were hand-written `{ kind, params }` (182 times in the repo), params needed casts (`Number(ref.params.id)`, 31 times), and layouts were JSON literals (47). The goal: code an agent or a person reads once and gets right.
- **Pane kinds:** `definePane("note", { params: { id: Number }, title, width: { min }, height: { min }, Component })`. The result is callable: `note({ id: 2 })` is the ref, typed (a missing or wrongly typed param is a type error). `params` names how each param is read back from a link; undeclared params stay plain values. Sizes nest (`width.min/comfortable/max`, `height.min`) and default to 240×160. Renamed: `object` → `shows`, `recordable` → `inRecent`, `heavy` → `holdWhileResizing`; `identity: () => undefined` → `scratch: true` (scratch kinds stay out of Recent unless `inRecent: true`, as the query pane sets). `ref` is gone from kinds.
- **The component:** gets `params` (typed) instead of `ref`, so React 19's ref-as-prop needs no warning. Props are only what a pane shows and does (`params`, `node`, `paused`, `focused`, `inPeek`, `openBeside`, `openHere`, `peek`, `select`, `dismiss`). Reporting moved to hooks: `useActivity`, `useUnsaved(dirty && "…")`, `useCommands([...])` (pass every render; re-listed only when a label changes; `run` is always the latest), and `usePane()` for components below the kind's.
- **The launcher is an option,** not a magic kind name: `createWorkspace({ launcher })`. It is marked transient and reads `useLauncher()` (`recent`, `isOpen`, `titleOf`). Without one, Split and "New tab here" are not offered (commands refused, no "+"), instead of opening "Unknown pane kind".
- **Layouts:** `row`, `column`, `tabs`, `pane(ref, options)` in `@jali/core`; ids are named after what a node holds unless given. Presets take `layout` (a value or a function); a page's `build` may return a builder's result.
- **One call:** `createWorkspace({ panes, layout | presets, ... })` boots (reads the address, fits, focuses) before returning. `url` defaults to on in a browser and takes options (`{ prefix, sizes, location }`) or `false`; `storage` takes a prefix string; the address uses the workspace's storage. `<Jali workspace>` starts the listeners on mount and stops them on unmount (`workspace.start()` without React), and renders `<JaliView />` when it has no children. New options: `keys: "workspace"` (two workspaces on a page now each get saving, Back and Forward and the unload prompt, which they lost by skipping `startUi`), `pageTheme: false` (a workspace inside a page with its own theme leaves `data-theme` alone), `size`, `moveFocus`.
- **Names:** `useWorkspace`, `useWorkspaceState`, `useWorkspaceModel`, `useTheme`, `WorkspaceProvider`, `<Panes>` (was `Workspace`), `definePage` / `Page` / `PageView` (were `WorkspaceProfile` / `RoleDef`), `WorkspaceState` (was `UiState`). New actions replace raw state writes: `openPalette`, `closePalette`, `openSettings`, `closeSettings`, `changeSettings`.
- **Public surface:** `@jali/core` exports 19 values (was 34); the engine's helpers (`boot`, `startUi`, `createUiStore`, `createPaneKinds`, `createUrlSync`, `installKeyboard`, `focusPane`, the DOM ids, `PALETTE_ID`, …) are in `@jali/core/adapter`. `@jali/react` drops `useShortcutSuffix`, `useActions`, `useEnv`, `useProfile`, `useTitleOf` and `PaneIdContext`.
- **Unchanged:** behaviour, URLs, keys, visuals and stored data. The lab keeps every pane id its links and saved layouts name. Engine tests still run on an unbooted store (`createLabStore`); new tests cover `definePane`, the builders, `createWorkspace` and the hooks (`src/tests/define-pane.test.tsx`, `layout/test/build.test.ts`).

## 19 Nov 2026 · More than one workspace on a page, and start-up that leaves the host alone

- **A workspace's dialogs are part of it.** `<Jali>` renders the palette, settings, chooser, confirmation and live region in a `<div data-jali-layer>` (`display: contents`) that the store knows as `store.dom.layer()`. A keyboard scoped to a root takes keys from there too, so ⌘K then ⌘M finishes when keys are scoped. Dialog ids and radio names carry the store's `id`.
- **`startUi(store, { root, url, theme })`.** `root` scopes the keyboard (pass `store.dom.root`) and skips writing tokens on `<html>`; `theme: false` never writes `data-theme`, for a host with its own theme. A UrlSync as the second argument still works. `KeyboardScope.root` is `() => ParentNode | null`, so `store.dom.root` fits without a wrapper.
- **Storage defaults follow the id.** `createUiStore` saves under `browserStorage(id)` (still `"jali"` by default, so nothing saved is lost); a URL sync's broken-link key carries its `prefix`, as its sizes key already did.
- **Tokens are Jali's.** `applyTokens` writes `--jali-gap` and `--jali-switcher-h`; the CSS carries the same values as fallbacks. The top bar and status heights were the lab's and live in the lab's CSS; `initialArea` no longer subtracts them (the first measure corrects the guess). `GAP` is public, for measuring a workspace from outside.
- **Host commands:** `createUiStore({ commands })` adds an app's own commands after Jali's in ⌘K; `keymap` binds them like any other. A repeated Jali id keeps Jali's. `Command.group` takes a host's own group name.
- **Mounting never takes focus.** The workspace pulls focus off the body into its focused pane only after the person has been in it (focus or a press in its root or dialogs); a docs page with three workspaces, or a workspace below the fold, keeps its place. `keepPaneFocus(dom, id, { fromBody })` for adapters.
- **The shelf's phone rule** reads `[data-jali]`, not a host `.app` class.

## 19 Nov 2026 · Packages pass: layout behaviour, CSS, types and text (FINDINGS-FROM-DOCS)

- **The launcher is a store option** (finding 4): `createUiStore({ launcher })`, default `"launcher"`. With `null` or an unregistered kind, split and "New tab here" are refused (their commands are greyed out in ⌘K) and tab strips show no "+", so the smallest app never opens an unknown kind.
- **`PaneKindBase.ref` is optional** (16): Jali never called it; it stays for an app's own link building.
- **Never a second copy of a row** (5): opening the selected row when a detail of the same list already shows it (a pinned one, with no follower) reveals that detail; focus stays in the list.
- **Item ids may be strings** (13): `ItemId = string | number`. `ProfileBase<R, I>` and `WorkspaceProfile<I>` carry the id type (default any id; `WorkspaceProfile` defaults to `any` so existing number-typed rails compile). A link holds the item as text; `openPage` gives it back in the type of `firstItem`, so a numeric profile still gets numbers. `PageRead.item` is the text, or undefined.
- **A page-only app** (14): `createUiStore({ kinds, profile })` with no presets and no `initial.layout` starts with its page open on `firstItem`. "Open <workspace>" (`page.leave`) is refused when there are no presets, since there is no free workspace to go to.
- **`StackNode.origin` is optional** (15): hand-written stacks leave it out; validation and links accept both.
- **Unsaved work clears itself** (17): the pane host calls `setUnsaved(null)` when a pane's content unmounts or its kind changes. A kind only reports and clears it while mounted. (`setCommands(null)` on unmount is still the kind's; the same treatment would suit it.)
- **`Settings.showStats` is the lab's** (36): it left `Settings` and `DEFAULT_SETTINGS`; a saved value is dropped on load. `<Jali settingsExtra>` (and `<SettingsPanel>` children) adds a host's own fieldsets to the Settings panel; the lab's "Show fetch stats" lives there, saved under `lab:show-stats`.
- **A negative fit size clamps** (26): `resolve` and `refit` treat a negative width or height as zero instead of throwing; non-finite sizes and a negative gap still throw.
- **Dragged weights average 1** (31): after a divider drag, the weights it set are scaled to average 1 (`0.53`, `1.47`), not pixels (`320`, `880`). Not rounded, so the geometry is exactly the same; a link may carry longer numbers.
- **The theme is in the `jali` layer** (32): `jali-theme.css` and `jali-tailwind.css` now sit in `@layer jali` like the rest, so a host's `--jali-*` in a layer after `jali` (or unlayered) wins. A token set in a layer before `jali` (`base`, Tailwind's `theme`) loses; the docs say where to set them.
- **Palette tokens Jali does not read stay** (33): `--jali-brand`, `--jali-done`, `--jali-accent-soft` and `--jali-shadow-raised` are part of the palette a host themes with (the lab and the docs read them); dropping them would break hosts for no gain. Dialogs and menus now use `--jali-surface-raised`, as the theming guide already said (in dark mode they sit a step lighter than panes).
- **Types in public signatures are public** (34): `@jali/core` exports `DndState`, `ConfirmState`, `ChooserState`, `PagePrefs`, `UndoEntry`, `Change`, `OpenPage`, `Group`, `ShelfEntry`, `Chord`, `KeySequence` and `ResolvedStack` (type-only), each with a reference entry.

## 19 Nov 2026 · A curated page's modes are Single view and Split view (founder)

- "Multiplexed" read as tmux or HTTP/2 to developers (naming research, 19 Nov), and "side by side" implies two. The modes are now **Single view** and **Split view**: `ViewMode` is `"single" | "split"`, `PagePrefs.split`, command `page.split`, and the words in the bar, the messages and the docs. A choice and layout saved as `"multi"` still load.

## 19 Nov 2026 · Merge: the simplified API and the packages pass

- **The simplified API's shape wins** wherever both lines designed the same thing. The two entries above ("More than one workspace…", "Packages pass…") describe their fixes on `createUiStore` and `startUi`; as merged, they are reached through `createWorkspace` and `<Jali workspace>`:
  - **Start-up:** `startUi(store, url?, { keys, pageTheme })` stays (adapter only). The pass's `{ root, url, theme }` options are dropped; their fixes are kept: with `keys.root`, no tokens are written on `<html>`, and `pageTheme: false` is the theme opt-out. Apps say `createWorkspace({ keys: "workspace", pageTheme: false })`.
  - **The launcher** is `createWorkspace({ launcher: kind })` with no default kind name; the pass's `launcher: string | null` (default `"launcher"`), `launcherRef` and its refusal message are dropped. Without a launcher, split and "New tab here" are refused silently and the tab strip has no "+".
  - **Unsaved work** clears through `useUnsaved` on unmount; the pass's pane-host effect is dropped as a duplicate. `PaneKindBase.ref` is gone, so "`ref` is optional" (16) has nothing left to say.
  - **Host commands** are `createWorkspace({ commands })`, passed through to the store. **Storage** defaults to `browserStorage(id)` in both `createUiStore` and `createWorkspace`.
  - **A page-only app** is `createWorkspace({ panes, page })` with no layout or presets; a page's `build` returns a `LayoutInput`, converted with `toLayout`.
  - **Item ids:** `definePage` has two overloads, `Page<number>` and `Page<string>`, so `firstItem: 1` gives a numeric page without a literal type; `Page<I>` carries the id type to `Rail` and `Header`.
- **Public surface:** `@jali/core` exports 20 values: the simplified API's 19 and `GAP` (finding 28). The pass's type exports (34) are in `@jali/core`, except `StartUiOptions`, since `startUi` is in `/adapter` (as `StartOptions`). `HideRefusal` loses `"tab"`; `Settings.showStats` is gone, with `<Jali settingsExtra>`.
- **Tests:** the pass's tests are ported to `createWorkspace`, `definePane` and `<Jali workspace>` (`minimal-store`, `pane-body`, `workspaces`, `active-item-hook`); `<Jali>` now starts its workspace on mount, so the keys test uses `keys: "workspace"` rather than installing keyboards by hand.

## 19 Nov 2026 · The toolchain is Vite+ 1.7.0

- **What:** `vp migrate` (1.7.0, run with `pnpm dlx` so the global `vp` 1.5.1 played no part). `vite-plus`, `vite` (as `@voidzero-dev/vite-plus-core`) and `vitest` are pinned in the pnpm catalog (`pnpm-workspace.yaml`) with overrides, so every package gets the same versions. Scripts call `vp dev`, `vp build`, `vp test` and `vp pack`; config and test files import from `vite-plus` and `vite-plus/test`; inline Vite plugins are wrapped in `lazyPlugins`, so `vp check`, lint and fmt can read configs without loading them.
- **Packages:** each `tsdown.config.ts` moved into a `pack` block in the package's `vite.config.ts` (the migrator leaves this step by hand), and `tsdown` is no longer a direct dependency. `vp pack` builds the same `dist` as before.
- **Left out on purpose:** the migrator's agent files, editor config and git hooks (`--no-agent --no-editor --no-hooks`). They change how people work here rather than the build; add them with `vp migrate --full` or `vp config` if wanted. No `packageManager` pin either (`vp env pin` adds one).
- **`.claude/worktrees/` is ignored,** because `vp check` reads every file git does not ignore, and agents keep other checkouts of this repo there.
- **Formatting and lint:** the repo is formatted by `vp fmt` (Oxfmt defaults, width 100), except MDX, which the formatter breaks (it collapsed a fenced block inside `<Tab>`), so `fmt.ignorePatterns` leaves it as written. `vp lint` is clean; docs samples may show a value on its own line (`no-unused-expressions` is off under `apps/docs/src/samples`). `vp check` passes.

## 19 Nov 2026 · The API says "Jali", not "workspace"

- **Why:** in enterprise apps "workspace" is usually a tenant (Slack, Notion, Azure), a project or a desktop area, so a host often has its own `Workspace` type, `useWorkspace()` hook and `/workspaces` routes. `import { useWorkspace } from "@jali/react"` beside the app's own is a collision, and an agent can't tell the two apart. Every domain word tried clashes somewhere (desk: service desks; board: Jira; surface, canvas, shell, stage, layout), and an app never has its own `Jali`.
- **Renamed:** `createWorkspace` → `createJali` (file `create-jali.ts`), `Workspace` → `Jali`, `WorkspaceOptions` → `JaliOptions`, `WorkspaceState` → `JaliState`, `WorkspaceModel` → `JaliModel`, `WorkspaceDom` → `JaliDom`, `useWorkspace` / `useWorkspaceState` / `useWorkspaceModel` → `useJali` / `useJaliState` / `useJaliModel`, `WorkspaceProvider` → `JaliProvider` (prop `jali`). The component that frees the name: `<Jali workspace>` → `<JaliRoot jali>` (`JaliRootProps`, file `JaliRoot.tsx`). `keys: "workspace"` → `keys: "scoped"`. Code calls its instance `jali`.
- **Unchanged:** "workspace" stays the word for the idea in prose and UI copy (the free workspace's default `name` is still "Workspace"), `<JaliView>`, `<Panes>`, internal names (`UiStore`, `createUiStore`), behaviour, URLs and stored data.

## 19 Nov 2026 · Jali shares ⌘K and the keyboard with its host

- **Why:** Jali will mostly live inside enterprise apps, and most already have a ⌘K menu and shortcuts. Before this, a host's ⌘K that called `preventDefault()` also silenced every ⌘K chord of Jali's (15 commands), one that didn't opened two menus, `<Jali>` always rendered its palette, moving Jali off ⌘K meant overriding 15 bindings, and a clash was found only when someone pressed the key.
- **One menu, the host's:** `createJali({ palette: false })`: `<JaliRoot>` renders no palette and `palette.toggle` is unbound (unless `keymap` binds it). `listCommands(jali)` (core) and `useJaliCommands()` (React) give the host's menu what the palette lists: the focused pane's own commands first, then the workspace's and the host's `commands`, each `{ key, id?, title, group, keys, disabled, reason?, run }`. The palette itself now reads `listCommands`, so the two never differ.
- **`keyPrefix`** (`keymapOptions.prefix`): the first step of every default two-step binding and the palette's key, default "Mod+K". Host-written `keymap` bindings are used as written. With `palette: false` the prefix still starts a chord.
- **`reservedKeys`** (`keymapOptions.reserved`): keys the host uses. Any binding that is one, or starts with one, is dropped and reported to `onInvalid` when the workspace is made.
- **Who gets a key** is documented (Commands and keys): a handler that calls `preventDefault()` first keeps the key (Jali listens on `window`, bubble phase); a chord's second step is Jali's (capture phase); with `keys: "scoped"` keys outside the panes are never Jali's. `keys` keeps its default, `"page"`, so nothing changes for existing apps; the guide recommends `"scoped"` where the panes are one region among many.
- **Tests:** `src/tests/host-integration.test.tsx`.

## 19 Nov 2026 · Params say what they hold: optional params, flags, fixed choices

- **Why:** a declared param lied when it was missing (`{ id: Number }` typed `id: number`, but a link or a hand-written ref could leave it out and it was `undefined` at runtime), there was no optional param, values could only be `string | number`, and a component written apart from its kind repeated the params' type by hand.
- **Declaring:** `params: { id: Number, tab: optional(String), internal: optional(Boolean), status: optional(oneOf("open", "closed")) }` gives `{ id: number; tab?: string; internal?: boolean; status?: "open" | "closed" }` to the component, `title`, the other options and the ref maker. `optional` and `oneOf` are exported from `@jali/core` and `@jali/react`. `{ id: Number }` is unchanged. A kind that declares `params` takes no others in its ref maker (a type error); a link carrying undeclared params still opens, and they reach the component as plain values. An optional param given as `undefined` is left out of the ref.
- **A component apart from its kind:** declare the params first, `const orderParams = { id: Number }`, and type it `PaneProps<typeof orderParams>`: `PaneProps` reads a declaration as its params' type and takes a plain type as before (`PaneProps<{ id: number }>`). `ParamsOf<typeof orderParams>` names the type alone. The docs samples and the lab's record, query and chart panes use this.
- **Values:** `ParamValue` is `string | number | boolean`. `Number` now reads only text that is a finite number (`""` and `"abc"` can't be read; before, they gave `0` and `NaN`). `Boolean` reads `true`/`false`, `"true"`/`"false"` and `1`/`0`, so the lab's old `autorun: 1` links still run their query; the preset now writes `autorun: true`. `oneOf` compares as text, so `oneOf(10, 25)` reads `"25"` as `25`. A function type says it can't read a value by returning `undefined` or `NaN`, or by throwing.
- **On the wire:** `?l=` and saved layouts are JSON, which carries a flag as it is; the validator accepts booleans and still rejects lists, objects, `null` and non-finite numbers. `peek=` and `open=` write a flag as `!true` / `!false`, as numbers are written `#42`, so both come back exactly (`sameRef` compares with `===`). Text values are written as before, so every older peek decodes to the same ref; only a text value that is exactly `!true` or `!false` now reads as a flag.
- **A ref its kind can't read** (a required param missing, a value its type can't read) never reaches the component. Decided per place, so a link breaks the way it already broke for other faults: a `?l=` link or saved layout holding one fails validation (`PaneKind.checkParams`, from `kinds.registry()`) and opens as a broken link; a peek or a page's `open=` pane with one is dropped, as `open=` already dropped unknown kinds; a ref the app's own code opens shows "This order can't open. Its link has no "id"." in its pane, like an unknown kind. Its title is the kind's name and it stays out of Recent. `kinds.problems(ref)` lists what is wrong (`ParamProblem`); `parseParams` is the reader behind it (adapter).
- **Left out:** lists, because the peek text codec splits on `~` and `=` with no escaping, so a list (or text holding those characters) has no clean form there, and arrays would make identity and validation order-sensitive. Dates, because a `Date` is not JSON: an ISO date as `String` is read by the component.
- **The lab:** query `{ sql: optional(String), autorun: optional(Boolean) }`; record and review-record `{ table: String, id }` with a lab reader that keeps a number a number and anything else text, so their links are unchanged; the `?? ""` guards in table, structure and ER titles are gone, since `table` is now really there.
- **Tests:** `src/tests/params.test.tsx` (types with `@ts-expect-error`, reading, the error state, each codec with each new type, links written before the change); the codec test's "flag is invalid" case became list, object and `null`.

## 19 Nov 2026 · A failing or loading pane stays in its pane, and a pane can name itself from its data

- **Why:** a pane's component had no error boundary and no `<Suspense>` around it. One pane that threw blanked every pane, and one that suspended reached the host's boundary (or none). Titles came only from params, so a customer pane said "Customer 12" when its data said "Acme Ltd".
- **Boundaries per pane** (`packages/react/src/pane/PaneBoundary.tsx`): `PaneBody` wraps each kind's component, in panes and in the peek sheet, in an error boundary around a Suspense boundary. The boundary sits inside `PaneBody`'s context, so the failed and loading states report through the same pane host as the content.
- **Failed state:** "<kind title> could not be shown.", the error's message, Retry (remounts the component under a new key) and Close (`actions.close`, or closes the peek). `role="alert"`. Activity `"error"`, back to `"idle"` when it goes. Retry is a pane command (`pane:retry`, "Retry"), so ⌘K lists it for the focused failed pane; the button is in the tab order. A new ref clears a failure (the boundary compares `JSON.stringify(ref)`) without remounting healthy content, so a following detail keeps its state as before.
- **`createJali({ onPaneError(error, { pane, ref }) })`**, `PaneErrorInfo` in `@jali/core`; `pane` is null in the peek sheet. Default `console.error` in development, like `onUnstable`. It reaches the store as `env.onPaneError`.
- **Loading:** `definePane({ Loading })`, a component like `Component` that gets the same `PaneProps`. Default: a muted "Loading…" (`role="status"`). Activity `"loading"` while it shows, `"idle"` when it goes (the content's own `useActivity` runs after, so it wins).
- **`useTitle(title)`** sets `UiState.titles[id]` through `actions.setTitle(id, title | null)`. `titleOf(env, node, titles)` and `JaliModel.title(id)` read it, so the header, tab, overflow menu, shelf, switcher, ⌘K group and every announcement use it; the model's cache keys on `titles`. A curated page's role label still wins, and the data title is shown beside it where the kind's title was. Plain state, not saved. `prunePanes` drops a title when its pane goes or shows another object (like unsaved work), and the hook sets it again for the new object; the hook also clears it on unmount. The peek sheet's host ignores it.
- **`setActivity` ignores a pane that is gone,** so a loading or failed state that unmounts with its pane leaves no record behind.
- **Tests:** `src/tests/pane-boundary.test.tsx`. A render that suspends needs an awaited `act()` under React 19.

## 19 Nov 2026 · Right to left: the same layout, mirrored

- **Why:** enterprise apps ship in Arabic, Hebrew, Persian and Urdu. Before this a row always started at the left, the arrows on a divider moved it the wrong way for the reading order, and the styles used physical sides.
- **Direction comes from the page.** The workspace reads the computed `direction` where `<Panes>` renders (so `<html dir="rtl">`, or any ancestor's `dir`, is enough), guesses the page's before it mounts, and reads it again when any `dir` on the page changes (a language switch). It is `JaliState.dir` and `LayoutContext.dir`. Why the page: the host already says its direction once, for its own text and controls; a second setting could disagree with it. `createJali({ dir: "ltr" | "rtl" })` fixes it for a workspace that must differ from its page, or for tests and the server; `<JaliRoot>` then sets `dir` on its root and its dialog layer, so the styles agree with the geometry.
- **Geometry is mirrored, the tree is not.** `resolve` lays the tree out as before and, right to left, mirrors every pane and divider rect across the workspace. Rects stay screen coordinates, so everything that reads them (focus by direction, hit testing, drop zones, the drag line, the frames' `left`) works unchanged. The tree, the fit, the URL and stored data are the same in both directions: a link opened in a right-to-left app shows the mirror of the left-to-right layout. Reading order (F6, "Focus next pane", "Focus pane 1–9", "Swap with next pane") is tree order, so it now goes from the right.
- **Left and right mean the screen.** Every left and right a person meets (keys, command titles, drop zones, announcements) is a side of the screen, so the English text is exactly as before and correct in both directions: "Focus pane left" goes to the pane on the left of the screen, a drop on a pane's left edge puts the pane on its left, "Split right" opens on the right, "Move out of tabs" puts the tab on the right of its group. We chose this over start/end words because "left" is what a person sees and what the arrow key says. The layout operations take tree sides (`"left"` before, `"right"` after); actions convert (`treeSide`, `layout/geometry/direction.ts`). Placements with no side in their words follow the reading order: opening beside, a pinned peek, ⌥-click on a page tab and following a link all open after, which right to left is on the left.
- **Resizing:** a divider's value is still its first neighbour's size, which right to left is the pane on the right. A pointer drag, the arrows on a focused divider and the arrows in resize mode all move the divider the way they point (`nudgeDivider`'s delta is towards the screen's right); resize mode prefers the divider on the side the pane's row ends on.
- **Chrome:** tab strips, the shelf, the page tabs and the pane switcher take ← as forward right to left; their edge fades and "reveal the active tab" read `scrollLeft` from the start of the strip; the tab overflow menu lines up with its button's end side and carries `dir` (it is portalled to the body); the drag chip sits on the pointer's left; the peek sheet sits at the inline end (the left) and slides in from there.
- **Styles:** sides that follow reading order are logical (`padding-inline`, `margin-inline-start`, `inset-inline-end`, `float: inline-start`, `text-align: end`). Centred and geometric parts (divider lines and handles, the frames, the drop zones) stay physical. Left to right every computed value is the same as before.
- **Left open:** directional icons (`PanelRightOpen` on "Pin beside") are not mirrored, since the icon set is being replaced; the lab's own chrome (top bar, status line) is the lab's and only partly mirrors.
- **Tests:** `layout/test/rtl.test.ts` (resolve, sides, focus, move, drop and divider geometry), `src/tests/rtl.test.ts` (the workspace: drops, put back, split, unmerge, keyboard resize, reading order) and `e2e/rtl.spec.ts` (the lab at `?dir=rtl`: order and link, F6 and focus keys, a divider drag, arrow resize, a drop, the peek).

## 19 Nov 2026 · Every word Jali shows or says can be replaced (messages)

- **Why:** Jali is aimed at enterprise apps, and English-only text was a blocker. Announcements lived in `state/messages.ts`, but command titles, dialogs, tabs, the shelf, the page bar, settings and every aria-label and tooltip were hard-coded in the React parts and the registry.
- **One object, by area:** `createJali({ messages })` takes `MessageOverrides`, any keys of `Messages` grouped by area: `announcements`, `toasts`, `drop`, `commands`, `commandGroups`, `keys`, `palette`, `chooser`, `confirmDiscard`, `settings`, `tabs`, `shelf`, `pane`, `peek`, `workspace`, `page`. Keys left out stay English. `en` (exported) is the English set; `Messages` is its type, so a full translation missing a key, or a misspelt one, is a type error. `jali.messages` is the resolved set (`en` itself when none are given); React reads it there.
- **Values, not pieces:** a message that needs values is a function (`closed(pane)`, `discarded(count)`, `moved(pane, edge)`, `commands.focusDirection(direction)`, with `ScreenDirection` "left" | "right" | "up" | "down"; `Direction` is RTL's "ltr" | "rtl"), so a translation chooses word order and plurals. Two sentences said together go through `announcements.both(first, then)`. Bold parts take `bold` and return their parts in order (`confirmDiscard.item(pane, what, bold)`, `chooser.heading`, `page.investigating`); React renders them with `<b>`. Command titles are keyed by what the command does (`commands.close`), not its id.
- **Key words:** `formatKeys`, `formatChord` and `keyHint` take an optional `KeyWords` (Ctrl, Alt, Shift, Esc, Space, the arrows); the keymap prints with the workspace's `messages.keys` (`keymapOptions.words`), and `keymap.format(seq)` is new. Mac symbols stay.
- **Moved:** 274 messages. 81 announcements and 4 toasts were already in `messages.ts` (now `en.announcements`, plus `both`, and `en.toasts`); 36 command titles (a few cover a family: the four directions, panes 1 to 9, presets) and 7 groups came from `commands/registry.ts`; the other 145 came from 19 files of `@jali/react` and the core's own defaults ("Workspace", "pane", "investigator" and "viewer", the chooser's hints, a divider's "+N more", key names). `pane/tabState.ts` is gone (its four strings are in `en.tabs`). The adapter's `msg` and `toasts` exports are gone; `dropText` stays, with an optional `words`.
- **Unchanged:** the English output, byte for byte (the unit and browser suites pass unchanged), behaviour, URLs, keys and stored data.
- **Tests:** `src/tests/messages.test.tsx`: overrides reach an announcement, command titles and groups, the palette and the discard dialog; English is unchanged; type tests for missing and misspelt keys; and a scan (Oxc parser) that fails on JSX text or a read attribute (aria-label, title, placeholder, …) with words in `packages/react/src`, or a sentence literal in the core's actions, commands, start-up and store.
- **Merged with params, resilience, RTL and the icon switch:** their new words are messages too: `pane.cantOpen(kind)` and `pane.cantOpenHelp(problems)` (a ref its kind can't read), `pane.failed(pane)`, `pane.retry`, `pane.retryCommand` (the failed pane's ⌘K command) and `pane.closeFailed`, and `pane.loadingContent` ("Loading…"). RTL and the icons added no words. RTL's `Direction` ("ltr" | "rtl") keeps its name; the screen direction a command id names is `ScreenDirection` ("left" | "right" | "up" | "down"), since it stays the screen's in both reading directions and names move commands as well as focus ones. The hard-coded scan now also catches a `title` written in an object (a pane command's).

## 19 Nov 2026 · The instance: a small `Jali`, one action convention, results, events, layout save and restore, and a host close guard

- **Why (API review):** `Jali` was the internal store (20 members, `set()` could write any state); `jali.actions` mixed 63 entries, app calls and engine steps alike; signatures disagreed (`openBeside(source, ref)` but `peek(ref, source?)`) and took only node ids, which builders name and which shift; a refused action told screen readers why and the caller nothing; `subscribe` said nothing about what changed; saving a layout meant `get().layout` and an action named `arrive`; and about 95 types were public.
- **`Jali` is a frozen facade** with 13 members: `actions`, `get`, `subscribe`, `model`, `on`, `getLayout`, `setLayout`, `keymap`, `env`, `messages`, `href`, `onToast`, `start` (`state/instance.ts`). The store keeps everything else and is reached with `storeOf(jali)` from `@jali/core/adapter` (a WeakMap, so it is type-safe and nothing extra is on the object). `<JaliRoot>`, `<JaliProvider>` and `useJali()` take and give the facade; React's parts use the store. `get()` is typed as `JaliState`, the fields an app reads (`layout`, `page`, `view`, `presetId`, `peekSource`, `resizeMode`, `settings`, `activity`, `selection`, `recent`, `area`, `dir`, `unsaved`, `paletteOpen`, `settingsOpen`); the engine's (`dnd`, `confirm`, `undoStack`, `paneCommands`, …) are adapter-only. Host commands' `run` gets the `Jali`; Jali's own command checks are `CommandDef` (adapter). `listCommands`, `runCommand`, `copyLink`, `activeItemPort` take a `Jali`.
- **Actions are split.** `jali.actions` (`actions/public.ts`, `JaliActions`) has the 37 an app calls: focus, toggleZoom, openBeside, openHere, peek, closePeek, select, setPinned, split, newTab, addTab, close, closeOthers, undo, remove, tuck, putBack, reveal, move, swapWithNext, mergeInto, unmerge, preset, resetLayout, openPage, leavePage, setMode, openTab, activate, backToPage, resetPage, setCanInvestigate, openPalette, closePalette, openSettings, closeSettings, changeSettings. Each is a thin wrapper over the engine's own step. The 63 steps stay as `storeOf(jali).actions` (unchanged signatures, still returning the pane id), for adapters and engine tests.
- **One convention.** The pane comes first. Wherever an action takes a pane it takes a `PaneTarget` (`NodeId | ObjectRef`); a ref means the pane showing that object (the focused one if it does, else the first; scratch kinds match by exact ref). The pane is optional, meaning the focused one, only when nothing required follows it. What the action uses comes next; options last, in an object. Hence `peek(pane, ref)` and `closePeek()` (was `peek(ref | null, source?)`), `split(pane?, direction?)` (direction omitted: right for a wide pane, below for a tall one; replaces `splitAuto`), `move(pane, direction)` (was `moveDirection(dir, id?)`), `preset(id)` (an unknown id is `"not-found"`, no longer the first preset), `openPage({ item, tab })` (`OpenPageOptions`; the link-only fields stay internal).
- **Results.** Every public action and `setLayout` return `ActionResult = { ok: true, pane? } | Refusal`, `Refusal = { ok: false, reason, message?, settled? }`. `pane` is what it opened, else what it acted on. Both sides declare the other's fields as `undefined`, so `r.pane` and `r.reason` read without narrowing and the common path stays `jali.actions.close()`. `ok: true` also means "already so" (focusing the focused pane). Reasons (`RefusalReason`): `not-found`, `invalid`, `unavailable`, `single-view`, `not-allowed`, `last-pane`, `blocked`, `nothing-to-do`, `unsaved`, `kept`, `pending`. Each refusal step now carries its reason (`refuse(reason, msg?)`); `message` is the text announced, and announcements are exactly as before. A few silent `null`s that meant failure (split or new tab without a launcher, page actions without a page, an unknown view) became silent refusals with a reason; nothing they say or do changed. `apply()` returns the result: the last step's, or the first refusal among the steps.
- **Events.** `jali.on("open" | "close" | "focus" | "layout", handler)` returns the unsubscribe. The store gathers changes while a commit runs (`apply`, `set` and what they call) and tells them once when it ends, in the order close, open, focus, layout, by diffing the state before and after. So a multi-step action, a preset switch or Discard-then-change is one set of events, a drag tells only its drop, and a following detail tells once when it lands. `open` is a pane added or now showing another object (`previous`); `close` a pane that left the layout (tucked, folded and tabbed panes are still in it); `focus` the focused pane changed; `layout` the layout changed by a committed change, with `source: "action" | "address"` (Back, Forward, a link). A refit to a new window size or pane cap does not fire `layout`. A handler that throws is reported and does not stop the others.
- **Save and restore.** `getLayout()` is the layout on screen. `setLayout(input)` takes any `LayoutInput`, validates it against the kinds (`"invalid"` otherwise), keeps focus where it still exists, fits it to the room, leaves an open curated page as `leavePage` does (keeping its prefs), adds Recent, and pushes history (op `setLayout`: push, reshape, silent), so Back returns and the address stays in sync. Unsaved work and `beforeClose` guard it like a preset. A host saving per user listens for `"layout"` and passes the saved layout as `createJali({ layout })`; the address still wins at start, so shared links keep working. Documented in the Presets guide.
- **Host close guard (Data Studio):** `createJali({ beforeClose(request) })`, `BeforeClose = (r: CloseRequest) => boolean | Promise<boolean>`, `CloseRequest = { panes: { pane, ref }[], reason: "close" | "show" | "layout" | "address" }`. It plugs into `apply()` where the unsaved-work guard sits, and is asked for any layout change that removes panes or points them at another object: close, close others, back to page, a preset, `setLayout`, undo, page mode and item changes, Back and Forward, `openHere`, a following detail. It is not asked while `createJali` boots (the guard is installed after the first layout is in place) or for changes that remove nothing. `false` (or a throw or a rejection) keeps the panes: `reason: "kept"`, no events. A promise holds the change: `reason: "pending"` with `settled`; on yes the change is committed through `store.apply` (so events fire then) unless the layout changed meanwhile (then dropped, `"kept"`). **Order:** the host is asked first; after a yes, Jali's own "Discard unsaved changes?" still appears when a pane reports unsaved work (`useUnsaved`), and Discard does not ask the host again (`Change.allowed`). When the host keeps the panes on Back or Forward, the address is written back to what is on screen (replace).
- **Keeping in step with a host's documents (Data Studio, which called `apply({ op, layout, view })` with `layout.addTab`, `layout.close` and `layout.setRef`):** `addTab(pane, ref)` shows a ref as a new tab of the pane's group and focuses it (an object already open is shown instead, as everywhere: one object, one pane; announced "<title> opened"). `openHere(pane, ref)` is the in-place swap, and takes a ref or an id. `remove(pane)` is for an object the host closed elsewhere: no undo entry, toast or announcement, history replaced (op `remove`), and neither `beforeClose` nor the unsaved-work question runs, because the host made the decision and the object is gone. **The last pane** becomes the launcher (the workspace's own "choose what to show", which the person already knows from Split) rather than leaving an empty workspace, which the layout tree cannot represent; without a launcher it is refused with `"last-pane"`, and the host shows something else there with `openHere`. A curated page's views are the page's and are refused (`"unavailable"`). Tests in `instance.test.ts`.
- **Public types:** removed `UndoEntry`, `JaliDom`, `DndState`, `ConfirmState`, `ChooserState`, `Actions`, `OpenPage`, `PagePrefs`, `Snapshot`, `Outcome`, `Change` and the old `Refusal` (they stay in `/adapter`); added `JaliActions`, `PaneTarget`, `OpenPageOptions`, `ActionResult`, `Refusal`, `RefusalReason`, `JaliEvents`, `BeforeClose`, `CloseRequest`. Values are unchanged (21).
- **Merged with params, resilience, RTL, messages and Phosphor:** `setTitle` stays an engine step (`useTitle` reaches it through the store), not a public action. `JaliState` gains `dir`, which an app may read to lay out its own chrome; `titles` stays out, since `jali.model().title(id)` gives a pane's name with its data title. `jali.messages` is public: a host's own UI can use the resolved words in the same language. Every refusal takes its text from `say(x)` with its reason beside it (`refuse(reason, say(x).key)`); this work adds no new words (`addTab` says the existing `opened` and `alreadyOpen`; `remove`, `setLayout` and `beforeClose` are silent). Both `@jali/react` entries, the default and `bare`, take the public `Jali` in `<JaliRoot>` and `<JaliProvider>`.
- **Unchanged:** behaviour, URLs, keys, visuals, announcements and stored data. `jali.set({ area })` is gone from the docs' testing guide: a test makes a workspace with the `size` it needs. The lab's e2e dev hook (`window.__lab.actions`) exposes the store's steps. Tests: `src/tests/instance.test.ts` (convention, refs, results, each event, setLayout, beforeClose sync, later yes, later no, rejection, stale, order with the unsaved dialog, Back).

## 19 Nov 2026 · What an app ships of Jali, measured; `layout` tree-shakes

- **Measured:** `pnpm size` builds five apps in `scripts/size/` with `vp build` (production, against the packed `dist`, not the source condition), puts each package in a chunk of its own, and prints minified and gzipped KB per package. `--modules` lists which source files of `@jali/*` each app ships (the dist's source maps are fed to the app's build). Scenarios: **minimal** (one kind, no page, no launcher), **full** (curated page, presets, launcher, URL, host commands, hooks), **bare** (`examples/bare-icons`: `@jali/react/bare` with the host's icons), **headless** (`createJali` without React) and **layout** (the builders and the `layout` namespace only).
- **Numbers** (minified / gzipped KB, on the merged code, before → after):

  | scenario | @jali/core                   | @jali/react        | styles.css | Phosphor   |
  | -------- | ---------------------------- | ------------------ | ---------- | ---------- |
  | minimal  | 123.0 / 40.9 → same          | 39.6 / 12.2 → same | 36.0 / 6.6 | 45.7 / 8.9 |
  | full     | 123.6 / 41.1 → same          | 41.2 / 12.7 → same | 36.0 / 6.6 | 50.1 / 9.9 |
  | bare     | 123.0 / 40.9 → same          | 38.8 / 11.8 → same | 36.0 / 6.6 | none       |
  | headless | 113.2 / 37.6 → same          | –                  | –          | –          |
  | layout   | **37.5 / 12.6 → 24.8 / 8.7** | –                  | –          | –          |

- **`layout` was the leak.** Bundled, `export * as layout` becomes an object of getters (`__exportAll`) that no app bundler can tree-shake, so calling `layout.resolve` shipped every layout operation. `dist/layout.js` is now built as a file of its own and `index`/`adapter` re-export it as a real ES namespace (`import * as layout from "./layout.js"`), a small resolve plugin in `packages/core/vite.config.ts`. It is not in `exports`. The layout app now ships no store, keyboard, commands, URL or curated-page code; `pnpm size` fails if it does.
- **The shared chunk was not the problem.** Building `dist` unbundled (one file per module) gave the same app sizes within 0.2 KB: apps' bundlers tree-shake inside the shared chunk because the modules have no top-level side effects. The `dist` stays bundled: one entry file per subpath, tidy declarations.
- **Pure annotations** on the few top-level calls a bundler must otherwise keep: `isMac` and `PUNCT_LABEL` (format.ts), `createContext` (two) and `memo` (three) in React. They change nothing for `<JaliRoot>` apps; they let an app that imports only parts drop the rest.
- **Not minified, on purpose.** A minified `dist` made every app's bundle the same size (±0.1 KB: the app minifies anyway) and the tarballs only 3% smaller (maps and declarations dominate), while stack traces and reading `node_modules` get worse. Maps ship with `sourcesContent`, so they work without `src`.
- **CSS:** every rule in `styles.css` is used (the four "unused" classes are built from a value: `jali-activity-${a}`, `jali-divider-${axis}`). Not split: the curated page's rules are 0.8 KB gzipped of 6.6, and a split would change what an app imports.
- **Still shipped when unused, without an API change:** the curated page (`actions/page.ts`, about 9 KB minified, is woven into open and close, and `ACTIONS` holds every action) and the Settings dialog (`<JaliRoot settings>` is a runtime prop). Both would need the page or settings passed in as code rather than data.
- **Publishing:** `publishConfig.exports` drops the `source` condition (it pointed at `src`, which the tarball doesn't have), so a consumer resolving "source" no longer fails. Tarballs: `dist` (JS, maps, declarations, CSS), `README.md`, `package.json`. `@arethetypeswrong/cli` (esm-only): green for node16 and bundler on every entry (CSS excluded); a consumer installed from the tarballs type-checks with `moduleResolution` node16 and bundler (`skipLibCheck: false`) and imports in Node.
- **Left open:** `files` lists `LICENSE` but there is none (the site says "Licence to come"); `package.json` says Apache-2.0. `@jali/react`'s declarations name `UiStore`/`UiState` from `@jali/core/adapter` where `Jali`/`JaliState` are the public names (same types).
- **Budgets** (`scripts/size.mjs`, gzipped KB, about 10% headroom): minimal core 45, react 13.5, CSS 7.3, Phosphor 10; full 45, 14, 7.3, 11; bare 45, 13, 7.3, Phosphor 0; headless core 41.5; layout core 9.6.

## 19 Nov 2026 · What a host found: tabs that hold no controls, landmarks, sizing, tokens, pane attributes (Data Studio)

- **Why:** Data Studio, integrating Jali, found seven defects: axe's `nested-interactive` on every tab strip, two `<main>` landmarks and pane headers counted as banners, a `ReferenceError` without `ResizeObserver`, a workspace that collapsed to 0 high without a word, theme scopes that overrode the host's tokens, no way to mark a pane from its data, and a second React in linked installs.
- **Tabs hold no controls (APG tabs with deletable tabs).** Each tab sits in a `role="presentation"` wrapper (`.jali-tab-item`) with its close and put back buttons beside it (`.jali-tab-actions`), not inside it. The buttons are for the pointer: `tabindex="-1"`, labelled, and `aria-hidden`, because a tablist may own only tabs (axe `aria-required-children` fails on a button there, presentational wrapper or not). The tab says what they do instead: `aria-keyshortcuts="Delete Backspace"`, and `messages.tabs.description(reason, putBackKeys)` ("Tucked here. ⌘K ⌘] puts it back. Delete closes it."). Delete or Backspace (no modifier) on a focused tab runs the normal close, so unsaved work still asks; the put back command already acted on a focused tucked tab (`activeTabId`). Spacers inside the tab keep the buttons' room and the actions box copies the tab's underline box, so the tab is pixel for pixel as before (screenshots compared, left to right and right to left, with hover). The drag starts from the wrapper, so pressing a close button and dragging still drags the tab. The page tabs, the tab overflow menu and the shelf chips had no nesting. New: `e2e/axe.spec.ts` (`@axe-core/playwright`, a dev dependency of the lab: there was no axe-core to inject otherwise) over a strip with a tucked tab, the shelf, the palette and a curated page's tabs, plus a case that adds a button to a tab and must report `nested-interactive`. `label-content-name-mismatch` is disabled there: the follow toggle shows "Following" but is named "Pin <pane>", left for its own change.
- **Landmarks: `createJali({ landmark: "region" | "main" })`**, default `"region"`: the workspace is a `<section aria-label="Panes">`, and `"main"` makes it the page's `<main>`. On `createJali`, not `<JaliRoot>`, because `<Panes>` renders the element and a host composing the parts itself (no `<JaliRoot>`) must reach it too; it sits beside `dir` and `palette`, the other options that shape what is rendered. The default suits Jali inside an app with its own `<main>`, the common case. The lab and both examples are whole pages and pass `"main"`. Pane headers are `<div class="jali-pane-header">`.
- **No `ResizeObserver`:** `observeResize(el, onResize)` (adapter, `dom/resize.ts`) uses it when there is one and the window's `resize` event otherwise; the workspace, tab strips and the shelf use it.
- **Sizing:** `:where([data-jali])` is a flex column with `height: 100%`, and `.jali-workspace` (or `.jali-page`) is `flex: 1 1 0` under it, at no specificity in the `jali` layer. A host's rule in a later layer or none wins; one in a layer below `jali` loses, so the lab's app grid moved from `lab-base` to `lab` (the docs' live parts are in a later layer, the examples are unlayered). In development the workspace warns once at mount when it measures 0 high with a width (`clientWidth > 0 && clientHeight === 0`), which is a collapsed workspace and not jsdom or a hidden root.
- **Tokens: declared once, on the root; scopes switch only the defaults.** Every public `--jali-*` token is declared on `:where(:root)` as `var(--jali-default-*)`, and every default is `light-dark(light, dark)`. An unregistered custom property keeps `light-dark()` as written, so the browser picks the side where the token is used, by that element's `color-scheme`. Theme scopes now set only `color-scheme` (light on the root and in `.light` / `[data-theme="light"]`, dark under the system preference unless the root says light, and in `.dark` / `[data-theme="dark"]`), as they already did beside the palette. So nothing of Jali's sits between a host's token and the panes: a token on `:root`, any ancestor or the Jali root wins at any depth, and a `.dark` subtree still gets dark defaults. The tints are `light-dark()` pairs of `color-mix()` on the root, each Jali root and dialog, so they follow an accent set on a subtree or on the root itself. Rejected: reading `var(--jali-x, var(--jali-default-x))` in every rule with the public names left undeclared, because the lab, the docs and host stylesheets read the public names outside Jali. A difference: a host that sets `color-scheme` itself now decides Jali's palette, even against its own theme class. The Tailwind bridge still declares the tokens on every scope, so it follows a theme variable a `.dark` scope sets again; with it, theme through those variables. The docs' token page reads both sides of each pair. The theming guide's teal example is now four `light-dark()` lines on `:root`.
- **`usePaneAttributes(attributes: Record<\`data-${string}\`, string> | null | undefined)`** (@jali/react): `UiState.paneAttributes`, set by the engine step `setPaneAttributes(id, attrs | null)`(not on`jali.actions`), pruned with titles when a pane closes or shows another object, and cleared on unmount. Names that are not `data-_`, or that Jali's parts carry or look for (`data-pane`, `data-tab`, `data-chip`, `data-jali-_`, …), are dropped, so a host value can't confuse focus or drag code; on a section Jali's own attributes come after the host's anyway. They go on the pane's section, its tab in every strip (folded and tucked), the tab overflow menu item, its shelf chip and shelf menu item, its switcher entry, and the peek sheet while the peeked ref is one a pane with attributes shows. The peek sheet's own content can't set them (like `useTitle`). No styles.
- **Install:** the React README and the quickstart say that a `link:`, `file:` or `workspace:` install can bundle a second React, and to set `resolve.dedupe: ["react", "react-dom"]` (Vite) or alias them (webpack).
- **React's declarations name the public types** (asked for after the seven): every type `@jali/core` exports is imported from `@jali/core` in `@jali/react`, type-only, so the built `.d.ts` imports no type from `@jali/core/adapter` and names no `UiStore` or `UiState`. The value re-exports `optional` and `oneOf` still come from the adapter, so the bundle is unchanged.
- **Unchanged:** behaviour, URLs, keys, stored data and visuals, apart from these. English output gains only the tab description; `tabs.foldedDescription` and `tabs.tuckedDescription` stay for the overflow menu and the shelf.
- **Tests:** `src/tests/tab-strip.test.tsx`, `src/tests/host-page.test.tsx` (landmarks, no `ResizeObserver` and no stub, the 0-high warning), `src/tests/pane-attributes.test.tsx`; `e2e/axe.spec.ts`, `e2e/host-sizing.spec.ts`, new cases in `e2e/theme.spec.ts` (a host token above a `.dark` scope, a `.dark` scope alone and a `.light` inside it, a token on the Jali root) and `e2e/tuck-shelf.spec.ts` (Delete and put back on a focused tab, the buttons out of the Tab order); `e2e/a11y.spec.ts` checks one main and no pane banners.

## 19 Nov 2026 · Findings from the markets example: followers of every kind, the preset in the link, a chooser for app commands

- **Why:** building `examples/markets` on the public API alone (FINDINGS-FROM-DOCS 41 to 49) needed internals in five places (`actions.follow` per kind, `jali.set({ presetId })`, a first-run theme flag, an own picker dialog, `openBeside` + `mergeInto` + `reveal`), and a CSS `@import` the theming guide shows failed on source. The example is ported to the current API and now uses none of them; `storeOf` is left only in its tests (unsaved work, the chooser's state).
- **One selection, followers of every kind (41).** The rule: when a list's selection rests, every follower of that list (`linkedTo` it, `follows: true`) that can show the selected object moves, together, in one change (one history replace, one layout event, one announcement: the follower of the selected kind if it moved, else the first). A follower of the selected object's kind shows it, as before. A follower of another kind says what it follows through its kind: `PaneOptions.follow(selected) => params | undefined`, so a chart follows a watchlist of quotes with `follow: (s) => ({ symbol: s.params.symbol })`. `undefined`, a kind without `follow`, or params its kind can't read (`parseParams` problems) keep the pane as it is. Opening what a kind's `follow` gives for the selection counts as opening the selection, so a chart opened from a quote's row follows (or opens pinned beside the list's following chart), with no `setPinned` dance. Still at most one follower per list and kind; pinning, unpinning (which now catches up only the unpinned pane) and Space are unchanged. Why on the follower's kind, not the list: the list doesn't know what will follow it, while each kind knows what it needs from an object; a function, not a param-name list, because the mapping is sometimes not one to one (an order's customer). Why not match by `shows`/identity: kinds that show different objects (a chart and a quote) share no identity. New: `PaneOptions.follow`, `FollowParams`, `PaneKinds.follow(kind, selected)`, `layout.followers(layout, source)`; `select` now defers whenever the list has any follower, so a later selection always replaces a waiting one.
- **The preset in the link (42).** `buildSearch` writes `preset=<presetId>` (prefixed, like `l`) beside a layout, never with a page. Reading: a link naming a preset the workspace has sets `presetId` on arrival (`arrive(x, layout, view, presetId)`), on first load and on Back and Forward; a broken layout link opens the preset it names. A link or history entry without `preset`, and an unknown id, leave `presetId` as it is, so older links open exactly as before. Always written rather than only when it differs from the first preset, so a link says what it is without knowing the workspace's options.
- **Default settings (43).** `createJali({ settings: Partial<Settings> })`, `UiStoreDeps.settings`, `loadSettings(storage, defaults)`: Jali's defaults, then the app's, then what is saved, key by key. The defaults are not written to storage, so changing them reaches everyone who never chose.
- **CSS imports (44).** Vite resolves CSS `@import` with the conditions `style` and development/production and ignores `resolve.conditions`, so `"source"` was never used and `@import "@jali/react/styles.css"` went to `dist` (missing or stale in the repository). Each stylesheet export now also has `"style"` pointing at its source; `publishConfig.exports` keeps `default` only, so the published package resolves to `dist`. Checked: a source build and dev server of the markets example (which now imports Jali's styles from CSS), and a CSS `@import` of `styles.css` and `theme.css` from a packed tarball. JS imports are unchanged.
- **Focus shows the pane (45).** `jali.actions.focus(pane)`: a pane behind a tab (tab group, fold, tuck) gets the engine's `reveal` step, which only chooses a tab, a swap op under the layout stability rule (17 Nov), so nothing else moves and the dev check stays quiet; while another pane is maximised, focus maximises this one, as the focus keys do (`focusMoved`). A pane on screen is a plain focus. `reveal` had no job left beside it, so it left `JaliActions` (36 actions); the engine step stays for the shelf and adapters.
- **Open as a tab (46).** `addTab(pane, ref)` already covered it: one `newTab` op (one history entry, one layout event), the tab taking the pane's slot, so nothing folds or moves; a test pins that on a full workspace. The example uses it.
- **Pane props return results (47).** `PaneProps.openBeside`, `openHere`, `peek` and `select` (and `PaneHost`) return `ActionResult`: the pane host calls `jali.actions` for its pane (`peek(null)` is `closePeek`, so closing a peek that isn't open is ok and silent). In the peek sheet, `openHere` refuses with `"unavailable"`.
- **A chooser for app commands (48).** `jali.actions.choose<T>(options: ChooseOptions<T>)`, options `{ title, items, label, hint?, placeholder?, onChoose }`: the smallest general piece is an action, not a command option, so a command's `run`, a key or a button can ask; the command stays a plain `Command`. It opens Jali's existing chooser dialog (`ListDialog`: type to filter, arrows, Enter, Esc, focus back where it was, a combobox over a listbox with `aria-activedescendant`), so search, keys and screen reader support are the merge chooser's. Typing matches label and hint; labels that start with the text come first (`ListDialog.rank`). `onChoose` runs after the dialog unmounts, as palette commands do. Esc chooses nothing; there is no cancel callback until someone needs one. `ChooserState` is now `{ kind: "merge"; source } | { kind: "choose"; request }`. The words are the app's (`title`, labels, hints, placeholder) and Jali's (`messages.chooser.choosePlaceholder` "Type to search", `chooseListLabel` "Choices", `chooseEmpty(query)`). Opening it closes ⌘K; options without a title, items or label are `"invalid"`. RTL: the dialog is the palette's grid, which mirrors.
- **Documented (49):** a tab group is as narrow as its widest tab allows (`combineBounds`: every tab's minimum must fit, the slot measured as its home); a pane id two presets share keeps its pane state and unsaved work across a switch, without asking, when it shows the same object in both (`prunePanes` keeps state for the same id and ref; the unsaved guard asks only for panes that go or show another object). In Fitting, Define a pane kind, Presets, and Unsaved work and pane state.
- **Public API:** values unchanged; types added `FollowParams`, `ChooseOptions`; `JaliActions` gains `choose` and loses `reveal`; `PaneKinds` gains `follow`; the `layout` namespace gains `followers`; `JaliOptions` gains `settings`; `Jali` still has 13 members.
- **Left open:** `jali.actions.openBeside` outside a curated page opens an object that is already open in another pane (it reuses the source's earlier plain link instead of showing the open pane), though the reference says the open pane is shown; found while testing 47, not changed here.
- **Tests:** `src/tests/follow-kinds.test.ts`, `preset-link.test.ts`, `settings-defaults.test.ts`, `css-exports.test.ts`, `focus-reveals.test.ts`, `pane-props-results.test.tsx`, `choose.test.tsx`, `documented-fits.test.ts`, an `addTab` case in `instance.test.ts`; the markets example's `workspace.test.ts` and its smoke test (now also the chooser from /).

## 19 Nov 2026 · Holding focus while something else drives the workspace

The docs' hero tour drives a real workspace while the reader watches. Jali's own focus moves (into a pane after a change, into the palette's field when it opens, back when it closes) would take the reader's keyboard focus, and the tour first held them back by replacing `HTMLElement.prototype.focus` for the whole page while it played. A public demo shouldn't patch the browser, so the workspace now has the switch itself.

- **`UiStore.focusHeld` (`@jali/core/adapter`), default false.** While true, the store's focus port does nothing, `<Workspace>` skips keeping focus on the focused pane, and `ListDialog` (palette, chooser) neither takes focus on open nor hands it back on close. Keys the person presses still move focus as usual (tab lists, F6, the overflow menu, dialogs they open).
- **Why runtime, not `createJali({ moveFocus })`:** that option is fixed at creation and only covers the focus port; a tour turns the hold on and off as it plays and stops.
- **Why the adapter, not `Jali`:** one known use (a scripted tour; a remote presenter is the next likely one). It joins the public instance when an app needs it.
- **Tests:** `src/tests/focus-held.test.ts`; the docs' `e2e/tour.spec.ts` checks focus stays on the page through the ⌘K step and that the browser's `focus` is never replaced.

## 2026-11-19 · Tab features for apps with documents (Data Studio's request)

Data Studio's old tab strip had six features Jali lacked. Each is general, and lands on its own.

- **The unsaved mark.** A pane that reports unsaved work (`useUnsaved`) shows a dot. On a tab it holds the close button's place and turns back into × on hover or focus, so it costs no width. It also shows in a lone pane's header, on a shelf chip, in Single view's switcher, and in the peek sheet while it shows the same object. A tab's, chip's and switcher item's description starts "Unsaved changes" (`messages.pane.unsaved`). Elsewhere, the dot is an image with that name. `data-unsaved` is on each, for the app's styles.
- **`confirmDiscard: false`.** For an app that asks about unsaved work itself, from `beforeClose`. Its yes stands: Jali's "Discard unsaved changes?" never follows, and Jali doesn't hold the page's unload. Panes still report work, so the mark still shows. A following detail with unsaved work still keeps its object, since nothing asked. **Why an option and not `useUnsaved(what, { ask: false })`:** whether to ask is the app's policy, not each pane's, and one app never wants two dialogs.
- **Middle-click closes** a tab or a shelf chip: `auxclick` with button 1 runs `actions.close`, so `beforeClose` gets reason `"close"` exactly as from ×. The middle button's press is prevented, so autoscroll doesn't start.
- **Tests:** `src/tests/tab-features.test.tsx`.
- **Reordering tabs.** `jali.actions.moveTab(pane, index)` moves a tab to position `index` (from 0, clamped) in its group; `layout.moveTab` is the pure step. The group keeps its rect and its shown tab (op `moveTab`, a swap-geometry change with its own history entry). Announced "Orders moved to position 2 of 4". Only a group the person or the app made has an order: a folded or tucked tab is placed by the layout, so it is refused with `"nothing-to-do"`.
  - **Keys:** `tab.move.left` and `tab.move.right`, the browser's and VS Code's Ctrl+Shift+PageUp/PageDown after the prefix (`⌘K ⇧PageUp`), so they follow `keyPrefix` and rebind through `keymap` to a single chord (Data Studio: ⌥⇧←/→). Screen sides: right to left, left is later in the strip. At the end of the strip: "Orders is already the last tab", as moving a pane says it can't.
  - **Drag:** a tab dragged over its own strip shows a line before or after the tab under the pointer (reading order) and drops there; no split zones while over the strip. A centre drop on a pane still adds a tab at the end. The hit test goes through the tab's item, since the close button covers the tab's end.
  - `data-unsaved` is also on the pane's section, beside `data-kind` and `data-focused`.
  - **Tests:** `src/tests/tab-features.test.tsx` (position, clamping, shown tab, refusal, keys, RTL, a single-chord rebinding under `keyPrefix: "Mod+J"`), `e2e/tab-reorder.spec.ts` (drag with the line).
- **A tab's menu.** Right-click, Shift+F10 or the menu key on a tab opens an APG menu for that tab (not the focused pane). Jali's groups: Close · Close other tabs · Close tabs to the right (left, right to left) · Move tab left and right · Move out of tabs · Split right and down (with a launcher, not on a curated page) · Maximise or Restore; then the app's, from `createJali({ tabMenu: (pane) => TabMenuItem[] | undefined })`, called as the menu opens. `TabMenuItem` is `{ id, title, run, disabled?, checked?, keys? }`: `checked` makes a menuitemcheckbox; a disabled item stays reachable and says why (`aria-description`). Esc returns focus to the tab; choosing closes the menu and refocuses the tab before `run`, so an item that moves focus wins. **Why app-wide, not per kind:** Data Studio's 14 document kinds share their items, and a function of the pane can still branch on `ref.kind`.
  - **Closing several tabs** is `jali.actions.closeTabs(pane, "others" | "after")`: one change (op `closeOthers`), so `beforeClose` is asked once with every pane, one announcement ("2 tabs closed"), one Undo. "after" is reading order, so the API needn't know the direction; the menu says left or right.
  - The tab's `aria-keyshortcuts` adds Shift+F10, and it has `aria-haspopup="menu"`.
  - **Tests:** `src/tests/tab-features.test.tsx` (items and groups, app items and `checked`, none for `[]`, keyboard and Esc, one `beforeClose` for Close other tabs, Undo, disabled items).

## 2026-11-19 · Kept, not pinned; and a link never copies a pane of its own chain

- **"Pinned" is now "kept"** for a linked pane that stays on its object: `PaneNode.kept`, `jali.actions.setKept(pane, kept)`, `layout.setKept(layout, id, kept, { follow })` (was `setFollows`), messages `pane.keep`, `keepWord`, `keptTip`, `plainTip`, `announcements.kept`, `openedKept`, `unkept`. **Why:** "pin" means a pinned tab in every browser and editor, and Jali is getting those (Data Studio's request). VS Code calls this idea "Keep Open" for its preview editor, which the next file replaces exactly as Jali's next link replaces a plain link. Links and saved layouts keep the same short key (`p`), so old ones load as kept. The peek's "Pin beside" is "Open beside" (`peek.open_beside`, internal `openPeekBeside`, icon `openBeside`). Icons: `keep` (Phosphor's `AnchorSimple`) for the toggle; `pin` (`PushPin`) is now a pinned tab's mark.
- **Keep on every linked pane.** Before, only a follower could be kept, though the guide said "pin a pane to keep it" of plain links too, and `setPinned` on a plain link did nothing but returned `ok: true`. Now a plain link can be kept, so the next link from its source opens beside it. Let go, a pane whose source reports a selection (a list's detail) follows again; any other goes back to being a plain link. The control is one toggle named and labelled "Keep" (`aria-pressed`), with "Following" beside it as a status on a follower. That fixes the old name and label mismatch ("Following" shown, "Pin …" named), and the axe rule is back on. On a plain link the toggle shows on hover or focus of the header.
- **A link never copies a pane of its own chain.** Outside a curated page, `openBeside` from a pane whose object is the pane itself, a pane up its chain (`linkedTo`, followed up), or a pane it opened, shows that pane instead: focus stays, it says "Already open: …", and `pane` in the result is that pane. Before, a link to itself or back to the order you came from opened a copy, and re-opening what a link already showed announced "opened". Other chains may still show the same object (two orders' customers side by side), as in VS Code's editor groups. **Why not one pane per object everywhere:** a link would then move or reveal a pane far from where the person is working.
- **Tests:** `src/tests/open-beside-chain.test.ts`; the follow, codec, priority and markets tests with the new names; `e2e/axe.spec.ts` without the exception.
- **Pinned tabs.** `PaneNode.pinned` (link key `h`), `jali.actions.setPinned(pane, pinned)`, `layout.setPinned`, and the `pin` event `{ pane, pinned }`. A pinned tab sits at the start of its group, in the order tabs were pinned; unpinned, it goes to the start of the rest. A pinned pane joining a group joins after its pinned tabs. `closeTabs` (Close other tabs, Close tabs to the right) leaves pinned tabs; Close, middle-click and the close keys still close one, as in browsers. `moveTab` and the move keys keep a tab in its part of the group, and the move items in the menu are disabled at that line. The tab menu has a "Pin tab" checkbox item. The tab shows a pin (icon `pin`) before its icon, carries `data-pinned`, and its description starts "Pinned". Its width is the app's: `--jali-tab-pinned-width` caps it.
  - **The event is derived, not sent by the action**, like `open` and `close`: it compares each pane's `pinned` before and after a change, so it fires for the menu, `setPinned`, `setLayout`, Back and links alike. Data Studio keeps the pin on its documents, sets it with `setPinned` and writes back from `on("pin")`; setting the current value is no change, so no event, no layout event and no history entry, and the two never loop.
  - **Tests:** `src/tests/tab-features.test.tsx` (order, event once and no echo, closing others, moving within a part, mark and menu, the codec).
- **Renaming in place.** `createJali({ rename: { can?(pane), run(pane, text) } })` and `jali.actions.startRename(pane?)`. Double-click or F2 on a tab, or on a lone pane's title, or the tab menu's Rename… (only where `can` allows) opens a field in place of the tab or inside the title's `h2`, with the title selected. Enter or leaving the field calls `run` with the trimmed text; Esc keeps the old name; an empty or unchanged name calls nothing; `false`, a throw or a rejection keeps the field open with the text, marked invalid and announced; a promise keeps it busy. Focus goes back to the tab, or the pane, after Enter or Esc. Jali stores no name: the app saves it and the pane shows it, usually with `useTitle`. State: `UiState.renaming`.
  - **Why app-wide, with `can`, not per kind:** Data Studio's 14 document kinds rename the same way while its Start page and launcher don't; one function with a predicate says that once.
  - **F2** is the `pane.rename` binding, a file manager's rename key. Content sees keys first, so a grid that edits a cell on F2 claims it; a host that owns F2 lists it in `reservedKeys`, which drops Jali's binding, and calls `startRename` from its own command. A double-click on a title that can be renamed renames; elsewhere in the header it still maximises.
  - While renaming, the tab strip holds the field instead of the tab, so for that moment the tablist has a child that is not a tab. A field inside the tab would nest a control in it, which is worse and lasts as long as the tab.
  - **Tests:** `src/tests/tab-features.test.tsx` (double-click and Enter, `can`, from the app on a lone title with Esc, a declined name, empty names, F2 and `reservedKeys`, the menu).

## 2026-11-19 · React 18.2 and up

- **The range is `^18.2.0 || ^19.0.0`** for `react` and `react-dom` (was 19 only). Jali used one thing React 18 lacks: the `inert` prop, which React 18 drops with a warning, so a pane behind a maximised one would stay reachable with Tab. `useInert(on)` (pane/inert.ts) sets the DOM property through a ref instead, the same in both (React 19 reads `inert=""` as false, so no string form works in both). Everything else Jali calls (`useSyncExternalStore`, `useId`-free ids, portals, Suspense) is in 18.
- **Types:** `JaliIconProps` takes `size?: number | string` and `"aria-hidden"?: boolean | "true" | "false"`, so a Phosphor icon is a `JaliIcon` under React 18's types too (their `propTypes` made it fail there).
- **Why not 17:** no `useSyncExternalStore`, which the state hookup relies on, no `createRoot` or automatic batching; a shrinking share of apps, at a real cost. **Why 18.2:** what most apps on 18 run; 18.3 only adds warnings ahead of 19.
- **Checked:** `pnpm test:react18` (scripts/test-react18.sh) copies HEAD to a throwaway worktree with React 18.3.1 and its types, typechecks and runs the unit tests (706 pass; the two dist bundle checks skip without a build). The lab on React 18 passes the axe, tab, zoom, peek and review e2e specs. The suspending tests no longer use React 19's `use()`: they throw the promise, as a data library does.

## 2026-11-19 · Browsers: Baseline 2024

- **Jali needs Baseline 2024 browsers:** Chrome and Edge 123, Firefox 120, Safari 17.5, Electron 30. Stated in the quickstart, the theming guide and `@jali/react`'s README.
- **What sets it:** the theme's `light-dark()` pairs (41 tokens). Jali already needed late 2023 for `:has()` (Firefox 121), `color-mix()` (Safari 16.2) and container queries, so the floor moved by about five months. A scan of the packages found nothing newer: JS is es2022 (`.at()` the newest), with the `ResizeObserver` fallback already in place.
- **Why no fallback:** it would mean every token written twice, light and dark, which `light-dark()` replaced; the browsers left out are iPhones and iPads not updated past iOS 17.4 and Macs too old for Safari 17.5. Data Studio's Electron 45 (Chromium 142) is well inside.
- **Pinned tabs stay in view** (the docs session's finding: a narrow strip scrolled the shown tab into view and clipped a pinned one behind "+1"). The tablist now holds the pinned tabs in a part that never scrolls (`.jali-tabs-pinned`, with a hairline after it), then the strip that does (`.jali-tabs`, unchanged for the unpinned tabs). The "+N" count is of the scrolling strip only, so a pinned tab is never counted as out of view. Browsers and VS Code do the same. Test: `e2e/tab-reorder.spec.ts`.
- **Narrow strips** (the docs session's finding at 390px: the pinned part took the whole strip and the shown tab had no room). The rule: the shown tab is always on screen, and pinned tabs give way first. The scrolling strip keeps `min(8rem, 60%)` when it has tabs; the pinned part shrinks and, past that, scrolls. Under a 32rem header (container `jali-header`) pinned tabs are a pin and an icon, with no close button, as in browsers; the title stays their name and tooltip, and middle-click, Delete and the menu still close them. `--jali-tab-pinned-width` now defaults to 12rem. `pnpm typecheck` also checks `apps/docs`, which `tsc -b` didn't reach (f319506's icon size type broke it unnoticed). Test: `e2e/tab-reorder.spec.ts`.
- **Sharing a narrow strip, the right way round** (the docs session's measurements: at 1440 the pinned tab was cut to "An…" so every unpinned tab could fit; at 390 the pinned part was 3px). The scrolling tabs give way first, down to `min(8rem, 60%)`; only then the pinned part, down to `min(var(--jali-tab-pinned-collapsed, 3rem), 40%)`, about one collapsed tab (a collapsed pinned tab drops its 4.5rem minimum: a pin and an icon, about 48px) (`flex-shrink: 0.0001`). The narrow-strip e2e test now also checks that each pinned tab is at least partly on screen.
- **One underline per strip** (Data Studio's "continuous indicator"). `.jali-tab-indicator`, one absolutely positioned element in the part of the strip that holds the shown tab (pinned or scrolling), so it scrolls with the tab. It spans the tab and its close button as one box (the close button is the tab's sibling, so a per-tab border broke at the gap or stopped short of ×), or the tab alone when the close button is hidden (a collapsed pinned tab); its bottom is flush with the lower of the two. Accent colour, 2px (the focus ring's width), `z-index: 1`, no pointer events. A `ResizeObserver` on the part and on every tab and close button measures it again, since a renamed or newly marked tab moves the shown one. Hidden while the shown tab is renamed, and with no shown tab in the strip. No slide, as before; the per-tab underline is gone. It measures from its own parent, not a ref of it: a parent's ref is attached after a child's layout effect first runs. Test: `e2e/tab-indicator.spec.ts` (1280 and 390, a pinned shown tab with and without its ×, an overflowing strip scrolled both ways).
- **The shown tab is whole, and never counted in "+N"** (the docs session at 390: a 140px shown tab in an 8rem part faded under "+3", and was counted). The strip measures the shown tab into `--jali-shown-tab`, and the scrolling part's minimum is the wider of about one tab and the shown tab, so long as the collapsed pinned tabs still fit. The overflow count skips the shown tab, which is always revealed.
- **A shown tab that can't fit whole is shortened, not cut** (the docs session at 390: "Order 1048" needed 258px of a 236px bar). The shown tab's item may be at most its part of the strip, and its tab shrinks with an ellipsis ("Quarterly reven…"), its × still in view; its title stays its name and tooltip. While it fills the part there is no edge fade, and it shows from its start. The strip also reveals the shown tab again when the strip or that tab changes size (a narrower header, a longer `useTitle`), not only when it becomes the shown tab. Tests: a long title at 390 in `e2e/tab-reorder.spec.ts`; finding 30's 3rem strip now chooses its first tab by key, since the shortened shown tab covers where a pointer would land.

## 19 Nov 2026 · Jali's icons are built in; no icon library to install (founder)

- **Why:** the founder doesn't want an icon library as a dependency of `@jali/react`, even an optional peer. The host's icon system supplies icons through the named registry (`<JaliRoot icons>`); without them, Jali draws the icons that come with its default theme.
- **How:** `scripts/icons.mjs` renders each of the 28 names' Phosphor icon (regular; `activityError` bold; `openBeside` mirrored) with `react-dom/server` and writes the path data to `packages/react/src/icons/default-paths.ts` (`pnpm icons`). `icons/default.tsx` turns each path into a plain `<svg viewBox="0 0 256 256" fill="currentColor">` component marked `data-jali-icon="<name>"`. `src/tests/default-icons.test.ts` fails when the file and the script disagree. `@phosphor-icons/react` stays a dev dependency only, to change or update an icon. Phosphor's MIT notice ships in `packages/react/THIRD_PARTY_NOTICES` (in `files`).
- **API:** `@jali/react/bare` is gone (archived under `archive/`): with no library to keep out, a second entry earns nothing. `<JaliRoot icons>` / `<JaliProvider icons>` take `Partial<JaliIcons>` over the defaults. `@jali/react/icons` exports `defaultIcons` (was `phosphorIcons`). A host replacing every icon types its set as `JaliIcons`. `examples/bare-icons` is `examples/own-icons`, on `@jali/react`.
- **Lost:** a host's Phosphor `IconContext` no longer changes the weight of Jali's icons; a host that wants another weight passes its own icons.
- **Size** (gzipped KB, `pnpm size`; before → after; the "before" react numbers were already over budget from the tab work): minimal: react 14.7 + Phosphor 9.4 = 24.1 → react 16.6, no Phosphor. Full: 15.3 + 10.3 → 17.2 + 1.6 (the app's own two kind icons). An app with its own icon for every name: 14.3 → 16.6, since the defaults now ship unused (2.3 KB, accepted for one entry and no dependency). Budgets reset to about 10% over: react 18.3 (minimal, own-icons) and 19 (full), CSS 7.8, Phosphor 0 (2 for full's host icons).
- **Install line:** `npm install @jali/core @jali/react` everywhere.

## 19 Nov 2026 · A styling contract: the parts an app may select on (from ui-sdk.dev)

- **What:** `packages/react/src/parts.ts` lists every public part (32: root, layer, workspace, pane and its header, title, actions and content, the tab strip's parts, tab menu items, dividers, the drop preview and drag chip, shelf and chips, switcher, peek, page bar, follow toggle, palette items, Jali's icons, the host's `data-jali-chrome`), with one selector each and the state attributes it carries. The docs' new Parts reference (`/reference/parts`) is built from it; the theming guide points there instead of keeping its own table.
- **The rule:** state is an attribute (`data-*` or ARIA), never a class. Listed parts and attributes change only in a major version; other `jali-*` classes, every `is-*` class and unlisted attributes are internal. Learned from ui-sdk.dev, whose parts are styled through `data-slot` and state attributes. Jali keeps its `jali-` classes as the part names rather than adding `data-slot`: they are already namespaced, and a second name for each part would be one more thing to keep in step.
- **New attributes** where a state was only an `is-*` class: `data-dragged` and `data-drop-target` on a pane, `data-renaming` on a tab item, `data-tucked` on a switcher entry.
- **Test:** `src/tests/parts.test.tsx` checks every selector and attribute is set in `@jali/react`'s source, and renders a workspace (a pane, a tab group with a pinned tab, then a tucked pane) to find the parts it shows. jsdom has no layout, so the test gives elements a size.

## 19 Nov 2026 · Every event says where its change came from (`input`, from ui-sdk.dev)

- **What:** each `jali.on` event carries `input: JaliInput`, one of `mouse`, `touch`, `pen`, `keyboard`, `virtual` (a click with no pointer or key, as a screen reader sends), `agent` or `code`. For analytics and for telling a person's change from the app's own or an agent's; Jali never behaves differently by it. ui-sdk.dev's `source` is the model; Jali calls it `input` because the `layout` event already has `source` ("action" or "address"), which stays.
- **How:** `packages/core/src/dom/input.ts`. While any workspace is started, capture listeners on the document note each `pointerdown`/`pointerup` (by `pointerType`), `keydown` and `click` (`detail 0` with no press: `virtual`). The note lasts until the task ends (`setTimeout`), so an action in that event's handlers, Jali's or the app's, sees it; later work reads as `code`. A batch reads the input once, when it starts, and every event of that change carries it. `withInput(input, fn)` (adapter) wins over the page: the agent bridge marks its actions `agent` with it.
- **Limits, accepted:** an app action after an `await` that a click started reads `code`; two workspaces on one page share the note, which is right since one person is using both.
- **Tests:** `src/tests/event-input.test.ts`; the event recorders in `instance.test.ts` and `tab-features.test.tsx` check `input` is `code` there.

## 19 Nov 2026 · The docs ship in @jali/core, for agents; and a skill (from ui-sdk.dev)

- **What:** `packages/core/docs/` holds every docs page as Markdown (29 files, about 400 KB), with a `README.md` index in reading order, and is in the package's `files`. An agent reads the docs of the installed version: `node_modules/@jali/core/docs/README.md`. In `@jali/core` because every app installs it, headless ones too; `@jali/react`'s README points there. ui-sdk.dev ships its docs the same way.
- **How:** `scripts/agent-docs.mjs` (`pnpm agent-docs`) loads the docs site's own `toMarkdown` through Vite's SSR loader, so the package's copy and the site's "View as Markdown" are one conversion. Site links become relative file links. `pnpm test` ends with `agent-docs --check`, which fails when the copy is out of date; the formatter skips the folder, since the check compares bytes. Files no page writes any more are reported, never removed.
- **Better Markdown for everyone:** `apps/docs/src/site/jsx-markdown.ts` turns the docs' components into Markdown: reference entries into headings, signatures and lists; `<Ref>` into links; live demos into one line saying what they show; the parts, commands, tokens and Tailwind bridge tables into Markdown tables from their data (`site/markdown-tables.ts`). Code, fenced or inline, is left alone. "Copy page" and "View as Markdown" use it too. Test: `apps/docs/src/reference/markdown.test.ts`.
- **Skill:** `skills/jali/SKILL.md`, the layout `npx skills add <repo> --skill jali` reads. It sends the agent to the installed docs and the coding-agents rules first, has it look up every API it uses in the reference, and check its work against the ten rules before finishing. The coding-agents page says where both are.

## 19 Nov 2026 · One pane is quiet; tabs as wide as their titles (Data Studio, the founder's feedback)

- **Why:** in Data Studio, one pane with three tabs at 800×500 looked heavier than the old tab strip: an accent border and ring framed the whole workspace like a modal, an 8px inset cost room, tuck, maximise and close showed with nothing to arrange (the header × sat beside the active tab's ×), and tabs were cut at 12.5rem with half the strip empty. The principle: the chrome grows only when you need it.
- **A lone pane** (one pane on screen, tiled, not a curated page; `Workspace` counts the resolved panes that aren't hidden) gets `ALONE_CHROME` (`@jali/core/adapter`): full-bleed over the whole workspace, no inset, border, radius or focus edge (it carries `is-single`'s styles, plus `is-alone`), no grip or header drag, no tuck or maximise. Its header close goes when its tabs carry their own × (`Chrome.closeWithTabs`); a pane without tabs keeps it, since nothing else closes it with a pointer. A second pane brings the island back. `data-alone` on the workspace and the pane, in the parts contract. Fitting still uses the inset size, so one pane is 12px narrower than it could be for its minimum; not worth a second fit.
- **Tabs** are as wide as their title up to `--jali-tab-max-width` (default 20rem, was a fixed 12.5rem), then shortened with an ellipsis. In a full strip, the overflow rules (the shown tab whole, "+N") do the rest; wider tabs mean "+N" comes a little sooner.
- **Kept for Data Studio's smokes:** `.jali-tab-indicator`, `.jali-unsaved` in a pane's header, `.jali-tab-close` inside `.jali-tab-item`.
- **Tests:** `src/tests/alone.test.tsx`. The icon tests now give jsdom a size, so their two panes sit side by side instead of folding into one.

## 19 Nov 2026 · Auto layout: Jali arranges the panes itself (founder)

- **What:** `layout.arrange(layout, ctx, options)` (pure, in the `layout` namespace) and `jali.actions.autoLayout()`, with the ⌘K command `layout.auto`, "Arrange panes automatically" (no default key). The founder asked for both a built-in arrangement and an agent that may use it on its own; this is the first half, and the agent bridge calls it.
- **The rule:** reading order with each pane's linked panes right after it; as many columns as fit at the kinds' comfortable widths (else their minimums); a second row in a column only when the height holds two of the tallest minimum, never more than two; panes past the cells become tabs of the cell holding the pane they were opened from, else the last cell, with the focused pane shown. Column weights follow the widest comfortable width; nothing is marked as sized by the person. The fit runs after, so a narrow window still folds.
- **The same panes:** ids, refs, links, follows, keeps and pins carry over, so no pane remounts or loses state. Tucked, folded and hidden panes are placed too: arranging is a fresh start. Splits and stacks get fresh ids that can't collide with a pane's.
- **Undo:** like a preset or `setLayout`, it adds an address entry, so Back returns to the arrangement before; it announces "Arranged N panes". Refused on a curated page (`unavailable`, the page has its own design) and with one pane (`nothing-to-do`).
- **Tests:** `src/tests/auto-layout.test.ts`.

## 19 Nov 2026 · An agent bridge: an AI agent uses the workspace (from ui-sdk.dev, founder)

- **What:** `@jali/core/agent`, an entry of its own (so an app with no agent ships none of it): `createAgent(jali, { actions, allow, arrange })` returns `snapshot()`, `act({ steps })`, `tools()` (two tools for a model, `jali_snapshot` and `jali_act`, with JSON Schemas and MCP-style text results) and `registerTools()` (WebMCP, `navigator.modelContext`, where the browser has it; a no-op elsewhere). Guide: "Let an agent use the workspace" (`/guides/agents`). The founder wanted it before release, not after, with auto layout ("both": a deterministic arrangement, and an agent allowed to use it on its own).
- **Through Jali's own actions:** each step is a `jali.actions` call run inside `withInput("agent", …)`, so every event says `input: "agent"`, the workspace's rules hold, and a close with unsaved work still asks the person. A pane argument is an id or the ref it shows; refs are checked against their kind first (`invalid`, with what is wrong). Steps stop at the first refusal, and the result gives each step's outcome and the snapshot after.
- **The app decides:** `actions`, which ones (default `AGENT_ACTIONS`: focus, open, peek, select, keep, tabs, close, undo, tuck, move, pin, presets, auto layout and the curated page; never `remove`, rename, dialogs, settings or `setCanInvestigate`); `allow(step)`, a veto per step whose string the agent hears; `arrange`, `"when-asked"` (default) or `"after-changes"`, which runs `autoLayout` after any turn that opened or closed panes: the agent arranging on its own, within the app's limits.
- **The snapshot:** panes (id, kind, title, params, where each is: shown, tab, folded, tucked or hidden; tab group, focus, zoom, pin, keep, link, follow, unsaved work, activity), kinds with their params described (`number`, `one of: a, b`, `?` for optional) and widths, presets, the allowed actions with what each does, and the workspace's size and view.
- **Tests:** `src/tests/agent.test.ts`; `public-api.test.ts` pins the entry's exports.
- **Size:** the bridge ships only to apps that import `@jali/core/agent`. Core grew from 44.1 to 45.2 KB gzipped in an app with React, from auto layout (`arrange.ts`, 1.7 KB minified, shipped with every action like the rest of `ACTIONS`) and input tracking (`input.ts`, 0.7 KB). Core budgets reset to about 10% over: 49.5 with React, 45 headless.

## 19 Nov 2026 · Tab menus render in the workspace's layer; the dialog backdrop is a part (Data Studio)

- **Why:** Data Studio themes Jali by setting tokens on its host element and on `.jali-scrim`, the dialogs' backdrop, which wasn't in the parts contract. Checking it showed a real gap: the tab menu and the "+N" menu were portalled to `document.body`, so tokens set around `<JaliRoot>` never reached them.
- **What:** both menus now portal into the workspace's layer (`[data-jali-layer]`, `display: contents`, beside the root), where the palette, Settings, the chooser and the discard question already render; `document.body` only before the layer exists. The supported way to theme everything a workspace draws, overlays included, is tokens on an element around `<JaliRoot>`. `.jali-scrim` joins the parts as `dialog`, for styling the backdrop. The theming guide says so.
- **Test:** `parts.test.tsx` opens a tab's menu and finds it in the layer; the lab e2e (133) passes.

## 19 Nov 2026 · Phones: Single view under 600px of workspace width (founder, from the phone research)

- **Why:** docs/research/phone-split-view.md found that the old "phone rule" was only an overflow rule: on a 390px phone, panes of narrow kinds tiled with desktop chrome (12px dividers, draggable headers), one wide kind flipped the whole workspace to Single view, and landscape stacked two 186px strips. The docs already promised one pane at a time on a phone.
- **What:** `m.single` is now also true when the workspace's width is under `env.phone.below` (`createJali({ phone: { below } })`, `PhoneOptions`, default `PHONE_BELOW` = 600, Android's compact width). The overflow rule stays for every width. `{ below: 0 }` restores the old behaviour exactly. Layout, address and history are untouched as before; widening restores the arrangement (`restoreWide`).
- **First of three steps.** Next: opt-in stacked view on portrait phones (two linked panes top and bottom), then foldables (a separating hinge becomes a locked divider), as the research proposes.
- **Tests:** `pane-attributes.test.tsx` tests folding at 360px, so it sets `below: 0`; the rule's own tests come with the stacked view.

## 19 Nov 2026 · Phones: stacked view, two linked panes top and bottom (opt-in)

- **What:** `createJali({ phone: { stack: true } })`. In Single view, when the focused pane has a partner on screen (the pane it was opened from, else a follower, else any pane opened from it) the model's `stacked` names the pair, source above, and `frames` lays them out top and bottom. Derived each render: layout, address and history don't change. Step two of the phone work (docs/research/phone-split-view.md).
- **Only with room:** the workspace at least 480px tall (`STACK_MIN_HEIGHT`, Android's compact height), and each half, after the 44px switcher, at least the larger of `stackFloor` (default 200) and the kind's minimum height. Never more than two. A kind opts out (`phone: { stack: false }`) or asks for a half (`place`). While the visual viewport is under three quarters of the window (the keyboard is up), the focused pane shows alone, so a field in the lower pane isn't covered.
- **The divider:** `.jali-stack-divider`, a 44px touch target around the 6px gap with a grabber; `role="separator"`, drag or Up/Down/Home/End, settling on a third, a half or two thirds. The ratio is the React tree's state for the session, not layout. Entering a pair is announced once ("Two panes stacked: Orders above, Order 7 below"). The switcher marks the other pane in view (`data-in-view`); the workspace carries `data-stacked`. Both in the parts contract.
- **Model cost:** with `stack` on, the focused pane is part of the model's cache key (the pair follows focus); without it, nothing changes.
- **The markets example** turns it on: its watchlist sits above the chart it opened at 390×844.
- **Deferred, as the research suggested:** dragging the divider to an edge to go single, stacking in landscape, three panes, keeping the ratio across sessions.
- **Tests:** `src/tests/stacked.test.tsx`.

## 19 Nov 2026 · Phones: a pane each side of a fold (on by default)

- **What:** the workspace reads the browser's viewport segments (`window.viewport.segments`, Chrome and Edge 138+) when it measures, and on window resize, posture change and the `(horizontal|vertical)-viewport-segments: 2` media queries (turning from book to tabletop changes only the segments). `hingeOf(segments, rect)` gives the hinge in the workspace's coordinates (`axis`, `start`, `size`; ignored when it grazes the workspace within 48px or there are more than two segments) into the store's `hinge`. With a hinge (and `phone.fold` not false), the model's `single` is true and `stacked` is a fold pair (`foldPair`): the focused pane and its partner, else the next pane on screen, laid out by `frames` exactly either side of the hinge, a mask's width apart for a dual screen. A hairline (`.jali-fold-line`) marks a seamless hinge; there is no draggable divider, the hardware decides. The workspace carries `data-fold="row|column"`. The keyboard doesn't collapse a fold pair (two screens). Announced: "Split at the fold: A and B". Step three of the phone work.
- **Why on by default:** it only ever acts on hardware with a separating fold, and a pane split by a hinge is never what anyone wants (docs/research/phone-split-view.md).
- **Simplified from the research:** a pair of panes rather than fitting the layout's root children into each half; one pane alone spans both halves; right to left still puts the first pane on the physical left. Revisit with real devices.
- **Tests:** `src/tests/fold.test.ts` (the hinge maths, the pair, `fold: false`); `e2e/fold.spec.ts` emulates book, tabletop and a dual screen's 28px mask through `Emulation.setDeviceMetricsOverride({ displayFeature })` (`setDisplayFeaturesOverride` didn't change the segments in this Chromium) and checks no pane crosses the hinge and unfolding restores the exact layout. Emulation doesn't model the seam: a real Fold or Flip pass is still owed.

## 19 Nov 2026 · Full screen, beside Maximise (founder)

- **What:** `jali.actions.toggleFullScreen(pane?)`, the ⌘K command `pane.fullscreen` ("Full screen pane, or exit full screen", no default key) and a header button beside Maximise (icons `fullScreen` and `exitFullScreen`, Phosphor's CornersOut and CornersIn). The pane is maximised and placed fixed over the window, and the page goes into the browser's full screen (`document.documentElement.requestFullscreen`), so the pane covers the display. The founder asked for it as well as maximise; this is the reasoned shape from the discussion.
- **Why the page and not the pane:** the browser shows only the full-screen element's subtree. Making the pane the full-screen element would hide ⌘K, Jali's dialogs and tab menus, which render beside the workspace root. With the whole page in full screen and the pane fixed over it (z-index 50: above the workspace's own layers, below tab menus at 60 and dialogs at 100), everything Jali opens still opens over it.
- **Ways out:** the button again, ⌘K, Escape (the browser leaves its full screen first, and Jali hears `fullscreenchange`; where the browser has none, Escape restores the maximise, which clears full screen), or the pane closing. Leaving maximise always leaves full screen (`toggleZoom` clears `fullScreen`). State is `UiState.fullScreen`, never in the layout or address.
- **Details:** while full screen, the workspace drops its `isolation: isolate` (`data-full-screen` on it), or the host's later chrome painted over the pane (the lab's status line did); a host stacking context around the workspace still confines it, and the docs say so. In full screen the header shows Exit full screen and Close, not Maximise's Restore. A lone pane keeps a Full screen button, shown on hover. Single view (phones) has none. Where the browser has no element full screen (iPhone Safari), the pane still covers the page.
- **Breaking for hosts that type a complete icon set:** `JaliIconName` gains two names; Data Studio is told.
- **Tests:** `e2e/fullscreen.spec.ts` (the button, the browser's full screen, the box equals the viewport, Escape restores the exact layout; ⌘K twice).

## 19 Nov 2026 · Docs: the hero tour shows tabs being moved (founder)

- **What:** the landing hero's tour (`apps/docs/src/live/Tour.tsx`) now plays eight steps in about 35 seconds: pick an order (the detail and customer follow); drop the customer's pane on the order's, which makes them tabs; drag the customer's tab along the strip to the front; pin the order's tab, which goes to the front with its pin; drag the customer's tab to the bottom edge of the orders list, which splits it out under the list; less room folds a pane into a tab; more room brings it back; the layout as JSON with its link; "Your turn".
- **Why:** the founder: the tour didn't show off tab rearrangement, Jali's main feature. The steps are drags a visitor watches happen, not results that snap in. The tour sets the store's `dnd` state the way a person's drag does (the chip, the drop zone with "Add as tab to Order 1046" or "Place below Orders", the line between tabs), with the same hit rule as `workspace/dnd.ts`, then releases through `store.actions.moveTab` and `store.actions.drop`, the calls a real release makes.
- **The hero adds a tab on a centre drop** (`centreDrop: "tab"`, only for the figure with `tour`), so a visitor who copies the drag gets what the tour showed. Other live figures keep Jali's default, swap.
- **Cut:** the ⌘K palette step (maximise, restore) and opening and closing the customer's notes. Neither is about tabs, and they took about 12 seconds. Kept: the follow step (it is what makes the panes look alive), fold and unfold (a pane becoming a tab by itself), and the address chip.
- **Kept guarantees:** `focusHeld` while it plays, the announcer quiet, a pointer, key, wheel or focus inside the figure stops it and leaves the workspace as it is (a drag in progress is put away without dropping), it pauses out of view or with the tab hidden, no autoplay on a phone or with reduced motion. With reduced motion a drag shows its drop preview, held still, then drops. On a phone (Single view) the drag steps are left out, since there is nothing beside a pane to drop on.
- **Tests:** `apps/docs/e2e/tour.spec.ts` (six tests): stopping mid-drag, each tab move without taking focus, stopping mid-fold, Replay and Pause, reduced motion, phone, leaving mid-drag.

## 19 Nov 2026 · Pop out, a prototype: a pane in a floating window (founder)

- **What:** `unstable_popOut(jali, pane?)`, `unstable_bringBack()` and `unstable_canPopOut()` from `@jali/react`, and a lab ⌘K command "Pop out pane (experimental)". A pane's content opens in an always-on-top window through Document Picture-in-Picture (Chrome and Edge on desktop, 116+), as Google Meet's does, and stays visible while the person is in another tab or app. The founder agreed to prototype it in the lab after full screen.
- **How:** the window's document gets every stylesheet of the page (cross-origin ones linked) and `<html>`'s class, `data-*`, `dir` and `lang`, so tokens and theme match. The pane's `PaneBody` renders into the window through a React portal, so it keeps Jali's context: hooks, the data layer, actions; React listens for events on a portal's container, so clicks in the window work (e2e: a row chosen there moves the detail that follows it). The pane keeps its place, showing "Popped out into its own window" with Bring back. The window's own close (`pagehide`), Bring back, or the pane leaving the layout puts it back. One pane at a time, held outside React state (a Window is not state).
- **Known limits, for the next round:** the content remounts when it moves, so its own `useState` starts again (`usePaneState` and the app's data cache carry over); Jali's keys don't reach the window (its keyboard listens on the page's document); the window closes when the opener navigates away (the platform's rule); no header button yet, since a new icon name would break hosts that type a complete set (it would need to be optional in `JaliIcons`). Experimental names (`unstable_`) so it can change shape freely.
- **Tests:** `e2e/pop-out.spec.ts` (skipped where the browser has no Document Picture-in-Picture).

## 19 Nov 2026 · Full screen: the pane is the browser's full-screen element (the founder's screenshots)

- **What went wrong:** with the page in full screen and the pane fixed over it at z-index 50, the docs site's sticky top bar (a higher z-index) drew over the pane's header, hiding its title and Exit full screen. Any host chrome can outrank a z-index Jali picks.
- **Now:** the pane itself is the browser's full-screen element (`store.dom.pane(id).requestFullscreen()`), so the browser shows it alone, over everything, whatever the host's stacking. The reason it wasn't before (the browser shows only the full-screen element's subtree, so Jali's dialogs and menus would vanish) is solved by moving them: while one of its panes is full screen, `<JaliRoot>` portals its layer (`[data-jali-layer]`: palette, Settings, chooser, discard question, live region; tab menus portal into the layer) into that pane. They remount on the way in and out, which costs nothing while they're closed. The host's own overlays (toasts) don't show until it leaves; the docs say so. In full screen the Exit button always shows at full strength.
- **Fallback unchanged:** where the browser has no element full screen (iPhone Safari), the pane is fixed over the window, the workspace drops its isolation, and a host stacking context still confines it (documented).
- **Tests:** `e2e/fullscreen.spec.ts` now also checks the full-screen element is the pane and that ⌘K's dialog opens inside it; checked on the docs page in dark at 1440 (header and Exit visible, a tab's menu opens).
- **Fix, same evening (the founder's screenshot):** a maximised pane is the only one on screen, so it counted as a lone pane and lost its Restore button (lone panes have no maximise). `alone` now also needs no pane maximised. Test: `alone.test.tsx`.

## 19 Nov 2026 · What may happen to a pane: `allow` (founder)

- **Why:** panes have many controls now (tuck, maximise, full screen, close, move, pop out), and not every app wants each everywhere: maximise but not full screen in one workspace, rearrange freely but never remove in a given layout. The founder asked for host control with smart defaults.
- **Permissions over actions, not over buttons:** every control has several ways in (a button, a key, ⌘K, a tab's menu, a drag, middle-click, the agent bridge), so the rule lives in the actions (`actions/allow.ts`: `allows(x, pane, control)`, `notAllowed` refusing `not-allowed` with "Board can't be closed here"). The chrome reads the same answer: no button, ×, grip, divider handle or menu item for what isn't allowed; ⌘K greys the command out with the reason; drags don't start; the agent snapshot lists `notAllowed` per pane.
- **Controls:** `close`, `tuck`, `maximise`, `fullScreen`, `move` (drag, move keys, swap, merge, unmerge, reordering tabs), `resize` (a divider is locked when any pane on either side forbids it), `pin`, `popOut`. Restoring a maximised pane and leaving full screen are always allowed. Folding is not a control: it is how the layout fits. Renaming keeps `rename.can`.
- **Levels, each only taking away:** Jali's own rules (lone pane, phones, curated pages), the kind (`definePane({ allow })`, what its content can handle), then the workspace (`createJali({ allow })`, defaults plus `when({ action, pane, presetId, page })`). Everything on by default except `popOut` (experimental), which the workspace turns on. A `true` never turns back on what a level above refused.
- **Not per pane in the layout, for now:** the layout lives in the address, so a person could strip a "can't close" flag from a link; `when` is the app's code and can check a pane's role or id. What it reads (a preset id, the panes) can still come from a link, so the guide says plainly these controls shape what people are offered and are not a security boundary. Revisit if a real need for per-pane flags appears.
- **Close others and Close other tabs** close the rest and leave panes that can't be closed. `beforeClose` stays for decisions of the moment.
- **Tests:** `src/tests/allow.test.tsx` (defaults, a kind's refusal and its message, Close others leaving it, `when`, restore always allowed, ⌘K's check, the tab menu, dividers, and what is drawn).

## 19 Nov 2026 · A pane's menu on its header; Pop out at the page's zoom (founder)

- **The menu:** the founder right-clicks panes expecting a menu. A tab already had one; a pane without tabs now has the same menu on its header (right-click the title bar). Right-clicking the content stays the app's: a grid, an editor or a chart may have its own, and the browser's (copy, inspect) must stay reachable there. The menu gains Full screen or Exit full screen, Tuck (on a pane without tabs, when it can be tucked) and Pop out (where `canPopOut()` and `allow` say so), beside Maximise. Every item respects `allow`. Escape returns focus to the pane. Test: `e2e/pane-menu.spec.ts`.
- **Pop out's small text:** the window had the same CSS sizes (13px) as the page, but the browser's zoom on the page (⌘+) doesn't carry into the window it opens. The window's root now takes `zoom` = the page's devicePixelRatio over the window's, and follows changes (a `resolution` media query, and the window's resize).
- **Close other tabs** and **Close tabs to the right** are only in the menu of a pane in tabs: a pane on its own has no other tabs, and offered them greyed out.

## 19 Nov 2026 · Header buttons are shortcuts; `buttons` chooses them, ⋯ reaches the rest (founder)

- **Why:** `allow` answered two questions at once: may this happen, and is there a button for it. The founder: if an action is possible it should be in the menu; the top-right buttons are shortcuts, so they should be configurable, with great defaults so an app that passes nothing still gets a good header.
- **Split:** `allow` decides what can happen; everything allowed is in the pane's menu and ⌘K. `buttons` (`createJali({ buttons })`, then `definePane({ buttons })`, the kind winning) decides which get a header button: a list replaces, a function adjusts (`(defaults) => [...defaults, "popOut"]`) and keeps any better defaults Jali ships later. `allow` and Jali's own chrome still filter the list (`pane/buttons.ts`: `buttonsOf`).
- **Defaults:** Tuck, Maximise, Close. Full screen moves into the menu (rare, and a fourth icon crowds a narrow pane), except on a lone pane, where it takes Maximise's place (nothing to maximise over). A phone keeps Close. Pop out is never a default button: the app adds it.
- **The way out always shows:** Restore while maximised and Exit full screen while full screen are drawn whatever the list says; an app chooses shortcuts, it can't trap someone in a state. Bring back stays in the popped-out pane's place.
- **⋯** (`icons.menu`, Phosphor's DotsThree) opens the same menu, right-aligned under itself, whenever the menu offers more than the buttons: right-click doesn't exist on touch and is never found from the keyboard. It sits before Close, so Close keeps the corner. **Shift+F10** or the menu key on a focused pane or its header opens it too (a tab keeps its own; the content's keys stay the app's).
- **Icons:** `menu` and `popOut` (PictureInPicture) join `JaliIcons`. A host typing a full set gets a type error naming the two, as the theming guide promises; nothing outside this repo types a full set yet.
- **Tests:** `src/tests/buttons.test.tsx` (defaults, lone and phone, list, function, allow, ways out, ⋯ drawn and opening the menu); `e2e/pane-menu.spec.ts` (⋯ position, Shift+F10); `e2e/fullscreen.spec.ts` now enters from the menu. The lab adds Pop out to its buttons.

## 19 Nov 2026 · Following and Keep are one toggle (founder)

- **Why:** the founder asked why a linked pane had both "Following" and "Keep" when it can only be one or the other. "Following" looked like a button and was only a label; "Keep" was the button.
- **Now:** one toggle naming what the pane does: **Following** (link icon; it changes with its list, or the next link from its source replaces it) or **Kept** (anchor, in the accent; it stays and the next link opens beside). A click switches. A plain link's toggle stays quiet until the header is hovered or focused, as before.
- **Accessibility:** the name starts with the visible word ("Following orders", "Kept", WCAG 2.5.3), and `aria-description` and the tooltip say what a click does. Because the name changes with the state, it is not also `aria-pressed` (APG: a toggle's name stays put). Tests and styles read `data-follow` (`following`, `kept`, `plain`), which the parts contract already lists.
- **Removed:** the message keys `pane.keep` and `pane.keepWord` (new: `pane.followingName(list)`) and `.jali-follow-status` (never in the contract). Data Studio was told before this landed.

## 19 Nov 2026 · Folded panes wait behind one "N folded" chip; the shelf is for tucked panes (founder)

- **Why:** the founder found folding "very confusing, especially when there isn't enough space". Folded panes looked like real tabs (italic, a small icon), so the person's own tabs and the ones the layout made blended, and the same panes showed again on the shelf beside the ones they had tucked.
- **Now:** the tab strip is for the person's tabs. Of the panes the layout folded into a place, only the one shown is a tab (after the hairline, with its fold mark); the rest wait behind one **N folded** chip at the end of the strip (`.jali-tab-folded`, a dashed outline, in the parts contract). Its menu says why ("No room to show these side by side. Widen the window, or pick one to show it here.") and lists them; a pick shows that pane in the place (the one it replaces goes behind the chip). The +N overflow menu still lists every pane in the group.
- **The shelf holds only tucked panes**, so what the person put away and what the layout put away never look the same. Gone with it: the folded chips, the "N folded" summary chip and its menu, `data-summary` on `.jali-shelf-chip` (`data-reason` is now only `tucked`), and the message keys `shelf.folded`, `shelf.foldedHeading`, `shelf.summary`, `shelf.summaryText` and `tabs.foldedTip`. New keys: `tabs.foldedChip`, `foldedChipLabel`, `foldedChipTip`, `foldedNote`. The fold rule itself is unchanged.
- **Not done:** a visible note the first time a pane folds. The chip appears at that moment and says "folded" itself, and screen readers already hear "folded into tabs: not enough room"; a toast each time the window narrows would be noise.
- **Tests:** `e2e/tab-overflow.spec.ts` (no folded tabs, the chip's name, note and menu, a pick, not on the shelf; the overflow test now narrows a strip of two tabs), `src/tests/pane-attributes.test.tsx` (the folded menu item carries the pane's marks), `src/tests/host-page.test.tsx`.

## 20 Nov 2026 · Jali and five example apps; the lab is gone (founder)

- **Why:** the founder disliked the repo still being "pane lab". The root app held Data Studio and the loan review in one workspace with a switch between them, which no real host does.
- **Now:** `packages/` is Jali, `apps/docs` its docs, and `examples/` holds five apps: `data-studio` (:5300), `loan-review` (:5350), `markets`, `studio` and `trips`. Data Studio and Loan review share `examples/shared` (the sample database, the table, record and related panes, the shell); each app's `main.tsx` is one `start(createX())`. Loan review is page-only (`page`, no layout or presets). `examples/minimal` and `examples/own-icons` moved to `fixtures/`: they serve the quickstart and the size and bundle checks, not as examples. The root package is `jali` and serves no app.
- **Tests:** `src/tests` is `tests/`, and its store is Data Studio's and Loan review's kinds and page together (`tests/workspace.ts`, `createTestStore`). `e2e/` runs against both apps' servers (`DATA_STUDIO_URL`, `LOAN_REVIEW_URL`, replacing `PANE_LAB_URL`); the page specs open `review(...)` links; its fixture is `app`, not `lab`. The "Data Studio is untouched" switch test went with the switch.
- **Renamed:** storage `pane-lab` is `data-studio` and `loan-review` (saved settings and layouts start fresh), the dev hook `window.__lab` is `window.__jali`, the command `lab.pop_out` is `app.pop_out`, the CSS layers `lab-base` and `lab` are `base` and `app`.
- **Found and fixed:** a page-only workspace opened from a link showed the first item, not the link's. Its start opened the page with a `"mode"` op, which pushed the first item's address before boot read the link. It opens as an arrival now (no history). Tests: `tests/minimal-store.test.ts`.
- **Kept:** `?app=review` still reads as the loan review's page (`packages/core/src/url.ts`), for links from before.

## 20 Nov 2026 · A follower with unsaved work holds only itself (Studio, FINDINGS.md #1)

- **Why:** a list with several followers moved none of them while one had unsaved work. `apply()` refused the whole `follow` change, so Studio's timeline and mixer stayed on the old session beside a transport that had loaded the new one. Studio kept its transcript by hand (Keep) to get round it.
- **Now:** the follow step (`actions/follow.ts`) leaves out each follower with unsaved work and moves the rest in the same change. The workspace still says "The detail stays put: it has …" for the one held. A held follower still follows: once its work is saved or discarded (`setUnsaved(null)`), it catches up with the list's selection at once (`actions/content.ts`). The check in `apply()` stays as a safety net.
- **Not added:** an event for what was held. The follow step is deferred, so `select`'s result can't carry it, and an event belongs in the store; the announcement is the report for now.
- **Tests:** `tests/follow-kinds.test.ts` (mixed followers, all held, catching up), `examples/studio/src/workspace/workspace.test.ts`.

## 20 Nov 2026 · A new layout and a list's selection agree; the layout's word wins (Studio, FINDINGS.md #4)

- **Why:** a list keeps its selection through a preset or `setLayout` when it is in both (the same id). The new layout could put a follower beside it showing something else: Studio's Compare showed segment 6 while the transcript's cursor stayed on 5, and selecting 5 again did nothing, since the selection hadn't changed.
- **Now:** `preset` and `setLayout` settle it in the same change (`agreeWithSelection`, `actions/follow.ts`). For each list in the new layout with a selection: a follower of the selected kind resets the selection to what it shows, and the list's other followers show what their kinds give for it; with no follower of that kind, the followers follow the selection. Lists are taken in tree order, so a chain settles from the top. Kept details and followers with unsaved work keep what the layout gives them. A Back, a link or a reload (`arrive`) was left unchanged here; see the next entry but one, which makes it agree on the selection's side.
- **Not added:** a preset option to choose the other rule. One rule, until an app needs the other.
- **Tests:** `tests/follow-layout-switch.test.ts`, `examples/studio/src/workspace/workspace.test.ts` (Edit on segment 5, then Compare: 4 kept, 6 following, the cursor on 6).

## 20 Nov 2026 · Heights have a comfortable and a max height (Studio, FINDINGS.md #7)

- **Why:** a kind's widths had `min`, `comfortable` and `max`; its height only `min`. Spare height in a column was shared by weight, so Studio's timeline (right at about 240 pixels in any window) grew to a third of a tall window, and each layout tuned weights to hold it down.
- **Now:** `height: { min, comfortable, max }`, with width's rules down a column, reusing width's code (`geometry/shares.ts`): every pane starts at its minimum, spare height brings each to its comfortable height evenly, then toward its max by weight, then past it by weight, so a column never leaves a void. Only `min` decides folding. The layout reads them as `PaneKind.comfortableHeight` and `maxHeight` (`Bounds.comfortableHeight`, `maxHeight`).
- **Combining:** a column adds its children's comfortable and max heights; a row, a row that scrolls included, takes the largest of its children's (as a column does with widths). A tab group's minimum is its tallest tab's, and its comfortable and max heights are its first tab's (a fold's: its home's), as with widths. A column inside a row that scrolls shares its height like any column.
- **Divider drags** may pass a max, as with widths: the divider's bounds come from the minimums only, and a sized split keeps the person's proportions.
- **Stacked view** (a phone): the two panes share the height by the same rule until the person moves the divider (`stackShare`, `workspace/stack.ts`); with no comfortable or max height on either kind that is a half, as before. The person's snap then holds.
- **Off:** with neither given, the share is exactly the old weight share, so existing layouts don't move. Links carry no kind sizes, so the codec and `validate` are unchanged; kind sizes are not validated, for heights as for widths.
- **Not changed:** `arrange` still uses minimum heights to decide whether a second row fits (usability, not comfort), and the agent snapshot still lists widths only.
- **Tests:** `layout/test/heights.test.ts` (max, comfortable, no void, off, sized split, drag past max, folding by minimum only, rows, tab and fold groups, rows that scroll, codec), `tests/stacked.test.tsx`, `tests/define-pane.test.tsx`.

## 20 Nov 2026 · A fold goes where it keeps the most panes on screen (Studio, FINDINGS.md #9)

- **Why:** a tab group is as wide as its widest tab needs, so a fold can widen the group it joins. In Studio's first Compare, at 760 pixels, the timeline (440 wide) folded behind the library (240) it follows; the library's group became 440, the transcript no longer fitted beside it and folded too: one pane on screen, four folded. Each step followed the rules.
- **Considered:** always preferring a group whose minimum the fold doesn't raise. Rejected: it moves a detail away from its list in ordinary layouts where the list's group grows harmlessly (most of the existing fold tests), and in the motivating case every candidate is raised (the library by 200, the transcript by 60).
- **Now:** fitting first folds into the rule's home (the pane's source, else a detail, else the nearest neighbour). If that fits, it stays. If the projection is still too big, it also tries the pane's other links and its neighbours in reading order, follows each through to a fit by the focus-free order `resolve` uses, and keeps the one that leaves the most slots on screen; the rule's home wins ties (`fold`, `fit/replay.ts`). The choice is a function of the projection and the room, so replaying the recorded folds reproduces it: the same width always gives the same arrangement, and widening unfolds in reverse. Between two widths a folded tab can move between groups (at 900 the timeline sits behind the library, at 760 behind the transcript); that is the price of not folding the transcript.
- **Unchanged:** every existing layout and fold test gives the same result. Tucks go to their recorded home as before. `replay` and the hidden-pane step moved from `fit/overlay.ts` to `fit/replay.ts`, so the lookahead can use `chooseFold` without an import cycle; `foldSlot` takes the home, and `foldHomes` lists the candidates.
- **Studio:** Compare keeps the timeline under the transcript: at 760 it shows three panes (library, transcript, timeline), more than the old arrangement now gives safely (library and transcript, the segments and the timeline as tabs).
- **Tests:** `layout/test/fold-home.test.ts` (the cascade at 760 with generic kinds, the rule's home at 900, the same arrangement on a round trip, a tie).

## 20 Nov 2026 · A "live" activity (Studio, FINDINGS.md #6)

- **Why:** the closest activity to music playing was `"working"`, a spinning ring announced as "Working", which reads as "busy, wait". Recording, streaming and playback are ongoing, healthy work that is meant to go on.
- **Now:** `PaneActivity` has `"live"`: a dot after the pane's name in `--jali-live` (a green apart from the teal of working), and on the shelf and the "N folded" chip a dot in a soft halo (`data-shape="dot"`) that breathes slowly, still under reduced motion. It reads "Live" (`messages.pane.live`), and the shelf chip's and folded chip's names say "live". It is the least pressing on the folded chip (error, needs-you, working, loading, then live): a pane that waits for the person, or is busy, says so first.
- **Not added:** a per-pane label for screen readers (`useActivity(a, { label })`). It would thread a label through the store, the shelf and the folded chip; an app that wants other words changes `messages.pane.live` once.
- **Tests:** `tests/folded-activity.test.tsx`.

## 20 Nov 2026 · A kind's `Missing` (Studio, FINDINGS.md, theming gap 27)

- **Why:** a ref whose params Jali can't read showed Jali's own message, which an app couldn't style or give a way on. A ref that reads but names nothing (a deleted session) already reached the component, so the two looked different.
- **Now:** `definePane(kind, { Missing })`. Jali renders it in place of `Component` when the params can't be read, inside the pane (so `useTitle` and the other hooks work), with `MissingProps`: the pane's props with the params as they came, `problems` and `close` (with Undo). A kind's `Component` renders the same component, with no problems, for params that name nothing. Without `Missing`, Jali's message as before.
- **Where it is reached:** a layout in code, a saved layout or an action with such a ref. A link holding one is still refused as broken before it opens anything.
- **Tests:** `tests/params.test.tsx`.

## 20 Nov 2026 · `::before` and `::after` on a tab, a switcher item and the activity marks are the app's (Studio, FINDINGS.md, theming gap 10)

- **Why:** a tab takes no children of the app's, so Studio draws a latched tab's lamp in `::before`. If Jali ever used it, the lamp would break.
- **Now:** a part can promise its pseudo-elements (`adornments: true` in `parts.ts`), and the Parts reference says so on each. `tests/parts.test.tsx` reads Jali's stylesheets, nested rules and lists included, and fails if any rule draws `::before` or `::after` on such a part. Jali's own drop line is on `.jali-tab-item`, the wrapper, not on the tab.
- **Not added:** a `tabAdornment(pane)` slot. The promise costs nothing and covers what the slot would.

## 20 Nov 2026 · The theme on Jali's root and layer (Studio, FINDINGS.md, theming gap 23)

- **Why:** an image can't follow the theme through `light-dark()`, so an app switches it by `data-theme`, which Jali wrote only on `<html>`.
- **Now:** `<JaliRoot>` writes the resolved theme as `data-theme` on its root and its dialog layer too, after mount, as on `<html>`, so a rule can be scoped to the workspace. Jali's theme scopes (`jali-theme.css`, `jali-tailwind.css`) ignore the copy where it equals `<html>`'s, so whatever sits between `<html>` and the workspace still decides its colours, and the Tailwind bridge doesn't redeclare tokens on the root over a host's value set above it.
- **Not with `pageTheme: false`,** though the finding asked for that case. There the page's own scopes decide, the setting's resolved value can disagree with them, and a `data-theme` on the root would become one more scope (Jali's `[data-theme="dark"]` and every app rule written as `[data-theme] …`), changing apps that don't ask for it. Such a page switches images on its own scope. Nor over a `data-theme` the app gives `<JaliRoot>`.
- **Tests:** `tests/workspaces.test.tsx`.

## 20 Nov 2026 · A list with no selection starts on what its follower shows (`selects`)

- **Why:** agreement after a layout switch only touched lists that had a selection. A list with none got nothing, so Trips' overview and map and Markets' watchlist each carried the same effect: on first show, select what my follower already shows, so nothing jumps.
- **Now:** a kind says what its list selects, `selects: "quote"`. A list of such a kind with no selection starts on what its follower of exactly that kind shows (`startingSelection`, `actions/follow.ts`): at start-up (`boot`), when a link or Back arrives (`arrive`), and after a preset or `setLayout` (`agreeWithSelection`), in the same change, with no step to undo and no follow step after it. After a preset or `setLayout` the list then agrees as one with a selection does: its other followers show what their kinds give for it. On a link they stay as the link has them, as for a list with a selection. Lists are taken in tree order, so a chain (list → list → detail) starts from the top. A list that has a selection is left to agreement.
- **Why a declaration:** with no selection Jali can't tell what a list selects. A follower of another kind shows what its `follow` gives for a selection, and `follow` can't be turned back: every Markets follower takes `{ symbol }` from any ref, so a quote, a chart and a book would each pass for the selection; a Trips map of a day can't be turned into the day. Guessing could tell a list it has selected an object of a kind it doesn't hold. So only a follower of the declared kind counts, and a kind without `selects` sees no change.
- **Not added:** an inverse of `follow` (a kind's way of turning what it shows back into a selection). Trips' overview with only a map beside it starts on nothing now; no preset has that shape.
- **Tests:** `tests/follow-start.test.ts`.

## 20 Nov 2026 · A layout that arrives and a list's selection agree too, on the selection's side

- **Why:** agreement ran only for a preset or `setLayout`. Back to an older preset brought its followers back as they were, while the list kept the selection the later preset had given it: Trips' place pane showed one place and the map had another selected, and Trips' overview and map carried effects to fix it. A list whose selection disagrees with what its follower shows is incoherent, whatever brought the layout.
- **Now:** `arrive` (Back, Forward, a link, a reload) and `boot` settle the selections (`agreeOnArrival`, `actions/follow.ts`): a list with a selection whose follower of the selected kind shows something else takes what it shows (the layout's word wins, as after a preset); a list with none starts on its follower of the kind it selects. Only the selection changes: the followers stay exactly as the link has them, the address is what the arrive writes anyway, and there is no undo step, no follow step and no announcement of its own. Kept panes don't follow, so they never drive it; a follower with unsaved work does, as after a preset, since what it shows stays on screen. A follower of another kind changes nothing.
- **Tests:** `tests/follow-start.test.ts` (Back to an older preset, a link mid-session, a reload, a kept detail, a follower of an unrelated kind).

## 20 Nov 2026 · A built-in "Pop out pane" command (`pane.pop_out`)

- **Why:** Data Studio and Trips each defined the same ⌘K command calling `unstable_popOut`, while the pane menu already offered Pop out wherever `allow.popOut` is on. Any app that turns pop out on wants it from the keyboard too.
- **Now:** `pane.pop_out` ("Pop out pane", group Pane, no default key) pops the focused pane out. It is in the registry only when the workspace turns pop out on (`allow: { popOut: true }`), so a workspace that leaves it off lists nothing new. It is greyed out, silently, with no pane focused or where the browser can't pop out, and says why when the focused pane's kind (or `when`) doesn't allow it. The floating window is the React adapter's, so core holds a port the adapter sets as it loads (`setPopOutPort` in `@jali/core/adapter`, from `pane/PopOut.tsx`); without one the command can't run.
- **Tests:** `tests/pop-out-command.test.ts`.

## 20 Nov 2026 · A held question holds the action, not the change it computed (QUALITY-REVIEW C8, C9, C10)

- **Why:** "Discard unsaved changes?" kept the change computed when it opened and applied it as it was: close dirty pane A, let pane B show another object while the dialog is open, press Discard, and A closed while B went back. The host's async `beforeClose` had the opposite fault: it kept its change only while the layout was the same object, so a resize during the question turned the person's yes into `"kept"`. Back with unsaved work and Keep editing left the address on the layout the person said no to, so a reload or a copied link opened it. And `setCanInvestigate(false)` made the switch to Single and the permission two changes: with the switch held, the permission changed anyway, and Discard then restored the old one.
- **Now: the intent waits, and is re-resolved when the answer comes** (`state/apply.ts`). What is held is the step `(x) => Outcome` that produced the change: the outermost step around it that has committed nothing yet (so a public action re-reads its target by id or ref too), plus the steps after it in any sequence outside that step. A held step stops its sequence; what follows waits with it (this alone fixes C10's two changes, and the downgrade is now also one change). Every bound action (`store.actions`, `jali.actions`, deferred steps) runs as a step for this. The question records what it named: each pane and the object it showed. The answer (`AnswerStep`, `{ op: "answer", intent, agreed }`) runs the intent against the state of that moment: if what it removes or replaces is still only what was agreed to (same pane, same object), the fresh result is made; otherwise the question is asked again (the host's `beforeClose` with the new panes, or the dialog with the new list). A yes from the host is not asked again, and Discard does not ask the host again, while the panes are the same. Unsaved work is forgotten inside the commit that loses it, never before: an answer that changes nothing keeps it, and an answer that asks again keeps it until that answer. Announcements are as before ("discarded", then what the change says).
- **Back and Forward** (`boot.ts`): the navigation stays with its question. When it ends without the layout changing (the host keeps the panes, Keep editing, or the arrival is refused), the address is written back to what is on screen (replace), for the dialog as for the host. A newer Back or Forward takes the place of an older one still waiting: the older dialog closes, and the older answer (a later host yes included) no longer changes anything.
- **Limited viewers:** `setCanInvestigate(false)` in Split view is one guarded change (op `mode`, the permission's announcement), so Keep editing leaves both mode and permission. A page that arrives (a link, Back, Forward) for a limited viewer opens in Single view and leaves out its opened panes, without changing the person's saved mode.
- **Host-visible:** a later `beforeClose` yes now makes the change when only unrelated things changed meanwhile (was `"kept"`), and asks the guard again when a pane it named now shows another object. `setCanInvestigate(false)` held for unsaved work no longer changes the permission until Discard. No new `RefusalReason`: a question that is asked again ends as the new one does, so "stale" was not needed; the host-visible reasons and `settled` are unchanged, and `"unsaved"` refusals still carry no `settled` (hosts compare them with `toEqual`).
- **Adapter types:** `ConfirmState` holds `{ panes, asked, agreed, intent, settled, settle }` in place of `change`. `Outcome` gains `AnswerStep`; `Intent`, `Asked` and `Agreed` are new types in `state/apply.ts`.
- **Replaces** "Discard applies the held change exactly" (Unsaved work, above) and "unless the layout changed meanwhile (then dropped, `"kept"`)" (Host close guard, above).
- **Tests:** `tests/held-questions.test.ts` (an intervening `openHere`, more work at stake by the answer, a held action gone by the answer, a sequence's later steps, a resize during an async `beforeClose`, a pane showing another object by the yes, Back then Keep editing, Back then Discard, two Backs while the dialog waits, two Backs then Keep editing, Forward to what is on screen, two Backs while the host decides), `tests/viewer-downgrade.test.ts` (held then kept, held then discarded, one announcement, Back to an investigation as a limited viewer). One case in `tests/instance.test.ts` changed with its reason: a later yes after an unrelated pane opened now closes the pane it asked about.

## 20 Nov 2026 · Node ids have a safe shape, and every selector escapes them (QUALITY-REVIEW C1)

- **Why:** `validate` took any string as an id, and ids went into CSS selectors as written. A link holding a pane id with `"` crashed the workspace on mount (`SyntaxError: Invalid selector`).
- **Now:** an id is 1 to 128 letters, digits, `_`, `.`, `:` or `-` (`NODE_ID`, `layout/codec/validate.ts`), for nodes and `linkedTo`; overlay entries take the same shape, or `@auto:` before it (a fold names the automatic group it made). Every id Jali makes fits: `newId`'s `pane-3`, `split-1`, `stack-2`, `launcher-1`; `arrange`'s `row-4`, `tabs-2`; the builders' `orders-2`. A builder names a pane after its kind with any other character as `-` (a kind called `Order detail` gives `Order-detail`), so an app's own layout still validates.
- **And every selector escapes:** `cssString(id)` (`dom/ids.ts`, in `@jali/core/adapter`) quotes any text for an attribute selector. It is used by `dom.pane`, `flashTab`, the tab indicator, tab strip, tab overflow, rename field and shelf. It doesn't need `CSS.escape`, so jsdom and server rendering behave as the browser does. A layout written in code isn't validated, so a quote in its ids reaches the DOM, and now finds its element.
- **What a host notices:** a link, saved layout or `setLayout` with an id outside the shape is refused as broken (`"invalid"` for `setLayout`), where before it opened.
- **Tests:** `tests/hostile-input.test.tsx` (C1).

## 20 Nov 2026 · Public actions check the refs they are given, and never throw (QUALITY-REVIEW C4)

- **Why:** `openHere(pane, { kind: "typo", params: {} })` threw `Unknown pane kind: typo` from the layout operation under it, against the `ActionResult` contract. `null`, a ref without params, or params holding an object, threw as well.
- **Now:** `checkRef(kinds, ref)` (`pane-kinds.ts`, in `@jali/core/adapter`) is the one check, run at the public action boundary (`actions/public.ts`) before any step sees the ref: `openBeside`, `openHere`, `addTab`, `peek` and `select` refuse `"invalid"` for a kind the workspace doesn't have, and for anything that isn't `{ kind, params }` with text, finite numbers or flags. A pane named by a ref (`PaneTarget`) must be well formed too (`"invalid"`); a well-formed ref of an unknown kind names no pane (`"not-found"`). The agent bridge uses the same check, so its words are unchanged (`There is no kind "chart"`).
- **Said:** the refusal is announced, through messages (`announcements.unknownKind`, `announcements.invalidRef`), and is the result's `message`. Before, `addTab`'s refusal of an unknown kind was silent.
- **Not refused:** a ref of a known kind whose params its kind's types can't read (`order({ id: "lost" })`). It still opens, in the kind's `Missing` (20 Nov, "A kind's `Missing`"): that is how an app shows "this order is gone", and refusing it would take that away.
- **The layout operations still throw** on an unknown kind (`layout.openBeside`, `addTab`, `setRef`): they are the pure API, documented to throw, and the actions now never reach them with one.
- **Tests:** `tests/hostile-input.test.tsx` (C4); `tests/instance.test.ts` (addTab's refusal now has its message).

## 20 Nov 2026 · Names on `Object.prototype` are never kinds, ids or entries (QUALITY-REVIEW C3)

- **Why:** the kind registry and the per-pane records were plain objects read with `record[id]` and `id in record`. `openBeside(…, { kind: "constructor" })` passed the agent's check, a follower with id `constructor` was always "held for unsaved work", the palette crashed on `paneCommands["constructor"].map`, a pane with id `toString` took a function as its title, and `usePaneState` in a pane called `constructor` read `Object` as its stored value.
- **Now:** `kinds.registry()` has no prototype, and every read of a record keyed by something from outside goes through `own(record, key)` (`own.ts`, in `@jali/core/adapter`), every membership test through `Object.hasOwn`: `titles`, `unsaved`, `paneCommands`, `selection`, `activity`, `paneState` (both levels), `paneAttributes`, `view.scroll`, a ref's params and the kind registry, in core and in `@jali/react`. The layout operations test a kind with `Object.hasOwn`, so a registry a host builds as a plain object is safe too. Stored pane state keeps only entries that are records.
- **Not changed:** the records in `UiState` stay plain objects, as their type says and as a host spreads them; the reads are what make the prototype irrelevant, so a record a host or a test builds with `{}` is read safely as well. A `Map` would have changed the public state's shape.
- **Tests:** `tests/hostile-input.test.tsx` (C3).

## 20 Nov 2026 · Every setting is checked on its own, and a bad one can't break a running workspace (QUALITY-REVIEW C2)

- **Why:** `loadSettings` checked only `theme` and `boundary`. A stored `paneCap: "8"` made `createJali` throw a RangeError on every load until the person cleared their site data, and `changeSettings({ paneCap: 0 })` broke a running workspace, because the store set the state before the refit that threw.
- **Now:** each setting has its check (`state/settings.ts`): `centreDrop` `"swap" | "tab"`, `theme` `"system" | "light" | "dark"`, `boundary` `"tint" | "none"`, `paneCap` a whole number from 1 to 64 (`PANE_CAP_MAX`). Loading falls back field by field: a bad saved `paneCap` takes the default (the app's `settings`, else Jali's), and a good saved theme beside it is kept. A bad app default falls back to Jali's. Keys that aren't settings are dropped, as the old ones were.
- **`changeSettings`** refuses `"invalid"`, silently and changing nothing, when any value in the patch is one its setting can't take; keys that aren't settings are left out.
- **Why 64:** fitting needs at least 1, and the dialog offers 2 to 16. An app may default higher (Trips once wanted 10), but past 64 the fitting cost (QUALITY-REVIEW P1) makes a cap meaningless, and nothing a person sets reaches it.
- **The store's raw write** computes the whole next state, refit included, before putting it in place (`write` in `state/store.ts`), so a refit that throws leaves the state as it was.
- **Tests:** `tests/hostile-input.test.tsx` (C2).

## 20 Nov 2026 · Sizes kept on the device are read as sizes only (QUALITY-REVIEW C2)

- **Why:** with `sizes: "local"`, the sizes a person dragged were spread onto the link's nodes as stored (`joinPersonalSizes`). A `null` entry stopped startup, and an entry holding anything else (a `ref`, `children`, a negative px) reached the layout unchecked, after the link itself had been validated.
- **Now:** only `size` and `base` that are one positive finite px or weight, and `userSized: true`, are taken from an entry; the rest is left out, and an entry that isn't an object is skipped. Entries in the store that aren't `[key, sizes]` pairs are ignored. The joined layout is validated with the link's kinds; if it fails, the link opens as it is, with the designed proportions. Kept sizes are read through `own`, so a pane called `constructor` has none it didn't save.
- **Tests:** `tests/hostile-input.test.tsx` (C2b).

## 20 Nov 2026 · Only a pane on screen can be maximised (QUALITY-REVIEW C5)

- **Why:** `toggleZoom("a")` on a pane the layout hides (`overlay.hidden`: a curated page's hidden view, a builder's `hidden: true`) returned `ok: true`, and every model read after it threw (`resolve` assumed the zoomed pane was drawn). A link's `zoom=` naming such a pane did the same.
- **Refuse, not reveal:** the hidden pane has no slot to come back to on its own: on a curated page it is a view the person turned off, and bringing it back is the page's `openTab`, a deliberate choice with its own history entry. Revealing it as a side effect of "maximise" would undo that choice silently, so `toggleZoom` and `toggleFullScreen` refuse `"blocked"` and say "<pane> is not on screen", as `tuck` does for the same pane. Restoring is never refused. A pane behind a tab (folded, tucked, a tab of a group) is drawn, so it can still be maximised as before.
- **And nothing assumes a drawn pane:** `resolve` (`fit/resolve.ts`) ignores a zoom on a pane it did not draw instead of reading its bounds; the focus keys move a zoom only to a pane on screen; `readSearch` drops a `zoom=` for a pane the link's layout hides.
- **Tests:** `tests/hostile-input.test.tsx` (C5).

## 20 Nov 2026 · What a link can open is limited (QUALITY-REVIEW C6)

- **Why:** a page link's `open=` repeated N times ran N full opens and fits, and with fitting's cost (QUALITY-REVIEW P1) a few hundred entries froze the tab. `validate` let a layout link hold 2,048 nodes, which no fit finishes in time either.
- **Page links:** `readSearch` reads `open=` in the link's order, keeps each object once (the same kind and params, in any order) and stops at 32 (`OPEN_MAX`, `url.ts`). The rest are left out, without a word: the link still opens, with the first 32. Why 32: the settings dialog offers a pane cap of up to 16, so an investigation of more than 32 opened panes is two screens of folded tabs; nothing a person opens by hand comes near it, and 32 fits stay well under a second.
- **Layout links:** `validate` takes at most 256 nodes (`MAX_NODES`, `layout/codec/validate.ts`), and the overlay's lists the same. A layout of 256 nodes is about 128 panes with their rows, columns and groups, eight times the largest pane cap the dialog offers and twice `PANE_CAP_MAX`. The depth limit (128) is unchanged.
- **What a host notices:** a link or saved layout with more than 256 nodes is refused as broken (`setLayout`: `"invalid"`).
- **Tests:** `tests/hostile-input.test.tsx` (C6).

## 20 Nov 2026 · The browser's address is written from the whole address (QUALITY-REVIEW C7)

- **Why:** `browserLocation().navigate` wrote `pathname + search + hash`. On a page whose path starts with `//` (`https://app.test//evil.com/x?l=…`), that relative URL names another host, so `replaceState` threw a SecurityError in `boot` and the workspace never started.
- **Now:** it takes `location.href`, sets its search and writes the whole URL, so it always stays on the page's own origin and path. Nothing is written when the address would not change, as before. Router adapters are unchanged: they navigate by search alone.
- **Tests:** `tests/hostile-input.test.tsx` (C7).

## 20 Nov 2026 · A ref in `peek=` and `open=` reads back as written (QUALITY-REVIEW P17)

- **Why:** the ref text (`order~id=#42~draft=!true`) wrote text values as they were, so text that looked like a mark changed on the way back: `"#123"` came back as the number 123, `"!true"` as `true`, and a value or key holding `~` or `=` was dropped or broke the ref.
- **Now:** in a kind, a key or a text value, `%`, `~`, `=`, `#` and `!` are written `%25`, `%7E`, `%3D`, `%23` and `%21` (`encodePeek`), and read back (`decodePeek`), so any text comes back as it went. Numbers and flags are marked as before. Text without those characters is written exactly as before, so a link from before reads the same and a ref without them gives the same text.
- **The one change for old links:** text written before this that held `%25`, `%7E`, `%3D`, `%23` or `%21` literally now reads as the character. Such text was rare (it only arises from a value that already contained a percent escape), and the old encoder couldn't round-trip it either.
- **Keys** are collected with `Object.fromEntries`, so a key such as `__proto__` is a param like any other.
- **Tests:** `tests/hostile-input.test.tsx` (P17).

## 20 Nov 2026 · A prefixed workspace leaves the host's `app` and `arr` alone (QUALITY-REVIEW P17)

- **Why:** every workspace deleted `app` and `arr` from the address when it wrote a page link, and read `?app=review` as its page, prefix or not. Beside a host that uses `?app=billing`, a prefixed workspace erased the host's param, against "Jali writes only its own params" (18 Nov, the location port).
- **Now:** the old lab's page params are the unprefixed workspace's only (`legacyKeys`, `url.ts`). It still reads `?app=review` as its page and clears `app` and `arr` when it writes one, as kept on 20 Nov ("Jali and five example apps"), because those links were written by an unprefixed workspace. A workspace with a `prefix` neither reads nor clears them.
- **Not added:** an option to turn the alias off for the unprefixed workspace too. A host whose own `app` param could be `review` should give its workspace a prefix, which it needs anyway to keep its params apart.
- **Tests:** `tests/hostile-input.test.tsx` (P17b).

## 20 Nov 2026 · Fitting carries the projection forward (QUALITY-REVIEW P1)

- **Why:** fitting cost grew far faster than the panes. Each new fold replayed every earlier fold from scratch, each candidate fold ("which supporting pane helps?") replayed them again, finding the folds to undo replayed every prefix, and each fold followed every alternative home through to a fit. Inside all of that, `allPanes` rebuilt pane lists for every `contains` and `orderOf`, and fold priority measured link distance with a loop over every pane per step. In Node, a refit of one row of 200 px panes at 1400 px (cap 8) took 25 ms at 16 panes, 0.96 s at 32 and 7.5 s at 64.
- **Now:** replaying `[...folds, id]` is replaying `folds` and then `id`, so a replay grows one fold at a time (`run` and `extend`, `fit/replay.ts`) and a refit walks its recorded folds once, stopping at the first prefix that fits, and folds on from there (`fit/refit.ts`). Probes copy the replay instead of starting again. With tucks, a tuck's home depends on every fold, so the replay starts again only when a new fold moves a tuck's home. Every fold takes exactly one slot off screen, so the alternative home that keeps the most slots is the one that fits after the fewest further folds: the trials advance side by side, one fold each per round, and the first to fit wins (ties to the rule's home, as before), so no trial runs past the winner. Pane lookups go through maps built once per step (`foldHomes`, `auto`), and link distance is a breadth-first search over a link map (`chooseFold`).
- **Budget:** the alternative-home search spends from a fixed budget per replay (`LOOKAHEAD`, 8,192 slot-steps: each trial copied or folded on costs the slots it has). When a round would cost more than is left, the slot goes to the rule's home, as before the search existed. The budget is part of the replay, so the same folds spend it the same way on every machine: replaying recorded folds still reproduces the arrangement. Every existing test, and a generated corpus of layouts up to 17 panes, fits exactly as without a limit (a quarter of the budget already changes one corpus layout). A workspace of hundreds of panes searches its first folds only; the choice of home for its later folds then follows the rule, not the lookahead.
- **Measured** (Node, Apple laptop, best of runs; refit at 1400 px with cap 8, then a resize step from that fitted layout: refit at 1000 px and resolve):

  | Panes | Flat row refit, before → after | Flat row resize step, before → after | Nested linked rows refit, before → after |
  | ----- | ------------------------------ | ------------------------------------ | ---------------------------------------- |
  | 16    | 35 → 1.0 ms                    | 61 → 2.6 ms                          | 29 → 1.1 ms                              |
  | 32    | 957 → 6.0 ms                   | 1,270 → 12 ms                        | 793 → 9.1 ms                             |
  | 64    | 7,544 → 6.6 ms                 | 8,547 → 12 ms                        | 10,833 → 9.9 ms                          |
  | 128   | not run (minutes) → 10 ms      | not run → 14 ms                      | not run → 15 ms                          |
  | 200   | not run → 17 ms                | not run → 18 ms                      | not run → 26 ms                          |

  Above about 32 panes the cost is mostly the spent budget, so it grows slowly; the rest is a fold's own work, about linear in the panes, so a fit grows about quadratically.

- **Unchanged:** every fit and resolve gives the old engine's result. `layout/test/legacy-fit/` keeps a frozen copy of the old engine, and `layout/test/fit-equivalence.test.ts` compares the two over a generated corpus (layouts, overlays with stale folds, hides and tucks, rooms, caps, views, every fit policy, then a second refit at another width); `JALI_FIT_CORPUS=full` runs the whole corpus. No public API changed; the engine stays pure.
- **Tests:** `layout/test/fit-equivalence.test.ts`, `layout/test/fit-scale.test.ts` (200 panes under 50 ms, with slack for CI, and no worse than quadratic growth).

## 20 Nov 2026 · Subscriptions read only what they show, and render counts are tested (QUALITY-REVIEW P2, P23)

- **Why:** the memoisation of 17 Nov (WP3: "a keyboard resize re-renders only the frames on either side of that divider") had been undone, and nothing tested it. A pane drag set the whole `dnd` on every pointermove and the workspace subscribed to all of it, so each move re-ran `frames()` and re-rendered every divider layer. Every pane's header actions subscribed to the whole model and rebuilt the pane's menu, so a keyboard resize re-rendered every frame. `useJaliCommands` returned a new array on every store change, so a host's kbar or cmdk re-registered its actions on every pointermove. A pane's live title re-ran the layout resolve. An inline `icons={{…}}` re-rendered every icon user, and the tab underline re-created its ResizeObservers on every render.
- **Now:**
  - **Drag:** core writes `dnd` at most once a frame, and only when it changed (`workspace/dnd.ts`). A release or Escape uses the pointer's last point. A `DragLayer` (`Workspace.tsx`) is the only part that subscribes to the whole `dnd` and draws the drop indicator and the chip. The workspace subscribes to the target pane and to whether a drag is on, and `DividerLayer` is memoised.
  - **Header actions:** worked out with `useDerived` (`state/react.tsx`) and compared by value (`samePlan`). It is worked out again when the state changes, but not when only `dnd` changes. The pane switcher's tucked mark and the drop label's title read one value each from the model (`useModelValue`).
  - **Commands:** `useJaliCommands` keeps the same array until a listed command's title, group, keys, disabled state or reason changes, or a pane's own `run` changes.
  - **Titles:** the model cache (`state/model.ts`) is keyed on geometry. A new title gives a new model that shares `resolved`, `content`, `flat` and `groups` with the old one and swaps only `title`.
  - **Icons:** `icons` are compared name by name.
  - **Tab measuring:** the tab underline observes the strip part and each tab once per shown tab, and observes again only when tabs are added, closed or moved (a MutationObserver). `TabStrip` measures when what it lays out changes, not on every render.
- **Measured** (`tests/render-counts.test.tsx`, jsdom, 10 panes in five columns of two at 2400×1000; commits counted with a `<Profiler>` around each frame, body and divider layer; workspace renders counted as `frames()` calls):

  | Run                                                                 | Workspace renders | DividerLayer | PaneFrame | PaneBody |
  | ------------------------------------------------------------------- | ----------------- | ------------ | --------- | -------- |
  | 60-move pane drag across the top row (12 changes of target), before | 60                | 60           | 16        | 0        |
  | the same, after                                                     | 5                 | 0            | 16        | 0        |
  | 10-step keyboard resize of one divider, before                      | 10                | 10           | 100       | 0        |
  | the same, after                                                     | 10                | 10           | 20        | 0        |

  The 16 frame commits in a drag are changes of target: a frame gains or loses its drop-target mark or its zone label. Pointer moves within one zone commit no frame. Ten pointer moves inside one frame used to make ten `dnd` writes and now make one.

- **Size:** @jali/core +0.2 KB gzip, @jali/react +0.6 KB gzip (full scenario: 55.0 and 24.7 KB, from 54.8 and 24.1).
- **Tests:** `tests/render-counts.test.tsx`. A keyboard resize commits only the two neighbouring frames and no body. A pane drag commits no frame per move, only on a change of target, and no divider layer or body. `dnd` is written at most once a frame, and a release lands where the pointer last was. A live title keeps the resolved geometry. `useJaliCommands` keeps its array through a drag, a focus move and a divider move. The tab underline observes no new elements when titles change. An inline `icons` object re-renders no frame.

## 20 Nov 2026 · One set of keyboard and focus primitives: a roving row, a modal dialog and a menu (QUALITY-REVIEW P5, P6, P7, P8)

- **Why:** each part did its own keys, and each copy had its own gaps. A pane's tab strip had no arrow keys, so only the shown tab could be reached; the pane switcher couldn't wrap backwards; Settings and the discard question dropped focus on `<body>` when they closed, and Tab walked behind their scrim; the discard question didn't count as a dialog, so F6 and ⌘\ acted behind it; the tab menu and the strip's lists were near copies, and the shelf's **+N** list was `role="menu"` with no menu keys. Menus portalled from a pane's header still sent their React events up through it: a press in a menu dragged the pane, a double-click maximised it.
- **Now:** three internal primitives in `packages/react/src/a11y/`, not exported (they are how Jali's own parts behave, not a contract a host builds on):
  - `useRovingKeys(items, move?)` (`roving.ts`): ← and → in reading order (`inlineStep`, so right to left ← moves on), wrapping both ways, Home and End. Only keys pressed on an item count (not a rename field in the row), and a key with a modifier is left for the keymap. Used by a pane's tab strip, the pane switcher, a curated page's tabs and the shelf's chips.
  - `ModalDialog` (`ModalDialog.tsx`): reads `document.activeElement` as it renders, focuses `initialFocus` (else the first tab stop), wraps Tab and ⇧Tab (a radio group is one stop), makes the workspace root `inert` (or, while a full-screen pane holds the layer, every sibling on the way up to the root), closes on Esc and a press on the scrim, and on close gives focus back, unless the change it made moved focus on purpose or removed that element. With `focusHeld` it moves no focus and inerts nothing. Used by ⌘K and the chooser (`ListDialog`), Settings and the discard question.
  - `Menu` (`Menu.tsx`): focus in on open (the item a caller names, else the first), ↓ ↑ wrapping, Home, End, Enter and Space choose, Esc closes with focus back to its opener, Tab and a press outside close it; keys used are the menu's alone. At a point it portals into the layer and flips at the window's edges; without one it renders in place (the shelf's). Its root stops pointer, click, double-click, context-menu and key events from going up React's tree. Used by a tab's menu, the strip's **+N** and **N folded** lists, and the shelf's **+N**. No typeahead: none of the copies had it.
- **Activation is manual everywhere:** an arrow moves focus; Enter, Space or a click selects. For a tab strip this is APG's advice when showing a tab costs something (a pane mounts or wakes). The pane switcher used to switch on each arrow, but switching moves focus into the pane, which ended the walk after one step; it now moves focus along the switcher and switches on Enter. A visible change.
- **Core:** the keymap's `dialogOpen` counts `confirm`, so the discard question owns the keys like the other dialogs. `focusPane` and `keepPaneFocus` (`dom/focus.ts`) leave focus alone inside `[data-jali-layer]` (the workspace's dialogs and menus) as well as any `dialog`, `[role=dialog]` or `[role=alertdialog]`; before, only `[role=dialog]`.
- **The header's own handlers** (`PaneFrame.tsx`: right-click menu, drag, double-click to maximise) also act only on events whose DOM target is inside the header, so an app's popover portalled from a header control can't drag or maximise the pane either.
- **P8:** in forced colours (`@media (forced-colors: active)`, at the end of `pane.css` so it wins over the rules above it), the shown tab's underline is `Highlight`, the activity dots `CanvasText`, and the focused pane has a 2px `Highlight` outline. "Loading" uses `--jali-text-subtle` (6.1:1 light, 6.3:1 dark) instead of `--jali-text-faint` (2.7:1). ⌘K and the chooser scroll the selected option into the list's view (the list only, never the page). A tab behind its group says what its pane is doing in its `aria-description` ("Needs you. Delete closes it."); the strip re-renders only when one of its own tabs' activity changes.
- **Size:** `@jali/react` +0.8 KB minified, +0.6 KB gzipped (76.4 / 23.5 → 77.2 / 24.1 in the minimal scenario); `styles.css` +0.2 KB minified, the same gzipped; `@jali/core` the same; the three primitives replace four copies of roving keys, two of menu keys and three dialog shells.
- **Tests:** `tests/roving.test.tsx` (strip arrows, Home, End, wrapping, right to left, modifiers left alone, manual activation; the switcher wraps both ways and switches on Enter only; a tab behind's activity), `tests/modal-dialog.test.tsx` (focus back after Settings, its close button, the discard question, ⌘K and the chooser; Tab wrapping; the root inert; F6 held while the discard question is open; the selected option scrolled into view), `tests/menu.test.tsx` (a tab's menu, the folded chip's and the shelf's **+N**: focus in, wrapping, Esc back to the opener; a press and a double-click in a tab's menu neither drag nor maximise the pane). `e2e/axe.spec.ts` (Settings and the discard question pass axe, keep Tab inside and give focus back), `e2e/a11y.spec.ts` (forced colours keep the underline and the focused pane's outline).

## 20 Nov 2026 · One ref equality (QUALITY-REVIEW P14)

- **Why:** refs were compared four ways. `apply.ts` (unsaved work at stake, the panes `beforeClose` is asked about, held questions, and which panes' records to drop) and `frames.ts` compared `JSON.stringify` text, which depends on key order; `ops/ref.ts` and `follow.ts` each had their own key-by-key copy. A layout loaded from Postgres `jsonb` (which reorders keys) made every pane look replaced: Jali asked about unsaved work, asked the host, and dropped pane state, titles and attributes.
- **Now:** one `sameRef` (`layout/ops/ref.ts`): the same kind and every param `===`, in any key order, own keys only. `sameRef` from `@jali/core` and `@jali/core/adapter` is the same function, and every comparison in core and in `<PaneBody>`'s memo uses it. The private `equalRef` is gone (it was never exported). `kinds.sameRecent`'s text comparison stays: it is deliberately looser (`1` equals `"1"`) and already order-free.
- **Tests:** `tests/same-ref.test.ts`.

## 20 Nov 2026 · `usePaneState` keeps its first `initial`, and can check what was stored (QUALITY-REVIEW P10)

- **Why:** while nothing was stored, `usePaneState` returned each render's `initial`, but its setter's `prev` was the first one. An object written inline is a new value on every render, so a value derived from it changed by itself (Trips' Explore filters). And a value read back from storage was trusted as `T`, though an older version of the app, or a hand edit, wrote it.
- **Now:** the first `initial` is kept (a ref) for both the read and the setter's `prev`, as `useState` does. New, additive: a third argument, `usePaneState(key, initial, { parse })`, with `PaneStateOptions<T>` exported from `@jali/react`. `parse(stored: unknown): T | undefined` turns what was stored into the value, or `undefined` (or a throw) to use `initial`. It runs once per stored value, so a parse that copies doesn't make a new value each render. A rejected value stays stored until the pane sets its own: the pane may be an older build than the one that wrote it.
- **Why not a validate-only option:** `parse` also lets an app migrate an old shape (`{ col }` to `{ column }`) without a separate step.
- **Tests:** `tests/use-pane-state.test.tsx`.

## 20 Nov 2026 · The pane hooks hold one report per call (QUALITY-REVIEW P11)

- **Why:** `useCommands`, `useUnsaved`, `useActivity`, `useTitle` and `usePaneAttributes` each wrote one slot per pane. The last caller won, and any caller unmounting cleared the slot for all: a child editor unmounting cleared its parent's unsaved guard, and a list's commands vanished when its toolbar re-mounted. The boundary's loading and failed states overwrote the content's activity and commands the same way.
- **Now:** each hook call reports under its own `useId()`, with its render order, and core keeps every caller's report (`paneReports`, `reportPane` in `actions/content.ts`) and merges them into the pane's `paneCommands`, `unsaved`, `activity`, `titles` and `paneAttributes`, which every reader already uses:
  - commands: concatenated in render order (a parent's before its children's, an earlier mount before a later one); a repeated id keeps the first;
  - unsaved: the pane has work while any caller has some; the text is every distinct text, joined with ", " ("an unsaved note, a draft reply");
  - activity: the most pressing (`ACTIVITY_URGENCY`: error, needs you, working, loading, live), moved from `TabOverflow.tsx` to core with `mostPressing`;
  - title and attributes: the last caller in render order that gives one, which is the innermost component on a first mount and the latest mounted after that.
    The boundary's loading and failed states are callers like any other. A caller unmounting removes only its own report. A pane that shows another object loses its callers' titles and attributes, as before; Discard clears its callers' unsaved texts with the merged one.
- **Unchanged:** the hooks' signatures, and `store.actions.setUnsaved` and its siblings, which still set the merged value directly.
- **New in `@jali/core/adapter`** (adapters only): `reportPane`, `mergeReports`, `PaneReport`, `PaneReportPatch`, `ACTIVITY_URGENCY`, `mostPressing`, and `PaneHost.report(caller, seq, patch)` in `@jali/react`'s internals.
- **Tests:** `tests/pane-hook-callers.test.tsx`.

## 20 Nov 2026 · Pane state and selections belong to the object, not the pane id (QUALITY-REVIEW P13)

- **Why:** `usePaneState` values and lists' selections were keyed by pane id alone. Ids are reused (`newId` takes the lowest free `pane-N`, so closing `pane-2` and opening anything gives the next pane `pane-2`), are kept for an undo, and after a reload name whatever the address's layout puts there. A new detail read a closed detail's scroll and draft; a new list started on a closed list's selection, and a preset or `setLayout` that put another list under the same id carried the selection over (and moved its followers to it).
- **Now:** an object key, `objectKey(kinds, ref)` (`state/pane-state.ts`): the kind plus `kinds.identityOf(ref)`, or the params in key order for a scratch kind.
  - **Pane state:** `UiState.paneStateOf` records the object each pane's state belongs to, and is saved beside it (storage key `pane-state-of`). `usePaneState` reads a pane's state only while the pane shows that object (`paneStateFor`), and a write for another object starts a new record. An entry stays while a pane with its id shows its object in the layout or an undo entry (`ownedPaneState`), so an undo brings the state back with its pane; otherwise it goes. Boot drops saved state the arriving layout can't show. A pane whose ref changes but whose object doesn't (an identity that ignores a param) now keeps its state; before, any change of ref dropped it.
  - **Selection:** `UiState.selectionOf` records the list each selection was made in. An entry whose id arrives in the layout showing another object is dropped (`ownedSelection`, on every commit that changes the layout or the selection). A list that stays in the layout keeps its selection when it moves to another object (a list that follows a list), as before. `agreeWithSelection` (presets, `setLayout`) and `agreeOnArrival` (links, Back) ignore a selection made in another list than the one the new layout shows at that id (`selectionFor`). An entry for a list that left the layout stays with its owner, so an undo that brings the same list back keeps it.
  - **Discard:** "Discard" also forgets the discarded panes' own state, so undoing the close doesn't bring the discarded draft back.
- **Host-visible:** pane state saved before this has no object with it and is not read back (one reload loses a scroll position or a sort). `loadPaneState` reads only entries that have an object; `savePaneState(storage, state, owners?)` takes the owners as a new optional argument. New in `@jali/core/adapter`: `objectKey`, `paneStateFor`, `ownedPaneState`, `ownedSelection`, `selectionFor`, `loadPaneStateOwners`, `PaneOwners`; `agreeOnArrival` takes the owners as an optional fourth argument.
- **Tests:** `tests/pane-state-identity.test.ts`; `tests/pane-contract.test.ts` saves through `savePaneState` and checks that state saved without its object is left out.

## 20 Nov 2026 · `jali.destroy()` (QUALITY-REVIEW P18)

- **Why:** a workspace had no teardown. A follow waiting for the selection to rest and the address's debounced write outlived `stop()` and could write onto the next route's address; the store's subscription to the kind registry was never released; and stopping dropped pane state still waiting for its 400 ms save.
- **Now:** `jali.destroy(): void`, additive on `Jali`. It stops the listeners if started, saves pane state still waiting, clears every deferred step and drops later ones, cancels the address's pending write, and unsubscribes from the kind registry. `start()` after it does nothing; reading state still works; a second call does nothing. The stop `start()` returns now saves pending pane state instead of dropping it. `UrlWriter` gains an optional `cancel?(): void` (the built-in URL sync has it), which `destroy()` calls; a host's own writer may leave it out.
- **Not done:** `<JaliRoot>` doesn't destroy on unmount: the host owns the workspace, which may outlive one mount (HMR, a remount under a new key). A router app calls `destroy()` where it drops the workspace.
- **Tests:** `tests/destroy.test.ts`; `tests/instance.test.ts` and `tests/public-api.test.ts` list the new member.

## 20 Nov 2026 · A first render that matches the server's: Pop out and key labels (QUALITY-REVIEW P19)

- **Why:** `HeaderActions` called `canPopOut()` during render. A server says no and Chrome says yes, so with `allow.popOut` on, hydration found a button the server never rendered, and React threw the server's HTML away. Key labels had the same flaw from the other side: `createKeymap` reads the platform where the workspace is made, and Node has a `navigator` too, so a server on a Mac prerendered "⌘" for every reader, and one on Linux "Ctrl" for Mac readers. (`commands/format.ts`' deprecated `isMac` is the one read at module load; nothing in Jali uses it, and its comment now says not to print from it before hydration. It stays exported from `@jali/core/adapter` for compatibility.) The SSR test added on 20 Nov rendered to a string and never hydrated.
- **Now:**
  - Pop out: `useCanPopOut()` (`pane/PopOut.tsx`) is `useSyncExternalStore` with a server snapshot of `false`. The server and the hydrating render agree; React then renders again with the browser's answer. A page rendered only in the browser has the button on its first render.
  - Keys: a new additive `Keymap.forPlatform(platform): Keymap` (the same bindings, matched and printed for another platform; the same object for its own; refused bindings not reported twice) and `SERVER_PLATFORM = "other"` in `@jali/core/adapter`. `@jali/react` reads labels through an internal `useKeymap()` (`state/hydrated.ts`): `SERVER_PLATFORM` on a server and while hydrating, the workspace's own after. It is used by `useShortcut` (public, so a host's own labels are safe to prerender), the unknown-kind message, the peek sheet's close tip and the page bar's ⌥-click hint.
- **Left for later:** `HeaderActions`' own tooltips (tuck, close, maximise, full screen) still read `store.keymap`, so a prerendered pane header's `title` attributes can differ from the browser's. React reports attribute differences in development only and keeps the server's HTML, so nothing is thrown away; they should move to `useKeymap()` once the subscription work in `HeaderActions.tsx` lands (another branch owns that file today). The settings panel's key list renders only when open, never on a server.
- **Tests:** `tests/server-render.test.tsx` now also renders with `allow.popOut` on, a Pop out button and a `useShortcut` label, on a "Mac" server; then hydrates that HTML in jsdom as a Windows reader in a browser that can pop out, and checks that `onRecoverableError` is never called, and that after hydration the reader's keys and Pop out show.

- 2026-11-20 · **Server rendering on React 18.** On React 19, a server-rendered workspace hydrates without a mismatch (tests/server-render.test.tsx). On React 18 it does not: each pane has its own Suspense boundary, and the workspace writes to its store as it mounts (it measures its size), and React 18 can't take a store update in a boundary that is still hydrating, so it client-renders those panes after hydration ("This Suspense boundary received an update before it finished hydrating"). The page still works and shows the same thing; only the server's pane markup is replaced. The hydration test runs on React 19 only. **Closed 21 Nov 2026:** the workspace measures once its panes have hydrated ("Server rendering on React 18: the panes keep the server's markup").

## 20 Nov 2026 · The curated page is opt-in: `definePage` brings its code (QUALITY-REVIEW P3)

- **Why `page.ts` wasn't tree-shaken:** nothing about it was unreachable to a bundler. `ACTIONS` (the engine's step table) listed every page step, `open`, `close` and `boot` imported page helpers, the registry built the page's eight commands for every workspace, `en` held the page's words, and `<JaliView>`, `<Panes>` and `<SettingsPanel>` imported the page's React parts. `sideEffects: false` was set and correct; the page was simply referenced.
- **Now:** the page's code arrives with the page. Core's `definePage(page)` (new in `@jali/core`) returns a copy of the page carrying a `PageEngine` under a symbol (`PAGE`): its steps, what the free workspace's steps ask of it (`goToRole`, `investigation`, `placeAfterArrangement`, `settleRoles`, `withoutOpened`), `besidePreview`, its commands and its English. `@jali/react`'s `definePage` calls it and adds the page's React parts (`PAGE_PARTS`: the view, the ⌥ preview over the panes, the page's fieldsets in Settings). The store keeps the engine as `env.page`; every page step in `ACTIONS` and `jali.actions` goes through `pageStep(name)`, which refuses `"unavailable"` without a page. A page not made by `definePage` is refused when the workspace is created, with an error that says so.
- **Words:** the page-only messages moved to `state/page-messages.ts` (`pageEn`): the `page` area, 16 announcements, 8 command titles and one toast. Keys are unchanged, and `en` still has every key (built by a pure call, so an app that never imports `en` doesn't ship the page's words through it). `resolveMessages(overrides, page)` layers English, the page's English, then the overrides. Without a page, `jali.messages` has no page words; `jali.messages === en` no longer holds.
- **Host-visible:** a workspace without a page no longer lists the eight `page.*` commands (they were always refused there). `createJali({ page })` with a hand-built profile now throws; pages made with `definePage` (the documented way) are unaffected. `viewerLabel` moved to `actions/page.ts` and takes its words (no English default). In the adapter: `env.page`, `pageEngine`, `pageStep`, `PageSteps`, `PageEngine`, `OpenPage` and `BesidePreview` (both now in `profile.ts`).
- **Also unreachable but shipped:** top-level `new Set`, `new WeakMap`, `Object.freeze`, `Object.keys` and `Object.fromEntries` calls kept their modules in any bundle. They are marked pure; the layout-only app no longer ships part of `actions/content.ts` and `state/apply.ts`.
- **Tests:** `tests/page-opt-in.test.ts`; `pnpm size` fails if the minimal app ships `actions/page.ts`, `state/page-messages.ts` or `chrome/PageBar.tsx`, or the headless one ships the first two.

## 20 Nov 2026 · Size after the opt-in page: over budget, and why (QUALITY-REVIEW P3)

Gzipped KB (minified in brackets), `pnpm size` on the merged code, before this work → after:

| scenario  | @jali/core                  | @jali/react               | styles.css | budget (core / react / css) |
| --------- | --------------------------- | ------------------------- | ---------- | --------------------------- |
| minimal   | 56.2 (170.5) → 52.3 (156.1) | 24.6 (79.0) → 24.5 (77.5) | 8.2 → 8.2  | 49.5 / 18.3 / 7.8           |
| full      | 56.4 (171.1) → 57.3 (172.3) | 25.4 (81.2) → 26.2 (83.6) | 8.2 → 8.2  | 49.5 / 19 / 7.8             |
| own-icons | 56.2 → 52.3                 | 24.6 → 24.5               | 8.2 → 8.2  | 49.5 / 18.3 / 7.8           |
| headless  | 50.2 (152.7) → 46.7 (140.0) | –                         | –          | 45                          |
| layout    | 10.2 (29.4) → 10.2 (29.4)   | –                         | –          | 9.6                         |

The opt-in page took 3.9 KB off the minimal core and 0.7 KB off its React; the `DomPort` (below) then moved the
markup lookups into @jali/react (`reactDom`, 2.1 KB minified), which is where most of React's gain went. The full
app, which has a page, grew by those lookups and by `appOnly`.

- **What is left over the budgets is code the minimal app reaches**, not code it can't: the budgets were set on 19 Nov, 10% over what shipped then, and the work since then shipped features the minimal app uses (one input layer, the fitting rewrite, keyboard and focus primitives, the menus and modal dialog, pop out, phones, rename, tab menus). In the minimal app, the core's largest reached modules are the English messages a workspace says (13 KB minified), the command registry (7), `apply` (7), the address (5), the store (4.8) and `open` (4.8); React's are the default icons (6.9), the tab strip (6.5), the workspace (6.2), the frame (4.3), the strip (3.9) and the header buttons (3.8). Every one is reached at run time. The layout-only app ships only `layout/` modules now: its 0.6 KB over is the fitting rewrite and the hardened validator from phase 1. The CSS is all used (DECISIONS, 19 Nov).
- **Not done, because it would change the design rather than remove dead code:** splitting `en` into one export per message (every message the workspace says is reachable through `jali.messages`, a translation is keyed by area, and the React parts read most areas); making Settings, the chooser, pop out or stacked view opt-in modules (each is turned on by a runtime option today, as the page was, and moving them would change the API the same way). The budgets are the owner's decision; they are unchanged.

## 20 Nov 2026 · The core finds an adapter's elements through a `DomPort` (QUALITY-REVIEW P15)

- **Why:** the "framework-free" core queried @jali/react's markup by name in 14 places (`.jali-workspace`, `.jali-tab-item`, `.jali-divider-layer [data-divider]`, `.jali-strip`, `:scope > .jali-pane-content > .jali-pane-content-inner`, `.jali-shelf-chip-main`, `[data-shelf]`, `[data-pane]`, `[data-tab]`, …) and kept a drag's state as body classes (`jali-resizing`, `jali-pane-dragging`).
- **Now:** `DomPort` (`dom/port.ts`, in `@jali/core/adapter`) is what the core asks: the panes' area, the tab at a point, a pane's tab, the dividers and rows that scroll, a row's scroller, holding a heavy pane's content, the divider's drag line (`DividerLine`), the shelf and its chip, marking a drag, flashing a tab. `@jali/react`'s is `reactDom` (`src/dom.ts`), given by `StoreProvider` with `store.dom.use(reactDom)`. Until an adapter gives one, `noDom` finds nothing, so a headless workspace runs. The drag in progress is the workspace's own (`store.dom.dragging()`, `setDragging`); the port only marks it for styles. What stays in the core: its own ids (`paneDomId`), the root and layer the adapter attaches, generic semantics (`[role=dialog]`, `[role=separator]`) and attributes the host writes (`data-jali-chrome`, `data-pane-region`, `data-pane-keys`, `data-no-drag`, `data-drag-ok`, `data-autofocus`).
- **Adapter API changes:** `startDividerDrag(store, e, parentId, index)` (the drag line comes from the port, not a parameter); `isDividerDragging(dom)`; `activeTabId(dom)`; `focusShelf(dom, shelf)`; `JaliDom` gains `port`, `use`, `dragging`, `setDragging`.
- **Left:** `actions/content.ts` still lists the `data-*` names Jali's parts use, to keep a pane's own attributes from taking them; it never queries them. Pop out's port (`setPopOutPort`) was still module state set by @jali/react as it loads; since 21 Nov 2026 it is the workspace's ("Pop out's port is the workspace's").
- **Tests:** `tests/dom-port.test.tsx`: a scan of the core's source for React's classes and attributes, the port asked and told what the core does, `noDom` until an adapter gives one, and `reactDom` finding React's elements.

## 20 Nov 2026 · A curated public surface: `layout.tree`, `UrlState`, an explicit adapter list (QUALITY-REVIEW P16)

- **`layout.tree` only reads.** It was the engine's tree module, so `replace`, `remove`, `balance` and `activate`, which edit their argument, looked as pure as `find`. It is now `layout/tree/public.ts`: `clone`, `isSplit`, `nodes`, `panes`, `find`, `parent`, `stackOf`, `newId`, `map`, `shape`, `unzoom`, `noFocus`. The four draft steps and `parentOf` (a second name for `parent`) stay as `@deprecated` aliases that name what to use instead (`map`, `layout.close`, `layout.setActiveTab`, `parent`).
- **`UrlState`.** `UrlWriter.write` took the store's whole `UiState`. It now gets `UrlState` (`layout`, `view`, `presetId`, `page`), new in `@jali/core`, built that narrow at run time too, with refs as a link carries them (below). A host's writer that read other fields no longer type-checks; none in the repo did.
- **`@jali/core/adapter`** was `export *` over 45 modules. It is now `export * from "./index"` (the public API, itself an explicit list) and each adapter name by module, grouped by purpose. The built entry exports exactly the same 399 names as before.
- **Tests:** `layout.tree` on frozen trees (`layout/test/purity.test.ts`); `tests/public-api.test.ts` checks `UrlState`'s keys at type level and at run time, and that the adapter has no `export *` but the public entry.

## 20 Nov 2026 · `appOnly`: a param links never carry (QUALITY-REVIEW C12)

- **Why:** a link could set any param, so a crafted Data Studio link opened a query with `autorun` on and ran its SQL.
- **Now:** `appOnly(type)` (from `@jali/core` and `@jali/react`, type `AppOnlyParam`) declares a param only the app sets: `params: { sql: String, autorun: appOnly(Boolean) }`. It is optional. The store hands the URL writer refs without it (layout and peek), so no address Jali writes carries it; `readSearch` drops it from every ref it reads (the layout, a peek, a page's opened panes), and a value of it the kind can't read doesn't make the link broken. It isn't part of what a pane shows: two refs that differ only in it are the same object. `PaneKind.appOnly` lists them for the layout; `linkRef`, `linkLayout`, `linkView` and `appOnlyParams` are in the adapter.
- **For Data Studio:** declaring `autorun: appOnly(Boolean)` in `examples/data-studio/src/panes/kinds/query.tsx` closes C12 there; that file is the example's own, so it is left to it.
- **Tests:** `tests/app-only-params.test.ts`.
- **`usePaneState`'s `parse` (C13)** landed with P10 (above); a test now also checks that a `parse` that throws starts from `initial` and leaves the stored value alone.

## 20 Nov 2026 · Docs: static pages with islands, and normal page loads (QUALITY-REVIEW P4, P24)

- **Why:** the docs hydrated the whole site as one `<Site client:load>` island on every page: about 470–500 KB of JS gzipped per page (measured, Lighthouse-like phone profile), every MDX source and sample shipped as text, the landing's live workspaces on every page, code highlighted twice (at build, then again in the browser with Shiki's grammars), and "On this page" built after hydration, which shifted `/learn/fitting` by a CLS of 0.39.
- **Now:**
  - **Static HTML.** `src/shell/render.tsx` renders each page's MDX with React at build time, inside a collector that gathers its headings (for the TOC and search) and its islands; `src/shell/Shell.tsx` renders the chrome, nav, TOC and footer around it. Astro writes the result; nothing in the shell hydrates.
  - **One small script** (`src/client/enhance.ts`, about 4 KB gzipped) runs the theme toggle, copy (code, Install commands, "Copy page" from the `.md` copy), wrap lines, tabs (arrows, remembered groups), the TOC's current section, the nav drawer, the 404's address and videos, on the elements the build wrote. Theme, its toggle state and code wrapping are applied before the first paint from `<html>` attributes an inline script sets.
  - **Islands.** The live parts (`TreeView`, `Frame`, `Spotlight`, `QuickstartApp`, the landing's `LinkDemo` and `KeysDemo`) are wrapped with `island()` (`src/shell/island.tsx`). At build each is rendered on its own with `identifierPrefix: "i<n>-"`; in the browser `src/client/islands.ts` imports it and `hydrateRoot`s that HTML with the same prefix when it comes within 400px of the screen, so `useId` values and markup match. Props must be JSON. Chosen over Astro's own islands, which need Astro MDX and `client:*` on every use in every page: the pages stay React MDX, unchanged, and the contract in apps/docs/AGENTS.md holds.
  - **Highlighting once, at build:** `src/shell/highlight.ts` is Shiki's synchronous core with the CSS-variables theme and nine grammars; the browser loads no highlighter. `@shikijs/rehype` (whose output was being thrown away) and `remark-mdx-frontmatter` are gone.
  - **Search** loads on first use (or when the pointer reaches its button) and reads `/search.json`: each page's title, summary, section, and the headings and reference entries the build collected, with their real ids. It now finds reference entries.
  - **Navigation is normal page loads**, with Astro's prefetch on hover. The client router is gone. Kept a router? No: with every page static, a router would mean shipping every page's code or a fetch-and-swap layer, and its in-place navigation is where the partial head updates, the link interception bugs and the post-hydration TOC came from. A full load of a prefetched static page is fast, and its head, focus, scroll and history are the browser's own and always right.
  - **One frontmatter parser:** `frontmatterOf` in `src/site/sources.ts` (plain, double- or single-quoted values; a line it can't read, or an unquoted ": ", fails the build).
- **P24:** the breadcrumb's section links to its first page; each page's head is its own file's (the 404 and drafts have no canonical or Markdown alternate); heading anchors are `aria-hidden` and out of the Tab order, so a heading is read as its words (the TOC links to the same sections), as GitHub does; clip-path ids are unique per drawing; the auto-layout GIFs are H.264 videos with a first-frame poster (about 160 KB instead of 900 KB each), loaded only when they play, played while on screen unless the reader prefers reduced motion, with controls to pause; images carry width and height and load lazily; Install has one tab panel per package manager; `/llms.txt` is built; the Quickstart's preview is the notes app the page builds. `MarkdownView`, `rawText` and `shell/home.tsx` were already gone.
- **Fonts:** the four faces the first screen uses are preloaded, so text isn't redrawn when they arrive (that was a CLS of 0.2 on `/reference/react` once JS no longer delayed the first paint).
- **Measured** (`apps/docs/scripts/measure.mjs`, production build, phone = 390×844, 4× CPU, 150 ms RTT, 1.6 Mbps): see QUALITY-REVIEW, Progress, phase 3.
- **Tests:** `e2e/hydration.spec.ts` (each island keeps its prerendered nodes on a Mac and a Windows reader; a page without live parts loads no React), `e2e/smoke.spec.ts` (every sitemap page, every island hydrated, no console error), `e2e/site.spec.ts` (search, tabs, copy, theme, heading names, CLS under 0.1 on a phone, and axe on five page types in light and dark).

## 21 Nov 2026 · Size budgets reset to what ships, plus 5% (QUALITY-REVIEW P3)

After the opt-in page, what a minimal app ships is code it runs: the English messages, the command registry, `apply`, the URL code, the store; in React the default icons, the tab strip, the workspace and the pane frame (see "Size after the opt-in page"). Cutting further means making Settings, the chooser and pop out opt-in for about 4–5 KB of React, still short of the old budget. The owner chose to reset the budgets instead.

| Scenario           | core             | react       | css       |
| ------------------ | ---------------- | ----------- | --------- |
| minimal, own-icons | 52.4 → budget 55 | 24.6 → 25.8 | 8.2 → 8.6 |
| full               | 57.5 → 60.4      | 26.4 → 27.7 | 8.2 → 8.6 |
| headless           | 46.9 → 49.2      | –           | –         |
| layout             | 10.2 → 10.7      | –           | –         |

Gzipped KB, measured on master `ea3ac83` after `pnpm build:packages`. The `mustNotShip` lists stay: a page module in a page-less app still fails the gate whatever its size. The 5% is deliberately tight; growth past it is a decision, not drift.

## 21 Nov 2026 · A refusal that asks says how the question ended: `settled` on "unsaved" (Markets, FINDINGS.md #1)

- **Why:** with unsaved work in a pane, an action returned `{ ok: false, reason: "unsaved" }` and Jali asked the person, but the app couldn't learn the answer. Markets' Reset inferred it from the next `layout` event and four signals.
- **Now:** every refusal that asks carries `settled: Promise<ActionResult>`. "pending" already had it; "unsaved" now has it too. It resolves with `{ ok: true, pane }` when the action went ahead (the same `pane` the action would have returned, for the actions that name one), or with a refusal when it didn't (`"kept"`: Keep editing, or a newer question took its place). It never rejects. Jali's question asked again (more work at stake by the answer) is the same question, so `settled` waits for its end. A host's yes that meets Jali's question resolves with that `"unsaved"` refusal, whose own `settled` says how the person answered: each promise ends when its own question is answered, as `pending`'s always did.
- **Not `Promise<Change | null>`,** as the finding suggested: `Change` is the engine's step, not public, and every action already speaks `ActionResult`. One field, one type, on both asking reasons; `end.ok` reads the same as the action's own `result.ok`.
- **Not done:** a following detail that keeps its object because of its unsaved work refuses `"unsaved"` without asking; it has no `settled`, as nothing is asked. `Refusal` stays an interface with `settled?` (a union keyed by `reason` would break hosts that extend or build it).
- **Markets:** `resetAll` (`src/desks.ts`) forgets the other desks when `settled` resolves ok; its inference from the next `layout` event is gone.
- **Tests:** `tests/held-questions.test.ts` ("`settled` says how the question ended").

## 21 Nov 2026 · The `layout` event names the action that made it (Markets, FINDINGS.md #2)

- **Why:** `on("layout")` said whether a change came from an action or the address, not which action, so an app couldn't react to a reset, a preset or a close in particular.
- **Now:** `layout` carries `action?: ActionName`, where `ActionName` (new, from `@jali/core`) is `keyof JaliActions | "setLayout"`: one vocabulary, the one the app already calls. Whoever ran it counts: `jali.actions.resetLayout()` and the person's "Reset layout" in ⌘K both say `"resetLayout"`. Jali's own steps that are a form of a public action say that action (a click on a tab and F6's cycling say `"focus"`, Split's auto direction `"split"`, the launcher's dismissal `"close"`, ⌥-click on a page tab `"openTab"`); the table is `NAMED_AS` in `actions/index.ts`, and a type check fails the build if an engine step is neither listed nor a public action's name. A change made after a question names the action that asked: the held action's name travels with it (`Run.action`, `AnswerStep.action`, `ConfirmState.action`), so Discard and a later `beforeClose` yes both say `"resetLayout"`. Undefined for what no action names: a drag, a divider, a linked pane following its list, what a pane reports, and the address (`source: "address"`).
- **Not the engine's op names** (`"preset"` for both a preset and a reset, `"drop"`, `"resize"`): they are internal and would make every op a public name.
- **Size:** about 0.3 KB gzipped of core, in every scenario (the naming table and the wrapper).
- **Tests:** `tests/instance.test.ts` ("layout names the action that made it, whoever ran it", after Discard, after a later yes, none for a drag).

## 21 Nov 2026 · `IconButton`: Jali's icon button, public (Markets, Data Studio, Loan review FINDINGS.md)

- **Why:** all three apps wanted top-bar and pane buttons that look like Jali's header buttons. `.jali-icon-btn` was private, so each copied its look into its own `.icon-btn`, which drifts the moment Jali's changes.
- **Now:** `<IconButton label onClick>{icon}</IconButton>` from `@jali/react`, and the button it renders is a public part, `iconButton` (`.jali-icon-btn`), with `aria-pressed`, `disabled` and `data-pressed`. It is the same part as each header button (also `paneAction`), Reset on a page's bar and the peek's and Settings' close. `label` is required: it is the accessible name, and the tooltip unless `title` says more, so an icon button can't be nameless. Every other `<button>` prop and a ref pass through; `type` defaults to `"button"`.
- **Not added:** an `icon` prop naming one of Jali's icons. Children keep one way to give the icon (the app's own icon set, or `useJaliIcons()`), and keep the component a few lines.
- **Size:** 0.1 KB gzipped of React, only in apps that import it.
- **Tests:** `tests/icon-button.test.tsx`; `tests/parts.test.tsx` checks the part.

## 21 Nov 2026 · Two more parts: a Settings row and the curated page's root (Data Studio, Loan review FINDINGS.md)

- **`settingRow` (`.jali-setting`, a `label`):** a row in Settings, a radio or checkbox and its words on one line. It was the private `.jali-radio`, which Data Studio used until 20 Nov and then copied as `.setting-check`. The class is renamed rather than kept (it was private), and documented for the app's own rows too: `<label className="jali-setting"><input type="checkbox" /> <span>…</span></label>` in a fieldset given to `<SettingsPanel>` or `<JaliRoot settingsExtra>` matches Jali's. A class, not a component: a row is plain markup with no behaviour of its own, and a component would only rename `<label>`.
- **`page` (`.jali-page`):** the curated page's root, in the workspace's place: its rail and its main column (header, views' tabs, panes). An app styles the page's frame there (background, the rail's width, spacing).
- **Size:** none (a renamed class, and the parts list, which isn't shipped).
- **Examples:** the shared Status line setting is a `.jali-setting` row; the shared `.setting-check` is gone.

## 21 Nov 2026 · A curated page's view tabs are in a `nav` landmark (Loan review FINDINGS.md #2)

- **Why:** axe's `region` rule failed on every curated page: the view tabs (`.jali-page-tabs`) sat outside every landmark, so a screen-reader user moving by landmarks skipped them. Loan review's scan left the rule out for them.
- **Now:** the tablist is inside `<nav class="jali-page-nav" aria-label="{page} views">`, between the item's header and the panes' region. A `nav`, not a region around the whole page: the tabs choose what the page shows, which is navigation, and a region around the page would hold the workspace, which is the page's `<main>` with `landmark: "main"` (a `main` inside a region fails axe). The tablist keeps its own name. `.jali-page-nav` has `min-width: 0` so the tabs still scroll inside the column instead of widening the page.
- **Tests:** `tests/landmarks.test.tsx`; Loan review's quality scan runs with no known violations, and Jali's own axe test (`e2e/axe.spec.ts`) judges the landmark.

## 21 Nov 2026 · Stacked view's divider stays in the room between the panes (Markets FINDINGS.md #4)

- **Why:** the divider's 44px touch target was centred on the 6px gap, so it reached 19px over the last row of the pane above and the header of the pane below. A tap there started a resize (and did nothing) instead of choosing the row.
- **Now:** in stacked view the panes are `STACK_GAP` (24px) apart, or the workspace's gap if that is more (`stackGap(gap)`, in the adapter), and the divider is exactly that room: it covers neither pane, so a pane's controls always win. 24px is WCAG 2.5.8's minimum target, and the divider is the full width of the screen. The grabber is drawn in its middle, as before.
- **Chosen over** letting the pane win the overlap (forwarding a tap that didn't move to whatever is under it): that needs a synthetic click on another element, which loses focus, text selection and the browser's own activation behaviour. And over a 44px room: on a 760px phone that is 6% of the height for a line.
- **Changed:** `STACK_GAP` was the gap (6); it is now 24, the least room. Each stacked pane is 9px shorter at the default gap. A fold's hinge is unchanged.
- **Tests:** `tests/stacked.test.tsx` ("is the room between the panes"). The shared width sweep (`examples/shared/e2e/quality.ts`) no longer excuses stacked view's divider from its "covered" check; a tiled layout's divider (3px over the panes' edges) still is.

## 21 Nov 2026 · `optional(type, { link: false })`: a pane's own param the address doesn't hold (Data Studio FINDINGS.md #2)

- **Why:** Data Studio's chart names its result by `runId`, which lives in memory. In the address it outlived the page load: after a reload a stale id could name another query's result, so the app had to make ids per visit and explain stale ones.
- **Now:** `optional(String, { link: false })` (new `ParamOptions`, the second argument of `optional`) keeps a param out of every link Jali writes (the address, Copy link, Back and Forward). It differs from `appOnly` in the two ways the finding asked: it is part of what the pane shows (`chart({ runId: "a" })` and `chart({ runId: "b" })` are two objects, so opening another result opens another chart), and a link that carries it still sets it (an old link, or one the app built). The registry lists such params as `PaneKind.unlinked`; `linkRef` and `linkLayout` drop them with the app-only ones, and the address is read with `readRef` and `readLayout`, which drop app-only params only.
- **What the address doesn't hold stays where the app put it** (`keepOwnParams`, in `arrive`): a pane from the address that has none of a kind's app-only or `link: false` params takes them from the app's own layouts, the one on screen first (so Back and Forward keep them on a pane still open), then the preset the address names (so a reload keeps what the preset gave). Only a pane with the same id and kind, showing the same object apart from those params, takes anything, so a link that changes a pane still can't set an app-only param on it. Without this, declaring `autorun: appOnly(Boolean)` would have stopped Data Studio's preset query from running after a reload (its chart came back empty), and every Back would have dropped a chart's run.
- **Only on `optional`:** a param the address leaves out can't be required, since a pane from a link or a reload doesn't have it.
- **Data Studio:** the chart's `runId` is `optional(String, { link: false })`, and the query's `autorun` is `appOnly(Boolean)` at last (left to the app on 20 Nov). Its own check (only its own SQL autoruns) stays, as a second line.
- **Size:** about 0.3 KB gzipped of core in every scenario but the layout-only one.
- **Tests:** `tests/link-false-params.test.ts`; Data Studio's `e2e/links.spec.ts` (a link's SQL isn't run, the preset's query runs after a reload, an old link's run id says it is from an earlier visit).

## 21 Nov 2026 · A page's `bind` stays synchronous: load what it needs before `createJali` (Loan review FINDINGS.md #1)

- **Asked:** let `definePage({ bind })` return a promise, with the page in its loading state until it settles.
- **Declined, because `bind` is not where data loads in this model.** `bind(item)` runs inside every page step: opening the page, choosing an item, Reset, Back to the page, a link or Back and Forward arriving. Each step is computed from a snapshot and committed once, returns its `ActionResult` at once, and writes the address in the same commit. An async `bind` would make every one of them a held action (`"pending"` with `settled`, like a host's `beforeClose`), give the page a state with an item and no layout (what would Split view, the tabs, the address and Undo show?), let a slow network decide the order of two quick item changes, and make server rendering wait. The held-question machinery could carry it, but every page path would pay for the case where a view's ref needs data.
- **The model instead:** `bind` names objects; panes load them, each with its own loading, error and retry. Most views need only the item's id. When a view shows another object only the data knows (Loan review's borrower, group and officer for an application), read those ids before `createJali` and keep them, as Loan review does (`src/parties.ts`); the app shows its own loading screen until then, and reads new ids before calling `activate` for an item it hasn't seen. Documented in the Curated pages guide ("When a view's object comes from your data") and on `bind`.
- **Revisit if** an app needs per-item facts it can't read up front (millions of items, no listing): then a page-level "resolving" state with `activate` returning `"pending"` is the shape, not an async `bind` in every step.

## 21 Nov 2026 · `createJali({ label })`: a named workspace names its landmarks (the docs' live workspaces)

- **Why:** two live workspaces on one page repeated Jali's landmarks: a "Panes" region each, and a region per pane named by its title, so two "Orders" regions. axe's `landmark-unique` failed, and a screen-reader user moving by landmarks couldn't tell the workspaces apart. The docs excluded `[data-jali]` from their best-practice scan.
- **Now:** `createJali({ label: "Orders" })` (and `createUiStore`'s `label`). The workspace's landmark is named `label` instead of "Panes", and each of Jali's landmarks inside it adds it through `messages.workspace.within(name, workspace)` (English: "Order 7, Orders"): each pane's region, the shelf, Single view's switcher, the peek and a curated page's views. A pane in a named workspace is named with `aria-label` from its title (it is `aria-labelledby` its title element otherwise, unchanged). Without `label` nothing changes.
- **An option, not only `messages.workspace.label`:** that message already renamed the workspace's region, but it is a translation, shared by every workspace in the language, and it can't reach the panes' names. `label` names one instance. Not `name`: that is the free workspace's name in commands ("Open Data Studio").
- **Docs:** each live workspace is named for its figure (its caption, else its layout's description; the hero's tour "Tour of a live workspace"; the landing's apps "Notes app" and their layout's description), and `apps/docs/e2e/site.spec.ts` runs axe's best practice on whole pages, live workspaces included. The two-workspaces guide and its sample name both.
- **Size:** about 0.1 KB gzipped of React and 0.05 KB of core.
- **Tests:** `tests/landmarks.test.tsx` (named landmarks; two named workspaces share no landmark name; unnamed is unchanged).

## 21 Nov 2026 · The docs' heading permalinks: after the heading, in the Tab order, named (supersedes P24's anchors)

- **Why:** P24 hid each heading's permalink from assistive technology and the Tab order, so the heading was read as its words; "On this page" was meant to stand in. It doesn't for h4s, which the TOC leaves out, and the TOC links to a section rather than handing the reader its address. A keyboard user had no way to copy a section's link that a mouse user has.
- **Now:** `heading()` in `apps/docs/src/shell/mdx.tsx` renders `<div class="heading-wrap"><hN id>words</hN><a class="heading-anchor" href="#id">icon <span class="visually-hidden">Link to this section: words</span></a></div>`. The link comes after the heading and outside it, so the heading's accessible name is its words alone (a link inside a heading adds its name to the heading's), and every heading, h4 included, has a link Tab reaches in reading order, with a name that says which section it is. It shows in the margin on hover and on focus, as before; on a phone, where there is no margin, it shows just above its heading, on focus only. The wrapper draws nothing: the heading's margins pass through it, and the rules that met a heading directly (`.prose > :first-child`, h2 + h3, the reference's first entry under a heading) now meet the wrapper.
- **Chosen over** making the heading's text the link: it keeps the name, but colours or underlines every heading as a link and makes a click on a heading navigate. Over a link inside the heading with `aria-label`: the label becomes part of the heading's name ("How spare room is shared Link to this section"). Over leaving it to the TOC: no TOC entry for h4s, and none at all on narrow screens until it is opened.
- **Cost:** one Tab stop per heading. A page has a dozen at most, and they sit where the reader is already reading.
- **Tests:** `apps/docs/e2e/site.spec.ts` ("every heading's permalink is a named link the keyboard reaches, outside the heading"; "headings are read as their words, without their link"), and axe on every page type.

## 21 Nov 2026 · Server rendering on React 18: the panes keep the server's markup

- **Why:** on React 18 a server-rendered workspace client-rendered every pane after hydrating (DECISIONS, 20 Nov, "Server rendering on React 18"). The cause, traced in React's own code: React hydrates each Suspense boundary after the rest of the page, at its lowest priority, and React 18 throws a boundary's server markup away if an update reaches it first. React 19 hydrates the boundary first instead. Two updates reached the panes' boundaries: the workspace measuring itself as it mounts (a size other than the server's paused the second pane, which its content hears), and `PaneBody` reading the key label for its unknown-kind message, which changes once the page has hydrated. `startTransition`, React's usual advice, can't help: a store update reaches components through `useSyncExternalStore`, which is always synchronous.
- **Now:**
  - A workspace that hydrates holds its measuring until every pane boundary that mounted with it has hydrated, then measures at once (`state/hydration.ts`, `useMeasure` in `Workspace.tsx`). Each `PaneBoundary` waits on mounting and arrives when its content commits (an empty part inside the Suspense boundary), when it fails, or when it unmounts. Meanwhile the page is interactive and laid out at the server's size. A workspace rendered in the browser alone measures on its first commit, as before, whether or not a pane is still loading.
  - The unknown-kind help is its own part (`UnknownKindHelp`), so the body around a pane's boundary no longer re-renders when the page hydrates.
- **A pane that waits in the browser:** if a pane's content waits for data the server had (not yet in the browser's cache), the workspace keeps the server's size until it shows; measuring first would replace that pane's markup with its Loading state. Nothing waits on a pane that never mounted.
- **Size:** about 0.2 KB gzipped of React, none of core.
- **Tests:** `tests/server-render.test.tsx` runs the hydration test on React 18 too (the skip is gone), checks that the server's elements are the ones on the page after hydrating and that the workspace measured, that a pane waiting for its data in the browser holds the measure and keeps its markup until it shows, and that a workspace rendered in the browser alone measures on its first commit. Without the hold, the first two fail on React 18.

## 21 Nov 2026 · Toasts are inert behind a dialog; announcements are still heard (QUALITY-REVIEW phase 2, open)

- **Why:** a modal dialog (Settings, the discard question, ⌘K, the chooser) made the workspace's root inert, but not the host's `overlays`. A toast's Undo stayed in the tab order and the accessibility tree behind an `aria-modal` dialog, and pressing it ran an action under the question.
- **Now:** `<JaliRoot>` renders `overlays` in an element of its own, `[data-jali-overlays]` (`display: contents`, with an id from the workspace's), and `ModalDialog` makes it inert with the root while it is open, then gives back exactly what it changed (an overlay the host made inert itself stays inert). Jali's live region is in the layer beside the dialog, never made inert, so what the workspace says while a dialog is open is still announced. Without `overlays` nothing new is rendered. The wrapper is a new public part, `overlays` (`parts.ts`); it takes no box, so a toaster lays out as before.
- **Not the whole page:** the native `<dialog>.showModal()` makes everything outside it inert. Jali doesn't: a host page around the workspace (its own nav, its own live regions) is the host's, and muting a host's live region would lose what it says. A toaster portalled out of `overlays` (to `body`) leaves Jali's reach; the docs say to render it in `overlays`.
- **Size:** about 0.1 KB gzipped of React.
- **Tests:** `tests/modal-dialog.test.tsx`, "the host's overlays": inert while Settings is open, the live region outside everything made inert and still speaking, back after Esc; inert behind the discard question, and a host's own inert overlay left inert; no element without overlays. `tests/parts.test.tsx` renders the part.

## 21 Nov 2026 · A live title re-renders only the frame that shows it (QUALITY-REVIEW phase 2, open)

- **Why:** `PaneFrame`, `TabStrip` and `TabOverflow` each subscribed to every pane's live title (`s.titles`), so one pane's `useTitle` re-rendered every frame and every tab strip in the workspace.
- **Now:** a frame reads its own pane's title only (`own(s.titles, node.id)`). A tab strip and its overflow menu subscribe to their own tabs' titles, as one string, and re-render when one of those changes; they read the titles from the state as they render, as the strip already did for its tabs' activity. The strip's out-of-view count no longer sets state when it is unchanged: a functional update right after a commit rendered the strip a second time to find the same number.
- **Measured** (`tests/render-counts.test.tsx`: a tab group of three, a pane, a column of two; five title changes each):

  | Run                                      | Frame commits, before                              | after                                                  |
  | ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
  | five new titles for a pane on its own    | 35: every one of the six frames, the group's twice | 5: that pane's                                         |
  | five new titles for a tab behind a group | every frame, each at least five times              | 10: the group's, and the tab's own (its region's name) |

- **Left:** `TabMenu` (only while open), the pane switcher, the peek and `useTitleOf` still read all titles; none is in a frame. A tab strip still subscribes to every pane's `data-*` attributes and unsaved marks.
- **Tests:** `tests/render-counts.test.tsx`, "a live title commits only the frame that shows it".

## 21 Nov 2026 · Pop out's port is the workspace's, given with the DOM port (QUALITY-REVIEW API cleanup, open)

- **Why:** `pane.pop_out` asked a module-level port that `@jali/react` set as a side effect of loading `pane/PopOut.tsx` (`setPopOutPort`). Every workspace on the page shared it, whichever adapter rendered it or none; a workspace no adapter rendered could still pop a pane out through it; and a test had to clear it by hand.
- **Now:** a `DomPort` may carry `popOut?: PopOutPort`, and the command asks the workspace's own (`store.dom.port.popOut`) before the module one. `@jali/react`'s `reactDom` carries its floating window (`reactPopOut`), so each workspace gets it when `StoreProvider` gives the DOM port, as it already got everything else from its adapter. Loading `@jali/react` sets nothing. `CommandDef.check` takes the store as an optional second argument (the core's three callers pass it), since a refusal that asks the adapter needs to know which workspace's.
- **Additive:** `setPopOutPort` stays exported and still works, for every workspace that has no port of its own; its comment says it is the older way. `DomPort.popOut` is optional, so an adapter's port without it still type-checks. A caller of `check` outside the core that passes no store gets the module port, which `@jali/react` no longer sets: such a caller now sees Pop out unavailable until it passes the store.
- **Tests:** `tests/pop-out-command.test.ts`: a workspace's own port runs and another workspace's doesn't; the workspace's port wins over the shared one. `tests/dom-port.test.tsx`: in a browser that can pop out, a workspace `@jali/react` hasn't rendered can't, and one it rendered can, through `reactDom.popOut`.

## 21 Nov 2026 · A link's refs of a kind registered later lose their app-only params (Codex review)

- **Why:** a link's refs are read without app-only params (`readRef`), but only for a kind the workspace has. A peek of a kind registered later (a lazily loaded module) kept every param the link carried; once the kind arrived, opening the peek full gave its pane the link's `appOnly` value. (A layout link with an unknown kind is refused whole, so the peek was the way in.)
- **Now:** `readRef` remembers a ref it kept whole because its kind was missing (a `WeakSet`, so nothing is held). When a kind is registered, the store reads those refs again (`rereadRef`, `rereadLayout`) wherever it keeps them: the layout, the peek, Recent, Undo and a page's way back. A ref the app made is never touched: only a ref read from a link is remembered.
- **Tests:** `tests/app-only-params.test.ts`: a peek read before its kind is registered loses `autorun` when the kind arrives, and so does the pane it opens full; an app's own peek keeps it through a registration.

## 21 Nov 2026 · `linkSearch` never writes app-only or `link: false` params (Codex review)

- **Why:** `linkSearch` wrote every param of the refs it was given. A share link built from a live layout or peek (`jali.getLayout()`), or from a ref the app made with `autorun: true`, carried what a workspace never writes. It needs no workspace, so it didn't know which params those were.
- **Now:** a kind's call (`defineKind`, so `definePane`) remembers, for each ref it builds, the params a link leaves out (a `WeakMap`, nothing on the object). `linkSearch` leaves them out of the layout, the opened panes and the peek. A new optional `LinkSearchOptions.panes` (the workspace's kinds, as given to `createJali`) covers any ref, such as a live layout's plain objects. Without it, a plain object of a kind it can't know is written as it is: there is no way to tell, and the docs say to pass `panes`.
- **Tests:** `tests/link-search.test.ts`, "a link built with no workspace": a kind-built ref's app-only and `link: false` params stay out of a page link and a layout link while the ref keeps them; with `panes`, a live layout's and peek's plain refs lose them too.

## 21 Nov 2026 · A writer of the host's own sees the page's way back as a link carries it (Codex review)

- **Why:** the store hands a host's `UrlWriter` the address's share of the state with app-only and `link: false` params removed from the layout and the peek, but `page.before` (the split layout "Back to …" returns to, set when the first investigation pane opens) went out as it was, refs and all.
- **Now:** `writeUrl` passes `page.before` through `linkLayout` too. Jali's own address never wrote `before`; the workspace keeps its own copy whole, so Back to the page's layout is still exact.
- **Tests:** `tests/app-only-params.test.ts`: after an investigation pane opens, neither the written layout nor the written `page.before` holds the role pane's `autorun`, and the workspace's own `page.before` still does.

## 21 Nov 2026 · Back and Forward keep a curated page's opened panes' own params (Codex review)

- **Why:** a free layout arriving from the address takes back the params the address doesn't hold (`appOnly`, `link: false`) from panes still on screen (`keepOwnParams`, 20 Nov). A curated page's opened panes didn't: Back and Forward rebuilt them from the address's stripped refs, so the same pane, still open, lost its `autorun` or its `link: false` value.
- **Now:** `openPage`, arriving from the address, gives each opened pane's ref the params it lacks from a pane on screen of the same kind showing the same object apart from them (`keepOwnRef`, the ref-level half of `keepOwnParams`, which now uses it). Only the workspace's own panes are read, and only an exact match takes anything, so a link still can't set one.
- **Tests:** `tests/app-only-params.test.ts`: an opened pane with `autorun` keeps it through Back to an address that holds it without.

## 21 Nov 2026 · An action a listener runs doesn't rename the event it heard (Codex review)

- **Why:** a batch's ops, action name and input were the store's own variables, read by `told` as it told the app. A listener that acted (`setPinned` inside a `close` listener) started a batch of its own, which reset them; the close's `layout` event, told after, then named `setPinned`.
- **Now:** `told` takes the ending batch's ops, name and input as arguments, read when it ends. The listener's change is told inside the close's telling, as before, with its own name; the close's own `layout` event names `close`.
- **Tests:** `tests/instance.test.ts`: a `setPinned` from a `close` listener gives `layout` events named `setPinned` then `close`.

## 21 Nov 2026 · `destroy()` ends an open discard question as kept (Codex review)

- **Why:** a workspace destroyed while "Discard unsaved changes?" was open left the held action's `settled` promise pending for good: nothing could answer the question any more, and a host awaiting `settled` waited forever.
- **Now:** `destroy()` clears the question and settles it as `{ ok: false, reason: "kept" }`, as a newer question already ends one left unanswered. The panes stay as they were. "kept" rather than a new reason, so the `RefusalReason` union a host switches on is unchanged.
- **Tests:** `tests/destroy.test.ts`: destroying with the question open resolves `settled` as kept and keeps the pane.

## 21 Nov 2026 · Pane state waiting to be saved is saved when the page goes away

- **Why:** pane state (`usePaneState`: a draft, a scroll position) is saved 400 ms after it stops changing (`startUi`, boot.ts). A reload or a closed tab within those 400 ms dropped it, so a draft typed just before a reload was lost. `destroy()` and the stop `start()` returns already saved it; leaving the page didn't.
- **Now:** a save still waiting is made at once on `pagehide` and when the page becomes hidden (`visibilitychange`): a phone switching apps may never bring the page back to run the timer. Nothing is written when nothing waits.
- **Tests:** `tests/destroy.test.ts`: a draft set just before `pagehide`, or before the page is hidden, is in storage; a `visibilitychange` to visible saves nothing.

## 21 Nov 2026 · Pane state saved under a pane id alone is dropped at once, never adopted (QUALITY-REVIEW phase 2, open)

- **Why:** since P13, pane state belongs to the object a pane shows (`pane-state-of`). State saved before it is not read back, but it stayed in storage until the next save. The question was whether it could be adopted instead.
- **What the old format held:** the same `pane-state` key, `{ [paneId]: { [key]: value } }`: the values of the panes in the layout and the undo stack when it was saved, and nothing else. No object, no kind, and no layout saved with it.
- **Why nothing is adopted:** no case can be tied to an object safely, so adopting any of it would bring back the bug P13 fixed.
  - "Adopt it when the pane shows the object that id showed in the saved layout": no layout was saved with it. A free layout lived in the address, and the reader may arrive by another link, a bookmark, or a second tab that shares the storage. Adopting whatever the address now shows at that id is the pre-P13 behaviour. A curated page's split layout (`review:<page>`) is another key, written by whichever tab wrote last, and its views are bound again to the item in the address.
  - "Adopt it for an unambiguous pane" (one pane, one entry, or a kind with one object): the entry may be another kind's. `pane-1` showed an order and now shows a customer. Nothing in the data rules that out.
  - A reload check (the navigation's type) proves the address, not that this tab wrote the state.
  - What is lost is a scroll position, a sort or a draft, once. Adopting it could put one customer's draft reply in another customer's pane.
- **Now:** `readPaneState` (`state/pane-state.ts`) reads saved pane state as a workspace starts. Anything `loadPaneState` leaves out is taken out of storage at once, so it is gone after one read: state without an object, an entry that isn't a record of values, an owner that isn't text or has no state, and text that isn't JSON. Good state is read as before, and nothing is written when storage holds nothing else. Old values never reach `usePaneState`, so its `parse` never sees them. Entries are still read through `own`, and a `__proto__` entry is an own key, never the prototype.
- **Unchanged:** `loadPaneState`, `loadPaneStateOwners` and `savePaneState` (`@jali/core/adapter`). `readPaneState` is internal.
- **Found, not fixed:** values and owners are two keys. A tab running a build from before 20 Nov, still open beside a newer one, saves `pane-state` and leaves the newer build's `pane-state-of` in place. The newer build could then read the old tab's values as belonging to the objects it saved last. This can happen only while an old build's tab is open. The fix is one key holding each pane's values with their object, which changes the stored format again.
- **Size:** @jali/core +0.1 KB gzipped.
- **Tests:** `tests/pane-state-legacy.test.ts`: old state is never attached, whatever the pane under its id shows, and a write starts the object's own state. It is gone from storage after one read, and the next start writes nothing. Owned state stored beside it is read back and kept. Bad entries and prototype names are dropped. Text that isn't JSON is replaced. Clean storage is never rewritten. `tests/pane-contract.test.ts` still checks that state saved without its object is left out.

## 21 Nov 2026 · A pane's title, data-* attributes and unsaved mark re-render only what shows that pane (QUALITY-REVIEW phase 2, open)

- **Why:** after "A live title re-renders only the frame that shows it", some parts still subscribed to every pane:
  - an open tab menu, each entry of the single view switcher, and the peek subscribed to every pane's title;
  - a tab strip and its overflow menu subscribed to every pane's `data-*` attributes and unsaved marks (the overflow menu to every pane's activity too);
  - the shelf subscribed to the whole model and to all three records;
  - the discard question subscribed to every unsaved mark and to the whole model while closed.
    The workspace (`Panes`) re-rendered on each live title as well, through `useModel` (directly and in `useFocusIntoStrip`), and so did every switcher entry and the peek under it. `useTitleOf` read every title and was used nowhere.
- **Now:**
  - **Hooks** (`state/react.tsx`, internal):
    - `useEntriesOf(record, ids)` gives the entries of `ids` in one per-pane record (`titles`, `unsaved`, `paneAttributes`, `activity`), as a record of those panes only. It keeps the same object until one of their entries changes.
    - `useGeometry()` gives the model, but re-renders only when its geometry changes (`m.resolved`): a live title makes a new model that shares the geometry.
    - `useTitleOf` is gone.
  - **Tab strip and overflow menu:** they read their own tabs' titles, attributes, unsaved marks and activity through `useEntriesOf`. These are also the strip's measure dependencies.
  - **Tab menu, switcher entry:** each reads one title (`useModelValue((m) => m.title(id))`). The switcher's entry is its own module (`chrome/SwitcherItem.tsx`), so a test can count it. The switcher is always on screen in single view, and each entry shows one pane, so it never needs every title.
  - **Peek:** it finds the panes showing its object (`useModelValue`, as text) and reads only their entries. It still takes the first one, now in tree order rather than the order the records' keys were added.
  - **Shelf:** it reads the shelf list from the model (`useModelValue`), its chips' and homes' names as one string, and its chips' entries. Its out-of-view list is set only when it changes: a functional update right after a commit rendered it a second time, as the strip's count did.
  - **Discard question:** it subscribes to nothing but `confirm` while closed. Open, it reads the panes it lists.
  - **Workspace and the curated page's bar:** they use `useGeometry`, and so does `useFocusIntoStrip`. Neither shows a title. The drag chip (`DragLayer`) and the stacked view's divider read their own titles.
- **Measured** (`tests/render-counts.test.tsx`: the tab group of three, a pane and a column of two; the switcher in single view; commits counted with a `<Profiler>`):

  | Run                                                               | Before                                        | After            |
  | ----------------------------------------------------------------- | --------------------------------------------- | ---------------- |
  | 5 attribute and 5 unsaved changes to a pane on its own            | 20 frame commits (its own and the group's)    | 10 (its own)     |
  | the same, closed discard question                                 | 5 commits                                     | 0                |
  | open tab menu, 15 changes to another pane                         | 15 menu commits                               | 0                |
  | single view, 5 title, 5 attribute and 5 unsaved changes to a pane | 40 switcher entry commits (all six per title) | 15 (that pane's) |
  | the same, workspace renders (`frames()` calls)                    | 5                                             | 0                |
  | peek, 15 changes to a pane showing another object                 | 5 commits                                     | 0                |
  | shelf, 15 changes to a pane not on it                             | 30 commits                                    | 0                |
  | shelf, 15 changes to its own chip's pane                          | 30 commits                                    | 15               |

  A tab behind in a group still commits its group's frame and its own hidden frame for each change: the strip shows it, and its own frame carries its attributes.

- **Not narrowed:** the divider layer. Each divider's label names the panes on either side ("Resize Order 1 and Order 2"), so a title re-renders it once. The curated page's ⌥ preview (`Ghost`, only while ⌥ is held) and ⌘K (only while open) still read the whole model.
- **Size:** @jali/react +0.2 KB gzipped (minimal 25.1 → 25.3, full 26.9 → 27.1).
- **Tests:** `tests/render-counts.test.tsx`:
  - attributes and unsaved marks commit only the frame that shows them, and nothing outside the frames;
  - an open tab menu re-renders for its own tab only;
  - the switcher re-renders only the changed pane's entry, and the workspace doesn't render at all;
  - the peek re-renders for the panes showing its object;
  - the shelf re-renders for its chips' panes.

  The live-title test now also checks that the workspace doesn't render.

## 22 Nov 2026 · The repo's folders: packages, apps, examples as packages, tooling

The layout agreed with the owner. Nothing in `@jali/core` or `@jali/react` changed: same paths (`packages/core`, `packages/react`), same exports, same `dist/` entries.

- **`tooling/`** is what `scripts/` was: verify, size (and its scenarios in `tooling/size/`), agent docs, icons, the React 18 check. It is a private workspace package (`jali-tooling`) so the size scenarios and the icon script have their own dependencies (React, Phosphor) instead of the root's.
- **`examples/<name>/`**, each a workspace package (`@jali-examples/<name>`) with its own `package.json` declaring only what it imports, plus `vp dev`, `vp build` and `vp preview` scripts. `fixtures/minimal` and `fixtures/own-icons` moved to `examples/minimal` and `examples/own-icons`; they are still not example apps (no standard, no browser suite), only the quickstart's and the size checks' apps.
- **`@jali-examples/shared`** replaces the root `#shared/*` import alias and the tsconfig `paths` behind it. Its `exports` lists each module an example imports, by its path under `src/` without the extension (`@jali-examples/shared/data/hooks`), so TypeScript and Vite resolve them without an alias.
- **The root `package.json`** has no dependencies, only dev tooling: TypeScript, Vite+, Vitest, jsdom, Playwright and axe, the React plugin, and the React types (the root tsconfig checks every package, the docs site's included, with one set). `@testing-library/react` moved to the packages that use it (`@jali/react`, Studio, Trips); `@jali/react` has React as a dev dependency for its own tests. `@fontsource-variable/chivo-mono` was imported nowhere and is gone.
- **Tests.** The root `tests/` split by what each file imports: a test that renders, or defines a pane with `@jali/react`, is in `packages/react/tests` (80 files); one that imports `@jali/core` alone is in `packages/core/tests` (3 files). The engine tests that run against Data Studio's and Loan review's kinds (`tests/workspace.ts`) define their panes with `@jali/react`, so they are React's. The layout tree's own tests stay beside its source (`packages/core/src/layout/test/`). Each package has a `vitest.config.ts`; the root config's `test.projects` runs `core`, `react` and `examples`, so `vp test run` still runs everything.
- **`e2e/` stays at the root.** Its specs test Jali itself through two apps (Data Studio, the free workspace; Loan review, the curated page) and one page object, and `e2e/fixtures/server.ts` is the dev server every Playwright config uses, the examples' and the docs site's too. It belongs to neither app, so it doesn't move beside one.
- **Dated reports** (`QUALITY-REVIEW.md`, `ARCHITECTURE-REVIEW.md`, `FINDINGS.md`, `FINDINGS-FROM-DOCS.md`) moved to `docs/reviews/`. Older entries above cite them at their old paths; those entries are left as written.
- **`archive/`** stays where it is: it is code kept for reference, not docs, and nothing builds from it. It is a candidate for deletion (git keeps its history).

## 22 Nov 2026 · React correctness and accessibility (review of 22 Nov, phase 2)

The decisions behind the phase 2 fixes of `docs/reviews/2026-11-22/react-opus.md` and `react-codex.md`. Each fix has its test; the review's README lists every finding and its commit.

- **A pane's content renders once, into an element of its own** (`pane/content.tsx`). `Panes` renders every pane's `PaneBody` in one flat keyed list, each as a portal into a `div.jali-pane-content-inner` made for that pane and kept while the pane is in the layout. The frame (`PaneFrame`) appends that element to its `.jali-pane-content`. A frame that changes parent (into or out of a row that scrolls, tiled ⇄ single view) still remounts, but the content doesn't: its state, subscriptions and DOM stay. The header slot and the pane host live with the element, so header controls follow it too. React's handlers on the frame don't hear events from content rendered elsewhere, so the element has native capture listeners that focus the pane on a press or focus, as the frame does. **Not while hydrating:** a portal can't be server rendered, so a workspace that hydrates a server's HTML keeps content inside its frames; there a frame that changes parent still remounts its content. Pop out still re-renders the content in the window (phase 4).
- **Selectors with equality.** `useJaliState(select, isEqual?)` and `useJaliModel(select?, isEqual?)` work a selection out once per snapshot, so an object-returning selector no longer loops, and keep the previous value while `isEqual` says it is the same. `shallow` is exported. The same shape as `useSyncExternalStoreWithSelector`, without the dependency.
- **Boundaries around the host's code** (`chrome/Guard.tsx`). Header controls render inside their pane's boundary (a throw fails that pane, with Retry). A kind's icon, a host icon (replaced by Jali's own), a page's rail and header, and Settings' extra fieldsets each fail alone. Anything else under `<JaliRoot>` fails inside the root, which shows "… could not be shown" with Retry; the host's app around it stays. New `<JaliRoot onError>` hears those; a pane's own failures still go to `onPaneError`.
- **DOM ids.** A workspace the host gave no `id` scopes its DOM ids per mounted root with `useId()` (`jali-_r_0_-pane-a`): deterministic on server and client, never stored. One the host gave an `id` keeps it, and two mounted with the same one are a development error. Ids are injective: the pane is core's `<scope>-pane-<id>`, its title `<scope>-title-<id>`, its tab `<scope>-tab-<id>`, its tab panel `<scope>-panel-<id>`, so panes `x` and `x-title` never collide. **Core change (one line):** `JaliDom.pane()` reads `dom.id` as it is now, so the adapter can scope it.
- **`<JaliRoot aria-label | aria-labelledby>`** name the workspace at render, over `createJali({ label })`. They name the workspace landmark, not the root `div` (a `div` with a name and no role is announced by nothing). With `aria-labelledby`, the landmarks inside carry the heading's text, read once mounted and when it changes. Two mounted workspaces with the same name are a development warning.
- **Development checks** read `process.env.NODE_ENV` (`dev.ts`), as core does since its own fix: Vite writes it in development too, so the zero-height warning still shows there, and now under every other bundler. A guard on `typeof process` was tried and dropped: Vite replaces `process.env.NODE_ENV` but defines no `process`, so the warnings went quiet in Vite's development. Production builds keep the messages (a few hundred bytes).
- **"use client"** starts every chunk of `@jali/react`'s build (`vite.config.ts` `banner`). The new `pnpm pack-check` gate checks it in the packed tarball.
- **Tabs and tab panels.** A tile's tabs control their pane's `.jali-pane-content`, which is `role="tabpanel"` labelled by the shown tab while it shows for a strip; the section stays the named region. Stacked view's switcher is `aria-multiselectable` with both panes on screen selected. A curated page's tab controls its view's pane when it is on the page. The page bar's view switch is an APG radio group (one tab stop, arrow keys); a Split view the page can't open is `aria-disabled`, focusable, with its reason. No text-only tab panel gets a tab stop of its own: panes almost always hold controls.
- **One dialog at a time.** `<JaliRoot>` renders the topmost of the discard question, the chooser, ⌘K and Settings; the one beneath comes back when it closes. Settings asked for with `settings={false}` closes again at once. A dialog's Tab wrap skips hidden and inert controls.
- **The dialog layer takes the root's scope:** `dir`, a host's `data-theme` on the root, and the root's `--jali-*` inline tokens. The measured `--jali-gap` and `--jali-inset` now win over the host's `style`, since the layout measured with them.
- **Menus:** Escape and Tab give focus back to what opened them (Tab used to leave the workspace: the menu sits in the layer, after everything). Type-ahead moves to an item by its first letter.
- **The live region** hears each announcement as the store makes it, so messages said in one go are read together (at most three, a repeat once).
- **Kept, not changed:**
  - **`data-theme` on `<html>`** (react-opus REACT-20): hosts may rely on it. `pageTheme: false` turns it off, as documented. A `data-jali-theme` attribute belongs in the API phase, with notice to Data Studio.
  - **The `is-*` state classes** beside the public attributes (react-opus REACT-19): a host stylesheet may select them (Data Studio's, outside this repo). Removing them waits for the API phase.
  - **`palette-title` and `tab-more-n`** (unprefixed, react-opus REACT-21): Trips styles `.palette-title`. Renamed in the API phase.
- **Size:** @jali/react +2.1 KB gzipped (minimal 25.3 → 27.4, full 27.1 → 29.3). The most, in minified bytes: the root's dialog owner, boundaries, names and layer scope (+1.8 KB), content hosts (+0.8 KB), the workspace's names and reshape fix (+0.6 KB), selectors and DOM scope (+0.6 KB), the pane cap field (+0.4 KB), the frame (+0.4 KB), `Guard` (+0.3 KB). Budgets move to about 2% over what it ships now: minimal and own-icons 25.8 → 28, full 27.7 → 29.9. The cuts that would win it back (opt-in Settings, chooser, pop out and scroll rows as modules) are the API phase's (react-opus REACT-16).

## 22 Nov 2026 · Development checks follow `NODE_ENV` (core-opus CORE-10)

- **Why:** dev mode was `import.meta.env.DEV`, which only Vite defines. Under webpack, Next.js, esbuild or Node, the stability check, the default `onPaneError` and every dev warning were off.
- **Now:** `process.env.NODE_ENV !== "production"`, as React reads it. Every bundler writes that in, and Node and the test runners have it.
  - Jali's development-only code tests the literal inside a `try`: `try { if (process.env.NODE_ENV !== "production") … } catch {}`. A production build replaces the test with `false` and drops the code and its messages, as `import.meta.env.DEV` let Vite do. A page that loads the package unbundled has no `process`, lands in the catch, and runs as production.
  - It is read when a workspace is made, so a test can switch it.
  - `@jali/react` has the same rule in its own `dev.ts` (from the react-correctness phase), so both packages decide development one way.
  - `isDev()` (`dev.ts`, in `@jali/core/adapter`, additive) gives the same answer, for an adapter's own checks.
- **Tests:** `packages/core/tests/dev.test.ts`.

## 22 Nov 2026 · `destroy()` is the end: one lifetime for everything pending (core-opus CORE-3, core-codex CORE-5)

- **Why:** `destroy()` cleared timers and an open Discard question, but a host's pending `beforeClose` still answered later. Its yes committed and pushed history onto whatever route showed next. A cancelled URL sync still wrote, and an arrival waiting for an answer survived `stop()`.
- **Now:** the store has one lifetime, an `AbortController` (no new dependency, no Effect: docs/research/effect.md). `destroy()` aborts it.
  - A held host answer's `settled` resolves as `"kept"` at once, and its later yes changes nothing.
  - `store.apply` refuses every commit as `"unavailable"` after it, whoever calls: a late answer, a timer, an app that kept a handle.
  - The address is never written after it.
  - `UrlWriter.cancel()` now also closes the built-in URL sync, so a later write is dropped.
  - The stop `start()` returns makes an arrival still waiting for an answer stale.
- **Tests:** `packages/core/tests/lifetime.test.ts`.

## 22 Nov 2026 · Every layout to start from is checked like a link (core-opus CORE-1)

- **Why:** DECISIONS (19 Nov, "Save and restore") tells hosts to pass a saved layout back as `createJali({ layout })`. A deploy that removed a kind then crashed start-up for everyone who had saved one ("Unknown pane kind"). A raw layout with two panes sharing one id was accepted, while `setLayout` refused the same input.
- **Now:** the layout given, each preset's layout (at start, when chosen, and for a broken link) and the page's go through `core.validate`, as links and `setLayout` do.
  - Order of fallback: the layout given, the preset it opens on, the other presets, the curated page, then a lone launcher. Development says what was wrong.
  - It throws only when nothing can be shown, and the message names the problem.
  - A ref whose params its kind can't read still opens in the kind's `Missing`, as before. `validate` gained `{ params: false }` (additive) for that.
  - The given layout is copied, never kept. Choosing a preset that can't be shown is refused as `"invalid"`.
- **Tests:** `packages/core/tests/ingress.test.ts`. Two React tests changed: a store made with no kinds now gets the kinds its layout names, and a layout with quotes in its ids is refused at start.

## 22 Nov 2026 · Kinds and options are checked as they are given (core-opus CORE-12, core-codex CORE-18)

- **Sizes:** a size that isn't a finite number of at least 0 is left out, and the default stands. `width: { min: NaN }` had put panes at NaN px. So is a max below its min, and a comfortable size outside its min and max. Each is a development error, once per definition.
- **Names given twice:** two kinds with one name, and two presets with one id, are development errors. As before, the last kind wins and the first preset can be chosen. An unknown `preset` is a development error, and the workspace opens on the first.
- **`keys`:** the docs said `"workspace"`; the value is `"scoped"`. Any other value is now a development error and is taken as scoped, so a misspelling never widens the keys a workspace takes.
- **Tests:** `packages/core/tests/kind-options.test.ts`, `url-port.test.ts`.

## 22 Nov 2026 · Layouts validation accepts always lay out (core-codex CORE-3, CORE-4, CORE-9)

- **A tab group of one** (`tabs(pane)` is valid): Unmerge has nothing to do, and Hide treats it as a slot of its own. Both used to read the missing sibling's id and throw.
- **Huge sizes:** a fixed px is taken as at most 10,000,000. Weights above 2^500 are scaled down by a power of two, which is exact, so ordinary weights give exactly the rects they gave before. Weights of 1e308 had overflowed to NaN rects.
- **A layout bigger than a link holds:** a change that would pass 256 nodes or 128 levels (`MAX_NODES`, and the new `MAX_DEPTH`) is refused as `"blocked"`. Its address would have been one `decode` refuses. A layout already that big may still shrink.
- **Tests:** `one-tab-stack.test.ts`, `extreme-sizes.test.ts`, `link-budget.test.ts` (packages/core/tests).

## 22 Nov 2026 · The address follows every refit (core-opus CORE-4)

- **Why:** a resize or a new pane cap refitted the layout in memory only, so Copy link and a reload at the same size opened another arrangement. An arrival from Back or a link had the same gap: it was fitted to this window, but its entry kept the writer's folds.
- **Now:** a refit for a new size or cap writes the address as a debounced replace. At phone width (Single view) it doesn't: the address keeps the wide layout, so widening brings it back (19 Nov 2026), as `e2e/responsive.spec.ts` checks. An arrival that went ahead replaces its own entry with what it was fitted to. Neither adds history or a `layout` event.
- **Focus on arrival:** an arrival with no focus to keep (a reload, a fresh link) is fitted without one, and then focuses the first pane on screen, not the first in the tree. The tree's first pane may be behind a tab, and focusing it changed which tab a fold group showed, so a reload showed something else.
- **Tests:** `address-after-refit.test.ts`. The fuzz (below) reopens the address after random steps.

## 22 Nov 2026 · One notification per action, after it is done; events in the order changes were made (core-opus CORE-16, core-codex CORE-12)

- **Why:** a close notified subscribers twice in the middle of its batch: once for the layout, again for the announcement. A listener that acted had its events told before the change it heard, so the last `layout` event could be older than `getLayout()`.
- **Now:**
  - Subscribers hear a batch once, when it ends, after the address and the announcement are written.
  - Batches are told FIFO. A listener's own change waits behind the change it heard, so the close is told, then the listener's pin. This supersedes the order in "An action a listener runs doesn't rename the event it heard" (21 Nov); the names are still right.
  - Two things said in one action are one announcement ("1 change discarded. Order 1 closed · Undo available"), so the live region reads both. Before, it read only the last.
- **Tests:** `commit-order.test.ts`. `instance.test.ts`, `held-questions.test.ts` and `follow-kinds.test.ts` in @jali/react were updated to the new order and the joined announcement.

## 22 Nov 2026 · A snapshot builds the model only when read (core-opus CORE-17)

`store.snapshot().m` is a lazy getter for the state the snapshot was taken of. `apply` takes snapshots to read the kinds and the words, and each of them used to resolve the layout it had just written. An `openBeside` now builds the model once instead of three times. Test: `lazy-model.test.ts`.

## 22 Nov 2026 · Host callbacks and ref equality, one way each (core-opus CORE-18, CORE-19, CORE-20, CORE-21)

- **The agent bridge** refuses `null`, steps that aren't a list, and a step that isn't one as `"invalid"`. It used to throw. (`agent-input.test.ts`)
- **A kind's `identity` that throws** is guarded like `title` and `follow`: the pane is then the object its params name. (`host-callbacks.test.ts`)
- **Refs:** `readSearch` dedupes `open=` with `sameRef`. `structureKey` hashes params in key order, so a layout read back from `jsonb` keeps the person's local sizes. A layout whose params were stored in another order loses those sizes once.
- **`linkSearch`** reads each ref before the layout builders copy it. The copy had dropped the "built by a kind's call" mark, so `linkSearch({ layout: doc({ id, draft }) })` wrote the app-only `draft`. Without `panes`, a plain or copied ref is a development warning. Input tracking per document waits for Pop out (phase 4). (`link-search-plain.test.ts`)
- **`files`** no longer lists a LICENSE the package doesn't have. The licence itself is still open. (`package-files.test.ts`)

## 22 Nov 2026 · Pane state: one record per pane, under `pane-state@2` (core-opus CORE-2, core-codex CORE-1, react-codex REACT-1)

- **Why:**
  - Pane state was two keys (values, owners), and every tab overwrote both whole on save. A second tab of the same build erased the first one's drafts.
  - An old build's tab could pair its values with a newer tab's owners (found, not fixed, 21 Nov).
  - A `usePaneState` setter kept after `openHere` wrote its value into the next object's state.
- **Stored format:** `{ v: 2, panes: { [paneId]: { of, values, at } } }` under the new key `pane-state@2`. The object and its values are one record, so they can never disagree. It is a new key, not only a new shape, so an old tab writing the old keys can't touch it.
- **Migration:** none. The old keys (`pane-state`, `pane-state-of`) are never read, in both the pre-20 Nov and the 20 Nov form. They are cleared at start: removed through `StoragePort.remove` where a port has it, else written as `{}`, which an old build reads as empty. The 21 Nov reasoning applies to the owned form too: a matching layout can't prove that the values and owners were written together, so adopting them could attach one customer's draft to another. What is lost is one scroll position, sort or draft, once.
- **Writing:** each workspace writes only what it changed since its last write, over what is stored now (`paneStateSync`). It never writes when it changed nothing. A pane closed for good takes its record out only if no other tab has written it since. At most 200 records are kept, newest first.
- **Other tabs:** `StoragePort.subscribe` (optional; `browserStorage` backs it with the `storage` event) brings in what other tabs write, for an object this tab shows under that pane id, unless this tab has a change of its own waiting. Records for other objects are never taken in, and never removed. A record that isn't one is left out, and goes at the next write.
- **Stale setters:** `setPaneState` takes the object the writer saw (`ref`, a fifth argument), and `usePaneState` passes it (a few lines in `@jali/react`). A value for an object the pane no longer shows is dropped.
- **Unchanged in memory:** `UiState.paneState` and `paneStateOf`, and `paneStateFor`, `ownedPaneState`, `loadPaneState`, `loadPaneStateOwners` and `savePaneState` (which now merges over what is stored).
- **New in `@jali/core/adapter`:** `paneStateSync`, `PaneStateSync`, `HeldPaneState`, `PANE_STATE_KEY`, `PANE_STATE_MAX`. New on `StoragePort`: optional `remove` and `subscribe`. New on `UiStore`: `paneStates`.
- **Not done:** state for object A and then object B under one pane id is still one record, so an undo back to A starts it afresh (core-codex CORE-1's third case). One record per pane and object is for the API phase.
- **Tests:** `packages/core/tests/pane-state.test.ts` replaces `pane-state-legacy.test.ts`. Also `use-pane-state.test.tsx` (a stale setter), `destroy.test.ts`, and `e2e/pane-contract.spec.ts` (the key name).

## 22 Nov 2026 · A pane's node reaches its component whole (react-codex REACT-7)

`sameNode` (core, `workspace/frames.ts`) compared a hand-picked list of fields. A `setLayout` that changed a pane's `role` or `follows` with the same geometry never re-rendered it. It now compares every field but the size (`size`, `base`, `userSized`), which the frame's rect carries. `PaneBody`'s memo uses it (one line in `@jali/react`). Render counts are unchanged. Test: `packages/react/tests/pane-node-fresh.test.tsx`.

## 22 Nov 2026 · Layout stability, enforced rather than approximated (core-opus CORE-5, core-codex CORE-6)

- **Why:** a 400-seed fuzz found about 200 "Layout stability" reports, and the reviewers disagreed on the cause. Both causes were real.
  - A deliberate tab group was measured as its first tab (17 Nov), so moving or pinning a tab resized it: 60 breaches in a sweep, reproduced here at widths above 1,100 px with no fold at all.
  - Its fold records and shown tab were keyed by its first tab, so moving that tab left them stale.
  - Swap ops whose rects depend on what they show (`swap`, `openHere`, `focusExisting`) were declared as never moving anything. They jumped instead of sliding.
- **Now:**
  - **A tab group the person made is measured by all its tabs alike.** It is comfortable for its most demanding tab, and grows as far as its most capable tab uses. (Stopping at its most limited tab's max was tried first. It narrowed the docs hero's group enough to break its tour, and left a plain tab beside a record with room it couldn't use.) Its tab order says nothing about its size. A fold group is still measured as its home. This supersedes "a tab group is measured as its home (a stack's first tab)" (17 Nov) for deliberate groups. A group of mixed kinds may sit at a different width than before.
  - **Ops own their overlay:** a new first tab (moved or pinned) carries the group's fold records and shown tab with it (`rekey`).
  - **Geometry is measured.** For a focus or swap op, `apply` compares the rects before and after. Rects that moved are counted as a reshape, so panes slide there. Only ops that never move anything by contract report a breach (`STABLE`: focus, tab, reveal, moveTab, pinTab, keep). The message says so.
- **Not reproduced:** fold destination following tab order (core-codex CORE-6, part). It didn't show after the sizing fix, in a sweep of 256 kind combinations × 44 widths.
- **Tests:** `tab-order.test.ts` (sweep and slide), `heights.test.ts` and `sizing.test.ts` (renamed and updated), and the frozen engine (`legacy-fit/overlay.ts`), which checks folding, not sizing.

## 22 Nov 2026 · A seeded fuzz over the public actions (core-opus CORE-15, part)

- **What:** `packages/core/tests/fuzz.test.ts` runs 300 seeds × 40 random steps (about 1.5 s) on core's own kinds. The steps are every public action, resizes, Back, and a reload from the address.
- **Checked after every step:**
  - nothing threw, and the layout validates;
  - focus and zoom are on panes that exist;
  - rects are finite and inside the room;
  - no breach of an op that never moves anything;
  - a reload at the same size shows what is on screen.
- **Knobs:** `FUZZ_SEEDS`, `FUZZ_LIMIT` and `FUZZ_DEBUG` widen it.
- **Found, moved:** at 2,000 seeds, 5 of 80,000 steps reopen with other widths after tucks and folds combine (seeds 54, 1289, 1403, 1421, 1571; the fuzz names them and leaves their address check out). It is the same panes, at other sizes. Moved to a later phase.

## 22 Nov 2026 · The address port, read-only snapshots, a page's viewer and its links (core-codex CORE-2, CORE-8, CORE-10, CORE-15)

- **Address port:** `browserLocation().navigate(…, "replace")` keeps the entry's `history.state` (a router's). The unprefixed workspace clears `app` and `arr` only when they are an old lab link's (`app=review`), not when they are the host's own. (`url-port.test.ts`)
- **Snapshots:** in development, the committed layout and view are frozen, and so are what `get()`, `getLayout()` and events hand out. An app that edits them fails at once, instead of changing the workspace behind its back (no history, no event, a stale model cache). Only what is new in a commit is walked. Refs are left alone, as they may be the app's own objects. No type changed. A deeply readonly type is for the API phase. (`frozen.test.ts`)
- **Viewer:** the page's viewer policy (`setCanInvestigate`) is kept in `UiState.canInvestigate` too, so leaving the page and coming back never widens it. It can be set before a page opens, and that call used to be refused as "unavailable". An initial value at creation waits for the API phase's naming. (`page-viewer.test.ts`)
- **Page links:** a page link's item is read as the page's type (`readItem`). A numbered page never gets `"abc"`: the link falls back to the item before, and an app's call is refused as `"invalid"`. A link to another page (`?page=other`) doesn't open this one with its item. `PageRead` gained `page` (additive). (`page-link.test.ts`)

## 22 Nov 2026 · What a pane allows holds whatever asks (core-codex CORE-7)

- **Dividers:** a divider's sides are the panes beside it on screen (the resolved divider's `neighbours`), not the split's next two children. A fold can put another pane there.
- **Reset and drag:** a reset is checked like a key. A drag's commit is checked again as it lands (`commitDividerDrag` takes the divider it moved, additive): its panes must still allow `resize`.
- **Back to the page:** it keeps the investigation while an opened pane may not close (`not-allowed`), as `close` refuses it.
- **Tests:** `allow-entry-points.test.ts`.

## 22 Nov 2026 · A divider drag resolves the committed layout once (core-codex CORE-16, part)

`layout.resizeDivider` takes an optional sixth argument: the committed layout, resolved. The drag makes it at pointer down, so each frame resolves only its preview, which halves the work per frame. A full resize plan (reallocating the affected split without resolving) is moved to a later phase. Test: `divider-preview.test.ts`.

## 22 Nov 2026 · Phase 1's size: over budget, and by how much

- **Measured** with `pnpm size`, core gzipped, master against this branch:
  - minimal 53.6 → 55.2 KB (budget 55);
  - full 58.7 → 60.4 (budget 60.4);
  - headless 48.0 → 49.6 (budget 49.2);
  - layout 10.2 → 10.3 (budget 10.7).
- **@jali/react:** unchanged (25.3 minimal, 27.1 full).
- **Where the bytes are, minified, for headless:**
  - the store: the event queue, the lifetime, the checked first layout and the lazy snapshot, about 1.0 KB;
  - pane state's sync, about 1.0 KB;
  - the storage port's `subscribe`, 0.2 KB;
  - the rest spread over about 20 fixes of 0.1 KB or less.
- **Already won back:** development-only code is dropped from production builds again (about 0.6 KB gzipped). It had been since `import.meta.env.DEV`, and the first `NODE_ENV` version lost that.
- **Over budget:** minimal and own-icons by 0.2 KB, headless by 0.4 KB. The size gate fails on core for those three.
- **Not done:** the budgets were not raised here. That is the owner's call. The opt-in feature split of the API phase (API-REVIEW.md, change 2) is the planned way back under.

## 22 Nov 2026 · Size budgets after the correctness phases (owner's call)

- **@jali/core:** +0.5 KB gzipped in every scenario that has a core budget except layout-only: minimal and own-icons 55 → 55.5, full 60.4 → 60.9, headless 49.2 → 49.7. Phase 1 shipped minimal 55.2, headless 49.6 and full 60.4. Layout-only stays at 10.7 (it ships 10.3).
- **@jali/react:** the phase 2 budgets stand (minimal and own-icons 28, full 29.9), as the owner accepted.
- **Why raise them rather than cut now:** both phases fixed correctness bugs, and a size gate that already fails hides the next regression. The API phase's opt-in features (docs/API-REVIEW.md, section 2) are the planned way down: about 25–30 KB for core and 17–18 KB for React, both still estimates. Its budgets will be set again from what it measures.

## 22 Nov 2026 · API phase 3a: types from the registered kinds (API-REVIEW section 3)

- **`Ref<K, P>`:** `definePane` takes the kind as a literal (`const K`) and its call returns `Ref<K, P>`: `{ readonly kind: K; readonly params: P }`. It is structurally an `ObjectRef`, so links, agents and every function that takes the wide type keep taking it.
- **No runtime brand.** The review said "branded"; a literal `kind` is the discriminant that does the work (narrowing, refusing `"ordr"`), and a phantom brand would either reject plain refs from links (`{ kind: "order", params: { id: 7 } }`) or reject nothing. So `Ref` is structural; the only cost is types.
- **`createJali<const D, const L, const P>`:** `D` from `panes`, `L` from `launcher` (its own parameter, so a launcher of another kind widens the union instead of failing inference), `P` from `page`. It returns `Jali<RefOf<D | L>, PageOf<P>>`; `RefOf` gives `ObjectRef` for a kind without a call (a plain `PaneKindBase`), so untyped kinds stay as wide as before.
- **`Jali<R, P>` defaults** to `Jali<ObjectRef, JaliPage | undefined>`, so every existing `jali: Jali` annotation still accepts a typed workspace. `AnyJali` is for functions that take any.
- **Read-only snapshots (core-codex CORE-10):** `JaliState`, `getLayout()`, the model and events are `DeepReadonly`. The engine's own layout types stay mutable: its operations clone and edit drafts (97 sites), and making the source types read-only would have rewritten the engine for no behaviour. Instead the read-only view is what the public API returns, `LayoutInput` takes it back, and `layout.tree`, `encode`, `validate` and `resolve` take it too. The core reads the draft-typed tree through `layout/engine.ts`.
- **`Register`:** `interface Register {}` in `@jali/core`; `RegisteredJali` reads it. The React hooks default their workspace type to it and take it explicitly too (`useJali<typeof jali>()`), because in this repo every example is one TypeScript program and two `Register` declarations would conflict. Its type test has a program of its own (`packages/react/type-tests`, in the typecheck gate).
- **`usePane(kind)`** types params from the kind, with a development error when the pane is of another kind; `usePane()` with no kind gives plain `Params`, for a component several kinds render.
- **Type tests first:** `packages/react/tests/types.test.tsx` (quickstart, curated page, custom chrome, negatives) and `type-tests/register.test.tsx`. Both failed to compile before the types (commit a5c8167c) and pass after.

## 22 Nov 2026 · API phase 3a: one action path (API-REVIEW section 5, core-opus CORE-7, core-codex CORE-14)

- **One table, `STEPS`** (actions/index.ts). A step written on its own is the public action of its name; a grouped name (`"page.showView"`, `"dialogs.openPalette"`) is that group's; `[step, name]` is a form of action `name`, or of none (`null`). A type check makes the plain public steps and `ActionName` the same set. `NAMED_AS`, `bindActions` and `publicActions` are gone.
- **`store.run(name, ...args)`** is the one way a step is made, for the app (`jali.actions`, `jali.page`, `jali.dialogs` are built from the table), adapters (`store.actions` is the same steps through `run`), keys, commands and the agent. Adapters now get the `ActionResult`, refusals included.
- **Where engine and public steps shared a name, the public one won** (`focus` shows the pane, `peek(pane, ref)`, `split(pane, direction)`): one meaning per name. The engine-only forms an adapter needs keep names of their own (`focusCycle`, `moveDirection`, `showViewBeside`, `arrivePage`).
- **The pane an action acted on** is put on the outcome (`withPane`), so a held action's `settled` resolves with it too, as before.
- **`jali.page` only with a page:** the key is absent without one, and its type is `undefined`. The page's state field `tab` and `open({ tab })` keep their names: `OpenPage.view` is already a view state internally, and `showView` names the verb, which was the ambiguity.
- **`setLinkMode("open" | "peek")`** replaces `setCanInvestigate(boolean)`, and the state field is `linkMode`. The initial value at creation (moved from phase 1) is `createJali({ linkMode })`, top level rather than inside `page`, since `page` is the page's design and the link mode is the viewer's.
- **`jali.dialogs.choose`:** the chooser is a dialog, so `choose` moved with the palette and settings.
- **Agent:** its page actions are named as the instance names them (`page.showView`).

## 22 Nov 2026 · API phase 3a: listening, options, the root, names, lifecycle (API-REVIEW sections 6 to 10)

- **`on("toast")`** replaces `onToast`; toasts still go out at once (not with the batch's events) and are kept until a listener comes. `useJaliEvent` keeps the latest handler in a ref and resubscribes only when the event name or store changes.
- **`keyboard: { scope, keymap, prefix, reserved, platform, onInvalid, words }`.** `palette` stays a top-level option: it is more than a key (it decides whether a dialog renders), and phase 3b turns it into a feature, so moving it into `keyboard` now would move it twice.
- **`resolveOptions`:** `JaliOptions` is resolved once into `JaliConfig`; options with the same name and meaning pass through by a rest spread (no field-by-field copy), and the store builds its env by spreading the config's shared fields. The option docs live once, on `JaliOptions`. Normalisation (`label` trimmed, `landmark`, `confirmDiscard`, `pageTheme`) moved there.
- **No default name.** `createJali({ name })` has no default. The page's leave command reads "Open <name>" with one and "Leave <page>" without; a failed root says the label, the name, or "Panes". Development messages say "Jali" and "panes".
- **One root:** `JaliProvider`, `Panes`, `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard` and `Announcer` are internal. The docs site's layout-tree panels read the live workspace beside its root, so they import the provider from source (the docs live in this repo); no app needs it.
- **`definePage` is React's only.** Core's is the adapter's `definePageEngine`, so an app can't make a page that renders nothing; phase 3b moves React's to `jali/page`.
- **Removed:** `layout.tree`'s draft aliases, `isMac`, `setPopOutPort` (its test now uses the DOM port), `onToast`. Internal `UiStore`/`createUiStore` are `JaliStore`/`createJaliStore`.
- **Lifecycle:** already true in behaviour; now tested (`lifecycle.test.tsx`): `<JaliRoot>` starts and stops (StrictMode too), `start()` returns `stop` and starts again, starting twice listens once, `destroy()` stops and refuses everything after.
- **Hydration bootstrap snapshot (react-codex REACT-4):** left moved. It needs a serialisable snapshot of layout, view, settings, direction and size from core's boot and a server snapshot for every selector; it is its own change, not part of the lifecycle's.

## 22 Nov 2026 · A → B → Undo keeps A's pane state (core-codex CORE-1, rest)

Writing state for object B under a pane id that holds object A's state no longer replaces A's: A's is held (`paneStateHeld`, in memory, never saved) while an undo could bring A back, and comes back with it. The layout's prune drops a held entry once no layout in the undo stack shows its object under its id. Test: `pane-state-identity.test.ts`.

## 22 Nov 2026 · The full-screen ⌘K flake was a focus race

`e2e/fullscreen.spec.ts` "⌘K runs Full screen, and running it again exits" failed about half the time in the full suite. The second ⌘K could open the palette just before `fullscreenchange`; the dialog layer then mounted again inside the full-screen pane, the new dialog's effect could run before the old one's cleanup, its focus landed in a root still inert, and the cleanup put focus back on the pane, so the typed "full screen" went to the pane (a space peeked a row). The dialog now checks that focus came in, and if not, focuses again once both effects are done (a microtask). No retries were added. Under load: 2 failures in 30 runs before, 0 in 200 after.

## 22 Nov 2026 · Phase 3a's size

Core gzipped, before → after (`pnpm size`): minimal 55.2 → 55.1, full 60.4 → 60.2, headless 49.6 → 49.4, layout 10.3 → 10.3 (budgets 55.5, 60.9, 49.7, 10.7). The one action table and the resolved options removed more than the typed API, `jali.page`/`jali.dialogs` and the held pane state added. @jali/react: minimal 27.4 → 27.4, full 29.3 → 29.3.

Left as found: `e2e/follow.spec.ts` "⌥↵ on the row the detail shows keeps it there…" fails about 1 run in 20 on master too (the follow's "Showing order 2" and "order 2 kept" land in one announcement). Not part of 3a.

## 22 Nov 2026 · API phase 3b: one package, `jali`, with subpaths (API-REVIEW section 1)

- **Layout:** `packages/jali` is the one published package. It holds no source of its own beyond its entry files: `vp pack` bundles `@jali/core` and `@jali/react` (both now `private`) into it. Entries: `jali`, `jali/react`, `jali/page`, `jali/agent`, `jali/testing`, `jali/adapter` (may change in any minor), `jali/icons`, `jali/features`, one per feature (`jali/url`, `jali/palette`, `jali/settings`, `jali/chooser`, `jali/rename`, `jali/pop-out`, `jali/pressed`), and the three style sheets.
- **Two code chunks, `core` and `react`,** forced by groups (core's first: a group takes what its modules import). An app's bundler tree-shakes each as it did the two dists, so per-feature subpaths cost nothing, and the size gate still splits core from React. The `layout` namespace keeps its own file, as before.
- **"use client"** starts the `react` chunk and every entry that re-exports it, and nothing framework-free (`jali`, `jali/url`, `jali/agent`, `jali/testing`, `jali/adapter`, `core`, `layout`). pack-check enforces both ways, and that framework-free files import no React.
- **React is an optional peer** (`peerDependenciesMeta`); `jali` has no dependencies.
- **Declarations** come from the workspace packages' dist (built first, in order, by `pnpm build:packages`); the code comes from their source (the `source` condition). Mixing source and dist declarations gave two copies of the same types (a `unique symbol` would not match), and the declaration bundler resolves package imports by `types` regardless of conditions, so `@jali/react` got an `./internal` entry listing what `jali` re-exports, and `@jali/core` a `./testing` entry.
- **`Register` on "jali"** merges through the re-export: pack-check typechecks a consumer that declares it against the packed `.d.ts` (`@ts-expect-error` on an unknown kind proves the hooks are typed).
- **Data Studio's links are untouched:** `packages/core` and `packages/react` keep their names, entries and `dist/index.js`; `private` only stops a publish. The agent docs moved to `packages/jali/docs` (they ship in `jali`); `@jali/core` ships no docs now.
- **`definePane` stays in `jali/react`.** The owner approved moving it to the framework-free entry "if the types stay clean". They don't yet: `Component`'s type is React's, so a framework-free `definePane` needs `jali/react` to augment `jali`'s option types, and a bundled `.d.ts` can't name the module it augments by its published specifier from source written against `@jali/core`. Left for the docs phase to revisit with a type test; the API review's own table puts it in `jali/react`.
- **`jali/react` doesn't repeat `jali`:** `optional`, `oneOf`, `appOnly` and `keyBelongsToContent` are imported from `jali` (one way per name). `definePage` is `jali/page` only.

## 22 Nov 2026 · API phase 3b: features are opt-in (API-REVIEW section 2, core-opus CORE-9, react-opus REACT-16, core-codex CORE-17)

- **What became a feature, by bytes and by how often apps need it** (gzipped, over the floor; "Phase 3b's size" has the table): the address (`urlSync`, 2.7 KB of core: URL sync was on by default and most of the reachable code an app didn't choose), the palette (1.2), Settings (1.3), the chooser (1.5), rename (0.5), Pop out (1.3, not a default before either) and `data-pressed` (0.4). `defaultFeatures()` is the five that were on by themselves (address, palette, Settings, chooser, pressed); rename needs the app's `run`, and Pop out was opt-in.
- **What did not, and why:**
  - _The tab and pane menus:_ the header's ⋯ and its narrow-header fallback are built from the same menu; without it a narrow pane would lose its controls.
  - _Phones (Single view) and stacked view:_ Single view is how fitting ends when even one pane can't fit, at any width; stacked view shares `workspace/stack.ts` with the fold (hinge) support, which is on by default. Only `Stacked.tsx` (1.8 KB minified) could move; not worth a second phone option.
  - _Rows that scroll:_ a layout's shape (`row({ scroll: "x" })`); a layout that has one must render it.
  - _The command registry:_ keys run commands through it, so it is the keyboard's.
- **The feature contract** (`features/feature.ts`, internal; adapters read it, apps never write one): an `id`, and optionally `words` (its English), `address(storage)` (the URL writer), `boot(store)` and `start(store) → stop` (lifecycle), `env` (options it sets, e.g. `rename`), and `parts` (what the adapter renders, by name). Not steps and not commands: the few a feature needs (`dialogs.openPalette`, `startRename`, "Rename pane", "Pop out pane") stay in core's tables at a few bytes each, so ids, keys and palette order stay one list; a step is refused as `"unavailable"` without its feature, and its command is listed only with it. (A first version let features bring commands placed `after` one of Jali's; it cost 0.2 KB more in the full app than the four gated entries, which pushed `full` over its budget.) No public plugin API.
- **One of each id:** a later feature of the same id takes the earlier's place, so `[...defaultFeatures(), urlSync({ location })]` works.
- **Words split per feature** (`state/feature-messages.ts`, one export per feature), merged after the base words and before the page's and the app's. `Messages` (the type) still has every word, and `en` holds them all for a translation to start from.
- **React parts come with the feature,** as `definePage`'s do: `palette()` is `paletteFeature({ palette: Palette })`, and `<JaliRoot>` renders `partOf(env, "palette")`. A dialog asked for that the workspace doesn't have closes again at once.
- **Behaviour:** with `defaultFeatures()`, unchanged, except that "Rename pane" is listed in ⌘K only with `rename()` (it was listed, greyed out, in every workspace). The examples pass `defaultFeatures()` (Data Studio and Trips add `popOut()`); examples/minimal picks `urlSync()` only, and says so.
- **`<JaliRoot settings={false}>` is gone:** leave `settings()` out. `settingsExtra` stays.

## 22 Nov 2026 · API phase 3b: params accept a Standard Schema (API-REVIEW section 4, research/effect.md)

- **The whole object:** `params` takes Jali's constructors (unchanged) or one Standard Schema v1 (`~standard`) of the whole params object, from any library. `ParamsOf` infers the schema's output, so `usePane(kind).params`, the kind's call and its component are typed by it.
- **No dependency:** the spec's `StandardSchemaV1` types are copied into `standard-schema.ts`, as the spec asks.
- **The schema decides validity and output; Jali's codec decides how values are written.** Links written by Jali keep numbers and flags (`#7`, `!true`, the layout's JSON), so a schema sees them typed. A value a hand-written link carries as text reaches the schema as text: coercing it is the schema's (`z.coerce.number()`). A first version retried text as a number or a flag; it cost 0.2 KB for every app and guessed at the schema's intent.
- **Failures** are `ParamProblem`s keyed by each issue's first path segment (`params` when an issue has no path), with the value the ref held. A schema that validates asynchronously can't read a link (params are read as a pane renders): its answer is a problem.
- **Not per param.** A schema per param (`{ id: z.number() }`) worked too, with optionality from the schema's output; it was dropped for 0.15 KB of every app's core, since the whole-object form covers the review's case and `appOnly`/`link: false` stay Jali's own, one by one.
- **Curated-page item ids** have no param-like declaration (`firstItem`'s type decides number or string), so nothing changes there.
- **Agents** read a schema kind's params as one entry: `params: "an object (<vendor> schema)"`.

## 22 Nov 2026 · Pop out, stable: a feature, `jali/pop-out` (react-opus REACT-11, react-codex REACT-9, core-opus CORE-11, core-codex CORE-11)

- **`popOut()`** replaces `allow: { popOut: true }` with `unstable_popOut`, `unstable_bringBack` and `unstable_canPopOut`. With it, Pop out is allowed unless a kind or the workspace says `allow: { popOut: false }`; without it, never.
- **The window is the instance's own:** the feature's window keeps a slot per workspace (a `WeakMap` held by that feature value, not module state); one window per workspace; opening another pane closes the first. The window closes when the workspace stops: its root unmounts, `destroy()`, or another workspace takes the root (the feature's `start` returns the close).
- **State survives:** each pane's content renders into its own host element (phase 2); Pop out moves that element into the window and back (`append` adopts it), and the frame doesn't take it back while it is out. The React portal target never changes, so `useState`, subscriptions and DOM survive (unit test with a counter, e2e with a mark on the content's first element). A workspace that hydrated a server's HTML keeps content in its frames; there the content renders in the window through a portal, and its own state starts again.
- **Keys:** core's `installKeyboard` is installed on the window with the window's document as the root, so every key pressed there is the workspace's whatever `keyboard.scope`. Input tracking is counted per document.
- **Look:** stylesheets copied (cross-origin ones linked, media kept), `<html>`'s class, `data-*`, `dir` and `lang`, and the root's theme, `--jali-*` tokens and direction kept in step by a `MutationObserver` and the store; `[data-jali]` on the window's root; the page's zoom followed.
- **Requests:** asked inside the gesture; a refusal resolves `false` (no unhandled rejection); a request that resolves after a newer one, after the pane left, or after the workspace stopped closes its window and resolves `false`.
- **The browser's limits stand** (19 and 21 Nov): one window at a time in Chrome across tabs, and not over a full-screen app's Space on macOS.

## 22 Nov 2026 · `jali/testing` (docs-opus DOCS-9)

`createTestJali` (address and storage in memory, 1440×900, keys as on a Mac, no DOM focus), `testJaliOptions` for an app whose function makes its workspace, `reportUnsaved`, `reportPaneState`, `paneStateOf`, `discardQuestion`, `answerDiscard`, `chooserRequest`, `lastAnnouncement` and `pressKeys`: what the examples' and the docs' tests reached into `storeOf` for. The examples and the testing guide use them; no app imports `jali/adapter` for tests.

## 22 Nov 2026 · Options Jali doesn't know warn in development

Data Studio's script built its options at run time with 3a's old names; Jali ignored them and the types couldn't see them. `createJali`, `definePane` and `definePage` now warn once per unknown option in development, naming where each of 3a's and 3b's moved options went (`dev-options.ts`; the list is in MIGRATION.md). The call sits inside the literal `process.env.NODE_ENV` test, so production builds drop it with its lists: `core/src/dev-options.ts` is in every size scenario's `mustNotShip`. `url` is known when it is a writer of the app's own.

## 22 Nov 2026 · React's development checks were shipping

`@jali/react`'s `DEV` was an IIFE around a `try`; minifiers didn't fold it, so every `if (DEV)` block and its message shipped (about 0.5 KB gzipped). Each check now tests `process.env.NODE_ENV` where it is, inside a `try`, as core's do, and `react/src/dev.ts` is gone. In core, a check that needs a runtime flag reads it first (`DEV && process.env.NODE_ENV !== "production"`), so a page without `process` never reads it.

## 22 Nov 2026 · The follow announcement flake was the live region's 30ms

`e2e/follow.spec.ts` "⌥↵ on the row the detail shows keeps it there…" failed about one run in 20. The live region reads what is said within 30ms as one announcement (`chrome/Announcer.tsx`), and the detail shows "order 2" as the follow is said, so a ⌥↵ pressed at once was read with it: "Showing order 2 order 2 kept". That is right for a person; the test now waits for "Showing order 2" to be said on its own before pressing ⌥↵. No retry. 30 of 30 runs pass.

## 22 Nov 2026 · Phase 3b's size

Gzipped KB, `pnpm size`, master `cdb8fb7b` → this branch. Before, every app shipped the address, palette, Settings, chooser, rename's field, Pop out and `data-pressed`; "minimal" was that app.

| Scenario                                              | jali core   | jali react  | budget (core / react)      |
| ----------------------------------------------------- | ----------- | ----------- | -------------------------- |
| minimal (before: everything; now: `urlSync()` only)   | 55.1 → 54.6 | 27.4 → 23.5 | 55.5 / 24.7 (react was 28) |
| bare: no feature (new floor)                          | – → 51.9    | – → 23.5    | 54.5 / 24.7                |
| own-icons, `defaultFeatures()` (today's behaviour)    | 55.1 → 55.4 | 27.4 → 26.2 | 55.5 / 27.5 (react was 28) |
| full: `defaultFeatures()`, rename, Pop out, a page, … | 60.2 → 60.8 | 29.3 → 29.6 | 60.9 / 29.9 (unchanged)    |
| headless (before: with the address; now: none)        | 49.4 → 46.4 | –           | 48.7 (was 49.7)            |
| layout                                                | 10.3 → 10.3 | –           | 10.7                       |

What each feature adds over the floor (core + react, gzipped): `urlSync` 2.7 + 0; `palette` 0.25 + 0.9; `settings` 0.5 + 0.85; `chooser` 0.2 + 1.3; `rename` 0.1 + 0.4; `popOut` 0.15 + 1.1; `pressed` 0 + 0.4; `defaultFeatures()` 3.55 + 2.7; a curated page 5.0 + 1.1. Each has a scenario (`+url`, …, `+page`) with a budget about 5% over its total, and a `mustNotShip` list of every other feature's files. CSS 8.3 everywhere (budget 8.6).

- **Short of the review's estimates** (core 25–30, React 17–18): the floor is 51.9 and 23.5. The estimate counted the English messages and the command registry as feature code; most of both is the keyboard's and the chrome's, which every app has. The rest of the floor is the engine (layout and fitting about 10), the store, actions, focus, follow and undo.
- **Full grew 0.6 core and 0.3 React** over 3a: stable Pop out (+0.4 React), the feature plumbing and word split (+0.4 core), Standard Schema (+0.15 core), offset by React's development messages no longer shipping (−0.5 React). Full and own-icons sit at the pre-3b budgets rather than 5% over what they ship, since raising a budget is the owner's call; full core has 0.07 KB of room.
- **Left for later:** the render-count instrumentation of react-codex REACT-16 (counting selector and permission work) and the hydration bootstrap snapshot (react-codex REACT-4) didn't fall out of this phase.

## 22 Nov 2026 · API phase 3c: the last names (reviews/2026-11-22, "Left for the owner")

The owner's rules: no "workspace" in a name or a word; "Single view" and "Split view" are a curated page's modes only; the phone fallback is "one pane at a time". The full list, old to new, is in MIGRATION.md.

- **The phone fallback's words** are their own: "One pane at a time: choose one from the switcher at the top" and "Panes side by side again: layout restored" (`onePaneOn`, `onePaneOff`). The model says `onePane`, the layout element `data-one-pane`, the agent `"one-at-a-time"`; "single" now means only a curated page's mode (`ViewMode`, `page.setMode("single")`, `data-page="single"`, `icons.singleView`). The adapter's `Presentation` (`"tiled" | "single"`) and `CHROME.single` keep their names: `jali/adapter` may change in a minor version, and renaming them would be churn with no public effect.
- **"workspace" out of every public name and word:** `Allow` (the name was free, and `PaneAllow` beside it says which level), `messages.panes` (the area holds the panes' region, the switcher and the dividers; its English already said "Panes"), `.jali-layout` (`.jali-panes` would sit one letter from `.jali-pane`), `AgentSnapshot.layout`, the duplicate-name warning's "two instances", the agent tools' descriptions, and the doc comments that ship in the declarations. Internal folders and files (`core/src/workspace/`, `Workspace.tsx`, `workspace.css`) keep their names. The npm keyword `workspace` stays in `packages/jali/package.json`: it is what people search for, not a name in the API, and dropping it is the owner's call.
- **The page bar's group** reads "**2** opened panes" in a group named "Opened panes", the words the commands ("close opened panes") and Settings ("opened panes") already used. The default viewer name `investigator` (`page.viewerFull`) is unchanged: it is a role's word, shown only where a page names no `viewers`.
- **`AgentKind.width`** is `{ min, comfortable? }`, the shape `definePane({ width })` takes, rather than keeping `minWidth` and explaining why. An agent reads the snapshot as JSON, so one shape for a kind's widths everywhere is the simpler thing to describe. `max` is left out, as before: nothing an agent does needs it.
- **`<Activity activity>`**, not `a`. Its development warning goes through `warnUnknown`, which now names a component's "prop".
- **Exported types:** `tooling/public-types.mjs` (run by `pack-check`) reads the packed declarations and follows every type an app entry's signatures name. It found the five the review named and five more: `Hinge` (inside `StackPair`), `CloseReason`, `Done`, `Spacing` and `PaneKindDef`, all exported now. It reads the bundler's output as text, since TypeScript 7's compiler API is not stable; it follows only the fields `Pick` and `Omit` keep, treats `Feature` and `en`'s type as opaque, and lists the few types named on purpose without an export (`definePage`'s slots, type helpers like `ParamsFrom`) with the reason.
- **Size:** unchanged within 0.02 KB everywhere (full core 60.83 → 60.81, own-icons core 55.43 → 55.43, React +0.01 at most). No budget moved.

## 22 Nov 2026 · The React review's fixes, and full's React budget

A review of `packages/react` found one decision with two owners in several places; the fixes are on `fix/react-review`. What an instance keeps now lasts as long as the instance (content hosts per store, a stopped instance's Pop out request goes stale, `data-pressed` only on the controls of an instance with the feature); the header and its ⋯ menu build their actions once (`pane/actions.ts`, so a narrow header's ⋯ says Bring back); every frame's final rect and the stacked divider come from one calculation (`workspace/placement.ts`, with `stackSplit` in core); `packages/react/src` has no import cycles; Peek's object identity is `sameRef`; `usePaneState` keeps a parsed `null`; `parts.ts` says `aria-disabled` where Jali renders it, and its test reads attributes, not substrings; TabStrip's groups are a pure function and each tab a `TabItem`.

- **Size:** full's React 29.6 → 30.2 KB gzipped (placement, the action builder, the TabStrip split, instance ownership); other scenarios within their budgets. Full's React budget moves 29.9 → 30.3, as the owner accepted. Undoing the TabStrip split would save about 0.15 KB and still not fit.
- **Core at its budget:** own-icons and `+defaults` core ship 55.5 of 55.5; the next core growth there needs a cut or the owner's say.

## 22 Nov 2026 · Core architecture review: ownership boundaries (branch core-architecture)

An architecture review of `packages/core` found the layout engine sound and the orchestration porous where actions meet pages, dialogs, persistence or deferred work. Each claim was checked in code and by probes, and the gesture findings live in Chrome (a probe page driven by Playwright, listeners counted through the DevTools protocol). All eleven findings are fixed; what follows is what changed and why.

- **Gestures belong to the instance** (`state/lifetime.ts`). A pane or divider drag registers how to cancel itself; `stop()` and `destroy()` cancel it, and a pane drag listens for `pointercancel`. Live before: a cancelled drag still dropped the pane on the next release, and a divider drag outlived by its instance left `jali-resizing` on `<body>` for good. Raw `store.set` is inert after `destroy()`, like `apply`.
- **`linkSearch` needs the kinds** (`{ panes }` is required). What a link leaves out (`appOnly`, `link: false`) is read from the kinds, never from which refs a kind's call built (the `WeakMap` and its compensating traversal are gone). Before, `toLayout(row(doc({ draft })))` leaked `draft`. A ref of a kind `panes` lacks throws: what it may carry can't be known.
- **Every public action checks its arguments** (`actions/args.ts`). Each public step declares one check per argument, and its argument types are read from the checks; the table also checks at compile time that every public step is checked and that `jali.actions`, `jali.page` and `jali.dialogs` take exactly what their steps take. JavaScript and the agent get the same `"invalid"`. Before, `page.setMode("invalid-mode")` answered ok and stored the mode. One binder (`bindSteps`) makes the store's `actions` and the instance's groups; `onPane`'s positional `refAt`/`orNull` are gone.
- **An action is all or nothing** (`state/apply.ts`). `apply` runs a transaction: state writes go through so each step reads the last, effects (address, announcement, toast, focus, deferred steps, layout events) wait, and a refusal puts back every earlier step. A question holds the whole action and runs it again when answered, so the frame, depth and write-count bookkeeping is gone. Parts that stand alone say so with `each(...)`: following several details (one with unsaved work stays) and a report's follow-up. Before, Keep on a peek closed the peek even when `beforeClose` kept the detail it would have replaced.
- **Pane reports have one owner** (`state/reports.ts`). The five maps (`activity`, `unsaved`, `paneCommands`, `titles`, `paneAttributes`) are made from the callers' reports and written nowhere else; the direct setters are one more caller. Lifetimes are the module's: a title and attributes go when the pane shows another object, the rest go with the pane. A pane nothing reports an activity for has no entry (idle), where the last reporter leaving used to leave `"idle"`.
- **The page engine owns page behaviour.** `openBeside` asks `opening` (peek, the view already showing it, the investigation's place, the snapshot, the tab fallback); `close` asks `hideRole`; leaving for a layout asks `leaving`; saving asks `prefsToSave`. `goToRole`, `investigation`, `placeAfterArrangement` and `settleRoles` are the page's own again. The link policy has one home, `UiState.linkMode` (now in `JaliState`); `PageState.linkMode` is gone. `Env` and the phone options moved from `profile.ts` to `env.ts`. **Not done, on purpose:** a single/split union for `PageState`. Single view keeps the Split layout "exactly, opened panes included, for coming back", so `before` is meaningful in both modes; the union would encode a rule the page doesn't have. The four `page!` assertions became guards instead.
- **Kind contracts.** A Standard Schema's output must still be params; a field that isn't is a problem of that param. `identity` returns `Identity | undefined` (any JSON value) and is written as JSON inside its guard, so a bigint, a cycle or a function falls back to the params, as a throw did.
- **Features:** the core's services are named and typed (`Feature.services.popOutWindow`, read with `serviceOf`); adapter parts stay opaque to the core and React reads its own through one map (`ReactParts`, `partsReader`).
- **Availability:** `checkSplit`, `checkZoom` and `checkFullScreen` take the pane, and the tab menu, header and ⌘K ask them. Split is now refused on a curated page by the action too, as the tab menu already decided (17 Nov).
- **Store:** a composition root over `state/lifetime.ts`, `state/events.ts` (batching and the re-entrant queue, unchanged), `dom/scope.ts` and `state/initial.ts`. 948 → 653 lines.
- **Smaller:** the `open`↔`peek` runtime import cycle is gone (`open.ts` no longer imports `peek.ts`); `shortcutLabel` and `tree.parentOf` removed; two stranded doc comments fixed.
- **Folders:** the review's folder sketch was an ownership sketch. Ownership moved to modules (`state/lifetime`, `events`, `reports`, `initial`, `dom/scope`, `env`, `actions/args`); files were not moved wholesale into `runtime/`, `kinds/`, `links/` and `page/`, which would be churn for every other session in the repo with no change of owner. `pane-kinds.ts` (832 lines) is the one file still worth splitting into `kinds/` later.
- **Size:** the layout tree alone is unchanged (10.3 KB; `STEPS` is made in a function marked pure, since `checked` steps can't otherwise be dropped). The new owners cost core about 0.8 KB gzipped where an instance is made: full 60.8 → 62.0 (budget 60.9), own-icons and `+defaults` 55.5 → 56.3 (budget 55.5). The owner raised those three core budgets by 1.2 KB (full 62.1, own-icons and `+defaults` 56.7).
- **Known flake, not from this pass:** `e2e/tab-overflow.spec.ts` "a narrow strip shows its active tab whole" fails about one run in six on master too.

## 23 Nov 2026 · Core review: actions, state and observers (branch fix/core-review-2026-11-22)

A second core review (at 7db3209a) reported eight reproduced failures where the action and state layer disagreed with itself. Each was re-checked at e429d583, after the architecture pass: `page.setMode("typo")` through the agent was already refused (the argument checks), raw writes after `destroy()` were already inert, and the `open`↔`peek` cycle was gone. The rest still reproduced, and each fix has a test that fails without it.

- **Host code inside a commit** (`state/apply.ts`, `state/store.ts`). A synchronous `beforeClose` runs in the middle of a commit that has read the state. An action the host makes then waits for that commit and runs after it, against the state then: it returns `"pending"`, and `settled` says how it went. A pane's reports (`setUnsaved`, `reportPane`, …) land at once, and after the guard's yes the commit reads the state again, so unsaved work the guard reported is asked about. A refused or held commit puts back only its own writes. Before, a guard that pinned A while B closed saw both succeed and A unpinned; a guard that said no lost its own change too. **Rejected:** re-running the whole intent after host code changed the state, as the review suggested. A compound action may have written before the guard (Keep on a peek closes the peek first), and the host's changes can't be separated from those writes to put them back; waiting keeps the commit's reading true instead.
- **One completed batch for observers** (`state/events.ts`). Toasts are told with their batch, after its other events (close, open, pin, focus, layout, toasts). Subscribers are isolated like listeners. A change made on a later yes, and an action host code made while the guard decided, carry the input of whoever asked.
- **One way into the free layout** (`intoFreeLayout`, `actions/layout.ts`). A preset, Reset layout, `setLayout`, an arrival and `page.leave` hand it their layout; it closes the page, keeps the page's mode and Split layout, and drops the page's undo steps. Before, a preset chosen on a page left `get().page` set and the address describing the page.
- **Agent arguments** that aren't a list are `"invalid"`, never read as none (`close` with `args: "b"` closed the focused pane). `allow("autoLayout")` is asked only when the bridge would arrange. A snapshot's params are a copy (refs aren't frozen: they may be the app's own objects).
- **Commands** return their action's result: `runCommand` is false for a refusal and after `destroy()`; Close others and its command ask one check (`checkCloseOthers`); the centre-drop toggle is `changeSettings` with its announcement. Each `start()`'s stop is its own and runs once.
- **Divider drag** owns the styles it previews until its commit lands; refused, cancelled or overtaken, it paints the committed geometry again.
- **Links:** the codec owns `MAX_LINK_TEXT`; a URL writer may report a layout's text length after its own filtering (`UrlWriter.linkText`), and a change whose free-layout text a link couldn't read back is `"blocked"`.
- **Not done, on purpose:** a cached public projection for `jali.get()`. The type already narrows it, layout and view are frozen in development, and a projection per commit would cost on the hottest read for little. The structural suggestions (one concrete change per operation instead of the `Outcome` tree, one owner for report follow-ups, splitting `pane-kinds.ts`) are left for a pass of their own: the all-or-nothing transaction relies on nested outcomes, so flattening them is a larger change than the review's table suggests.
- **Size:** core grows about 0.6 KB gzipped where an instance is made (minimal 55.5 → 56.1, full 62.0 → 62.6, own-icons and `+defaults` 56.3 → 56.9). The owner raised those five core budgets by 0.6–0.7 KB (minimal and `+url` 56.2, full 62.7, own-icons and `+defaults` 57.3).

## 23 Nov 2026 · React architecture pass: ownership (branch react-architecture)

A review of `packages/react` (at 7db3209a) found the adapter's structure sound and its ownership not: state that belonged to the instance lived in components, the adapter ran a transition the core should own, and several features answered the same question their own way. Each finding was checked again at 0dd79dee (the feature-parts typing had already moved to a typed map, 7003d2ac); every bug fixed has a test that fails without the fix.

- **One React lifetime per instance** (`InstanceScope`, `state/react.tsx`). The view, the dialog layer, the shelf and the page bar are keyed by instance, so `<JaliRoot jali>` given another instance mounts them again and no ref carries the old one's history (single view had restored instance A's tabs into B). The host's children stay mounted: the boundary is inside the root, around what Jali draws. `content.tsx`'s one-off swap repair went with it. **Rejected:** a key on the root, which would remount the app's own markup.
- **A rename session is its field's** (`pane/rename-session.ts`). `endRename(pane)` closes only that pane's field, and a field that left the screen ends nothing, focuses nothing and announces nothing; an ended field gives focus back only into the gap it left. Leaving a field saves it, so editing A then double-clicking B used to close B when A's save settled.
- **One pane at a time is the core's** (`settleOnePane`, `state/store.ts`). The adapter reports one measurement (`store.measure`); the store settles one pane at a time starting or ending as each batch ends, whatever changed it (a resize, a pane that can't fit), freezing the arrangement the batch started from and putting it back, in the same batch. The first measurement since a start is the baseline, and a hidden element (no width) changes nothing. The frozen arrangement is state (`UiState.wide`), so a refused action puts it back too. `useSingleView` and the adapter's `restoreWide`/`snapshotWide` are gone; the restore had no test and now has four, without React. Events got a `settle` hook for this, run inside the ending batch.
- **One selector** (`useSelected`): `useUi` and `useModelValue` are the public hooks' implementation with an optional `isEqual`. `useGeometry` returns `ModelGeometry`, the model without titles, which is exactly what it refreshes for; the fold and stack announcements read names when they speak. JSON as identity is gone: refs by `sameRef`, commands by what ⌘K shows, records and title lists by `shallow` (`useKept`).
- **Pane actions** (`pane/actions.ts`). Core splits Jali's items (`paneMenuOf`, typed ids) from the app's (`appMenuOf`); React adds Pop out once (`popOutItem`). The header reads Jali's items and runs its buttons' actions directly; it asks the app's `tabMenu` only when Jali's items don't already show ⋯. Before, every header built the whole menu, app code included, on every change.
- **Surfaces** (`dom/scope.ts`). The DOM scope knows every element that shows the instance (root, layer, and surfaces such as Pop out's window) and attaches features to each surface's window. `pressed()` marks controls in a popped-out pane, and focus there counts as being in the instance.
- **Dialogs.** One order (`topDialog`), read by the keyboard and the root. The palette key goes through its steps, so no dialog without its feature can be open, and the root's repair of one went. The chooser closes through a step. `closeThen` is the one way a choice runs after its dialog closed; it is dropped if the instance ended.
- **Content outlet** (`PaneOutlet`, `pane/content.tsx`): where content renders (moved in once, in the frame while hydrating, portalled into a floating window) is one module's; the frame asks for its pane's parts. The per-instance choice stays fixed at mount: switching after hydration would itself remount content.
- **Layout of the package.** `Workspace.tsx` is the composition (measurement, motion, drag layer, full screen and announcements in modules of their own); the curated page has `page/`; the header's controls slot and its give-way are apart; each stylesheet holds its own part's rules (no declaration changed); `common.ts` folded into `index.ts`; the internal READMEs point apps to `jali`.
- **Tests.** The fourteen tests that drive the engine with the example apps' kinds are `tests/examples/`, beside their fixture, which no longer sets data on import. **Not done:** rewriting them against small kinds of the package's own, and moving them to the core project; they define panes with React, so that is a rewrite, not a move.
- **Kept, as the review advised:** the framework-free core, `placement()`, `tabGroups()`, the a11y primitives, pane error boundaries, opt-in features, the render-count tests, and `parts.ts` as one catalogue. `useDerived` keeps skipping drag-only changes (a drag writes every frame); its contract is now written, and checked in development.
- **Size:** core grows about 0.2–0.3 KB gzipped where an instance is made (minimal and `+url` 56.5, full 62.9, own-icons and `+defaults` 57.3), and full's React 0.2 KB (30.5): the core now settles one pane at a time, knows the instance's surfaces and builds Jali's menu items apart from the app's. The owner raised those budgets (minimal and `+url` 56.6, full 63.0 core and 30.6 React, own-icons and `+defaults` 57.6).

## 23 Nov 2026 · The engine tests own their kinds

The React pass left the fourteen tests that ran the engine against Data Studio's and Loan review's kinds in `tests/examples/`. They now run on a fixture the package owns (`packages/core/tests/fixtures/workspace.ts`): plain kinds, no React, in the same shapes as the apps (kind names, size hints, params, preset ids, the page's views and the sample's application-to-borrower rule), so each test still reads like the app it stands for and none changed beyond its imports. The eleven that import no React are core's; the three that render or use hooks stay in React's project and build their store from the same fixture. No package test imports an example app, so an example can change without breaking them; the apps' own suites (and their e2e runs) test the apps. **Rejected:** keeping a unit-level suite against the real examples, which would only repeat what their e2e suites check, through code the package doesn't own.

## 23 Nov 2026 · Stabilisation step 1a: the cuts (23 Nov 2026)

First part of step 1 of docs/reviews/2026-11-23/PLAN.md, which the owner approved the same day: the mechanical cuts. Each is a commit on branch `stabilise`. The viewer role, `allow.open` and peek's leaving the address are step 1b.

- **The agent bridge (`jali/agent`).**
  - **What:** `createAgent`, `AGENT_ACTIONS` and their types, the `jali/agent` and `@jali/core/agent` entries, the reference page and its nav entry go. The guide is a recipe, "Let an agent arrange panes": two tools an app writes over `jali.model()` and `jali.actions`.
  - **Why:** the bridge was a second API over the first (a snapshot shape, a step runner, a schema for every action, WebMCP), kept in step by hand. A typed result, a refusal with its reason, `input` on events and `allow` already give an app what it needs, and an app knows its own model and its own tools better than Jali does. `input: "agent"` stays in the type for an adapter that marks its own actions.
- **The active-item port.**
  - **What:** `activeItemPort`, `useActiveItemPort`, `ActiveItemPort`, `ActiveItemAction`, `ActiveItemWriteResult` and `ActiveItemMapping` go, with `contracts/active-item.ts`.
  - **Why:** it was a shape kept for a library (Chakni) whose side was never built, and no app or example used it. `select(ref)` and `peek(ref)` do the work, as Markets' watchlist shows.
- **Peek "Open full".**
  - **What:** the button, the `peek.open_full` command, `openPeekFull` and its `openFull` op, its three messages and the `openFull` icon go.
  - **Why:** nothing needed it, and on a curated page it replaced every role with one pane while the page stayed active (finding A2-4). Open beside is the one way to keep a peeked object.
- **Live sync of pane state between tabs.**
  - **What:** `merge` on storage events, the revision bookkeeping and `StoragePort.subscribe` (with browserStorage's `storage` listener) go. Kept: pane state survives a reload; each write reads storage fresh and writes only this instance's changed records over it, so two tabs never erase each other's records; the last write wins per pane. A pane closed for good has its record deleted while the stored record still belongs to the same object.
  - **Why:** the merge needed a revision per record, which was finding A2-2's weak point (the timestamp doubled as identity), and no app needed a draft typed in one tab to appear in another. A reload still brings back what a tab saved.
  - **Known limit:** two tabs saving pane state in the same instant can overwrite each other's records. Each write reads storage, merges and writes synchronously within its tab, but no lock is taken across tabs, by choice: a lost draft needs two writes inside the same few microseconds, and a cross-tab lock (Web Locks, or a revision per record) would bring back the machinery this cut removed. A record's `at` only decides which 200 records are kept, and moves forward within an instance.
- **Names with no consumer benefit.**
  - **What:** `linkSearch` (with `JaliLink`, `PageLink`, `LayoutLink`, `LinkSearchOptions`) and `commandsOf` are deleted. `toLayout`, `browserLocation`, `browserStorage`, `DEFAULT_KEYMAP`, `formatKeys` and `GAP` leave `jali` but stay in `jali/adapter`, since the core and the docs machinery use them. `shallow`, `CuratedPage`, `useJaliIcons` and `useJaliCommands` leave `jali/react` and stay internal. `pressKeys` is deleted (`jali/testing`), and so are `defaultIcons` and the `jali/icons` entry (its types are exported by `jali/react`). `DefaultKeymapId` is written out, so a public type names no value the package doesn't export.
  - **Why:** each had no use that `jali.keymap`, `listCommands`, `select`/`peek` and the options don't cover. "Links are real links" (`<PaneLink>`) is the first feature after this round, so a half-way `linkSearch` would only be replaced.
- **Options.**
  - **What:** `createJali({ inset, onUnstable })` go. `--jali-inset` stays and is always `--jali-gap`; the development warning that an action which never moves anything moved panes stays, internal, through `console.error`. `onPaneError` stays.
  - **Why:** an inset apart from the gap was tried (Studio) and rejected, and `onUnstable` was a test hook that no app set.
- **Size:** unchanged budgets, none raised. Core now ships 0.3 to 1.2 KB less than its budgets in every scenario (full 62.4 of 63.0, minimal 56.0 of 56.6); step 8 ratchets them.
- **Tests:** the tests of the cut names go; the tests that used the bridge, `commandsOf` or `onUnstable` to reach an action or an observation now call it directly (`withInput`, `commandDefsOf`, a shared collector for the stability warning). The live-merge tests become three about reload, merge-on-write and last write wins.

## 23 Nov 2026 · Stabilisation step 1b: the viewer role becomes allow.open; peek leaves the address (23 Nov 2026)

Second part of step 1 of docs/reviews/2026-11-23/PLAN.md: the cuts that change behaviour. Each is a commit on branch `stabilise`.

- **`allow` gains one control, `open`.**
  - **What:** `"open"` joins `PaneControl` and `PANE_CONTROLS`. Off for a pane (the instance's `allow`, the kind's, or `when` asked with `action: "open"` and the source pane), following a link from it never opens a pane: `openBeside` shows the object in the peek sheet and returns what `peek` returns, in the free layout and on a curated page alike. What only adds panes is refused `"not-allowed"` where `open` is off for its source: `split`/`splitAuto`, `newTab`, `addTab`, the peek's Open beside, and placing an off-screen page view beside a pane (a drop or ⌥-click). `openHere` is not governed by it. The chrome leaves out what isn't allowed as for the other controls (the peek's Open beside, the tab strip's +, the menu's Split items), and ⌘K greys out Split, New tab here and Open beside with the reason ("Panes can't be opened from Orders here").
  - **Why:** "may look, may not rearrange" is the host's rule, and Jali already had one mechanism for the host's rules. With `move`, `resize`, `tuck` and `close`, a look-only viewer is one object: `allow: { open: false, move: false, resize: false, tuck: false, close: false }`.
  - **Rejected:** a `splitView` control. Split view on a page is anyone's; it is added only when a consumer needs it.
- **The viewer role leaves Jali.**
  - **What:** the `linkMode` option, `UiState.linkMode` and its place in `JaliState`, `LinkMode`, `jali.page.setLinkMode` and its step, the `permission` op, the profile's `viewers`, the `page.as_limited`/`page.as_full` commands, Settings' "Viewing as" fieldset, the page bar's disabled Split view, and their words (`permission`, `singleOnly`, `peekOnly`, `viewAsLimited`, `viewAsFull`, `viewerFull`, `viewerLimited`, `viewingAs`, `splitTipLimited`) go. `viewerLabel` leaves `jali/adapter`. The `"not-allowed"` reason now only means `allow`.
  - **Why:** Jali had two permission mechanisms, and its own UI let a person change the second. A permission the person can switch in Settings is a demo control, not a permission. Loan review keeps its two personas as its own switch: `?role=officer` (default reviewer), read once when the app makes its instance, the officer being `allow: { open: false }`; a link in the header goes to the other persona's address. Jali gets no API for it.
  - **Consequence:** a link with opened panes (`open=`) opens them for everyone: a link is content, and `open` governs following links from a pane, not arriving at an address.
- **Peek leaves the address.**
  - **What:** layout and page links no longer write or read `peek`; the `peek` op's history mode is `none`. An older link's `peek=` is ignored and removed at the next write (`UrlKeys.peek` stays, for removal only). A writer of the host's own gets `UrlState.view` without the peek, so `linkView` goes. The ref text encoder stays for a page's `open=`, renamed `encodeRef`/`decodeRef` in `jali/adapter`.
  - **Why:** a peek is a glance, not a place. In the address it made a reload or a shared link open a sheet over the reader's work, and every peek a history entry, which is how finding URL-1 lost the address from before the peek. Zoom and scroll stay in the address.
- **`"agent"` leaves `JaliInput`.** Nothing produces it since the agent bridge went; an app's agent acts in the app's code, as `code`. `withInput` stays internal (a held action ends with the input of whoever asked) and leaves `jali/adapter`.
- **Size:** unchanged budgets, none raised (full core 61.9 of 63.0 KB, `+page` 58.1 of 59.7).
- **Tests:** the viewer tests (`page-viewer`, `viewer-downgrade`, the officer browser test) become `allow.open` tests that follow each action to its next consequence (a peek instead of a pane, then its Open beside refused and the layout unchanged; Split view on a page, then a link that peeks; `when` per source pane; the chrome drawn without the buttons), and the peek's address tests become "a peek writes nothing, and a fresh instance on the same address shows none".

## 23 Nov 2026 · Stabilisation step 2: the commit model, one history decision, and history writes (23 Nov 2026)

Step 2 of docs/reviews/2026-11-23/PLAN.md, as the owner approved it, from Codex's design with the lead's notes. Each is
a commit on branch `stabilise`.

- **An action is a proposal until it commits.**
  - **What:** `apply()` works an action out on a private copy of the state, with its effects queued, and publishes
    both in one batch. A refusal or a question that holds it discards the proposal: `transaction`, `mark`, `restore`
    and `ApplyIO.restore` are gone, and so are the store's `hosting`, `waiting` and `wait()` and the REPORT_STEPS
    bypass. `beforeClose` runs while nothing of the action is written, so what the host does meanwhile (a report, pane
    state, an action of its own) commits at once with its real result. After a synchronous yes that changed the
    state, the action is worked out again from the state then, with what the host allowed; it asks again only for
    panes it hasn't allowed. A promise's yes runs the intent again, as before.
  - **Why:** putting back a whole state took back what others wrote meanwhile (finding A2-1), and made the host's own
    actions wait to be safe from it. A proposal has nothing to put back.
  - **Lifetime:** checked after every host callback (an outcome function, `beforeClose`, both branches of a held
    answer) and between effects. A destroyed instance commits, writes, announces and tells nothing; `destroy()`
    silences events (queued batches and toasts are dropped, even mid-listener) and the lifetime aborts before it
    cancels; every hold, including the discard question, settles as `"unavailable"` (finding A2-3). A held answer
    settles once and never rejects.
  - **Kept:** `Intent`, `AnswerStep`, `Agreed`, `covered()`, `each`'s independent parts, and the discard question as
    the one thing a held action leaves. A change computed outside a step is refused `"kept"` once its layout changed.
- **One history decision per action.** The store keeps the strongest mode a batch asks for (push > replace > debounce
  > none) and writes it once, from the final state, after one pane at a time settles and before subscribers hear it.
  > A discarded proposal asks for nothing, so a held or kept action writes nothing. An arrival's canonicalising replace
  > is a `history` override on its change, and a broken link's toast and announcement are part of its action (URL-2).
- **History writes.** While a gesture is in progress (gestures now nest: a pane drag that edge-scrolls is two), the
  store keeps the strongest mode and writes once when the last ends; edge scrolling is a gesture from its first move
  to its stop, a pane drag holds through its drop and a divider drag through its commit (SAFARI-3). `UrlWriter` is
  unchanged (no `pause`). `createUrlSync` writes a replace at most every 250 ms, the latest winning, its address
  captured when asked for; a push writes a waiting replace first; Back or Forward drops one; `href()` writes one
  first, so "Copy link" copies what is on screen. `browserLocation().navigate` catches a refused write and warns once
  in development.
- **Decided beyond the design:**
  - Back or Forward that the host or the person keeps still puts the address back to what is on screen (a replace,
    after the answer). The design dropped that repair; without it a reload after Keep editing opens what the person
    said no to, and the held-questions tests (C9) require it.
  - A restart after a synchronous yes happens only when the host changed the state; a held answer whose host also
    wrote the state reruns the whole action on its yes. More than 8 restarts in one action refuse it as `"kept"`.
  - A waiting replace is dropped on Back or Forward rather than written over the new entry, and written first by
    `href()`.
- **After review (Codex, seven findings):** a waiting write keeps this instance's share of the address as it was asked
  for (a debounced resize included) and is merged into the address as it is when written, so a push can't slip its
  state into the entry it leaves and a second instance's params stay; an answer step is replayed as an intent, so a
  second guard that writes doesn't turn both yeses into `"kept"`; `destroy()` silences events and refuses actions from
  its first line; a write waiting when a gesture starts is held (`UrlSync.hold`, adapter only) and becomes a replace of
  the final state; a URL writer that runs an action as it writes gets that action's write before the batch ends; a
  divider drag releases its gesture in a `finally`.
- **Size:** unchanged budgets, none raised.
- **Known limit:** the long-drag browser test runs in Data Studio, which has no row that scrolls, so it exercises the
  drop's single write rather than edge scrolling; the unit tests cover edge scrolling's ten-second hold.

## 23 Nov 2026 · Stabilisation step 3: undo reverses the operation (23 Nov 2026)

Step 3 of docs/reviews/2026-11-23/PLAN.md, as the owner approved it, from Codex's design with the lead's notes. Each is
a commit on branch `stabilise`.

- **An undo entry is the operation, not the layout before it.**
  - **What:** a close entry holds each closed pane as it was (content, flags, links) and its slot, level by level from
    its own container out: the container's id and type (a split's axis, or a tab group), its index, its size there,
    and its neighbours, nearest first. It also holds the panes linked to it and the sizes the close changed on nodes
    that stayed. Undo puts each pane back into the layout as it is now: into its container at its index (a tab within
    its pinned or unpinned section) if that container is still there; failing that, beside the nearest neighbour it
    had, recreating the container under its old id when that is free; failing that, at the end of the layout in
    reading order. A batch goes back in the order it closed, so one pane put back is the next one's neighbour. A link
    or size the close changed comes back only while it still has what the close left. Fits once, folding as a put
    back does; a single close focuses the pane, a batch leaves focus where it is.
  - **Why:** putting back a whole layout took back everything done since (finding UNDO), and brought back what the
    host had removed meanwhile (A2-5).
  - **Batches:** Close others, Close tabs and "Back to …" are one entry each, captured from the layout before any pane
    is removed, so an earlier removal can't shift a later pane's recorded place or size. Missing panes and the last
    pane make no entry.
  - **Dropped entries:** after every commit, a closed pane whose object is open again leaves the stack (identity
    kinds; a scratch pane is its own instance), and so does one the host removed: `remove` names a closed pane by its
    id or object and takes it out of the stack, alone of its batch, or is `"not-found"`. An entry left with no pane goes.
  - **Pane state:** kept while a pane or a closed pane in the stack shows its object under its id
    (`ownedPaneState(s, kinds, layout, closed)`), and pruned when an entry is dropped too, not only when the layout
    changes. A closed pane whose id a new pane took comes back under a new id, its state held for it there.
  - **Commit model:** an entry is built inside the proposal and published with the commit, so a held, refused or
    destroyed close publishes none, and a held one recomputes it on its yes.
  - **Kept:** a tuck is still undone by putting the pane back; undo still covers closes and tucks only.
- **"Back to …" closes the investigation.** It closes the panes without a role as one close, with `keepSizes`: no view
  takes an opened pane's room, so a resize, a pin or a move made during the investigation stays, and undo reopens
  only those panes. `PageState.before` and every assignment of it are gone; a new item and a mode change still clear
  the stack.
- **Decided beyond the design:**
  - A link opened on a curated page (`yields: false`) no longer evens out the views beside it: the new pane takes the
    mean of their sizes. Without it, the first link reset the page's designed widths (1.15 and 0.85), and closing it
    could not give them back, so "Back to Loan review restores every rect" (e2e/review.spec.ts) failed once the
    snapshot went. "Nothing the person placed gives way to an opened pane" now covers sizes too.
  - "Back to …" keeps the views' sizes rather than giving the space to each pane's opener, as `close` does; otherwise
    a role the person had just resized would take an opened pane's room.
  - `remove` of an open pane doesn't search the stack: a closed pane of its object was already dropped when the object
    opened again.
  - `layout.close` and `layout.closeOthers` return `undo` only when a pane closed.
- **Size:** core grows by about 1.4 KB gzipped (bare 53.5 → 54.9 KB, minimal 56.5 → 57.9 KB), over every core budget.
  Not raised: the owner's approval is asked for with these numbers.

## 23 Nov 2026 · Stabilisation, React stream: focus in Safari, header controls, boundaries (23 Nov 2026)

React-side items of docs/reviews/2026-11-23/PLAN.md (SAFARI-1, SAFARI-2, A1-4, A1-5), on branch `stabilise-react`.

- **Focus never leaves an open dialog.**
  - **What:** `ModalDialog` (which Settings, the discard question, ⌘K and the chooser all use) watches focus leaving while Tab is being pressed (`focusout` from the dialog, `focusin` outside it, within the key's own task) and sends it back in: the first tab stop after Tab, the last after Shift+Tab. Jali still doesn't drive Tab: the browser moves it, and the guard acts only when it would leave. The wrap at the first and last stop stays for browsers whose Tab reaches every button.
  - **Why:** Safari's Tab skips buttons by default, so the last stop Jali wraps from is one Tab never reaches, and Tab left the dialog. A blur with no Tab behind it (a click on nothing) is left alone.
  - **Tests:** a unit test (focus taken out by Tab comes back, a plain blur doesn't); the two axe tests check in WebKit that Tab, Shift+Tab, Option+Tab and Option+Shift+Tab never leave, and that Option+Tab reaches every button of the dialog. Chrome keeps its checks.
- **Focus returns to what was pressed.**
  - **What:** a menu's opener is taken from the event: the ⋯ button, or the pane for a right-click and Shift+F10 (tab menus and the overflow menu already were). For a dialog, `dom/input.ts` also keeps the element the last pointer press landed on, per document, until a key is pressed there (`lastPressedControl`, in `jali/adapter`); a dialog's opener is that control when there is one, else what has focus.
  - **Why:** Safari doesn't focus a clicked button, so `document.activeElement` is the page or whatever had focus before. The pressed control wins over `activeElement` and not only when focus is on the body: in Safari a click can leave focus on the text field before it. In a browser that focuses the button, the two are the same.
  - **Consequence:** Shift+F10 on a header control now returns focus to the pane, not to that control.
- **Header controls belong to whoever registered them.**
  - **What:** each `useHeaderActions` call registers in the pane's slot under its own owner (`useId`). The slot shows the controls of the latest owner to register that has some, and an unmounting call releases only its own. A call that passes `null` or `false` shows nothing and doesn't hide an earlier call's controls.
  - **Why:** the last unmount used to clear the one slot, so a component that left took a sibling's controls with it, even when the sibling didn't render again (A1-4).
- **Boundaries reset with the instance.**
  - **What:** `Guard`, the one boundary around the host's code in Jali's chrome (the root's children, the dialog layer, Settings' extra fieldsets, icons, a page's rail and header), clears its failure when the instance it is in is replaced, without remounting the host's healthy children. Each dialog sits in a Guard of its own (keyed by dialog): one that throws closes through its close step (`keepEditing`, `closeChooser`, `dialogs.closePalette`, `dialogs.closeSettings`) and reports to `onError`, so it no longer stays open in state, drawing nothing over the dialogs after it. Panes are unchanged.
  - **Why:** the boundaries sat outside the instance's scope, so `<JaliRoot jali={b}>` kept showing a's failure until Retry (A1-5).

## 23 Nov 2026 · Stabilisation step 4: a step owns its check; one link encoder (23 Nov 2026)

Step 4 of docs/reviews/2026-11-23/PLAN.md, with the menus item (A1-3) brought forward from step 5 and the step 1b
review's two page findings, on branch `stabilise`.

- **A step owns its check.**
  - **What:** a step is `{ control?, check?, run }` (actions/step.ts). `control` names the `allow` controls it uses and
    on which panes (both panes of a swap, every pane beside a divider, every pane auto layout moves, every opened pane
    "Back to …" closes); `check` is everything else it needs first. The store asks `allow` for each control, then the
    check, then runs it, every time, a held action again when its question is answered. `can(store, name, ...args)`
    (jali/adapter) runs the same gate without running the step or asking a close guard. Commands name a step and its
    arguments (`args` supply the pane and the way, never a rule); ⌘K, keys, the tab menu, header buttons, page tabs,
    drop targets and the divider layer ask `can`. The checkX helpers, the commands' own checks, `also()`,
    `needFocus`/`needLauncher`/`needOthers`/`inStrip`, `dividerAllowed`, `canRename` and `checkPeekBeside` are gone into
    the steps. A curated page's engine steps are descriptors too, delegated field by field (`pageStep`).
  - **Why:** each rule was written once for the action and again for each surface that offered it, and they drifted.
  - **Controls before the check:** a control the app turned off is the answer before any other reason, so "hide it
    where the app says no" is one comparison (`reason === "not-allowed"`). A control on a pane that isn't there asks
    nothing; the check says it isn't there.
  - **Checks that need steps of their own:** Pop out (`popOut`: the window is the adapter's, the step says whether it may
    open), the merge chooser (`openMergeChooser`), the shelf (`revealShelf`), the centre-drop setting
    (`toggleCentreDrop`) and a drag's start (`startDrag`: the pane allows `move`; what the drop does is `drop`'s).
  - **Refused, where an offer greys out:** an action that would change nothing because there is nothing to act on is
    refused `"nothing-to-do"` where a command offers it, so the command greys out: `closePeek` with no peek,
    `page.setMode` to the mode in use, `page.open` with the page open and nothing asked, `page.leave` with no page,
    `toggleZoom` with one pane (it was `ok`, doing nothing). `moveOutOfRow` for a pane in no row is `"unavailable"`.
    A tab at its group's end refuses Move left/right in the check, with the reason, so ⌘K and the menu grey it out.
  - **Kept:** `openBeside` still routes a link to the peek where `open` is off (a routing step, not a refusal).
    `runCommand` now says a refusal's reason, as a key does.
- **Menus run intents.** Every Jali menu item is worked out when chosen: Move left/right is `moveTabToward(side, id)`
  from where the tab is now, Pin and Unpin set the value the menu showed, Close, Split, Maximise and the rest name the
  pane. A stale intent is refused by its step, typed. An app's `tabMenu` item's `run` gets `{ id, ref }` as the pane is
  when chosen, and isn't called once the pane has closed (`chooseMenuItem`). The menu decides only hiding (refused
  `"not-allowed"` or `"unavailable"`, or per item) versus greying out with the step's reason.
- **The step 1b review's page findings.** Placing a view (a drag, ⌥-click) is checked against the page as it is,
  before `setMode("split")` would put the view on screen: from Single view every view comes in beside the one shown,
  so `open` is asked of that pane; from Split view, of the pane it goes beside, when the view is off screen. Choosing
  Split view itself stays anyone's. `besidePreview` returns nothing where `showViewBeside` is refused, the drop targets
  ask `placeTab` (or `drop`, for a pane), and the page tabs' tips mention ⌥-click only where it would work
  (`tabTipOff`/`tabTipSingle` take `altClick` as optional).
- **One set of link limits, one encoder.**
  - **What:** layout/codec/limits.ts holds `MAX_NODES` (256), `MAX_DEPTH` (128), `MAX_LINK_TEXT` (1,000,000) and
    `OPEN_MAX` (32), with `linkUsage` and `pastLimits`. The codec stops unpacking past them (its own 2048 guard goes),
    validation, the reader, urlSync's writer and the action budget use them. The budget replaces `pastLinks`: it
    measures the whole state a change proposes (its page and preset included), refuses a change past a limit as
    `"blocked"` (a curated page's 33rd opened pane, by every route), and lets what is already past one stay or shrink.
    Text is measured as urlSync writes it (`UrlSync.measure`: the instance's own params as `buildSearch` encodes them,
    the host's left out) and the reader measures an incoming address the same way; only an instance that writes an
    address has a text limit.
  - **An app's own layout** is validated without the link limits (`validate(..., { limits: false })`): one larger than
    a link opens at start-up, its address left unwritten, with one development warning; `setLayout` refuses it as
    `"blocked"`, never as malformed. urlSync never writes an address past a limit.
  - **`UrlWriter.linkText` goes:** a router writer of the host's own writes its own text, which no limit of Jali's can
    measure; the shape is otherwise unchanged.
  - **The reader:** an address whose own params are past `MAX_LINK_TEXT` is read as unreadable (a layout link opens
    the fallback, a page link opens without its panes). A hand-made page link naming more than 32 panes still opens
    the first 32.
- **The fuzz invariant.** Every address the fuzz writes is reopened by a fresh instance with the same kinds, storage
  and room, which writes it back unchanged (the link's state: the layout read back, without the folds and shown tabs
  the reader's fit works out again; zoom, scroll, preset). Seeds alternate "link" and "local" sizes and a prefix. The
  known reload gap after tucks and folds combine stays named for what those seeds show (1347 joins it: it failed at
  2,000 seeds before this step too); their addresses are checked like every other.
- **Size:** the gate costs core about 0.6 KB gzipped where an instance is made (bare 55.1 → 55.7 KB, minimal 58.1 →
  58.9, full 64.0 → 64.9, headless 49.7 → 50.2, `+page` 59.9 → 60.6; the layout tree alone unchanged at 10.7). Deleting
  the commands' checks saved 1.2 KB minified in the registry, but the descriptors, `can` and the limits cost more. Not
  raised: over every core budget, as after step 3.

- **Review fixes (Codex, after the step):**
  - urlSync writes only an address its reader reads back whole with the instance's kinds (`UrlSync.readWith`): a
    start-up layout with a param its kind can't read opens, its address left unwritten, as an oversized one is.
  - A page link brings back each scratch pane it opened: the reader keeps repeats of a scratch kind (the registry
    carries `scratch`), still each other object once.
  - A view change the address holds (maximise, scroll) meets the link budget too, and is refused `"blocked"` past it.
  - Placing a view by itself (⌥-click on the view in Single view, a drop on itself) is `"nothing-to-do"`, before any
    mode switch.
  - The last view on screen is refused in hideRole's check (so in Close's): menus and headers no longer offer it.
  - The page bar's "Back to …" takes `can(store, "page.back")`, greyed out with the reason, as ⌘K.
  - A pane named but not there is `"not-found"` before any control: the control no longer falls back to the focused
    pane.

## 23 Nov 2026 · Stabilisation step 3, after Codex's review: what an undone close keeps

Six problems Codex reproduced in step 3's undo, each fixed with its test on branch `stabilise-undo`.

- **A batch's references follow its new ids.** Every restored pane's id is chosen before any is placed (its own
  unless taken), and neighbours, links and tucks go through that map, so a pane never joins the object that took a
  batch member's id.
- **Links return only to the same objects.** An entry records what the pane's source and each follower showed; a link
  comes back only to a pane in the batch or one still showing that object.
- **A container made again keeps its panes' own sizes and a row its `scroll`.** A pane placed at an outer level takes
  its branch's size until its own container is remade around it, then has its own size again.
- **Tucks come back.** The tucks a close ended (of a closed pane, or into one) are recorded and added back while both
  panes are there and the pane can be tucked.
- **A curated page's undo keeps its placement rule.** Undo runs the page's settleRoles for the panes it put back: views
  go back to the page tabs rather than fold. Not done: the page's tab fallback for a restored opened pane that itself
  has no room (it folds, as before).
- **Size:** about 0.5 KB more gzipped in core; still over the budgets, none raised.

## 23 Nov 2026 · Stabilisation step 8: the peers in the size harness (23 Nov 2026)

`pnpm size` now builds the same kind of minimal app with each of four peers and prints their gzipped JS and CSS beside
Jali's minimal and full. The next round sets a hard size target from these numbers (docs/reviews/2026-11-23/PLAN.md).

- **Peers are reported, never gated.** They have no budget and cannot fail `pnpm size`; only Jali's scenarios do.
- **Each is the smallest real layout the library supports** (tooling/size/peers/): two panes side by side, resizable,
  the library's own stylesheet if it ships one. Where it has tabs the left pane holds two (Dockview, FlexLayout,
  react-mosaic's tab container). Production build, React in a chunk of its own, the library and what it pulls in (its
  own dependencies such as react-dnd) counted as its JS, the app's few lines not.
- **Versions are pinned exactly** in tooling/package.json, each at least two weeks old on 23 Nov 2026: `dockview-react`
  8.9.0 (Dockview's React binding; `dockview` 8 itself is framework-free), `flexlayout-react` 0.11.1,
  `react-mosaic-component` 7.2.1, `react-resizable-panels` 4.21.0 (4.22+ is newer than two weeks).
- **The numbers** (gzipped KB, this commit; Jali's JS is core + react, React itself is 65.8 KB in every row and left
  out):

  | Library                | Version | JS   | CSS  | Total |
  | ---------------------- | ------- | ---- | ---- | ----- |
  | Jali minimal           |         | 82.7 | 8.3  | 91.0  |
  | Jali full              |         | 96.5 | 8.3  | 104.8 |
  | Dockview               | 8.9.0   | 89.5 | 10.2 | 99.6  |
  | FlexLayout             | 0.11.1  | 47.0 | 3.7  | 50.6  |
  | react-mosaic           | 7.2.1   | 37.4 | 2.9  | 40.3  |
  | react-resizable-panels | 4.21.0  | 14.6 | 0.0  | 14.6  |

- **Reading them.** The peers do less than Jali (no history, address, keyboard, curated page, or feature set), and
  react-resizable-panels is only a split. Jali's own budgets are unchanged and its core is still about 1.9 KB over
  them (known, after the correctness steps); that is for the next round's target, not this step.

## 23 Nov 2026 · Stabilisation step 5: safe ids, a rename's object, copies at the door (23 Nov 2026)

Core half of step 5 (docs/reviews/2026-11-23/PLAN.md, findings A1-1, A1-2 and INGRESS). Header controls, menus and
boundaries landed earlier.

- **`__proto__`, `constructor` and `prototype` are never ids.** One check in layout validation's id test covers every
  id a layout holds (nodes, `linkedTo`, the overlay's folds, shown, hidden and tucks), so `setLayout` is `invalid`, a
  saved layout or preset gives way to the next fallback and a link is unreadable (the instance opens its fallback).
  `pane()` throws in development, and a generated id for a kind with such a name gets a suffix. Reads stay on `own()`;
  the hostile-input tests now put such an id into the state past every check to keep proving that.
- **A rename belongs to its object.** The state is `{ pane, object }` (the object key the session began on). The one
  place that normalises a state (`reduce`) clears it when that pane shows another object or is gone, so open here, a
  following detail, Back, Undo, a link and `setLayout` all end it with no case of their own. The field closes, the text
  is dropped, and focus returns to the pane. Save keeps the ref the session began on and calls `rename.run` with it; a
  save pending at the change completes for that object and only the field goes away.
- **Copies at the door.** `run()` copies its arguments once, before the step is checked, so a held action keeps what
  it was called with; `setLayout` and `createJali` (layout, presets, their saved layouts) copy too (state/ingress.ts:
  plain objects and arrays only, shared and cyclic parts stay so, a `__proto__` key is data). An argument nested past
  1000 levels is refused `invalid`. Because every ref is now Jali's own, development freezes refs and the peek too (the
  freeze skipped them because they might be the app's).
- **Not done:** an app's `rename.run`, `tabMenu`, `beforeClose` and event handlers still receive refs that are frozen
  in development (they are Jali's state), as layouts already were.
- **Size:** Jali full is 106.3 KB gzipped (JS 98.0), 1.5 KB more than before this step (104.8); core is 65.7 against a
  budget of 63. Still over, none raised; the budgets are re-set in step 8.

## 23 Nov 2026 · Stabilisation step 7a: a designed read API (23 Nov 2026)

Step 7, first half (docs/reviews/2026-11-23/PLAN.md, "The API (step 7)"; the design in the step's review notes, with
the lead's split): the read API, a stable `listCommands`, every consumer moved. The consumers gate and the coverage
adoptions are 7b.

- **`jali.get()` is `JaliState`, Jali's own interface.**
  - **What:** layout, page, view `{ focused, zoomed, peek }`, presetId, selection, settings, unsaved, activity,
    resizeMode. Projected from the store's state (state/instance.ts) and kept while none of these changed; each field
    is the store's own object, and `view` is kept while its three values are the same.
  - **Why:** it was the engine's state behind a `Pick`, so its internals (`area`, `dir`, `recent`, `peekSource`, the
    dialogs' flags, `view.scroll` and `focusHistory`) were API, and a selector over it heard every engine write.
  - **Out:** `peekSource`, `area`, `dir`, `recent`, `paletteOpen`, `settingsOpen`: no example or real Data Studio reads
    them. `view.peek` stays (the shared status line's hint).
- **`jali.model()` is `JaliModel { panes, pane(id), paneOf(ref) }`.**
  - **Each pane:** id, ref, title, where, focused, box, selected (a list pane's selection, reported with or without a
    kind's `selects`), linkedTo, follows, kept, pinned. Links and flags stay because the examples and real Data Studio
    read them; sizes, age, role and priority stay the engine's.
  - **`where`:** taken off screen by the layout (`overlay.hidden`) is `"hidden"`; on screen and in its viewport is
    `"shown"`; then tucked, folded or an inactive tab; then, one pane at a time, `"tab"` (the switcher's other
    entries); anything else (behind a maximised pane, scrolled out of its row's window) is `"hidden"`. One pane at a
    time uses core's `frames`, the calculation the adapter draws with, so a phone, stacked view and a fold agree with
    the screen.
  - **`box`:** where it is while shown, in CSS pixels from the panes' area's top left (the store's area: no inset or
    switcher), the whole area for a maximised pane; `null` while it isn't shown, so "has a box" and "is shown" are one
    rule.
  - **References:** worked out again on each read and compared: a pane keeps its object while every field is the same
    (refs by `sameRef`, boxes by value), the model while every pane does. A fast path returns the last model when the
    engine's model, focus, the selection and the area are the same objects and no title changed: titles are read every
    time, since a kind's title can read the app's own data.
  - **`paneOf(ref)`:** the first pane `kinds.sameObject` matches, so a kind's `shows` counts and a scratch ref matches
    nothing; real Data Studio keeps its own document-id lookup, which survives a change of kind.
  - **Frozen** in production too: the projections are a handful of small objects per change.
- **`jali.presets` is `{ id, label }[]`; `jali.env` goes.** Chrome metadata comes from the app's config: the shared
  shell's `start(jali, { name, itemNoun })`.
- **Behind jali/adapter:** `Env`, `Preset`, `Group`, `TuckedEntry`, `PaneKinds`, `Spacing`, the geometry types,
  `StackPair`, `Hinge` and the `layout` namespace (its reference page goes; the docs' layout diagrams read the
  engine's model through `storeOf`). `TuckRecord` becomes public, because `Overlay.tucks` names it and it was reachable
  only through the layout namespace.
  - **`createJali({ panes })` still takes a kind registry,** an adapter's (`createPaneKinds`). Narrowing it to an array
    changed how `D` is inferred where tests spread `Partial<JaliOptions>`, so the arm stays and tooling/public-types.mjs
    lists `PaneKinds`, `PaneKind` and `KindRegistry` as named on purpose but not exported, with that reason.
- **`listCommands` is the same array until something it lists changes.** Worked out on every call and compared entry
  by entry (key, id, title, group, keys, disabled, reason, run), never kept by the state's identity: an `allow` rule
  can read the app's own data. An instance command's `run` is one function per id. Hosts and the palette read it with
  `useSyncExternalStore(jali.subscribe, () => listCommands(jali))`; `useJaliCommands` goes.
- **Consumers moved:** the examples' three hand-rolled helpers are `paneOf(ref)` and `where === "shown"`; every top bar
  reads `jali.presets`; real Data Studio reads `where` and subscribes to `listCommands` (its workbench re-renders when
  the commands change, not on every state change).
- **Tests whose expectations changed:** `follows`, `kept` and `pinned` are booleans (three React tests expect
  `false`); the public API lists `presets` for `env` and the adapter's `layout` namespace; Trips' week checks `where`
  and `box` instead of the scroller's content boxes, Markets' second chart its tab group in the layout. Jali's own tests
  that read the engine's model read `storeOf(jali)`.
- **Size:** core grows about 0.8 KB gzipped where an instance is made (bare 56.5 → 57.3, minimal 59.7 → 60.4, full
  65.7 → 66.6, `+page` 61.5 → 62.2) and 1.6 KB headless (51.0 → 52.6: it now ships `frames`, which React scenarios
  already had); the React chunk is unchanged. Not raised: over every core budget, as since step 3.

## 23 Nov 2026 · Stabilisation step 7b: every public name has a consumer (23 Nov 2026)

Step 7, second half (docs/reviews/2026-11-23/PLAN.md, "The API (step 7)"): a gate that fails on any public name no
example uses, and a real use for each name it found.

- **The gate, `tooling/consumers.mjs`, in `pnpm verify` (--quick too).**
  - **What it checks:** every runtime value an app entry of `jali` exports (from packages/jali/package.json's exports,
    followed through re-exports and aliases to their declarations), every `createJali` option (`JaliOptions`) and every
    pane-kind option (`PaneOptionsReact`, inherited ones included), and every exported type.
  - **A use is real:** a value called, rendered, read or passed, never an import, a re-export, a comment or a type
    position; an option given a value in an object literal typed as the options, or a literal's own property that
    reaches where the options are expected (through constants, spreads and helper returns, so `testJaliOptions()`'s
    `size` counts); a value typed as the options themselves (a `Partial<JaliOptions>` passed along) gives nothing. A
    type is named by an example (a type position counts) or reachable from a public value's signature.
  - **How:** TypeScript's own checker (`typescript/unstable/sync` of TypeScript 7, over the root tsconfig), so names are
    matched by what they resolve to. About 6 s.
  - **Consumers:** examples/* and their unit tests. Not the docs (a sample shows a name), not the packages' tests (a
    test checks one). Real Data Studio, when its checkout is present, is read as text and printed beside each missing
    name as a witness; it never makes one pass. No allowlist, no baseline.
  - **`jali/adapter` is left out,** as tooling/public-types.mjs leaves it out: it is for adapter authors and may change
    in any minor version. The design proposed checking its adapter-only values against packages/react/src and pruning
    the rest; that is about 140 names that the React adapter doesn't use but core's and React's tests and the docs'
    diagrams import, so it is a proposal for later, not part of this step.
- **Its first run found 26 names:** `beforeClose`, `confirmDiscard`, `tabMenu`, `onPaneError`, `messages`, `id`,
  `label`, `pageTheme`, `dir`, `gap`, `url`; the kinds' `identity`, `buttons`, `Loading`; `palette`, `settings`,
  `chooser`, `pressed`, `rename`, `tabs`, `en`, `memoryLocation`, `memoryStorage`, `Activity`, `usePaneAttributes`,
  `useHeaderActions`. Each got a use in the example it belongs to; none was cut.
  - **Own-icons** takes each feature from its own entry and renames notes; two notes share a tab strip; a note's header
    keeps Maximise and Close; its text loads with the kind's `Loading`. Its size scenario allows rename's files.
  - **Markets asks about an unsent order itself** (`beforeClose`, `confirmDiscard: false`): its own dialog names the
    order, and holds the page's unload. The design put this in Data Studio's query pane, but Jali's own browser tests
    check Jali's discard question through that pane.
  - **Data Studio:** a table's tab menu (its structure, a query of it); Jali's discard question in its words; a toast
    naming a pane that fails; a query that changes data marked on its header, tab and chip; Chart this result in the
    query's header; a reload test in memory.
  - **Related lists** give an identity without their label (both related kinds, so they still match across kinds): a
    link to "Loans by this member" goes to Loan review's open "Loan history".
  - **The shared status line** shows Jali's `<Activity>` beside a busy tucked pane, not the raw activity id. The design
    put `Activity` in Markets, whose panes report no activity.
  - **Minimal** has a test of its notes embedded twice in a host page: `id`, `label`, `pageTheme`, `dir`, `gap`, `url`.
- **`Messages` takes any text from a message that picks its words by a value.** Data Studio's override of
  `confirmDiscard.body` didn't compile: the type copied English's two sentences as the only strings it could return.
  A function that returns text now returns any text.

## 23 Nov 2026 · Stabilisation step 5, after Codex's review: the doors that were left open (23 Nov 2026)

- **A page's role ids are pane ids**, so `definePageEngine` refuses `__proto__`, `constructor` and `prototype` as a role.
- **What a page binds is copied** (`bind(item)`'s refs, often cached by the app) before it is installed.
- **A rename's field is keyed by its object.** `openHere` then `startRename` in one batch is a new session; the old one
  never saves with its old ref.
- **`dialogs.choose` is the one entry that isn't copied:** its items are the app's own objects, read by identity
  (`label`, `current`, `onChoose`).
- **The development freeze freezes a node before walking its parts**, so a ref that refers to itself can't overflow it;
  selections and Recent are frozen as they are committed.

## 23 Nov 2026 · Stabilisation step 7a, after Codex's review: the model says what is drawn

Four problems Codex found in step 7a, each fixed with its test on branch `stabilise-fix7a`.

- **`where` and `box` come from the placement the adapter draws.** The projection worked out visibility on its own: a
  maximised pane in a row that scrolls read "hidden" once the row had scrolled it away, and stacked view ignored the
  on-screen keyboard, the divider the person moved, a curated page (which never stacks) and a pane on the whole
  screen. `placement` moves from the React adapter into core (jali/adapter) and both read it. The keyboard and the
  divider's share become the store's (`keyboardUp`, `stackShare`, which the adapter sets), so the model can read them
  and keys its cache on them, the page and the full-screen pane. A maximised pane is placed before its row's window
  is asked; a pane on the whole screen is shown with the root's whole box and every other pane is hidden.
  - **`box` is in the root's coordinates** (inside the inset, under the phone's switcher), as the frames are, where it
    was in the panes' area's: what an app overlays on Jali's root lines up with it.
  - **Size:** `placement` moves from the React chunk to core, which grows by about what React loses.
- **A host menu passes its read as the server's snapshot too.** `useSyncExternalStore(jali.subscribe, () =>
  listCommands(jali))` throws "Missing getServerSnapshot" in a server render; every place that shows the pattern now
  writes `useSyncExternalStore(jali.subscribe, read, read)`, and a sample test renders the guide's menu on the server.
- **No page names a read the instance doesn't have.** `useTitle`'s reference still said `jali.model().title(id)`; it
  says `jali.model().pane(id)?.title`, and the reference coverage test checks every `.model().x` and `.get().x` a docs
  page writes against what the instance has.

## 23 Nov 2026 · Stabilisation step 8: the size pass and new budgets (23 Nov 2026)

The round ends with a size pass, then the budgets in `tooling/size.mjs` are re-set to what ships, about 5% over, as
the owner decided in the plan (docs/reviews/2026-11-23/PLAN.md, "Size (step 8)"). Every scenario's core had been over
its budget since step 3; a budget everything is over guards nothing.

- **The round, start to end** (gzipped KB, `pnpm size`; the start is `350b4845` for minimal, and for full the last
  numbers recorded before the round, in "React architecture pass"):

  | Scenario | core        | react       | css       |
  | -------- | ----------- | ----------- | --------- |
  | minimal  | 56.5 → 60.7 | 24.0 → 24.1 | 8.3 → 8.3 |
  | full     | 62.9 → 67.1 | 30.5 → 30.3 | 8.3 → 8.3 |

- **Where the growth went**, in the minimal app's minified bytes per source file, round start to before this pass
  (+11.7 KB of core, 61.0 KB gzipped):
  - **Undo reverses the operation** (step 3): +5.3 KB. `layout/ops/restore.ts` puts closed panes back into the layout
    as it is now (+3.1), `layout/ops/close.ts` records each pane's slot, links and sizes (+1.4), `state/undo.ts` and
    `actions/close.ts` the rest.
  - **The designed read API** (step 7a): +3.4 KB, of which 0.8 is `placement` moved from the React chunk so the model
    says what is drawn; `state/model.ts` +1.9, `state/instance.ts` +0.8.
  - **The commit model and its checks** (steps 2 and 4): +3.0 KB across `apply.ts`, `actions/step.ts`, the step table
    and the steps that now own their checks.
  - **Links and history** (steps 2 and 4): +1.4 KB, one link encoder and one set of limits (`url.ts`,
    `layout/codec/limits.ts`).
  - **Safari focus** (React stream): +1.1 KB, `dom/input.ts`'s last pressed control and the dialogs that return to it.
  - **Copies at the door** (step 5): +0.8 KB, `state/ingress.ts` and the id checks.
  - **The cuts** (step 1) saved 3.1 KB: the registry's commands bridge (−1.6), pane state (−0.4), `allow`'s viewer
    role (−0.3), boot, peek and the rest.
- **This pass** took back what came without a behaviour, every test unchanged: minimal core 61.04 → 60.69 KB, full
  67.40 → 67.07 (−0.35 and −0.33).
  - Three development-only messages (the unsafe pane id, the refused history write, the layout a link can't reopen)
    asked `isDev()`, a call no bundler folds, so they shipped; they now test the literal `NODE_ENV` as dev.ts says
    (−0.19).
  - Undo's restore shares the tree's helpers (tab placement within the pinned section, copying a node's size, adding
    a tuck) instead of its own copies (−0.07).
  - The model compares a pane by its fields rather than a list of them, and reuses `currentPane`; `mapped` and
    `onTarget` always pass a check and control on (−0.07).
  - The address writer drops its waiting replace in one place, the sizes' tree copies share one walk, `fitsLink` is
    `pastLimits` from an empty layout, and the input listeners are one table (−0.02 gzipped, 0.2 KB minified).
  - **Left as they are:** the rest of the growth is behaviour (where a closed pane goes back, what the model says, what
    a step refuses). The candidates that remained (folding the policy table, the public state's field list, the fold's
    two axes) saved tens of bytes each for code that reads worse, or changed the shape of an exported type.
- **The new budgets** (gzipped KB, about 5% over what ships, rounded to 0.1): bare 60.4 core / 25.3 react; minimal and
  `+url` 63.7 / 25.3; full 70.4 / 31.9, Phosphor 1.7; own-icons 64.9 / 29; headless 55.6; layout 11.4; `+palette`
  60.9 / 26.3; `+settings` 60.9 / 26.2; `+chooser` 60.6 / 26.6; `+rename` 60.5 / 25.8; `+popOut` 60.6 / 26.5;
  `+pressed` 60.4 / 25.9; `+defaults` 64.8 / 28.4; `+page` 65.8 / 26.4; CSS 8.7 everywhere it is checked. React
  budgets rise too (minimal 24.7 → 25.3): they had little headroom, and the rule is the same for every column.
- **The peers, for comparison** (gzipped KB, as recorded in "the peers in the size harness"; Jali's rows now, with
  that entry's in brackets; React itself, 65.8 KB, left out of every row):

  | Library                | Version | JS          | CSS  | Total         |
  | ---------------------- | ------- | ----------- | ---- | ------------- |
  | Jali minimal           |         | 84.8 (82.7) | 8.3  | 93.1 (91.0)   |
  | Jali full              |         | 99.0 (96.5) | 8.3  | 107.4 (104.8) |
  | Dockview               | 8.9.0   | 89.5        | 10.2 | 99.6          |
  | FlexLayout             | 0.11.1  | 47.0        | 3.7  | 50.6          |
  | react-mosaic           | 7.2.1   | 37.4        | 2.9  | 40.3          |
  | react-resizable-panels | 4.21.0  | 14.6        | 0.0  | 14.6          |

- **Next:** the next round sets a hard size target from these numbers, with these budgets as its ceiling.

## 23 Nov 2026 · Stabilisation: the final review's findings

The round's final review, by Codex and by Opus, read `stabilise` at 65043990. Each finding was reproduced by a test that
follows the action to its next consequence (packages/core/tests/final-review.test.ts unless named), then fixed.

- **One close planner on a curated page** (Codex, P1 ×2). Close other tabs closed views for good (a view merged into
  another's tabs was gone, and `page.showView` then reported success focusing nothing); and hiding a view counted
  opened panes as on screen, so every view could be closed. Every close on a page (`close`, Close other tabs, Back)
  now goes through the page engine's `closing`: views are hidden through the page's rules, never closed; other panes
  close in one change with one undo entry; one view always stays on screen; Single view takes none out. Views are
  hidden before the rest close, and Undo passes over a neighbour hidden since (found while fixing this), so a pane is
  never put back beside a hidden view. A tab click never succeeds
  without doing something: a view the layout doesn't hold is `not-found`, no slot is `blocked`. The engine's
  `hideRole` step goes (it was only `close`'s); allow-open's test page now holds every view in its design.
- **A focus queued for the next frame ends with its instance** (Codex, P1): `focusPane` takes the lifetime's signal
  and checks it in the frame, so a replacement with the same id keeps the host's focus.
- **A page link keeps its zoom** (Codex, P1): the reader passes it on and the page keeps it once its layout is built,
  for a pane that layout shows (`zoomable`, shared with the layout link's check). The fuzz invariant still covers
  layout links only: covering pages needs a page in its kinds and steps, more than a fix round should add.
- **New tab here in Single view is refused** (Codex, P1), by the check `addTab` shares.
- **Undo reserves every node's id** (Codex, P2): a restored pane never takes a container's id.
- **A Discard answer keeps the asker's input** (Codex, P2): the question stores it, and the answer's commit is
  published under it, as a host's held yes was already.
- **Fuzz runs as six tests of fifty seeds** (Opus, P1): the same seeds and checks, each test inside its own limit.
- **A tab removes only the pane-state records it wrote** (Opus, P1), still as it wrote them (`at` and contents: `at`
  alone is no revision). Records adopted from storage or written over by another tab stay.
- **Menus set what they showed** (Opus, P2): Maximise and Full screen change nothing once that is true already.
- **A close the host's `beforeClose` made itself is done** (Opus, P2): a retry that finds nothing left to do, with
  every pane the host let go already gone, returns ok instead of `not-found`.
- **Reads by pane id never reach `Object.prototype`** (Opus, P2): stacked view's pair, the reports, undo's sizes.
- **Header controls are chosen as a title is** (Opus, P2): each `useHeaderActions` call is named by render order, so
  of calls mounted together the innermost shows; after that the latest mounted. The reference says so.
- **Code quality** (Opus, P2): an unknown step name is refused `invalid`; undo puts a tuck back through put back's
  gate; restore's side effects are plain statements; the store's stale comments are fixed.
- **Confirming pass** (Codex, at 23595a98): eight cases the fixes above missed, each a test of the rule, not only the
  case (final-review.test.ts, C1–C8). All eight were real.
  - Pane state: each record names its writer (`by`, a token per instance); an instance removes only a record still
    carrying its token and its `at`. Identical drafts written in one millisecond no longer pass for each other.
  - Undo: one reservation set for every id it gives, so a container made again never takes a restored pane's id. The
    fuzz starts one layout with containers named `pane-N`.
  - Page close: the rule is checked on what the close leaves (a view in front); a view behind an opened pane's tab
    no longer counts.
  - Page link zoom: an opened pane is named by its place among the link's opened panes (`zoom=~2`), followed through
    what the reader leaves out; a view keeps its id.
  - The host's own close: only a close, only when every pane the host let go is gone, and the evidence travels with a
    promised yes. `openHere` whose pane the host closed stays refused.
  - Menus: `setZoom` and `setFullScreen` (adapter forms of the toggles, no public name) set the menu's pane. Under it,
    `toggleZoom` on B while A was maximised restored everything (focus carried the zoom to B, then the toggle took it
    off); it now maximises B.
  - Every question asked again during an answer takes the answer's input (`askedBy`), through any number of them.
  - Second pass (Codex, at 6bdacf84; D1–D4), each rule held in one place:
    - A view in front is the close planner's rule for every close, checked on what it leaves with its final tabs and
      focus; a view behind a tab is brought forward, else the close is refused. Tested over 150 random page sequences.
    - The browser's full screen follows a switch from B to A (React: asked whenever the pane differs from Jali's own
      full-screen element).
    - Page link zoom: a view id starting with `~` is escaped (`~~1`), and an opened pane's place travels to the page in
      its own field (`zoomOpened`), so every value reads back to its pane.
    - A resuming close is judged by its postcondition wherever it resumes (`resumed`), replacing the evidence carried
      through answers.
  - Last pass (Codex, at 2493a1b2): Jali touches the browser's full screen only while it is its own (none, or one of
    its panes, read from the document then); a request refused during a switch exits, so browser and Jali agree.
- **Size** (gzipped KB, before → after the round's fixes and both confirming passes): minimal core 60.7 → 61.3, full
  67.1 → 67.8 and React 30.3 → 30.4, `+page` 62.6 → 63.3, headless 53.0 → 53.5. Every scenario stays inside the
  budgets set at the end of the round.

## 23 Nov 2026 · Stabilisation: the last browser run

Every Chrome suite and the React 18 check, run at f82e28fd after the final review's fixes, then every WebKit suite
(the first WebKit run this round: the screen had been locked until then), found three things. None came from those
fixes.

- **The same state writes the same address; only a write takes the replace slot** (20c70207). Trips' reload test
  lost the place just clicked, every time on a quiet machine (it had passed under load, slowly enough to clear the
  slot). `pageParams` deleted the layout param and set it again, so with `zoom` or `scroll` in the address the same
  state alternated between two orders, and every action made a history write. And a replace that wrote nothing still
  took the 250 ms slot, so a click's second action waited for it. Chrome takes a reload's address before `pagehide`
  or `beforeunload`, so a flush on the way out can't save a write still waiting: it has to be written in time. The
  instance's params now go and come back after the host's in one order, and only a write takes the slot. The flush on
  the way out stays, for a closed tab and a phone switching apps.
- **The React 18 check is Jali's packages** (e156e238). It typechecked the whole repository on React 18, so
  own-icons' `use` (React 19, from step 7b's consumer for `Loading`) failed it. Jali's packages run on React 18.2 and
  up; the examples are apps on this repository's React 19, and the docs already teach `use` for a pane that loads.
- **WebKit: the console guard passes over WebKit's word on loads a navigation cancelled** (d3c9ec7d). Every WebKit
  suite passed but Trips, whose tests failed on the console guard alone (each test's body passed, the map included).
  Every message came between a navigation's request and the next page's DOMContentLoaded: the page being left, still
  loading MapLibre's worker, its style and lazy modules. Chrome drops those loads silently; WebKit writes each as an
  error. `cancelledByLeaving` (examples/shared/e2e/quality.ts) passes over exactly those messages, and only while the
  page is being left. The plan's "Trips' map worker doesn't load in WebKit" was this: ad01afd1's change to how the
  worker is imported was a guess made while WebKit couldn't run, and is reverted (02fab7af).
- **WebKit results** at d3c9ec7d: root 144 (5 skipped), Data Studio 20, Loan review 28, Markets 32, Studio 49, Trips
  50, docs site 41. The Safari focus fixes (step 6) and the long-drag history writes are confirmed there.

## 23 Nov 2026 · Tests: four at a time

- **Every Playwright suite runs four tests at once** (`WORKERS` in e2e/fixtures/browsers.ts; it was `workers: 1`
  everywhere, with no recorded reason). Spec files run side by side; a file's own tests still run in order
  (`fullyParallel` stays off). Checked before the change: the root suite three times in Chrome and twice in WebKit
  (735 runs, no failure, no flake), and each example suite twice in both browsers (804 runs). One pass of the root
  suite in both browsers went from about 16 minutes (estimated from the one-at-a-time per-test time) to 6.5. Two
  failures in those runs, neither from running in parallel as far as a rerun can tell: Trips' map fonts from
  tiles.openfreemap.org failed to load once in WebKit (the network), and Data Studio's "an edited draft of the
  preset's query waits for Run" threw "The provided value is non-finite" once in WebKit after its reload, which 31
  reruns of that test (15 one at a time, 16 four at a time) didn't repeat. That one is an open intermittent bug.
- **`pnpm verify` runs the gates without a browser side by side**, four at once (`--jobs=N`). `size` waits for `unit`
  (unit's bundle test builds from packages/jali/dist when it is there, and size rebuilds it) and `pack` for `size`
  (`pnpm pack` rebuilds jali's dist too). The browser suites still run one suite at a time, after the rest, so the
  tests that read rendered positions get the machine to themselves.
- The docs site's suite stays at one worker: its tour tests sleep 2.5–4 s to see that nothing moves, which a busier
  machine could make flaky, and it wasn't part of the check. Those sleeps are the next thing to take out (Playwright's
  `page.clock`).
