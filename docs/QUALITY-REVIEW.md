# Quality review, 20 Nov 2026

> **What was reviewed:** master at `fccfa1f`, frozen once every session had been idle for 15 minutes. `@jali/core`, `@jali/react`, the five example apps and the docs site.
>
> **How:** every gate run on a clean copy. Performance measured in Chrome with a purpose-built harness. Six areas each reviewed by an Opus reviewer, and core and docs also by Codex GPT 6.2 Sol (high). Codex hit its usage limit on the React and example lanes, and OpenAI's filter refused the security lane, so those areas had one reviewer each. Every finding marked **verified** was reproduced by hand on the frozen copy. **Both** means two reviewers found it independently. **Measured** means the number comes from a run, not from reading code.
>
> Nothing was changed. This file is the list to fix from.

## Progress

**Phase 1, done 20 Nov 2026 (master `364e253`):**

- **Fixed:** C1–C7 and P17 (one input layer, 55 hostile-input tests); C8–C10 (a held question holds the action and answers against the workspace as it is then); C14, C15 and the docs correctness items in P24; P1 (fitting).
- **Repo:** `pnpm verify` runs every gate. Browser suites start their own server on a strict port. Docs tests run against the built site on a Mac and a Windows reader. The repo is formatted.
- **Measured after:**

  | What                             | Before                   | After                                                      |
  | -------------------------------- | ------------------------ | ---------------------------------------------------------- |
  | Refit, 64 panes (Node)           | 7.5 s                    | 6.6 ms                                                     |
  | Refit, 200 panes (Node)          | —                        | 17–26 ms                                                   |
  | Mount, 48 panes (Chrome, 4x CPU) | 8.7 s                    | 2.6 s                                                      |
  | Mount, 48 panes (unthrottled)    | 2.2 s                    | 0.66 s; what is left is rendering the harness's 1,920 rows |
  | Resize step, 24 panes            | p50 686 ms, p95 1,168 ms | p50 397 ms, p95 658 ms                                     |

- **Gates:** every gate in `pnpm verify` passes except **size**, which needs the owner's decision (the numbers are under P3).
- **Found while fixing:**
  - `e2e/follow.spec.ts` only passed on ports containing a 5; it is fixed.
  - `@jali/core`'s `commands/format.ts:13-20` reads `navigator` when the module loads, so a prerendered keymap label depends on the build machine. That goes into phase 2.

## Verdict

The architecture is sound and some of it is excellent:

- `apply()` with its typed changes and refusals;
- the pure layout engine with its purity tests;
- the hardened `?l=` codec;
- pane isolation through an error boundary per pane;
- the divider and scroll-strip hot paths;
- the tested parts contract.

It is not yet the hallmark. Four themes account for most findings:

1. **The trust boundary stops at the codec.** Values from links, storage, agents and the host's own calls reach records, CSS selectors and the fitting maths unchecked. One crafted link, one stale storage value or one typo crashes the workspace for good.
2. **Fitting cost grows close to cubically.** 48 panes take 2.2 s to mount on a fast machine, and 64 take 7.3 s to refit. Both were measured independently.
3. **State that waits (a confirmation, Back, a deferred follow) is not re-checked when it lands.** Discard can undo other people's changes, and Back leaves the address on a layout the person rejected.
4. **Keyboard and focus are re-derived per widget.** Tab strips have no arrow keys, dialogs neither trap nor restore focus, and the three menus differ. One shared set of primitives would fix all of them.

The examples are ambitious, but none of them yet meets `docs/EXAMPLES-STANDARD.md`. The docs site prerenders well, but it hydrates the whole site on every page.

## Gates

| Gate                                                    | Result                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck, lint                                         | pass                                                                                                                                                  |
| unit (999 tests), docs unit (14), agent-docs, React 18  | pass                                                                                                                                                  |
| browser tests: Jali 139, Studio 27, Trips 19, Markets 6 | pass (on frozen-copy servers, ports 5601–5605)                                                                                                        |
| `vp fmt --check`                                        | **fail**: 31 files unformatted, including `packages/core/src/layout/fit/replay.ts` and both packages' `package.json`                                  |
| `pnpm size`                                             | **fail**: every package over budget (below)                                                                                                           |
| docs build                                              | pass (33 pages)                                                                                                                                       |
| docs browser tests                                      | **fail**: `astro dev` starts in the background when no terminal is attached, so Playwright sees it exit at once (`apps/docs/playwright.config.ts:15`) |

**Size**, gzipped KB, minimal app:

| Package       | 19 Nov baseline | Budget | Now             |
| ------------- | --------------- | ------ | --------------- |
| `@jali/react` | 16.6            | 18.3   | **23.5 (+42%)** |
| `@jali/core`  | 45.2            | 49.5   | **52.3**        |
| CSS           | —               | 7.8    | **8.2**         |

The minimal app has no curated page, but it ships `core/src/actions/page.ts` (9.5 KB minified) and all of `messages.ts` (15 KB).

**Test setup that hides failures:** the example configs reuse any dev server already on their port (`reuseExistingServer: true`). Four of those ports were held by other sessions' servers, so a default run would have tested someone else's checkout. Trips also lacks `--strictPort`.

## Performance (measured)

The harness is a production build of a workspace with N panes, each rendering 40 rows. Chrome, CPU slowed 4x, unless marked otherwise.

| What                                                                  | Result                                                                                                                       | Read                                                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mount, 4 / 12 / 24 / 48 panes                                         | 78 / 118 / 556 / **8,682 ms**                                                                                                | 4x the panes costs 74x the time. Unthrottled, 48 panes take 2.2 s.                                                                                                     |
| Where the 48-pane time goes                                           | `allPanes` 758 ms, `slots` 194, `chooseFold` 188, `score` 119 (unthrottled profile)                                          | `allPanes` (`layout/fit/overlay.ts:56`) is a fresh `flatMap` called inside per-pane loops (`contains`, `orderOf`, `homeOf`), and fold replay repeats all earlier folds |
| Refit of a flat row (Codex, Node)                                     | 16 → 25 ms, 32 → 336 ms, **64 → 7.3 s**                                                                                      | Matches the profile                                                                                                                                                    |
| Resize step, 24 panes                                                 | p50 686 ms, p95 1,168 ms                                                                                                     | Janky above about 16 panes. With 12 panes unthrottled, it is about 2 frames, which is fine.                                                                            |
| Divider drag, 12 panes                                                | 16.7 ms frames, 2 commits for 60 moves, no long tasks                                                                        | Excellent. Keep this design.                                                                                                                                           |
| Follow a list, 12 panes                                               | 162 ms (includes Jali's 150 ms deliberate delay)                                                                             | Fine                                                                                                                                                                   |
| Leaks, 160 mount/unmount cycles                                       | Heap levels off at 4.6 MB; DOM nodes and listeners unchanged                                                                 | No leak                                                                                                                                                                |
| Docs, phone profile (Lighthouse mobile: 4x CPU, 150 ms RTT, 1.6 Mbps) | FCP and LCP 0.6–1.0 s; **TBT 250–750 ms**; **CLS 0.377** on `/learn/fitting`; **1.6–1.8 MB JS** (uncompressed) on every page | Prerendering pays off. The shift and blocking come from hydrating everything (D1, D4).                                                                                 |

## Findings

Ranked. P0 means fix before anything ships: crashes, data loss, security. P1 means the bar. P2 means polish. The tags in brackets say who found each one and whether it was checked.

### P0: crashes, data loss, security

**Trust boundary (one input layer fixes most of these)**

- **C1. A pane id containing `"` crashes the workspace on mount.** [both · verified] `validate` accepts any string as an id. The ids then go into CSS selectors unescaped: `state/store.ts:330`, `dom/focus.ts:91`, `TabIndicator.tsx:18`, `TabStrip.tsx:100`, `TabOverflow.tsx:118`, `RenameField.tsx:39`. Rendering threw `SyntaxError: Invalid selector`. **Fix:** a safe id pattern in `validate` (`/^[\w.:-]{1,128}$/`), plus `CSS.escape` or an id→element map at every selector.
- **C2. A bad stored `paneCap` means the app never starts.** [both · verified] `loadSettings` checks only `theme` and `boundary` (`state/settings.ts:25-46`). With `paneCap: "8"`, `createJali` throws a RangeError on every load until site data is cleared. `changeSettings({ paneCap: 0 })` breaks a running workspace, because `write()` sets state before it refits. Saved sizes are spread onto nodes unchecked (`url.ts:215-225, 268-275`): a `null` entry also stops startup. **Fix:** a per-field schema with a fallback for each field; validate the merged layout; refit before assigning.
- **C3. Prototype names count as real kinds and ids.** [both · verified] The kind registry and the per-pane records (`titles`, `unsaved`, `paneCommands`, `selection`, `paneState`) are plain `{}`. `openBeside(…, { kind: "constructor" })` returned `ok: true` and gave NaN geometry. A follower with id `constructor` is always "held for unsaved work", and the palette crashes on `paneCommands["constructor"].map`. **Fix:** `Object.create(null)` or `Map`, and `Object.hasOwn` for every membership test.
- **C4. Public actions throw on an unknown kind.** [Opus · verified] `openHere` threw `Unknown pane kind: typo`, against the `ActionResult` contract (`actions/public.ts:8`). **Fix:** one `checkRef` at the action boundary that returns `refuse("invalid")`.
- **C5. Maximising a hidden pane succeeds, then every model read throws.** [Codex · verified] `toggleZoom("a")` returned `ok: true`, and the next model read threw `Cannot read … 'bounds'` (`actions/focus.ts:59`, `fit/resolve.ts:215`). URL zoom targets are accepted the same way (`url.ts:157`). **Fix:** refuse, or reveal first; `resolve` should require a projected node.
- **C6. Page links have no limit on opened panes.** [Opus] `?open=` repeated N times runs N full opens and fits (`url.ts:146-150`, `actions/page.ts:124-142`). With the fitting cost above, a few hundred entries freeze the tab. **Fix:** cap and deduplicate in `readSearch`; cap `validate`'s 2,048 nodes to a realistic number, such as 256.
- **C7. A double-slash path stops startup.** [Opus] `browserLocation.navigate` writes `pathname + search` (`ports.ts:41-46`). `//evil.com/x?l=…` resolves to another origin, so `replaceState` throws a SecurityError in `boot`. **Fix:** build the URL from `location.href`.

**State that waits is not re-checked**

- **C8. Discard can roll back changes made while the question was open.** [Codex, which reproduced it] The dialog holds a change computed before it opened (`state/apply.ts:465-482`, `actions/content.ts:130`). Ask to close dirty pane A, change pane B, then press Discard: A closes and B reverts. The host's `beforeClose` path has the opposite problem. It checks by object identity, so a resize while its dialog is open turns the person's "yes" into `kept` [Opus]. **Fix:** hold the intent, not the computed change. Re-resolve it against current state when the answer comes; renew the question if what it asked about changed.
- **C9. Cancelling Back leaves the address on the rejected layout.** [Codex, which reproduced it] (`boot.ts:131`, `actions/content.ts:144`) Reloading or copying the link opens what the person said no to. **Fix:** keep the pending navigation with the decision and reconcile the address either way.
- **C10. A viewer that was downgraded gets its old permission back after Discard.** [Codex, which reproduced it] `setCanInvestigate(false)` applies its mode change and its permission change separately (`actions/page.ts:212, 629`). **Fix:** one guarded change.

**Examples**

- **C11. Markets trusts Kraken.** [Opus] Frames are cast, not parsed (`market/kraken.ts:161, 206-255`). `JSON.parse` has no try/catch, and NaN prices reach the saved paper book (`trading.ts:98`). Before the first quote, a market order fills at price 0 (`kraken.ts:376-393`, `trading.ts:135-161`). **Fix:** parsers at the boundary that require finite numbers; refuse to send orders without a live bid and ask; make quotes say "not known yet".
- **C12. Data Studio runs any SQL a link carries.** [Opus] `sql` and `autorun` are link params, and the query runs on mount (`data-studio/src/panes/kinds/query.tsx:26, 71-78`). One link can hang the tab or falsify what the reader sees. **Fix:** keep `autorun` out of links, or ask "Run this query?" first. In Jali: a way to mark a param as not coming from links.
- **C13. Stored data in Trips, Studio and Markets is trusted without checks, and several shapes crash the app.** [Opus ×2] Examples: `modes: null` in `trips:plan:v2`; a non-numeric gain in `studio:edits`; `markets:lists = {}`. Behind it, Jali's `usePaneState` returns stored values typed as `T` without checking them (`usePaneState.ts:20`). **Fix:** a validator per store, with a version key. In Jali: an optional `parse` on `usePaneState`.

**Docs**

- **C14. The prerender depends on the machine that builds it, so hydration fails for half the readers.** [Opus · verified] `isMac()` runs during render (`shell/Search.tsx:101`, `TopBar.tsx:121`). Node now has `navigator`, so a build on a Mac renders ⌘K. Every Windows or Linux visitor then gets a mismatch, and React throws the prerendered page away (verified: the article node was replaced). A build on Linux CI would flip it to Mac visitors. **Fix:** a stable first render (`useSyncExternalStore(noop, isMac, () => false)`), plus a test against the built site that fails on hydration errors.
- **C15. A malformed `#hash` blanks the docs page.** [both] `decodeURIComponent` throws inside a layout effect, and the shell has no error boundary (`App.tsx:118`). **Fix:** try/catch, and one top-level error boundary.

### P1: the bar

**Performance**

- **P1. Fitting cost.** [measured · both] Carry the projection forward instead of replaying all earlier folds (`fit/replay.ts:51-131`, `fit/refit.ts:16-91`). Compute `allPanes` once per pass. Give the search for alternative homes a work budget. Add a test that fails if refitting 200 panes takes more than 50 ms.
- **P2. Over-wide subscriptions undo the memoisation DECISIONS relies on.** [Opus] Three of them:
  - A pane drag sets the whole `dnd` on every pointermove, which re-renders the whole workspace (`Workspace.tsx:283, 330-339`; core's `dnd.ts:151-201`).
  - Each pane's `HeaderActions` subscribes to the whole model and rebuilds the menu on every render (`HeaderActions.tsx:42-58`).
  - `useJaliCommands` subscribes to the whole state (`commands/react.ts:17-22`).

  The model cache is keyed on `titles`, so a live title re-runs the layout resolve (`state/model.ts:196-213`). **Fix:** narrow selectors; a `DragLayer`; at most one `dnd` update per frame; split the model cache. Add a `<Profiler>` render-count test, because nothing guards these properties today.

- **P3. Bundle growth.** [measured] React grew 42% in a day without the budget moving, and curated-page code ships to apps without a page. Find why `page.ts` isn't tree-shaken, and decide which budgets to raise and which code to cut.
- **P4. The docs hydrate the whole site as one island on every page.** [both · measured]
  - **What ships:** about 369 KB gzip of static JS. That includes the landing page's live workspaces, which come in through the `./landing` barrel import of `SiteFooter`; every MDX source and sample as text (`site/sources.ts:9-41`), drafts included; and the token reference data.
  - **Code is highlighted twice:** at build, and again in the browser with Shiki's 175 KB grammars (`mdx.tsx:180-198, 318-330`).
  - **The TOC causes the layout shift:** it is built after hydration, which is where the CLS of 0.377 comes from.
  - **Fix:** let Astro render the chrome, the TOC and the content as static HTML; hydrate only search, theme, copy and tabs, and the live parts with `client:visible`; highlight once, at build; ship a small manifest instead of the sources.

  This is the architecture I chose on 20 Nov. It is the right next step for it.

**Keyboard, focus, accessibility**

- **P5. Tab strips have no arrow keys.** [Opus] Only the active tab is in the Tab order (`TabStrip.tsx:212-233`), so other tabs can't be reached from the keyboard. The switcher, page bar and shelf already do this right with `inlineStep`. **Fix:** one `useRovingTablist`, used by all four.
- **P6. Dialogs claim `aria-modal` but neither trap nor restore focus.** [Opus] After closing Settings or the discard question, focus is on `<body>`. The discard alertdialog isn't counted as a dialog by the keymap (`commands/keyboard.ts:55-58`) or by focus (`dom/focus.ts:18`), so F6 and ⌘\ act behind it. **Fix:** one `ModalDialog` primitive: record and restore focus, wrap Tab, make the background inert.
- **P7. Three menu implementations, and the shelf's "+N" menu has no menu behaviour.** [Opus] (`Shelf.tsx:217-258`, `TabMenu.tsx:96-114`, `TabOverflow.tsx:88-111`) Menus portalled from the header also inherit its pointer handlers: pressing on a menu note drags the pane, and a double-click maximises it (`PaneFrame.tsx:161-166`). **Fix:** one `Menu` primitive that ignores events from outside the header.
- **P8. Forced-colors mode hides the selected tab, the focused pane and the activity dots.** [Opus] (`pane.css:16-19, 232-240, 407-414`) The default "Loading" text is 2.7:1 contrast (`pane.css:224`). ⌘K's active option is never scrolled into view (`ListDialog.tsx:85-120`).
- **P9. Examples: no axe scan, no console check, no width sweep.** [Opus ×2] None of the five has all three, though the standard requires them. Nested interactive controls in listbox options (Trips Explore, Markets news). The shared grid's `role="grid"` doesn't announce row changes (`shared/src/panes/grid/Grid.tsx:145-183`). **Fix:** one shared e2e fixture (axe per preset and theme, a 360–2200 px sweep, a console guard), used by every example.

**API and architecture**

- **P10. `usePaneState` doesn't keep its first `initial`.** [Opus ×2 · verified by source] (`usePaneState.ts:23`) An object initial is a new value on every render, and Trips' Explore filters change by themselves. **Fix:** `useRef(initial)` for both the read and the write.
- **P11. The pane hooks hold one slot per pane.** [Opus] `useCommands`, `useUnsaved`, `useActivity`, `useTitle` and `usePaneAttributes`: the last caller wins, and any caller unmounting clears the others (`pane/hooks.ts:29-102`). A child unmounting can clear the parent's unsaved guard. **Fix:** register each caller under `useId()` and merge in core.
- **P12. Panes in a scrolling row remount when single view flips or the pane moves into or out of the row.** [Opus] (`Workspace.tsx:367-399`) They lose component state. **Fix:** one flat keyed list, with a persistent host node.
- **P13. Pane state is keyed by pane id alone.** [both] It reattaches to a different object after a reload or an undo (`state/pane-state.ts`, `apply.ts:377-419`). A new list can inherit a closed list's selection. **Fix:** key by id plus object identity.
- **P14. Ref equality is defined four ways, and some depend on JSON key order.** [Opus] (`apply.ts:344-383`, `frames.ts:174`, `ops/ref.ts:5-8`) Loading a layout from Postgres `jsonb` makes every pane look changed. **Fix:** one `sameRef`.
- **P15. The "framework-free" core queries @jali/react's class names.** [Opus] There are 14 couplings: `dividers/drag.ts`, `workspace/dnd.ts`, `dom/focus.ts`. **Fix:** an adapter-provided `DomPort`.
- **P16. The public surface leaks internals.** [Opus] Draft mutators are exported as pure (`layout.tree.remove` mutates). `UrlWriter` exposes the roughly 40-field `UiState`. `@jali/core/adapter` is `export *` over about 45 modules. **Fix:** a curated `tree`, a narrow `UrlState`, an explicit adapter list.
- **P17. URL contract breaks.** [all three core and security reviewers · verified] Peek and `open=` values don't read back as written: `"#123"` came back as `123`, `"!true"` as `true`, and `"a~b"` was dropped (`url.ts:23-48`). A prefixed workspace still deletes the host's `app` and `arr` params (`url.ts:89, 144`). **Fix:** escape text values; move the legacy aliases behind an option.
- **P18. No teardown.** [both] There is no `jali.destroy()`. Deferred follow steps and the URL debounce outlive `stop()`, and can write onto the next route's URL (`state/store.ts:419-436`, `url.ts:297`). Stopping drops pane state that is waiting to be saved (`boot.ts:98, 143`).
- **P19. Server rendering.** [Opus] `HeaderActions` decides on `canPopOut()` during render, which mismatches when `allow.popOut` is on (`HeaderActions.tsx:57-66`). The SSR test added on 20 Nov never hydrates. **Fix:** a stable first render, and a `hydrateRoot` test.

**Examples, against the standard**

- **P20. Each of these is against the standard:**
  - Studio ships a "TEMPORARY comparison switch" for header buttons (`studio/src/ui/headerButtons.ts`).
  - Trips has no type scale: 82 pixel font sizes.
  - Data Studio and Loan review have 93 pixel font sizes, several at 10 px, and name IBM Plex without loading it.
  - Data Studio and Loan review show made-up people without saying so.
  - Data Studio, Loan review and Markets use private `jali-*` classes, and none of the three has a FINDINGS.md.
  - Trips ships a font its README says may not be redistributable, and has no licences folder.
- **P21. Example bugs.** [Opus]
  - Markets:
    - a failed history fetch is retried on every tick (`kraken.ts:308-371`);
    - nothing says when the live feed is down (`connected()` has no callers);
    - Reset forgets saved desks before Jali asks (`TopBar.tsx:30-34`).
  - Data Studio: a chart's `runId` in the link is lost on reload.
  - Loan review: views are bound by a formula copied from the seed generator.
  - Trips:
    - city badges keep an old hotel (`map.tsx:452-464`);
    - a stop drag re-renders every day pane on each pointermove (`ui/drag.ts`).
  - Studio: the transcript draft outlives its session (`transcript.tsx:80-187`).

### P2: polish

- **P22. Core:**
  - The three option bags have drifted: the `keys` docs say `"workspace"`, but the type is `"page" | "scoped"` (`create-jali.ts:78`).
  - Input tracking is a module-global refcount that ignores the PiP document (`dom/input.ts:20-73`).
  - A one-tab stack crashes hide and unmerge (Codex F11).
  - A host event handler can suppress the layout event (Codex F9).
  - A folded divider checks resize permission against the wrong panes (Codex F10).
  - Public getters return live, writable snapshots (Codex F16).
- **P23. React:**
  - `PaneBody`'s memo lists node fields by hand (`PaneBody.tsx:140-148`).
  - Tab measuring re-creates its ResizeObservers on every render (`TabIndicator.tsx:13-43`).
  - The reshape animates `left`, `top`, `width` and `height`, and copies its timings and sizes from CSS into TS.
  - `data-pressed` misses several of Jali's own controls.
  - Pop out doesn't follow theme or token changes.
  - The hook error message names internal components.
  - An inline `icons={{…}}` re-renders every icon consumer.
- **P24. Docs:**
  - Draft pages are reachable through 404.html (`site/pages.ts:17`).
  - The breadcrumb's middle item has no URL.
  - The head is updated only partly on in-place navigation.
  - There are two frontmatter parsers.
  - Link interception catches asset links and drops query strings.
  - Duplicate SVG ids.
  - The heading anchors' labels are read as part of each heading.
  - Three GIFs of about 0.9 MB each, loaded eagerly.
  - Dead code: `MarkdownView`, `rawText`, `shell/home.tsx`.
  - From Codex: search misses reference entries; the package-manager tabs point at panels that don't exist; the footer advertises an agent index that isn't built; the Quickstart preview isn't the tutorial's app.
- **P25. Examples:**
  - Store and theme code is copied between examples.
  - Three different "is the person typing?" rules exist; Jali could offer `when: "not-typing"`.
  - `waitForTimeout` sleeps in the tests.
  - Non-null `!` on data from links and storage.
  - Per-frame allocations in the Studio meters.
  - Studio's three sessions (335 KB of JSON) are bundled eagerly.
- **P26. Repo:** run `vp fmt` and add a format check to the gates; make the example e2e configs refuse a server they didn't start.

## Suggested order of work

Each line is one small, focused commit, or a short series of them.

1. **One input layer in core:** ids, refs, settings, sizes and page links checked in one place, plus null-prototype records (C1–C7, P17). Add a "hostile input" test suite.
2. **Intents that wait are re-checked when they land:** discard, `beforeClose`, Back, and the viewer downgrade (C8–C10).
3. **Docs hydration bug and hash crash:** C14, C15, plus a test against the built site that fails on console errors.
4. **Fitting performance,** with a work-budget test (P1).
5. **Keyboard and focus primitives:** a roving tablist, a modal dialog and a menu (P5–P8).
6. **Subscription narrowing,** with render-count tests (P2), and a size review (P3).
7. **The `usePaneState` and pane-hook semantics** (P10, P11, P13).
8. **Examples:** the shared e2e fixture first (P9), then each example's P0 and P20 items. Each of these files belongs to the example's own session.
9. **Docs islands rewrite** (P4).
10. **Cleanups:** format the repo, and fix the docs dev server for Playwright (`astro dev` runs in the background without a terminal; start it with a TTY or run tests against `astro preview`).

## What to keep

- `apply()`: the POLICY table, typed `Change`/`Refusal`, geometry classes with a development-time stability check.
- The pure layout engine, with purity tests on frozen inputs; and the `?l=` codec, with canonical base64url checks, size and depth limits and one `validate` schema.
- Ports for location and storage, with memory versions; events batched per commit with their input source.
- The divider (an APG splitter; rAF with direct DOM writes and one commit) and scroll strips on the compositor: measured at 2 commits for a 60-move drag.
- Pane isolation (an error boundary and Suspense per pane, Retry in ⌘K, `Missing` before the component runs); the tested parts contract; tokens set once with `light-dark()` in a cascade layer.
- In the examples: Markets' injectable `MarketData` seam and `useTopic(topic, paused)`; Studio's engine outside the panes; Trips' respect for `paused`; careful SQL quoting; honest FINDINGS files where they exist.

## Not covered

- **Codex lanes:** the Codex React and example lanes stopped at the usage limit, which resets at 12:31. The Codex security lane was refused by OpenAI's filter. Those areas had one reviewer.
- **Dependency CVEs:** not checked; there was no network audit.
- **Screen readers:** the screen-reader findings (P5, P6, P9) were derived from the markup, not tried with VoiceOver or NVDA.
- **The other Codex core findings:** Codex reproduced C8–C10 and P13; I didn't run those four again.
