# @jali/core: architecture and code review (Opus)

Frozen tree: `review-93526af` (HEAD `93526af`). Read-only. Unit suite run: 106 files, 1,052 tests pass. Every finding marked **verified** was reproduced with a probe test run against the source (probes are in `probes/`; the seeded fuzz harness is `e.fuzz.ts.txt` there). Byte figures come from a rolldown build of the headless scenario from source (`.../scratchpad/size/build.mjs`).

## Verdict

The pure engine, `apply()` with typed refusals and held intents, the hardened codec and the per-input-layer checks are already at the top of the field. Four things stand between this and best in class:

1. **The state isn't one truth across time and tabs.** Pane state is one key that every tab overwrites whole, so a second tab erased the first tab's drafts (verified). After a window resize the address goes stale, so Copy link no longer reopens what is on screen (verified). And `destroy()` still lets a pending `beforeClose` commit and push history (verified).
2. **The geometry contract is declared by hand rather than derived.** That causes gap (b), and the same cause hits `swapWithNext`, `openHere` and `focusExisting`. Panes then jump instead of sliding (verified, about 200 breaches in a 400-seed fuzz).
3. **The types stop at `ObjectRef`.** Kinds and params never reach actions, events, selection or the model. TanStack's bar is end-to-end inference.
4. **Size is spent on features, not on the engine.** The fitter is about 10 KB gz of 49. The rest is bound in unconditionally through one `ACTIONS` table, a default URL sync, the command registry and a monolithic `en`. `definePage` already shows the fix: a feature model.

Findings: P0 1 · P1 4 · P2 10 · P3 6.

## Target architecture

What the current shape gets right and should keep: a pure `layout/` engine (tree, ops, fit, codec, validate, guarded by purity tests); `apply(Outcome)` with the POLICY table, refusals and held intents; ports for location and storage; events batched per commit with `input`.

Where the target differs:

```
@jali/core
  engine/        unchanged: pure tree, ops, fit, codec, validate                         (~10 KB gz today)
  store/
    config.ts    resolveOptions(JaliOptions) -> Config  (ONE normalised shape; Env = Config + kinds)
    state.ts     { layout, view, panes: Map<NodeId, PaneRuntime>, ui: {...}, slices: {[feature]: ...} }
                 PaneRuntime = { reports: Map<caller, Report>, state?: {of, values}, selection?: {of, ref} }
                 derived (memoised selectors, not stored): activity, unsaved, commands, title, attributes
    run.ts       run(step, ...args): ActionResult        (ONE action layer; adapters and apps share it)
    apply.ts     as now, plus: geometry DERIVED for content-dependent ops; dev assertion only for
                 contractually stable ops; one notify + events per batch; refuse everything after destroy
  features/      Feature = { id, slice?, steps, actions, commands, keys, words, hooks }
                 hooks: placeOpened, beforeClose, onArrive, link.read/write, prune
                 always on: focus, open, close, undo. Opt-in (adapters pick a default set):
                 keyboard(), urlSync(), persistence(), tabs(), tuck(), peek() + follow(), autoLayout(),
                 rename(), tabMenu(), phone(), page = definePage (the first feature: PageEngine already is one),
                 popOut()
  ports/         Location; Storage { get, set, remove?, keys?, subscribe? (cross-tab) };
                 Dom per Document (main + pop-out windows); input tracking per Document
types            PaneDefinition<K extends string, P> -> Ref<K, P>;
                 createJali<const D extends readonly PaneDefinition[]>(...) : Jali<RefOf<D[number]>, Features>
```

How far the current code is from this:

- **Engine:** at the target.
- **`apply`:** close. It needs derived geometry, coalesced notifications and a destroyed guard.
- **State model:** medium. There are 11 parallel `Record<NodeId, …>` maps, 5 of them derived but stored. There are three option shapes (JaliOptions → UiStoreDeps → Env) and two action layers.
- **Feature model:** the furthest. `PageEngine` is a de facto plugin, but `open` and `close` call into it by name, and every other feature is welded into `ACTIONS`, the registry and `en`.
- **Types:** a change to the signature, not to behaviour.

Estimated effort for the whole move: 2–3 focused weeks, without changing the UI or UX.

## Findings

### P0

**CORE-1. Restoring a saved layout crashes start-up when a kind was removed; duplicate ids are accepted.** _Verified._

- **Evidence:** `createJali({ layout: row({ kind: "zzz" }, …) })` throws `Unknown pane kind: zzz`. A raw layout with two panes both called `"x"` is accepted and resolves to two boxes with the same id, which breaks React keys and makes focus by id ambiguous. `setLayout` with the same input returns `invalid`, so the two paths are asymmetric.
  - Initial layout taken unchecked: `create-jali.ts:255-258`, `state/store.ts:456-459`.
  - DECISIONS (19 Nov, "Save and restore") tells hosts to save on `on("layout")` and pass that back as `createJali({ layout })`. After a deploy that renames or drops a kind, every user with a saved layout gets a blank app until site data is cleared. That is the C2 class again, through the documented path. Presets are protected (`saved`: "a layout that names a kind this workspace no longer has is ignored"); `layout` isn't.
- **Fix:** run the initial layout and every preset `build()` through the same `core.validate` + `readLayout` path that `setLayout` and links use.
  - If it's invalid, fall back to the first preset, then the page, then the launcher, and report it (dev `console.error`, plus an `onError`/`onPaneError`-style hook).
  - Throw only when there is no fallback, with a message that names the problem.
  - Unknown kinds can stay as Missing panes, as links already allow.
- **Effort:** S.

### P1

**CORE-2. Pane state is one key that every tab overwrites whole. Gap (a) is one case of this.** _Verified._

- **Evidence:** `savePaneState` writes the entire map (`state/pane-state.ts:95-103`; `boot.ts:93-96`, called from `saveSoon`, `pagehide` and `stop`). In the probe:
  - tab A saved `{"doc":{"draft":"reply to customer 1"},"doc-2":{"scroll":400}}`;
  - tab B (same build, no pane state at all) flushed;
  - storage then held `{}`, and a reload of A saw nothing.

  So any second tab of the same build loses the first tab's drafts on its next save, not only an old build during an upgrade. Owners make it safe (no draft lands on the wrong object), but not lossless.

- **Fix (one change that also closes gap a):**
  1. **A new key name,** `pane-state@2`, holding `{ v: 2, panes: { [paneId]: { of: objectKey, values, at } } }`. Values and owner are in one record, so they can't disagree. An old build keeps writing `pane-state`/`pane-state-of`, which the new build deletes once and never reads, so an old tab can't overwrite a newer one at all. Changing the key name, not only the shape, is what removes the upgrade race.
  2. **Merge on write:** read the latest value, apply only this tab's dirty and deleted pane ids, then write. A tab that has touched nothing never writes.
  3. **Stay current while other tabs write:** add an optional `subscribe(key, fn)` to `StoragePort`, which `browserStorage` backs with the `storage` event, so a live tab merges what other tabs write.
  4. **Bound the size:** cap at about 200 entries, evicting by `at`.
  5. **Optional:** `StoragePort.remove?` for the old keys.

  Keep the identity check (`paneStateFor`) as it is.

- **Effort:** M. It changes the stored format once (DECISIONS entry).

**CORE-3. `destroy()` leaves a pending `beforeClose` alive. Its later yes commits and pushes history onto whatever route is now showing.** _Verified._

- **Evidence:**
  - `close()` returned `pending`, then `destroy()` ran, then the host answered `true`.
  - `settled` resolved `{ ok: true, pane: "b" }`, the pane closed, and the address went from 1 to 2 entries.
  - `destroy()` settles an open Discard question (`state/store.ts:738-756`) but not a held host answer (`state/apply.ts:652-657` → `io.later` → `store.apply`, `state/store.ts:767`). `cancel()` drops only the debounce timer; later `write`s still go out (`url.ts`, `createUrlSync().write`).
  - This is P18's class again.
- **Fix:** have `store.apply` refuse with `"unavailable"` once destroyed, and make `io.later` a no-op then. In `destroy()`, settle every held `settled` as `"kept"` (keep the holds in a set). `createUrlSync().cancel()` sets a `closed` flag that drops later writes.
- **Effort:** S.

**CORE-4. After a resize or pane-cap refit the address is stale, so Copy link and a reload at the same size reopen a different arrangement.** _Verified._

- **Evidence:** `write()` refits the layout on an area or cap change but writes no URL (`state/store.ts:536-551`), so new fold records live only in memory. In a 400-seed fuzz:
  - every link round-trip mismatch came right after a resize: a different tab shown in a fold group, different widths (`[["list",0,378],["launcher-1",384,378]…]` against `[["list",0,360],["item",366,395]…]`);
  - with resizes removed, there were 0 mismatches;
  - with `writeUrl("replace")` before the reload, there were 0.

  BRIEF §3: "Copy an 8-pane layout as a link … get it exactly back." `href()` reads the stale address.

- **Fix:** when `write()`'s refit changes the layout, call `deps.url?.write(…, "debounce")`. That is a replace after `PERSIST_MS`: no history entry and no `layout` event, which keeps DECISIONS' event rule. Add a test: resize, then `href()`, then a new workspace at the same size gives equal geometry.
- **Effort:** S.

**CORE-5. Gap (b): the geometry class is declared per op but depends on content. Panes jump without animating, and the dev warning is noisy.** _Verified._

- **Evidence:**
  - **Sweep of `moveTab` and `setPinned`:** 6,960 cases over 5 shapes, widths from 400 to 1800, chosen tabs and tucks; 60 breaches.
    - Every one is in a layout where a deliberate stack is folded into an automatic group, for example `folds: ["n-3","n-5","@auto:n-2","tabs-2"]`.
    - Cause: `homeOf` keys a deliberate stack by its first tab (`layout/fit/overlay.ts:70-74`). Moving or pinning that first tab renames the group (`@auto:n-2` becomes `@auto:w`), so `foldOn` skips the record as stale (`fit/replay.ts:151-158`) and `shown` keys miss. The folds then replay differently.
  - **400-seed fuzz of every public action** (no resizes): 213 breaches.
    - `swap ← swapWithNext`: 143. `core.swap` between kinds with different min, comfortable or max sizes reshares the row (`actions/move.ts:85-89`; POLICY `swap: layout("push","swap")`, `state/apply.ts:311`).
    - `openHere`: 39. `setRef` into a slot the new kind sizes differently (`actions/open.ts:271-279`).
    - `focusExisting`: 26. It closes the transient launcher, which is a reshape, under a swap op (`actions/open.ts:245-255`).
    - `moveTab`/`pinTab`: 5.
  - **What the person sees:** `reshapes` only increments for `"reshape"` (`state/apply.ts:692`), so in every one of these cases panes jump instead of sliding for 180 ms. That is a visible bug, not only a warning.
- **Fix:**
  1. Key a deliberate stack's home by the stack's node id (stable across reordering). If the projection needs a pane id, remap `@auto:<oldFirst>` and `shown[oldFirst]` in `core.moveTab`/`setPinned` when the first child changes. "Ops own their overlay", as L3 does for refits.
  2. Derive the geometry. For layout-writing ops, `apply` already computes `geometryOf` before and after in dev (`state/apply.ts:675-679`). Compute it always (the model is needed for the render anyway), and treat any change of rects as a reshape for animation.
  3. Keep the dev assertion only for ops that are stable by contract (`focus`, `tab`, `reveal`, `moveTab`, `pinTab`, `keep`, `page`), where a breach really is a bug.
  4. In the `focusExisting` branch that closes the launcher, declare `geometry: "reshape"`.
  5. Turn the sweep and the fuzz into tests (CORE-15).

  This doesn't relitigate DECISIONS "layout stability": it enforces that rule instead of approximating it.

- **Effort:** M.

### P2

**CORE-6. Types stop at `ObjectRef`: no kind or param inference through actions, events, selection or the model.**

- **Evidence:**
  - `createJali<D>()` returns a non-generic `Jali` (`create-jali.ts:198`, `state/instance.ts`).
  - `ObjectRef.params` is `Record<string, string | number | boolean>` (`layout/types.ts:8-11`).
  - `PaneKindBase extends PaneOptions<never>` erases `P` (`pane-kinds.ts`, "PaneKindBase").
  - `PaneDefinition.kind: string`, not a literal.
  - So `jali.on("open", ({ ref }) => ref.params.id)` is `string | number | boolean`; `openBeside(p, { kind: "ordr", … })` compiles; `select(list, wrongKindRef)` compiles.
  - TanStack Router and Query carry the registered types end to end.
- **Fix:**
  - `PaneDefinition<K extends string, P>` returns a branded `Ref<K, P>`.
  - `createJali<const D extends readonly PaneDefinition[]>` returns `Jali<RefOf<D[number]>>`.
  - `JaliActions<R>`, `JaliEvents<R>` (a union discriminated on `kind`) and `JaliModel<R>`.
  - A `Register` interface (`declare module "@jali/core" { interface Register { jali: typeof jali } }`) so React hooks infer without generics.
  - Keep `ObjectRef` as the wide type for links and agents. Pre-1.0 is the only cheap moment.
- **Effort:** M–L, types only.

**CORE-7. Three option shapes copied by hand, and two action layers.**

- **Evidence:**
  - **Options:** `JaliOptions` (`create-jali.ts:58-190`) is copied field by field into `UiStoreDeps` (`create-jali.ts:221-260`), whose doc comments repeat it (`state/store.ts:222-307`). That is copied again field by field into `Env` (`state/store.ts:418-441`; `profile.ts:160-202`). About 45 fields are documented three times, and the copies have already drifted (CORE-13).
  - **Actions:** `ACTIONS`, 80 steps returning `NodeId | undefined` through `bindActions`, so refusals are thrown away (`actions/index.ts:88-238`). Beside them sit 37 public actions returning `ActionResult` (`actions/public.ts`), plus a `NAMED_AS` table (37 entries) to reconcile the names.
- **Fix:**
  - `resolveOptions()` once into a `Config`, with `Env` = `Config` + kinds.
  - One action table of steps; `store.run(name, ...args): ActionResult` serves adapters and apps alike. The public `JaliActions` becomes a typed `Pick` of it, and `NAMED_AS` disappears (a step names its public action in its own definition).
- **Effort:** M.

**CORE-8. Per-pane runtime is 11 parallel maps, 5 of them derived but stored.**

- **Evidence:**
  - `UiState.activity`, `unsaved`, `paneCommands`, `titles` and `paneAttributes` are merged from `paneReports`, then stored (`state/store.ts:146-196`).
  - `selection`, `selectionOf`, `paneState` and `paneStateOf` are pairs that must agree.
  - `prunePanes` has five copy-paste filter blocks to keep them in step (`state/apply.ts:421-480`), plus `withoutNames` and `withoutUnsaved`.
  - Every new per-pane fact means touching all of them.
- **Fix:** `panes: Map<NodeId, PaneRuntime>` with `reports` as the only source. Derive the rest with memoised selectors (the React side already reads per-pane slices). One prune per commit: drop the entry, or reset its object-bound part when `objectKey` changes.
- **Effort:** M.

**CORE-9. The bundle pays for features, not for the engine. The credible path to a much smaller core.** _Measured._

- **Evidence:** headless scenario, 148.7 KB minified, 49.4 KB gz, built from source.

  | Area     | Minified | Share | Main files                                                               |
  | -------- | -------- | ----- | ------------------------------------------------------------------------ |
  | layout/  | 47.2 K   | 32%   | of which `ops/arrange.ts` (auto layout) 4.7 K and codec + validate 6.0 K |
  | state/   | 33.5 K   |       | `messages.ts` 12.8 K, the largest single file                            |
  | actions/ | 33.1 K   |       |                                                                          |
  | root     | 16.3 K   |       | `url.ts` 5.2 K, `pane-kinds.ts` 5.2 K, `boot.ts` 2.9 K                   |
  | commands | 14.0 K   |       | `registry.ts` 5.8 K, `keymap.ts`, `keyboard.ts`, `format.ts`             |
  - The layout-only scenario is about 10 KB gz, so the fitter is about 20% of the bytes.
  - What can't be tree-shaken:
    - `ACTIONS` names every step (`actions/index.ts:88`), and `publicActions` names every public action;
    - `url = inBrowser` statically imports `createUrlSync` (`create-jali.ts:32, 215`);
    - `startUi` always imports the keyboard (`boot.ts:6`);
    - `en` is one object holding every feature's words.

- **Fix:** the feature model in the target architecture. `definePage` already proves the pattern (page code ships only when it is called).
  - `createJali({ features: [keyboard(), urlSync(), tuck(), peek(), autoLayout(), rename(), tabMenu(), phone()] })`, where each feature brings its steps, commands, keys, words and state slice.
  - `<JaliRoot>` (or `@jali/react`'s `createJali` re-export) applies the default set, so app code doesn't change.
  - `messages` split per feature.
  - Estimated minimal headless core (engine + store + open/close/focus/undo + their words): about 25–30 KB gz. That is an estimate, not a measurement; measure it with `scripts/size.mjs --modules` as the split lands.
- **Effort:** L.

**CORE-10. Dev mode is detected with `import.meta.env.DEV` (`state/store.ts:408`).**

- **Evidence:** outside Vite (webpack, Next.js, esbuild, Node tests), `import.meta.env` is undefined. So the stability check, the default `onPaneError` and the dev warnings are silently off for most consumers of a published package.
- **Fix:** `process.env.NODE_ENV !== "production"`, which every bundler defines (React and TanStack use it), or `development`/`production` export conditions.
- **Effort:** S.

**CORE-11. Gap (c): what would make Pop out stable.**

- **Evidence:**
  - The window and the popped pane are module state in React (`react/src/pane/PopOut.tsx:31-38`). The core doesn't know a pane is popped out.
  - The keyboard listens on `window` (`commands/keyboard.ts:160`), and focus helpers read the global `document.activeElement` (`dom/focus.ts:24-98`).
  - Input tracking is a global refcount bound to one document (`dom/input.ts:20-73`; P22, still open).
  - Content remounts because the portal target changes.
- **Fix, in four parts:**
  1. **State in core:** `view.poppedOut?: NodeId` (or a pop-out feature slice), with `popOut(pane)` and `bringBack()` as actions of geometry `focus`. Pruned when the pane leaves. `destroy()` and `prunePanes` close it through `DomPort.popOut.close()`. Events carry it. It stays out of the link.
  2. **Keys:** a DOM port per document. `store.attachDocument(win.document)` installs `installKeyboard(store, { target: win })` and `trackInput(win.document)` (refcounted per document with a `WeakMap<Document, number>`). Focus helpers use `el.ownerDocument`. Inside the window, pane-scoped commands and the ⌘K prefix work, and the palette opens in the main window and focuses it.
  3. **State carries:** render every pane's content into a persistent host element per pane, and move that one DOM node (`appendChild`, which adopts it) between the slot and the window. The React portal target never changes, so component state survives. React listens on portal containers, so events keep working. Document the limits: iframes and media reload; code that reads the global `document` sees the opener.
  4. **One window per workspace,** kept in the store's DOM port rather than module state. Theme and token changes are mirrored, which closes P23 too. A test with a second jsdom `Document` asserts that keys dispatch there and that `useState` survives a pop out and bring back.

  Rename to `popOut`/`bringBack` once these four land.

- **Effort:** M.

**CORE-12. Kind and option definitions aren't checked, and there is no fallback when they are wrong.** _Verified._

- **Evidence:**
  - `width: { min: NaN }` gives NaN rects (`x: null, width: null`).
  - `min: 500, max: 100` is accepted silently.
  - Two kinds with the same `kind`: the last one wins silently.
  - Two presets with the same id: the second can never be chosen.
  - `createJali({ preset: "typo" })` silently opens the first preset (`profile.ts:232-233`), whereas `gap` and `size` already throw a clear `RangeError`.
- **Fix:** check sizes (finite, ≥ 0, min ≤ comfortable ≤ max) and duplicates in `createPaneKinds` and `createJali`, with a clear error. An unknown `preset` is a dev warning.
- **Effort:** S.

**CORE-13. Naming and grouping inconsistencies in the public API.**

- **`keys` docs still drift (P22, still open):** the docs say `"workspace"` but the type is `"page" | "scoped"` (`create-jali.ts:78`, `state/store.ts:237`).
- **Keyboard options are scattered:** six flat options (`keys`, `keymap`, `keyPrefix`, `reservedKeys`, `palette`, `keymapOptions`) beside a group (`keymapOptions`) that covers part of the same ground. Make it one `keyboard: { scope, keymap, prefix, reserved, palette, platform, onInvalid }`.
- **Page actions sit on every workspace's `JaliActions`,** even though the page is opt-in. They are refused at runtime with `"unavailable"`.
  - There are three "tab" verbs with three meanings: `openTab(view)`, `addTab(pane, ref)`, `newTab(pane)`.
  - `activate(item)` doesn't say what it activates.
  - `setCanInvestigate` is loan-review vocabulary.
  - Move them to `jali.page.{open, leave, setMode, showView, showItem, reset, setLinkMode("open" | "peek")}`, typed only when a page is given.
- **Three subscription channels** (`subscribe`, `on`, `onToast`): make toasts `on("toast")`.
- **Effort:** M.

**CORE-14. Deprecated leftovers before 1.0, with two internal consumers.**

- `isMac` is read when the module loads (`commands/format.ts:23-26`).
- Mutating tree aliases (`layout/tree/public.ts:25-41`).
- `setPopOutPort`, which is module state (`commands/registry.ts:51-60`).
- **Fix:** delete them now. Deprecating means keeping them until 2.0.
- **Effort:** S.

**CORE-15. Test gaps.**

- **Missing store fuzz:** there is no model-based fuzz of the store. A 60-step × 400-seed harness (unique ids, focus and zoom on existing panes, finite rects, panes inside the area, link round trip at the same size, no stability breach) found CORE-4 and CORE-5 in under 2 s. The layout engine has a generated corpus (`fit-equivalence.test.ts`); the store has only hand-picked examples (`tests/stability.test.ts`).
- **Core tests depend on example apps:** they run against the example apps' kinds (`tests/workspace.ts` imports `examples/data-studio` and `examples/loan-review`), so a refactor of an example can break core tests. Core needs its own fixture kinds.
- **Untested behaviours:**
  - a pending `beforeClose` across `destroy()`;
  - the address after a resize;
  - two tabs sharing storage;
  - type-level inference through actions and events.
- **Slow setup:** jsdom is created 106 times, 75 s of setup (`pool: "vmThreads"`).
- **Effort:** M.

### P3

**CORE-16. Two notifications per action, sent in the middle of a batch.** _Verified._

- **Evidence:** `close`, `undo`, `openBeside` and `closeOthers` each notify twice: once for the state, once for the announcement. Subscribers see a state whose layout has changed but whose announcement hasn't. `write` notifies on every patch (`state/store.ts:550`).
- **Fix:** collect the patches and notify once when the batch ends, as events already do.
- **Effort:** S.

**CORE-17. `snapshot()` builds the model eagerly.**

- **Evidence:** `apply` calls `io.snapshot()` only to read `env` or the messages (`state/apply.ts:642, 650, 697, 707`). After an `io.set`, that resolves a new model nobody reads. The agent calls `storeOf(jali).snapshot()` once per pane (`agent.ts:228`).
- **Fix:** make `m` a lazy getter, and pass `env` separately.
- **Effort:** S.

**CORE-18. Agent bridge input.**

- **Evidence:** `act(null)` or a non-iterable `steps` throws a `TypeError` out of `execute`; a step of `null` throws on `step.action` (`agent.ts:298-300`). A model that sends malformed input should get a refusal, not an exception.
- **Fix:** guard the shape of `request` and of each step.
- **Effort:** S.

**CORE-19. Host callbacks and equality are handled inconsistently.**

- **Evidence:**
  - A kind's `identity` is called outside a try (`pane-kinds.ts:571-579`), while `title` and `follow` are guarded, so a throwing `identity` breaks `sameObject` and with it `open`.
  - `readSearch` dedupes `open=` with its own JSON key (`url.ts`, "investigation"): a fifth ref equality after P14.
  - `structureKey` hashes params in key order (`url.ts`, `structureKey`), so a layout from `jsonb` loses the person's kept sizes.
- **Fix:** guard `identity`, and reuse `objectKey` and `sameRef` for both.
- **Effort:** S.

**CORE-20. Hidden module state.**

- **Evidence:**
  - `unreadRefs` and `unwrittenOf` are module `WeakSet`/`WeakMap`s that tie meaning to object identity (`pane-kinds.ts`). A `structuredClone` or a JSON round trip silently drops the "built by a kind's call" mark that `linkSearch` relies on without `panes`.
  - The input tracker is global (`dom/input.ts`).
- **Fix:** let `linkSearch` require `panes` for app-only params (or warn without them), and make input tracking per document (CORE-11).
- **Effort:** S.

**CORE-21. Release hygiene.**

- **Evidence:** `files` lists `LICENSE`, but there is none; `license: "Apache-2.0"` is declared anyway (also noted in DECISIONS, 19 Nov, as left open). `en` imports `pageEn` as a value (`state/messages.ts:15`). Check that `en` doesn't carry the page's words into apps without a page: the size gate's `mustNotShip` covers the minimal app only through `<JaliRoot>`.
- **Effort:** S.

## Known gaps: best fix for each

- **(a) Two pane-state keys:** fold it into CORE-2. Use a new key name with one record per pane (`{ of, values, at }`), merge on write and stay current with the `storage` event. Old keys are deleted once and never read. The new key name is what makes the upgrade race impossible, and merge on write fixes the larger same-build loss found here.
- **(b) "Layout stability" warnings on `moveTab` and `pinTab`:** key a deliberate stack's home by its stack id, or remap overlay keys when the first tab changes. Derive the geometry class for ops whose effect depends on content, and keep the assertion for ops that are stable by contract (CORE-5). The same fix removes the swap, openHere and focusExisting breaches, and the panes that jump without animating.
- **(c) Pop out:** core state for the popped-out pane, a DOM port and keyboard per document, a persistent host node per pane so state survives, and a window per workspace (CORE-11).

## Keep as is

- `apply()`, held intents and `settled`.
- The purity tests.
- The codec and validator limits.
- `checkRef` at the action boundary.
- Null-prototype records and `own`.
- The divider and scroll-strip hot paths.
- The size gate's `mustNotShip` lists, which is the right tool to enforce the feature split.
