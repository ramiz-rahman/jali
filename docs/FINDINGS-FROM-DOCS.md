# What writing the docs found in the packages

19 Nov 2026. The docs agents checked every claim against the code; these are the places the code was wrong, awkward or unclear. To fix in a packages pass after the docs land. File and line are as of commit 99ba5cb.

## Bugs
1. **⌘K chords never finish when keys are scoped to a root.** The palette renders outside the root (`packages/react/src/Jali.tsx:36-38`), so the scoped handler rejects the second key (`packages/core/src/commands/keyboard.ts:152-157`). Reproduced in Chrome with two workspaces.
2. **Two workspaces share dialog ids:** `ConfirmDiscard` uses fixed `confirm-title` / `confirm-body` (`packages/react/src/dialogs/ConfirmDiscard.tsx:26-32`). Check the palette, chooser and settings too.
3. **Both defaults save under `browserStorage("jali")`** (`state/store.ts:190`, `url.ts:186`): two stores overwrite each other's settings and pane state unless the host passes storage.
4. Done 19 Nov: the store option `launcher` (default "launcher") names the kind; without it split and "New tab here" are refused and tab strips hide "+". ~~**Split and "+" need a kind named "launcher".** `LAUNCHER` is hard-coded (`core/src/actions/open.ts:12`, used at :74, :121; `layout/ops/tabs.ts:40`); without it ⌘\ throws "Unknown pane kind" (examples/minimal does this). The launcher should be an option (or the commands refuse when there is none).~~
5. Done 19 Nov: opening a row that a detail of the same list already shows (pinned, no follower) reveals that detail and keeps focus in the list. ~~**"Never a second copy of a row" doesn't hold:** with a pinned detail showing row X, opening X again from the list makes a new follower showing X (`follower()` is undefined). Contradicts DECISIONS (18 Nov).~~
6. Resolved 19 Nov: ⇧⌘↵ stays (founder); DECISIONS updated.
7. Done 19 Nov: the port reads the latest mapping through a ref and stays one object per pane. ~~**`useActiveItemPort` keeps the first mapping:** `useMemo` deps leave out `mapping` (`react/src/pane/useActiveItemPort.ts:14`).~~
8. Done 19 Nov: the derived tints are also declared on `.jali-scrim`, so dialogs pick up an accent set around `<Jali>`. ~~**Per-workspace accent misses the dialogs:** derived tints are on `:root, [data-jali]` only, the comment says "and dialog", and dialogs render outside `[data-jali]` (`jali-theme.css`).~~

## The start-up story for more than one workspace
9. **`startUi` can't be scoped** (`core/src/boot.ts:81` calls `installKeyboard(store)` with no root), so a second workspace loses settings and pane-state saving, theme, the leave-page prompt and `applyTokens`. `savePaneState`'s key isn't public.
10. **`startUi` writes `data-theme` on `<html>`** and overrides a host's own `.light` / theme toggle (`state/settings.ts` `applyTheme`, `boot.ts:61`). Theme should be opt-in for a host with its own.
11. **`applyTokens` sets unprefixed variables on `<html>`** (`--gap`, `--topbar-h`, `--status-h`, `--switcher-h`; `core/src/tokens.ts:10-15`), and two of them are the lab's bars. Prefix them, scope to the root, drop the lab's.
12. **`KeyboardScope.root` is `() => Element | null` but `store.dom.root()` is `ParentNode`** (`keyboard.ts:141`, `state/store.ts:150`).

## API shape
13. Done 19 Nov: item ids are `ItemId` (`string | number`); `ProfileBase` and `WorkspaceProfile` take the id type; a link's item comes back in the type of `firstItem`, so numeric profiles are unchanged. ~~**Items are numbers:** `ProfileBase.firstItem`, `build(item: number)`, `bind(item: number)`, `Rail`/`Header` props. UUIDs and slugs don't fit.~~
14. Done 19 Nov: a store with a `profile` and no presets or layout starts on its page; leaving it is refused. ~~**A page-only app still needs a preset or `initial.layout`** (`state/store.ts:180`) and has to open its page by hand after `boot`.~~
15. Done 19 Nov: `StackNode.origin` is optional; validate and the codec accept a stack without it. ~~**`StackNode.origin: "user"` is required** for hand-written stacks (`layout/types.ts:46`).~~
16. Done 19 Nov: `PaneKindBase.ref` is optional (docs say Jali never calls it). ~~**A kind's `ref` builder is required and never called.**~~
17. Done 19 Nov: the pane host clears unsaved work when the content unmounts (or the kind changes); the lab and the docs samples drop their cleanup effect. ~~**Unsaved-work cleanup is boilerplate:** every pane calls `setUnsaved(null)` on unmount; the pane host could clear it.~~
18. **Hosts can't bind keys to their own commands** though `KeymapOverrides` says they "may be bound too" (`keymap.ts:47`; `run()` only finds registry commands).
19. **Parts take no `className`**, so the README's "a utility class on a part is enough" is not true; layered CSS rules on the jali-* classes are the way. Fix the README (or let parts take classes).
20. Done 19 Nov: documented in `<Jali>` (its comment and reference page): the shelf and a toaster are the host's. A minimal built-in toaster is deferred. ~~**The shelf and toasts are the host's job:** `<JaliView>` renders no shelf and no toaster, and Undo lives only in a toast. A minimal app gets neither. Consider shipping both (a minimal toaster) or saying it in `<Jali>`.~~

## Text
21. Done 19 Nov: `define.ts` no longer names lab paths. ~~`react/src/define.ts:15,25` points at lab paths (`src/data/react`, `ui/pane/usePaneState`).~~
22. Done 19 Nov: the comment imports `@jali/react/…`. ~~`react/src/styles/jali-tailwind.css:4-6` imports `"jali/react/…"`; should be `"@jali/react/…"`.~~
23. ~~`jali-theme.css` defaults are cool zinc~~ Done 19 Nov: stone is the default (founder).
24. Done 19 Nov: the layer order is a `<style>` in `index.html`, before any stylesheet; the example registers a launcher kind, so Split works (checked in Chrome). ~~`examples/minimal` declares its layer order after Jali's CSS loads (`app.css:1`), so it teaches the wrong order.~~

## From the live parts and the reference
25. **Mounting a workspace pulls page focus into it** when focus is on the body (`core/src/dom/focus.ts:35`, `keepPaneFocus` from `Workspace.tsx`). A docs page with three workspaces, or a host with a workspace below the fold, loses its place. Only move focus for a change the person made.
26. Done 19 Nov: a negative width or height is clamped to zero in `resolve` and `refit`. ~~**`refit` throws a RangeError on a negative width** (`core/src/layout/fit/context.ts:9`); clamp instead.~~
27. **The shelf's phone rule needs the host's root to have the class `.app`** (`react/src/styles/shelf.css:37`), and the single view reads `--switcher-h`, which only `applyTokens` sets (see 11).
28. **`GAP` isn't exported**, so an outside measure (the docs' Frame) hard-codes 6.
29. **`FollowControl` crowds out the pane title** near 200px ("O…" for Orders); hide its word below ~250px (a container query on `.jali-pane`).
30. **The tab strip cuts off the first tab** in narrow tabbed panes ("ders"; `TabStrip.tsx` `revealTab` and the edge fade).
31. Done 19 Nov: a drag scales the weights it sets to average 1 (exact proportions, no rounding, so geometry is unchanged). ~~**A divider drag leaves sizes as weights equal to pixels** (`{ weight: 209 }`). Correct, but odd beside `weight 1.3`; consider normalising on commit.~~
32. Done 19 Nov: both files are in `@layer jali`; a host token in a later layer wins (e2e). ~~**`jali-theme.css` and `jali-tailwind.css` are not in the `jali` layer**, though the README says all styles are; a host setting `--jali-*` inside its own layer loses to them.~~
33. Done 19 Nov: dialogs and menus now read `--jali-surface-raised`; `--jali-font` is read since finding 38; `--jali-brand`, `--jali-done`, `--jali-accent-soft` and `--jali-shadow-raised` stay as palette tokens for the host (the lab and the docs read them), and the tokens page says so. ~~**Six public tokens nothing reads:** `--jali-brand`, `--jali-done`, `--jali-surface-raised`, `--jali-shadow-raised`, `--jali-accent-soft`, `--jali-font` (the workspace never sets `font-family`). Use them or drop them.~~
34. **Public signatures use unexported types:** `DndState`, `ConfirmState`, `ChooserState`, `PagePrefs`, `UndoEntry`, `Change`, `OpenPage`, `Group`, `ShelfEntry`, `Chord`, `KeySequence`, `ResolvedStack`.
35. Done 19 Nov: `HideRefusal` is `"missing" | "hidden" | "last"`. ~~**`HideRefusal` includes `"tab"`, which `hide`/`show` never return** (`layout/types.ts:100`).~~
36. Done 19 Nov: `Settings.showStats` is gone; `<Jali settingsExtra>` adds a host's own fieldsets to the panel, and the lab keeps "Show fetch stats" there in its own storage. ~~**`Settings.showStats` is the lab's** (`state/settings.ts:9`, `dialogs/Settings.tsx`).~~
37. Done 19 Nov: comments fixed and old paths replaced; the `pane.undo_close` title is now "Undo last close or tuck". ~~**Stale or wrong comments:** `Shelf.tsx:20` (also renders for folded panes), `usePaneState.ts:3` (also dropped when the pane shows another object), `profile.ts:44` (`?app=review` is the old form), `registry.ts:63` ("Restore last closed pane" also undoes close-others and tucks), and old `ui/…` / `layout-core/…` paths in `pane-kinds.ts:3,44`, `store.ts:24,76`, `url.ts:2,160`, `contracts/active-item.ts:6`, `pane/activeItem.ts:6`, `react/src/state/react.tsx:13`.~~

38. Done 19 Nov: **Jali's default font is the lab's:** `jali-theme.css` sets `--jali-font: "IBM Plex Sans", …` and `--jali-font-mono: "IBM Plex Mono", …`. Jali is its own identity: its defaults should be the Atkinson Hyperlegible family (Next and Mono), with system fallbacks, and the lab sets Plex for itself.
39. **Hidden header buttons still take room:** maximise and tuck are `opacity: 0` on unfocused panes (`react/src/styles/pane.css`), so a 230px pane cuts its title to "Order 1…". Collapse them instead.
40. **Icons: switch from Lucide to Phosphor** (founder, 19 Nov), to match Chakni (`@phosphor-icons/react`, a peer dependency there). Covers `@jali/react` (about 13 files, `lucide-react` dependency), the docs site and the live parts, and the default kind icon.
