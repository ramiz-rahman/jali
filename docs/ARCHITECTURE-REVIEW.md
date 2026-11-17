# Pane lab: architecture review

> 17 Nov 2026. A read-only review by three Opus reviewers (layout-core, ui, panes + data + e2e), combined by the coordinator. **The UI and UX are approved and must not change.** This review is only about structure, so behaviour, visuals, copy, keys and URLs stay as they are.
>
> **Baseline:** commit after `bfcbc0f`. 275 unit tests and 75 browser checks pass. About 10,000 lines.

## Verdict
**It works, but it is not yet a package seed.**

There are three overlapping ways of saying "this pane is not on screen":
- **fold records:** `Layout.fold`;
- **leftover automatic stacks:** `origin:"auto"` with `unfold()`;
- **a tree mutation for tuck:** `tuckedFrom`, which has 12 fields, plus `origin:"tuck"`.

**The core keeps hidden per-instance memory:** a cached fit per layout, plus `births` and `defaults`. The UI then has to hot-swap the core through a Proxy, and that silently drops the memory (a real bug).

**On top of that sits a 758-line store that does about twelve jobs:**
- it re-implements the core's tree helpers;
- it chooses a refit by hand for each action;
- it does its own tree surgery;
- it holds every announcement string;
- it reaches into the DOM.

**Pane-kind knowledge is spread over four places**, and panes reach into UI internals. **The tests have no fixture layer.**

**The judo:**
- make tuck a second overlay beside folds;
- make the core pure;
- have every action return one typed change that one `apply()` commits;
- derive one workspace model;
- keep one command registry;
- define each pane kind once.

Most of the conditionals then disappear instead of being moved around.

---

## Part 1: layout-core

### L1. Tuck becomes an overlay, like folds *(biggest win)*
- **Problem:**
  - DECISIONS (17 Nov, item 1) chose fold records over materialised stacks, because the tree can't undo a mutation without remembering where the pane came from. Tuck then mutated the tree anyway.
  - `TuckOrigin` has 12 fields (types.ts:41-63). Undoing the mutation needs:
    - `slotIn`/`handOn` (tuck.ts:258-281);
    - size restating plus `verify` (142-175);
    - `leaveStack` (189-201);
    - `besideNode` (283, a copy of ops.ts:21 `beside`);
    - `untuckAll` (301).
  - There is an import cycle between `resolve.ts:3` and `tuck.ts:12`, and from `codec.ts` to `tuck.ts`.
- **Shape:**
  - `Layout.overlay?: { tucks: { pane: NodeId; home: NodeId; seq: number }[]; folds: …; shown: Record<NodeId, NodeId> }`. The tree stays canonical.
  - `replay()` (resolve.ts:232) applies tucks first, then folds, using the existing `foldSlot` with an explicit home. The home slot absorbs the pane's weight plus the gap, as foldSlot's `sameParent` branch does (resolve.ts:219-223).
  - Put back drops the tuck record, so the round trip is exact by construction. Judging an unfold "as if untucked" means replaying without tucks.
  - The shelf `reason` comes from whichever overlay hid the pane.
- **Deleted:**
  - `TuckOrigin`, `origin:"tuck"` and `PaneNode.tuckedFrom`;
  - the staleness filter in `undoClose`;
  - `packTuck`/`unpackTuck` (codec.ts:12-38) and the validate block (validate.ts:27-38);
  - `slotIn`, `handOn`, `leaveStack`, `besideNode`, `untuckAll` and `sizeSum`;
  - the import cycle.

  `forget()` (ops.ts:10) already ends a tuck when a deliberate move happens.
- **Must hold:** every tuck and stress test still passes. Only the home's group changes, to 1e-6, and put back in either order restores the original order. URLs carry the overlay, and old tucked URLs may be dropped (it's a spike).

### L2. A pure core with an explicit context
- **Problem:**
  - `index.ts:13-16` caches the last `FitOptions` for each layout.
  - `close` (ops.ts:98, 127), `resetDivider` (230), `setActiveTab` (259) and `putBack` (249) behave differently depending on whether an earlier call happened to `remember`.
  - `births` and `defaults` live in a closure (ops.ts:54-55).
  - `ui/core.ts:8-20` swaps the instance through a Proxy when the cap changes. That drops births, reset baselines and the fit cache. **This is a bug.**
- **Shape:**
  - Every op takes `ctx: { fit: FitOptions; paneCap: number }`.
  - The reset baseline lives on the model: `NodeBase.base?: Size`, set by `resetLayout`.
  - Pane age is `PaneNode.born?: number` (or reading order).
  - The core is a plain namespace export.
- **Deleted:** the `createLayoutCore` factory, the `remember`/`lastFit` plumbing, `ui/core.ts`, and the `setPaneCap` side effect in store.ts:131-135.

### L3. Ops own their refit
- **Problem:**
  - `"load"` is the same as `"full"` (resolve.ts:296).
  - The store invents `"none"` (store.ts:347) because `open` already refits (ops.ts:80), while `close`, `drop`, `swap` and `moveDirection` rely on the store's `commit`.
  - `openHere` refits twice (store.ts:513).
  - `setState` refits silently on `!committing` (143-147).
  - `refitNow` swallows errors (116-124).
  - `RefitOptions` mixes the public mode with private knobs (resolve.ts:271-285).
- **Shape:**
  - Every structural op returns an already-fitted layout: `open`, `close`, `drop`, `swap` and `move` fit fully, and `putBack` folds only.
  - The public `refit(layout, view, ctx)` is only for external events: a resize, a cap change, or a URL arriving.
- **Deleted:** `"load"`, `"none"`, `committing`, `fitted`, the try/catch swallow, and the `refit:` option at about 15 call sites.

### L4. The core is the only owner of tree operations
- **Problem:**
  - Duplicated helpers:
    - store.ts:177-271 re-implements model.ts: `allPanes`, `findNode`, `nodeIds`, `uniqueId`, `mapTree` and `stackOf`;
    - `unzoomed` (436) duplicates `unzoom` (ops.ts:7).
  - Tree surgery in the store:
    - `newTab` builds StackNodes by hand (545-558);
    - `openHere` rewrites `ref` itself (517);
    - `reveal` parses `@auto:` ids (379-385).
  - **The deep-equal workaround:** `same()` deep-equal (338) exists only because core ops clone even when nothing changes (ops.ts:90, 133, 149, 173, 188).
- **Shape:**
  - Export `tree` (`panes`, `find`, `parentOf`, `stackOf`, `map`, `newId`, `shape`).
  - Add new ops: `addTab`, `setRef` and `reveal`.
  - **The rule:** an op returns the input object when nothing changed, and the store compares with `!==`.
- **Deleted:** about 120 store lines, `same`, and the `@auto:` parsing outside resolve (ops.ts:257, tuck.ts:67).

### Other layout-core findings
| Sev | Smell | Where | Fix |
|---|---|---|---|
| High | Dead code (removed feature) | legacy `origin:"auto"` + `axis` + `unfold()`: model.ts:30-38, ops.ts:8, types.ts:74-76, resolve.ts:87-90, resolve.test.ts:88 | Delete |
| High | Dead code (rail era) | `collapsed` migration: tuck.ts:313-326, codec.ts:66-67, validate.ts:25-26, tuck.test.ts:207 | Delete |
| High | Dead code | `fits` and `minimum` (resolve.ts:344-351) | Delete |
| Med | Duplicated code | extent along an axis computed 5 ways: ops.ts:103-108, 198, 204-209; tuck.ts:106-110; ui/geometry.ts:8 | `extentAlong(boxes, ids, axis)` |
| Med | Duplicated code | beside/addTab/sizeSum/NO_FOCUS: ops.ts:21 vs tuck.ts:283; ops.ts:37 vs tuck.ts:114; model.ts:25 vs tuck.ts:184; resolve.ts:139 vs tuck.ts:14 | One copy each in `tree/` |
| Med | Duplicated geometry | `ui/geometry.ts:15 minAlong` vs resolve.ts:69-96, with different fallbacks | Export `minSize(node, kinds, gap, axis)` from core |
| Med | Repeated work | ops.ts:189/195 resolve twice; canTuck/chooseHome twice (tuck.ts:124/129, store.ts:402-410) | Single pass |
| Med | Duplicated validation | codec unpack and validate both check shape | unpack only reshapes; validate is the one schema |
| Med | Primitive obsession | `@auto:` id prefix (resolve.ts:106, ops.ts:257, tuck.ts:67) | `ResolvedStack.kind` plus `core.reveal` |
| Med | Mysterious name | `hiddenInStack` is also set by zoom (resolve.ts:407) | `hidden?: "tab" \| "zoom"` |
| Med | Redundant projections | `folded[]`, `stacks.foldedCount` and shelf `reason:"folded"` record one fact three times; `ResolvedStack.origin:"auto"` is a constant | Derive from one source |
| Med | UI concern in core | `ShelfEntry.activity` (types.ts:156), `heavy` (121), the undo label used as a discriminator (221; store.ts:610) | Move to UI; `UndoEntry.kind: "close"\|"closeOthers"\|"tuck"` |
| Med | Long functions | `refit` (resolve.ts:292-343), `tuck` (tuck.ts:123-183), ops.ts:185-227 | Split into steps |
| Low | Misc | `linkOf` rebuilt (resolve.ts:151/197); `snapToCentre` in focus.ts:46; stale docs (types.ts:190, resolve.ts:51/144); middle man (ops.ts:242-252); chain fixture copied three times; collapse.test named after a removed feature | Fix each |

**Proposed structure:**
```
layout-core/
  index.ts                 public pure API + types
  types.ts
  tree/      tree.ts insert.ts size.ts
  geometry/  shares.ts bounds.ts extent.ts snap.ts
  fit/       overlay.ts priority.ts refit.ts resolve.ts
  ops/       open.ts close.ts move.ts divider.ts tuck.ts tabs.ts focus.ts
  codec/     codec.ts validate.ts
  test/      fixtures.ts + one *.test.ts per module
```

---

## Part 2: src/ui

### U1. A typed `Change` and one `apply()` replace `commit()` and its option matrix
- **Problem:**
  - `commit(layout, view, {history, refit, announce, announceView, extra})` is called about 20 times, each with a different mix of options.
  - Five actions bypass it and redo the URL and announce steps by hand: `afterFocusMove`, `toggleZoom`, `peek`, `select` and `restoreWide`.
  - There are 14 scattered early-return `hooks.announce` refusals.
  - The undo push `[...closedStack, r.undo].slice(-20)` is copied three times.
  - Command `enabled()` re-implements the action guards (commands.ts:43 against store.ts:614; commands.ts:48 against 580).
- **Shape:**
  - Actions are pure: `(s, …args) => Change | Refusal | null`, where `Change = { op, layout?, view, msg?, undo?, focusDom?, patch? }`.
  - A `POLICY: Record<Op, { history; announceWhen }>` table drives `apply()`, which does diff → setState → url → announce → toast → focus.
  - `check(s) → Refusal | undefined` is shared by `Command.enabled` and the action itself.
- **Deleted:** `CommitOptions`, `announceView`, `committing`, the five hand-written write and announce paths, the copied undo slices, and the duplicate guards.

### U2. One derived `WorkspaceModel`
- **Problem:**
  - "What is visible, and what is in this group" is computed in 19 places, including:
    - Workspace `collect`/`stackInfo`/`currentId`;
    - the store's `shownWith`, `mergeTargets`, `visiblePaneIds`, `focusIndex` and `snapshotWide`;
    - `useShelf` and StatusLine's private tucked list;
    - dnd, `nearestDivider` and `pairGeometry`.
  - Components subscribe by incantation: they call `useUi(s => s.layout)` and then read globals (StatusLine `void layout`, DividerLayer, Shelf, Chooser, Palette, tuck.ts).
  - `visiblePaneIds` (zoom-aware) and `focusCycle` (flat) disagree on order.
- **Shape:** `selectModel(state) → { boxes, visible, flat, groups: Map<id, Group{id, kind, tabs, active}>, groupOf(id), tucked, shelf, single }`, memoised on (layout, zoomed, area, kinds version, cap). Components read it with a `useModel()` hook.
- **Deleted:** every copy listed above, plus `resolvedFlat`.

### U3. One command registry that owns its keybindings
- **Problem:**
  - Keys live in three places: display strings in `COMMANDS.keys`, a separate matcher (keyboard.ts:88-120), and hard-coded glyphs in tooltips (HeaderActions, PaneFrame:212, Shelf:147, StatusLine:24).
  - Half the matcher calls actions directly and skips `enabled`.
  - `WORD`/`DIRS`/`dirWord` exist three times.
- **Shape:**
  - `Command { id, title, group, keys?: Chord[], check?, run }`.
  - The keyboard layer is `matchChord(e)` plus three modal handlers: resize mode, the Escape chain and F6 into the shelf.
  - `shortcutLabel(id)` serves tooltips and the palette.
- **Deleted:** keyboard.ts:88-120, every hard-coded glyph string, and the duplicate direction tables.

### U4. Explicit boot and effect sinks instead of singletons
- **Problem:**
  - **The `hooks` object** is mutated by Announcer, App and url.ts, and announcements made before mount are dropped.
  - **Hidden boot flags:**
    - `fitted` makes the first `setState` refit;
    - `lastKv`/`useMemoKinds` causes a side effect during render;
    - `bootFromUrl` runs inside `useMemo` behind `booted`/`initialBroken`.
  - **Over-broad cache invalidation:** any settings patch bumps `kindsVersion` (store.ts:132 is always true), so a theme change wipes the resolve cache.
  - **A magic string:** App toasts on the string `"Other panes"`.
- **Shape:**
  - `main.tsx`: `registerAllPaneKinds(); const store = createUiStore({ url, kinds }); store.boot(); render`.
  - The store emits typed events (`announce`, `toast{undo}`, `url{mode}`).
  - Announcements become state (`{text, seq}`).
  - The cache keys on the kind registry's own version.
- **Deleted:** `hooks`, `bumpKinds`, `lastKv`, `fitted`, `committing`, `booted`, `initialBroken`, and the Proxy (L2).

### U5. A pane host and presentation policy instead of sentinels and duplicated branches
- **Problem:**
  - PaneBody checks `id === "peek"` four times, and Peek fabricates `id: "peek"`.
  - `single` is threaded through PaneFrame, HeaderActions, Peek and the CSS.
  - Workspace has two near-identical render branches, with a fake `as PaneBox` and the leftover `{view.zoomed ? null : null}`.
  - Single view needs three refs and store exports (`snapshotWide`/`restoreWide`/`layoutShape`) that write the URL.
- **Shape:**
  - `PaneHost = { openBeside, peek, select, openHere?, dismiss?, setActivity? }`, passed to PaneBody. Peek supplies its own host.
  - `presentation: "tiled" | "single"` gives `Chrome = { draggable, zoomable, tuckable, island }`.
  - `frames(model, mode)` feeds one render loop.
  - `single-view.ts` (pure) plus `useSingleView()`.
- **Deleted:** one Workspace branch, every `single ? … : …`, and the sentinel checks.

### Other ui findings
| Sev | Smell | Where | Fix |
|---|---|---|---|
| High | Divergent change | store.ts: container, selectors, tree utils, wording, DOM focus, URL, undo, single view, settings, theme, ~30 actions | Split (structure below) |
| High | Shotgun surgery (DOM focus) | `focusLater` (store.ts:388-396), Workspace.tsx:83-96, the `activeElement` read (store.ts:638-641), keyboard.ts:56-69, commands.ts:116 | `dom/focus.ts`: `focusPane`, `focusShelf`, `activeTabId` |
| High | Primitive obsession | announcement English across logic (store.ts 481, 496, 529, 586, 656…; Workspace:60/77; keyboard:38/68) | `messages.ts`, typed by event |
| Med | Dead code | `dropLabel` (Workspace:172, test-only, duplicates dnd.ts:95), Workspace:164, `minAlong` (geometry.ts:15), `allPaneKinds` (pane-kinds.ts:88), `paneCap` (core.ts:16), `lastA` (DividerLayer 47/99/147), `nearestDivider().sign` | Delete; repoint the test to `dropOutcome` |
| Med | Dead remnants | the `react-resizable-panels` dependency (package.json:21), store.ts:78, "rail/collapsed" docs (pane-kinds.ts:18/40/54/69), DividerLayer.tsx:3 "Enter collapse/restore" | Remove and rewrite |
| Med | Speculative generality | Ark adapter (dividers/ark.tsx, `pair`/`gap` types, the drag.ts:94 style sniff, Settings 53-60, TopBar 62, commands 82-92, `.ghost-*` CSS); DECISIONS already chose "own" | Delete Ark; own divider only |
| Med | Middle man | pane/tuck.ts (`ShelfItem = ShelfEntry`, wrappers), the DividerLayer re-export of drag, the `__lab` hook in tuck.ts | Delete; move `__lab` to `dev.ts` |
| Med | Type lie | PaneFrame.tsx:105 and PaneSwitcher.tsx:13 cast `tuckedFrom?: string` | Gone with L1 |
| Med | Vocabulary drift | Shelf `norm()` handles `blocked/done/failed`, and `.activity-done` exists, but `PaneActivity` has neither; two dot components | One `PaneActivity`, one `<Activity>` |
| Med | Duplicated code | Palette.tsx and Chooser.tsx are the same combobox dialog | `<ListDialog items onChoose renderItem>` |
| Med | Inappropriate dependency | logic imports `nearestDivider`/`STEP`/`ADAPTERS`/`KindIcon` from component modules | `dividers/resize.ts`, `pane/icons.tsx` |
| Med | Magic constants | `GAP`, `SWITCHER_H`, 48/28/12 in TS and CSS | `tokens.ts` sets CSS variables at boot |
| Med | Mysterious name | `closedStack`/`undoClose` also hold tucks | `undoStack`/`undo` |
| Low | Duplicated code | zone half-rect (Workspace:179 vs dnd-label:13); preset buttons rendered twice (TopBar:33/54) | `zoneRect`; `<PresetButtons>` |
| Low | Wrong copy | HeaderActions "Only open pane" shown for every refusal | Use the refusal message |

**CSS:**
- **affordances.css is an override layer, not a module.** It re-declares rules from styles.css (`.tab-close`, `.palette-item`, `.drop-indicator`, divider hover and focus with a `.divider.divider` specificity hack, `.pane-actions .icon-btn`, `.status-stats`). It is also imported from PaneFrame although it styles the palette, the status line and the shelf.
- **The dark theme is written four times** (`@media` and `[data-theme]`, plus panes.css private tokens and SVG hex values). Fix: `applyTheme` always sets the resolved `data-theme`, so only one dark block remains, and panes.css uses the shared variables.
- **Dead CSS:** `.placeholder*`, `.status-sep`, `.status-warn`, `.activity-done` and `.drag-chip span`.

**Proposed structure:**
```
ui/
  App.tsx  boot.ts  url.ts  presets.ts
  state/      store.ts (createUiStore) model.ts apply.ts messages.ts settings.ts undo.ts
  actions/    focus open close tuck move tabs resize peek layout   (pure → Change | Refusal)
  commands/   registry.ts keyboard.ts format.ts
  dom/        focus.ts ids.ts
  workspace/  Workspace.tsx frames.ts single-view.ts useSingleView.ts dnd.ts DropIndicator.tsx
  pane/       PaneFrame PaneBody TabStrip HeaderActions icons.tsx kinds.ts
  dividers/   DividerLayer Divider drag.ts resize.ts geometry.ts
  chrome/     TopBar StatusLine Shelf PaneSwitcher Peek Announcer
  dialogs/    ListDialog Palette Chooser Settings
  styles/     tokens.css base.css pane.css dividers.css shelf.css dialogs.css chrome.css
```

---

## Part 3: panes, data and e2e

### P1. One module per pane kind
- **Problem:** pane-kind knowledge sits in four places.
  - **The registry table:** index.ts:21-30 passes the same `titleFor` to all ten kinds.
  - **The title switch:** format.ts:133-148.
  - **The ref factories:** format.ts:90-94, where `structureRef` is unused because StructurePane:29/35 builds the literal by hand; presets.ts:11-12 and walkthrough:15-16 re-declare `tbl`/`rec`.
  - **Special cases in store.ts:** `SCRATCH` (217), `launcher`/`chart && !runId` (229-230, 265, 512) and the `autorun` exception in `sameRef` (211).
- **Shape:** `definePaneKind({ kind, ref(params), title, icon, minWidth, minHeight, heavy, identity?, transient?, recordable?, Component })`. The store asks the definition instead of checking kind names.
- **Deleted:** `titleFor`, the ref factories in `format.ts`, `SCRATCH`, the kind checks in the store, and the duplicate builders.

### P2. Data hooks own their context, and panes get one gate
- **Problem:**
  - **The context sits in the wrong layer:** `DataLayerContext` lives in ui/pane-kinds.ts:127-138.
  - **Pass-throughs and dead code:**
    - panes/data.ts:14-18/32 are pass-through wrappers;
    - its row copy at 19-31 is dead (DECISIONS line 48);
    - `props.ts` is only an alias.
  - **The copied ladder:** the loading, error and "gone" ladder is copied in Audit, Er, Structure, Record, Table and Chart.
  - **Lost types:** `Q<T>` loses types, which forces a cast in useWindow.ts:14.
- **Shape:**
  - `src/data/react.tsx` holds `DataLayerProvider` and `useDataLayer`.
  - Hooks take no layer argument.
  - `useTableInfo(table, paused)` is added.
  - `<PaneGate queries gone>{() => …}</PaneGate>` lives in `panes/shared/`.
- **Deleted:** `panes/data.ts`, `props.ts`, about 30 lines of ladders, and the context in ui.

### P3. One canonical table: Grid plus `useWindow(source)`
- **Problem:**
  - **Windowing three ways:**
    - QueryPane:55-58 re-implements windowing, so it flickers;
    - ChartPane:13 hard-codes `0, 200` to hit the same cache entry.
  - **Index plumbing:** callers look up `w.rows[i - w.offset]` six times.
  - **AuditPane is a near-copy of TableGrid:** it ignores `select`, so peek doesn't follow J/K, and it has dead `void rowId`.
  - **Bug:** AuditPane:21 casts a singular `entity_type` (`'order'`) to `TableName`, which throws "Unknown table".
  - **Bug:** AuditPane:25 looks up the link by `entity_id` only, ignoring `entity_type`.
- **Shape:**
  - `useWindow(source: { key, fetch(offset, limit) })` with one `PAGE` constant.
  - Grid takes `rowRef(row)` and `link(value, row)`, and owns open, peek, select, label and copy-id.
  - `TableGrid` gains `columns?`, `orderBy?` and `rowRef?`, so AuditPane becomes about 10 lines.
  - `entityTable(type)` lives in the data layer.

### P4. Split the data layer, and let the key factory own the whole key
- **Problem:**
  - **The key shape leaks:** `hooks.ts:23` appends `offset, limit` to `keys.result()`, which forces a special case in `invalidateEntities` (index.ts:99).
  - **One file does five jobs:** `index.ts` mixes them with 1,500-character lines (90, 99).
  - **Inlined domain special cases:** index.ts:86 and :90.
  - **Duplicated names:**
    - `names` (index.ts:7) duplicates the `TableName` union;
    - two `singular()` functions disagree: format.ts:149 turns "addresses" into "addresse".
  - **Untyped options:** `Keys.rows(…, opts: object)`.
- **Shape:**
  - `TABLES as const` with `TableName` derived from it, and a typed `RowsQuery`.
  - `keys.resultPage(runId, offset, limit)`.
  - Separate modules: `catalog.ts`, `entities.ts`, `sql.ts`, `result-store.ts`, `labels.ts` and `react.tsx`.

### Other panes and data findings
| Sev | Smell | Where | Fix |
|---|---|---|---|
| High | Feature envy / layering leak | LauncherPane.tsx:4-5, 38-39, 133 imports `useUi`, `openPaneFor` and `KindIcon`; `useUi(layout)` only forces re-renders | Move the launcher into ui as workspace chrome with injected sources, or give the pane contract `recent` and `isOpen(ref)` |
| Med | Divergent change | format.ts mixes cells, refs, sort/filter, edit policy (`email_verified` hard-coded at :129), titles, chart picking and `tableInfoOf` | Split |
| Med | Dead code | `isNumericValue` (format.ts:66), `entityKey` (109), `structureRef` (92); unused `Shell` props (states.tsx:4-5) | Delete |
| Med | Duplicated code | the "focus when focused" effect (Catalog:12, Grid:69, Launcher:45); J/K handling (Catalog:14-22, Grid:83-101); two copy-raw implementations (RecordPane:56, Grid:76-81) | `useFocusWhen`, `useListKeys`, `copyRaw` |
| Med | Magic numbers | Grid.tsx:35, 62 | Measure, or use CSS |
| Med | Theming leak | hex fills (ChartPane:46-54, ErPane:31-45); dark mode patched from ui/styles.css:360 | CSS variables |
| Low | N+1 | RecordPane:103 runs one `useRows` per relation for a count | Counts from `api.relations` |
| Low | Data-shape assumption | money and JSON detected by name suffix (format.ts:6-7, RecordPane:28) | A format hint on `ColumnInfo` |
| Low | Stale docs | DECISIONS line 7 `holding` prop | Fix |

### E1. The tests get a fixture layer
| Sev | Smell | Where | Fix |
|---|---|---|---|
| Med | Duplicated code | `SHOT`, `paneEl`, `announcer` and two `start()`s across both specs; the visible-pane evaluation written six times | `e2e/fixtures/lab.ts`: a `test.extend({ lab })` page object with `preset`, `open`, `pane`, `header`, `visibleIds`, `snap`, `tuck`, `firstTuckable`, `setting`, `announcements`, `fetches`, `settle` and `shot` |
| Med | Bogus assertion | walkthrough:720 `toContainText("customer1".slice(0,0)+"")` asserts nothing | Assert on a real cell |
| Med | Dead code | stability:64, 80-85, 356-360 | Delete |
| Med | Sleeps | 22 `waitForTimeout` | `expect.poll` and `settle()` |
| Med | Magic selectors | stability:315, 350, 424, 454 repeat a long tuck selector; class selectors | Use roles and test-ids |
| Low | Side effects | normal runs write `docs/screens`; no `webServer` in the Playwright config | A separate `screens` project; add `webServer` |
| Low | File size | walkthrough is 888 lines | Split by area: open-peek, move, launcher-tabs, divider, zoom-focus-close, url, shared-data, a11y, responsive, tuck-shelf, stability, screens |

**Proposed structure:**
```
src/data/   index.ts tables.ts labels.ts catalog.ts sql.ts entities.ts result-store.ts keys.ts react.tsx hooks.ts types.ts sample-sql.ts
src/panes/  index.ts kinds/{catalog,table,record,structure,er,query,chart}/ grid/{Grid,RowMenu,useWindow,grid-state} shared/{PaneGate,states,useFocusWhen,useListKeys,copyRaw} format.ts panes.css
e2e/        fixtures/{lab.ts,layouts.ts} + one spec per area + screens.spec.ts (own project)
```

---

## Fix plan (how the work is split)
- **Wave 1, in parallel and by ownership:**
  - **Codex GPT 6.1 Sol: layout-core.** L1–L4 and its findings. It updates only the store's call sites, minimally, so the app keeps compiling.
  - **Codex GPT 6.1 Terra: data and panes.** P1–P4 and their findings. It adds kind policy to the registry but leaves store.ts alone.
  - **Claude Sonnet 5.5: e2e.** E1 only, as behaviour-level tests.
- **Wave 2, Claude Opus 5.5: src/ui.** U1–U5, the ui findings and CSS, built on the new core and kinds API. This includes deleting the Ark and rrp remnants.
- **Wave 3, Claude Sonnet 5.5: verification.** Full suites, a screenshot diff against the `docs/screens` baseline (visuals must not change), and a re-read of this review to tick off every item.

**For every wave:**
- behaviour, visuals, copy, keys and URL parameters stay as they are;
- commit small, with plain messages, no co-author line and no push;
- record every structural decision in DECISIONS.md.
