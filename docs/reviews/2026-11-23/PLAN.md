# Stabilisation round: the plan (23 Nov 2026)

Approved by the owner, 23 Nov 2026, after an interview that settled each decision below one at a time. This round makes
Jali's architecture and API stable. CI, repository metadata and versioning start after it. Work happens on branch
`stabilise` (worktree `.claude/worktrees/stabilise`), because other sessions are editing examples in the main
checkout. The owner reviews once, when everything is done.

## Done means

1. The cuts are made, and every public name is used by a consumer. The examples alone cover the API (including their
   tests); real Data Studio is an extra witness. The research portal is an internal test product that migrates later.
2. Every confirmed finding below is fixed at its root cause, each with a test that follows the action to its next
   observable consequence (Keep editing, then close again; remove, then undo; write an address, then reopen it in a fresh
   instance), not only its immediate result.
3. `pnpm verify` passes in Chrome and WebKit, including the examples' own WebKit failures.
4. Real Data Studio (`~/Projects/Sixface-Initiate/sixface/products/data-studio/code/data-studio`, branch
   `jali-integration`) builds, and its typecheck, unit tests and lint pass on the result.
5. A fresh review by Opus and by Codex finds no P0 or P1.

## The findings this round fixes

Each was reproduced (R) or confirmed in the code (C) on 23 Nov 2026 at 350b4845.

| Id       | Finding                                                                                                                                                                                                                                             | Status |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1-1     | A pane id `__proto__`: `out[id] = …` in state/reports.ts hits the prototype setter, so its unsaved report vanishes and `close("__proto__")` succeeds without asking.                                                                                | R      |
| A1-2     | Rename binds to the pane slot: rename object 1, `openHere(pane, object2)`, press Enter, and `rename.run` gets object 2 with the text typed for object 1 (`renaming` is never cleared when the pane's object changes; `save` reads the current ref). | C      |
| A1-3     | A tab menu's closures capture the tab's index (`at`) and `!node.pinned` when it opens: open B's menu in [A, B, C], move B to [B, A, C], choose Move right, get [A, C, B].                                                                           | C      |
| A1-4     | `useHeaderActions`: every caller's cleanup clears the pane's one slot (`header?.set(null)`), so unmounting contributor A removes contributor B's controls.                                                                                          | C      |
| A1-5     | The root's and the dialogs' error boundaries sit outside `InstanceScope`: after `<JaliRoot jali={b}>` replaces `a`, b shows a's failure until Retry. A crashed dialog renders nothing but stays open in state, hiding later dialogs.                | C      |
| A2-1     | `beforeClose` saves pane state on B, reports B unsaved and returns true: the discard question opens, but the draft and the unsaved mark are already gone (`whole()` in state/apply.ts restores the whole state from before the step).               | R      |
| A2-2     | Two tabs writing the same pane's state in the same millisecond: the timestamp doubles as revision identity, so the newer draft is skipped and later deleted (state/pane-state.ts:173, 181, 198).                                                    | C      |
| A2-3     | `beforeClose` calls `jali.destroy()` and returns true: `close("b")` still succeeds and emits a close event. With an unresolved promise, `settled` never resolves.                                                                                   | R      |
| A2-4     | On a curated page, `peek.open_full` is enabled in ⌘K and replaces every role with one pane while the page stays active (`openPeekFull` has no page rule).                                                                                           | C      |
| A2-5     | Close B, `remove("c")`, Undo: both come back (undo entries hold whole layouts). Also: "Back to page" restores an old snapshot, which can undo role edits.                                                                                           | R      |
| UNDO     | Undo of a close discards everything since: close B, open a pane, pin C, Undo: B is back, the opened pane is gone and C is unpinned.                                                                                                                 | R      |
| URL-1    | Peek, then Open beside: history keeps one entry, and it is not the address from before the peek; Back can't return.                                                                                                                                 | R      |
| URL-2    | A broken link whose fallback preset needs async close approval writes the address before the approval settles.                                                                                                                                      | —      |
| URL-3    | Links written that the reader rejects: a page writes every opened pane but reads 32 (`OPEN_MAX`); boot publishes a layout of any length.                                                                                                            | C      |
| AGENT    | An agent turn reports `ok: true` when its automatic arrange failed; a close finished through the discard question reports `input: "code"`.                                                                                                          | R      |
| INGRESS  | `jali.actions.peek("a", ref)` keeps the caller's object: changing `ref.params.id` afterwards changes Jali's state with no notification.                                                                                                             | R      |
| SAFARI-1 | Safari's Tab skips buttons by default, so Tab leaves the Settings dialog and the discard question (e2e/axe.spec.ts, WebKit).                                                                                                                        | R      |
| SAFARI-2 | Safari doesn't focus a clicked button: after a mouse-opened ⋯ menu, Escape returns focus to nothing (e2e/pane-menu.spec.ts, WebKit). The same applies to dialogs opened from the host's own buttons.                                                | R      |
| SAFARI-3 | A long drag makes more than 100 history writes in 10 s (edge scroll writes the scroll position about 10 times a second); Safari throws `SecurityError` uncaught from ports.ts:49, mid-commit (Trips' drag tests, WebKit).                           | R      |

The examples' own WebKit failures: Trips' map worker doesn't load in WebKit under the Vite dev server ("Worker failed to
load"); Studio's pan dial lands on 34 instead of 32; the docs site's 404 test sees console errors, its copy-button test
calls `grantPermissions(["clipboard-write"])` (WebKit has none), and its permalink test tabs to links (Safari reaches
links with Option+Tab).

## Decisions

### The cuts (step 1)

- **The agent bridge leaves the package** (`jali/agent`, packages/core/src/agent.ts and its docs reference). The guide
  becomes a short docs recipe on `jali.model()` and `jali.actions`.
- **Kept:** folding-screen support (Codex checked it in Chrome DevTools' Surface Duo emulation on Trips: panes sit each
  side of the hinge in both orientations, and unspanning restores the layout).
- **Peek "Open full" is cut:** the sheet's button, the `peek.open_full` command and the `openPeekFull` step.
- **The active-item port is cut** (`ActiveItemPort`, `activeItemPort`, `useActiveItemPort`, contracts/active-item.ts).
  Consumers call `select(ref)` and `peek(ref)`, as Markets' watchlist does.
- **Live sync of pane state between tabs is cut:** the `merge` on storage events, the revision bookkeeping and
  `StoragePort.subscribe`. Persistence across reloads stays, with merge-on-write so two tabs never erase each other's
  records; the last write wins per pane.
- **Names with no consumer benefit are cut:** `toLayout`, `browserLocation`, `browserStorage`, `commandsOf`,
  `DEFAULT_KEYMAP`, `formatKeys`, `GAP`, `shallow`, `CuratedPage` (from the public API), `useJaliIcons`, `pressKeys`,
  `defaultIcons` and the `jali/icons` entry, and the options `inset` and `onUnstable`. `onPaneError` stays and is wired
  into Data Studio.
- **`linkSearch` is cut.** "Links are real links" is the first feature after this round.
- **`useJaliCommands` is cut**; see step 7 for `listCommands`.
- **The viewer role is the app's:** `linkMode` (option, state, `page.setLinkMode`), profile `viewers`, the "View as…"
  commands and their words go. Jali has one host-owned permission mechanism, `allow`, and its own UI never lets a person
  change what they may do. Loan review keeps its two personas as a switch in its own demo UI.
- **`allow` gains one control, `open`:** off, following a link never opens a pane; it shows a peek instead. Per
  instance, per kind or by `when`; the same in the free layout and on a page; the chrome hides Open beside where it is
  off. Split view is no longer tied to it. A `splitView` control is added only when a consumer needs it.
- **Peek leaves the address entirely:** no `peek` param in layout or page links. Reload closes a peek. Zoom and scroll
  stay in the address.

### The commit model (step 2)

- **An action is a proposal until it commits.** A hold or a refusal discards it; nothing needs putting back. Writes
  others make meanwhile (pane reports, pane state, the host's own actions inside `beforeClose`) are their own commits
  and always stay. When the answer comes, the action is recomputed against the state then; it asks again if it would now
  lose different work; if the instance was destroyed meanwhile, it is refused as `unavailable` and nothing is written,
  announced or sent as an event.
- **One history decision per action**, written once after it commits, from the final state. The mode is the strongest
  of its parts (push > replace > debounce > none). A held action writes nothing until it commits; Keep editing writes
  nothing.
- **History writes:** nothing during a gesture (pane or divider drag, edge scrolling); written once when it ends.
  Replaces coalesced to at most one per 250 ms, the latest winning; a push writes at once, after flushing a waiting
  replace, so nothing is lost or reordered. A write the browser refuses is caught: the address lags, the action still
  succeeds, one development warning.

### Undo (step 3)

- **Undo reverses the operation; it never restores an old layout.** Undoing a close returns the pane to its slot (same
  parent, position, size and tab group if it still exists), with its pane state; failing that, beside the neighbour it
  had; failing that, at the end. Close others: each pane the same way. Everything done since survives. Entries for an
  object the host removed (`remove`) or one already open again are dropped. "Back to …" on a curated page closes the
  panes the investigation opened instead of restoring a snapshot. Undo still covers closes and tucks only.

### Each rule in one place (step 4)

- **A step owns its check:** a step is `{ control?, check, run }`, and the store always runs `check` and `allow` for its
  `control` before `run`. Commands, header buttons, menus and the agent recipe ask the step's check by name. The
  `checkX` helpers, the 28 command-level checks and `also(check, control)` disappear into the steps. A refusal only
  known after computing still comes back typed when the action runs.
- **One encoder writes every address**, and never one the reader would reject. One module holds the limits (nodes,
  depth, text length, a page's opened panes), used by writer and reader. An action past a limit is refused `blocked`,
  including a curated page's 33rd opened pane. At boot, an oversized starting layout opens, but no unreadable address is
  written (development warning). Text limits apply only when the instance writes an address. Fuzz invariant: every
  address Jali writes reopens identically in a fresh instance.

### Ownership and safe ids (step 5)

- **Unsafe ids are rejected where ids enter:** layout validation and `pane()` refuse `__proto__`, `constructor` and
  `prototype` (a development error, `invalid` from `setLayout`; a link with one is unreadable and opens the fallback).
  Reads stay on `own()`.
- **A rename belongs to its object:** rename state is `{ pane, object }`; the core ends it when that pane's object
  changes (the field closes, the text is dropped, focus returns to the pane). Save calls `rename.run` with the object
  the session started on.
- **Header controls belong to whoever registered them:** each `useHeaderActions` call registers under its own owner; the
  latest-mounted contributor's controls show; unmounting releases only its own, and the previous contributor's show
  again.
- **Menus show a snapshot and run an intent:** the display is what was true when it opened; each item runs as an intent
  worked out when chosen ("Move right" is `moveTabToward(id, "right")`; Pin and Unpin set a value, never toggle). A stale
  intent is refused, typed. This covers every Jali menu and app `tabMenu` items (given the pane id at run time).
- **Boundaries:** every boundary Jali renders resets when the instance changes; the host's healthy children stay
  mounted. A dialog that crashes closes itself through its close step and reports to `onError`. Panes are unchanged.
- **Ingress:** refs, params and layouts are copied where they enter (`run()`, `createJali`, `setLayout`). In
  development, what Jali keeps and hands back is frozen.

### Safari (step 6)

- **Focus never leaves an open dialog:** a guard sends it back inside; Tab follows Safari's setting; Option+Tab reaches
  every button. The WebKit test checks Tab and Shift+Tab never leave and Option+Tab reaches the buttons.
- **Focus returns to what was pressed:** Jali's menus take the opener from the event; for dialogs opened from host code,
  Jali remembers the last pressed element per document and uses it when focus isn't on a control.

### The API (step 7)

- **A designed read API:** `jali.get()` returns its own `JaliState` (roughly: layout, page, view { focused, zoomed },
  presetId, selection, settings, unsaved, activity); `jali.model()` returns its own `JaliModel` (panes with id, ref,
  title, `where`: "shown" | "tab" | "folded" | "tucked" | "hidden", focused, box; `pane(id)`; `paneOf(ref)`); and
  `jali.presets` ([{ id, label }]). `jali.env` leaves the public type; the geometry tree, groups and context move behind
  `jali/adapter`. Settle the exact fields from what consumers read.
- **`listCommands(jali)` returns the same array until something it lists changes,** compared on each read (not cached by
  state identity: an app's commands can read the app's data). Hosts write
  `useSyncExternalStore(jali.subscribe, () => listCommands(jali))`.
- **A `consumers` gate in `pnpm verify`:** every runtime value each `jali` entry exports, every `createJali` option and
  every pane-kind option is used by an in-repo consumer (the examples, their tests included). The examples alone cover
  the API: names only real Data Studio uses today (`beforeClose`, `confirmDiscard`, `tabMenu`, `messages`, …) get a home
  in an example. Real Data Studio is read as an extra witness when its checkout is present. Exported types must be
  consumer-used or reachable from a public signature. No allowlist. The docs site and Jali's own tests are not
  consumers.

### Size (step 8)

- No hard target this round. After the cuts, ratchet the size budgets to what ships (about 5% headroom) and add
  Dockview, FlexLayout, react-mosaic and react-resizable-panels to the size harness, each as a minimal app. A hard target
  is set at the start of the next round from those numbers.

## The steps

0. Licence, WebKit in every Playwright config, the three WebKit test fixes, this plan.
1. The cuts.
2. The commit model, history decision and history writes.
3. Undo reverses the operation.
4. A step owns its check; one link encoder.
5. Safe ids, rename, header controls, menus, boundaries, ingress.
6. The Safari focus fixes.
7. The designed read API, a stable `listCommands`, the consumer gate.
8. The examples' WebKit failures, real Data Studio, size budgets and peers, the two-reviewer pass.

## How the work lands

- One branch, `stabilise`, small commits in the repository's style ("Area: sentence", a body that says why), one decision
  per commit. For a finding, the test that follows the action to its next consequence comes first, failing, then the fix.
- Each step adds its entry to docs/DECISIONS.md and its moves to docs/MIGRATION.md, and updates the docs pages and the
  installed docs (`pnpm agent-docs`), since every code sample on the site typechecks.
- Real Data Studio gets matching commits on `jali-integration` ("Jali stabilise N: …"), checked with its own typecheck,
  unit tests and lint. Nothing is pushed.
- After this round: real links (`<PaneLink to={ref}>`, its href the address the click would lead to, built on the steps'
  checks), then a hard size target, then CI and versioning.
