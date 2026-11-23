# Migrating to the stabilisation cuts (23 Nov 2026, step 1a)

Names and behaviours that go. Each row says what to use instead. The examples used none of them, except that `examples/own-icons` dropped its `openFull` icon.

## `jali`

| Before                                                                                                                    | After                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `jali/agent` (`createAgent`, `AGENT_ACTIONS` and the `Agent*` types)                                                      | write two tools of your own over `jali.model()` and `jali.actions` ([Let an agent arrange panes](/guides/agents)); `input: "code"` on events |
| `activeItemPort(jali, pane, mapping)`, `ActiveItemPort`, `ActiveItemAction`, `ActiveItemWriteResult`, `ActiveItemMapping` | `select(ref)` reports a list's current item; `peek(ref)` shows it in the sheet                                                               |
| `linkSearch(link, options)`, `JaliLink`, `PageLink`, `LayoutLink`, `LinkSearchOptions`                                    | none for now: copy the address with `copyLink(jali)` or `jali.href`; real links (`<PaneLink>`) are the next feature                          |
| `commandsOf(jali)`                                                                                                        | `listCommands(jali)` for what a person can run now; `commandDefsOf` in `jali/adapter` for the whole table                                    |
| `formatKeys(seq, platform, words)`                                                                                        | `jali.keymap.format(seq)`, or `keyHint("Mod+K", platform, words)` for a binding string                                                       |
| `DEFAULT_KEYMAP`                                                                                                          | `jali.keymap.sequences(id)` for an instance's bindings; the table is in `jali/adapter`                                                       |
| `GAP`                                                                                                                     | `jali.env.spacing.gap` (6 by default); `jali/adapter` still exports `GAP`                                                                    |
| `toLayout(input)`                                                                                                         | everything that takes a layout takes a builder's result; `jali/adapter` still exports `toLayout`                                             |
| `browserLocation()`, `browserStorage(prefix)`                                                                             | the defaults of `url` and `storage` (`storage: "prefix"` is the same as `browserStorage("prefix")`); `jali/adapter` still exports them       |
| `StoragePort.subscribe`                                                                                                   | removed: a port has `get`, `set` and an optional `remove`                                                                                    |
| `createJali({ inset })`                                                                                                   | removed: the inset is the gap (`createJali({ gap })`); `--jali-inset` equals `--jali-gap`                                                    |
| `createJali({ onUnstable })`                                                                                              | removed: development still reports it through `console.error` (`Layout stability: "<op>" …`)                                                 |

## `jali/react`

| Before                                  | After                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `useActiveItemPort(mapping)`            | `select(ref)` and `peek(ref)` from the pane                                                         |
| `useJaliCommands()`                     | `listCommands(jali)`, read again in an effect on `jali.subscribe` (see the Commands and keys guide) |
| `useJaliIcons()`                        | none: draw your own chrome with your own icons                                                      |
| `shallow`                               | an equality function of your own (`useJaliState(select, isEqual)`)                                  |
| `CuratedPage`                           | `<JaliView />` draws the page                                                                       |
| the icon name `openFull` in `JaliIcons` | removed with the button; delete it from a complete icon map                                         |

## Other entries

| Before                        | After                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `jali/icons` (`defaultIcons`) | removed: give `<JaliRoot icons>` the icons you want; a part of the set is enough      |
| `jali/testing`: `pressKeys`   | dispatch `keydown` events on the document (`fireEvent.keyDown`, `userEvent.keyboard`) |

## Behaviour

| Before                                                                  | After                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| the peek sheet had **Open full**; `peek.open_full` was in ⌘K            | removed with `jali.actions.openPeekFull`; **Open beside** keeps the peeked object                                    |
| a draft typed in one tab appeared in another tab showing the same pane  | not while it runs: a tab reads what others saved when it starts. Writes still merge and the last write wins per pane |
| a pane closed for good kept its record if another tab had written since | deleted while the stored record is still for the same object; a record for another object stays                      |
| the `jali-inset` could differ from the gap                              | always equal                                                                                                         |

# Migrating to the React architecture pass (23 Nov 2026)

Apps change nothing: `jali`, `jali/react` and the features keep every name. What changes is in `jali/adapter`, for people writing an adapter, and a few behaviours. Data Studio uses none of the names below (checked by search over its whole repo, 23 Nov 2026).

| Before                                                                                                             | After                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jali/adapter`: `restoreWide`, `snapshotWide`, `WideSnapshot`; the adapter froze and restored the wide arrangement | removed: one pane at a time is the core's. Report what you measure with `store.measure({ area, dir, hinge })`                                                                   |
| `<JaliRoot jali>` given another instance kept Jali's parts mounted                                                 | they mount again (their state starts over); your own children around `<JaliView>` stay mounted                                                                                  |
| a rename save that settled after another pane's field opened closed that field                                     | it ends only its own field; the adapter step is `endRename(pane)`                                                                                                               |
| a key bound to `palette.toggle` without `palette()` set the palette open                                           | it opens nothing (`dialogs.openPalette` is refused as `"unavailable"`)                                                                                                          |
| `Model.shelf: ShelfEntry[]`                                                                                        | `TuckedEntry[]` (the shelf never held folded panes); the shelf's folded chip and `.jali-shelf-chip.is-folded` styles go                                                         |
| `frames`, `currentPane`, `defaultStackShare` took a `Model`                                                        | they take `ModelGeometry` (the model without titles); a `Model` still fits                                                                                                      |
| `JaliDom` knew the root and the dialog layer                                                                       | also surfaces: `addSurface`, `isOwn`, `contains`, `eachSurface` (an adapter with its own `JaliDom` adds them)                                                                   |
| new in `jali/adapter`                                                                                              | `JaliStore.measure`, `Measurement`, `paneMenuOf`, `appMenuOf`, `PaneMenuId`, `PaneMenuItem`, `topDialog`, `DialogName`, `ModelGeometry`, `TuckedEntry`; the `closeChooser` step |

# Migrating to the core review fixes (23 Nov 2026)

Behaviour changes only: nothing is removed or renamed.

| Before                                                                                      | After                                                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| an action run inside a synchronous `beforeClose` landed at once, then could be written over | it waits for the change being decided, then runs: it returns `"pending"`, and `settled` says how it went |
| unsaved work reported inside `beforeClose` was not asked about                              | it is asked about ("Discard unsaved changes?"), unless `confirmDiscard: false`                           |
| `on("toast")` heard a toast before the change's other events                                | after them: close, open, pin, focus, layout, then toasts                                                 |
| a subscriber that threw made the action throw                                               | it is reported with `console.error`; the action returns what it did                                      |
| a preset or Reset layout chosen on a curated page left the page open                        | the page closes, as `page.leave` and `setLayout` do; its undo steps go with it                           |
| `runCommand` returned true whenever a command's check passed                                | it returns the action's answer: false for a refusal or after `destroy()`                                 |
| an agent step with `args` that aren't a list ran with none                                  | refused as `"invalid"`                                                                                   |
| a change whose layout text a link couldn't read back was made                               | refused as `"blocked"` (with URL sync)                                                                   |
| `jali/adapter`: `CommandDef.run` returned `void`                                            | it may return the action's result; `JaliStore.ended()`, `UrlWriter.linkText` are new                     |

# Migrating to the core architecture pass (22 Nov 2026)

The core review's fixes change a few public contracts. None of them is used by Data Studio's `packages/workbench/src` (checked by search, 22 Nov 2026: its `identity` functions return text, and it calls neither `linkSearch` nor anything in `jali/adapter`).

## `jali`

| Before                                                                              | After                                                                                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `linkSearch(link)`, `linkSearch(link, { prefix })`                                  | `linkSearch(link, { panes })`, `linkSearch(link, { panes, prefix })`: the kinds are required, and a ref of a kind they lack throws |
| `jali.get().page.linkMode`                                                          | `jali.get().linkMode` (kept while no page is open)                                                                                 |
| `jali.get().activity[id]` is `"idle"` once the last component reporting it unmounts | no entry: a pane nothing reports an activity for is idle                                                                           |
| `identity: (params) => unknown`                                                     | `identity: (params) => Identity \| undefined` (any JSON value); one JSON can't write falls back to the params                      |
| a Standard Schema may give back any value                                           | its output must still be params (text, numbers, flags); anything else is a problem of that param                                   |
| `jali.actions.split(pane)` on a curated page split it                               | refused as `"unavailable"`, as the tab menu already showed                                                                         |
| an argument of the wrong type reached the step                                      | refused as `"invalid"` before anything happens                                                                                     |
| a multi-step action could land part way                                             | all or nothing: a refusal or a question puts back what came before it                                                              |

## `jali/adapter`

| Before                                                                                          | After                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partOf<T>(env, name)`                                                                          | `partsReader<YourParts>()` gives a typed reader for the parts your adapter gave its features; the core's own services are read with `serviceOf(env, "popOutWindow")` |
| Pop out's window in `Feature.parts.popOutWindow`                                                | `Feature.services.popOutWindow`                                                                                                                                      |
| `shortcutLabel(store, id)`                                                                      | `store.keymap.label(id)`                                                                                                                                             |
| `layout.tree.parentOf`                                                                          | `layout.tree.parent`                                                                                                                                                 |
| `ApplyIO` without `restore`                                                                     | `ApplyIO.restore(state)`: puts back a state the commit read                                                                                                          |
| `PageEngine.goToRole`, `investigation`, `placeAfterArrangement`, `settleRoles`, `withoutOpened` | `PageEngine.opening`, `leaving`, `prefsToSave` (the rest is the page's own)                                                                                          |
| `PageState.linkMode`                                                                            | `UiState.linkMode`                                                                                                                                                   |
|                                                                                                 | New: `each(...)`, `isChange`, `serviceOf`, `partsReader`, `store.gesture(cancel)`                                                                                    |

# Migrating to the API of phase 3c

Phase 3c is the last naming pass before 1.0. No behaviour changes: names, words and exports do. The rules it applies: "workspace" is in no name or word ("the instance" is what `createJali` returns, "the layout" is what a person sees); "Single view" and "Split view" are a curated page's modes only; a phone shows "one pane at a time". Phase 3b's note follows; read it first if you are coming from before 3b.

## For Data Studio

None of the names below is in Data Studio's `packages/workbench/src` (checked by search, 22 Nov 2026), so it needs no code change. A person using it hears the new phone words ("One pane at a time: …") under 600px wide.

## Names

| Before                                                 | After                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `WorkspaceAllow` (the type of `createJali({ allow })`) | `Allow`                                                                       |
| `JaliModel.single`                                     | `JaliModel.onePane`                                                           |
| `<Activity a={…} />`                                   | `<Activity activity={…} />`                                                   |
| `AgentSnapshot.workspace`                              | `AgentSnapshot.layout`                                                        |
| `AgentSnapshot.workspace.view`: `"single"`, `"split"`  | `AgentSnapshot.layout.view`: `"one-at-a-time"`, `"side-by-side"`              |
| `AgentKind.minWidth`, `AgentKind.comfortableWidth`     | `AgentKind.width: { min, comfortable? }`, as `definePane({ width })` takes it |

## Words (`createJali({ messages })`)

| Before                                                                                         | After                                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `messages.workspace` (the panes' region, the switcher, the dividers)                           | `messages.panes`                                                                         |
| `announcements.singleOn`: "Single view: one pane at a time. Use the pane switcher at the top." | `announcements.onePaneOn`: "One pane at a time: choose one from the switcher at the top" |
| `announcements.singleOff`: "Single view ended: full layout restored"                           | `announcements.onePaneOff`: "Panes side by side again: layout restored"                  |
| `announcements.notInvestigating`                                                               | `announcements.nothingOpened` (same words)                                               |
| `page.investigation`: "Investigation" (the page bar's group)                                   | `page.openedLabel`: "Opened panes"                                                       |
| `page.investigating`: "Investigating · **N** opened"                                           | `page.openedCount`: "**N** opened panes"                                                 |

A curated page says "Single view" in full where it said "Single" or "Single only": `announcements.modeSingle`, `permission`, `singleOnly`, `singleNoLayout`; `commands.viewAsLimited`; `page.splitTipLimited`; `settings.viewerLimited`. The keys are the same.

## Styling (the parts contract)

| Before                                                         | After                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| `.jali-workspace` (`parts.workspace`, in the "Workspace" area) | `.jali-layout` (`parts.layout`, in the "Layout" area) |
| `.jali-workspace[data-single]`                                 | `.jali-layout[data-one-pane]`                         |

Jali's own classes, which were never public, follow: `.jali-layout-inner`, `.is-one-pane`, and a pane's full-bleed `.is-bare` (was `.is-single`).

## Exported types

`row`, `column`, `tabs` and `pane` returned types an app couldn't import. These are now exported:

- from `jali`: `Draft`, `PaneDraft`, `SplitDraft`, `TabsDraft`, `StackPair` and `Hinge` (`JaliModel.stacked`), `CloseReason` (`CloseRequest.reason`), `Done` (the success side of `ActionResult`), `Spacing` (`Env.spacing`);
- from `jali/react`: `PaneKindDef` (inside `Pane`).

`pnpm pack-check` now fails when a public signature names a type no app entry exports (`tooling/public-types.mjs`).

## Development warnings

| Given                                                              | Warning                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `createJali({ messages: { workspace } })`                          | `Jali: createJali has no option "messages.workspace": moved to messages.panes`                    |
| `messages.announcements.singleOn`, `singleOff`, `notInvestigating` | `… "messages.announcements.singleOn": moved to messages.announcements.onePaneOn` (and the others) |
| `messages.page.investigation`, `investigating`                     | `… "messages.page.investigation": moved to messages.page.openedLabel` (and `openedCount`)         |
| `<Activity a>`                                                     | `Jali: Activity has no prop "a": a is activity (<Activity activity={…} />)`                       |
| Two instances named alike                                          | `Jali: two instances on this page are both named "…"` (was "two workspaces")                      |

The renamed types, model fields and agent fields have nothing to warn from: TypeScript names each.

## Docs

The guide "Two instances on one page" is at `/guides/two-instances` (was `/guides/two-workspaces`).

---

# Migrating to the API of phase 3b

What phase 3b of the API review (docs/API-REVIEW.md, sections 1, 2 and 4, and Pop out) changes for an app, old to new. Phase 3a's note follows below; read it first if you are coming from before 3a.

Three things change:

1. **One package, `jali`, with subpaths.** Every import moves. `@jali/core` and `@jali/react` stay in the repo as private workspace packages (so links to them keep working), but they are no longer what an app installs.
2. **Features are opt-in.** The address, ⌘K, Settings, the chooser, rename, Pop out and `data-pressed` are values you pass in `createJali({ features })`, each from its own entry, so an app ships only what it uses. `defaultFeatures()` is today's set in one line.
3. **`params` take a Standard Schema** of the whole object, beside Jali's constructors.

Nothing changes for a person using an app that passes `defaultFeatures()`, except: **Rename pane** is listed in ⌘K only where renaming is on (it was listed, greyed out, everywhere), and Pop out keeps a pane's state when it moves (it remounted before).

## For Data Studio

Data Studio's code in `packages/workbench/src/platform` uses 45 of Jali's names: 16 imports, 19 `createJali` options and 10 members of the instance. Every import moves; three options become features; the rest is unchanged.

**Imports** (5 files and `jali.css`):

```ts
// jali/document-jali.ts
import {
  createJali,
  keyHint,
  listCommands,
  type Jali,
  type KeyString,
  type ObjectRef,
  type TabMenuItem,
} from "jali";
// jali/stored-location.ts
import type { LocationPort } from "jali";
// jali/document-kinds.tsx
import {
  definePane,
  usePaneAttributes,
  useTitle,
  useUnsaved,
  type Pane,
  type PaneProps,
} from "jali/react";
// jali/jali-icons.tsx
import type { JaliIcons } from "jali/react";
// organisms/workspace-documents.tsx
import { JaliRoot } from "jali/react";
```

```css
/* jali/jali.css */
@import "jali/styles.css";
```

**Options** (`jali/document-jali.ts`): `url`, `palette: false` and `rename` become features. Data Studio lists Jali's commands in its own menu (`listCommands`), so it keeps Settings and the chooser (both are listed there: "Open settings", "Add to tabs of…") and leaves the palette out.

```ts
// Before
createJali({
  url: { location: storedLocation(layoutStorageKey(storageKey)), sizes: "link" },
  palette: false,
  rename: { can: ({ ref }) => …, run: ({ ref }, text) => … },
  // …
});

// After
import { urlSync } from "jali/url";
import { settings } from "jali/settings";
import { chooser } from "jali/chooser";
import { rename } from "jali/rename";
import { pressed } from "jali/pressed";

createJali({
  features: [
    urlSync({ location: storedLocation(layoutStorageKey(storageKey)), sizes: "link" }),
    settings(),
    chooser(),
    pressed(),
    rename({ can: ({ ref }) => …, run: ({ ref }, text) => … }),
  ],
  // …
});
```

Checked and unchanged: `id`, `name`, `panes`, `launcher`, `layout`, `storage`, `pageTheme`, `keyboard` (`scope`, `prefix`, `keymap`, `reserved`, `onInvalid`), `confirmDiscard`, `beforeClose`, `tabMenu`; `JaliRoot` with `icons` and `className`; `keyHint`, `listCommands` (and every field of `ListedCommand` it reads), and `jali.actions.startRename`, `jali.get()`, `jali.model()`, `jali.subscribe()` and `jali.on(...)`.

Until it moves, Data Studio's links (`link:<worktree>/packages/core`, `…/packages/react`, and `@jali/core/dist/index.js`) still resolve: both packages build as before, with 3b's API. Its options must change when its worktree moves to 3b, whether or not it moves to `jali` the same day.

## Imports

`jali/react` no longer repeats what is in `jali` (`optional`, `oneOf`, `appOnly`, `keyBelongsToContent`): import those from `jali`. `definePage` moved to `jali/page`. Types move with the values.

| Before                                                                                                                                                                  | After                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `@jali/core` (every name)                                                                                                                                               | `jali`                                                   |
| `@jali/core/agent` (every name)                                                                                                                                         | `jali/agent`                                             |
| `@jali/core/adapter` (every name, for a framework adapter)                                                                                                              | `jali/adapter` (may change in any minor version)         |
| `@jali/core/adapter`'s `storeOf` in an app's tests                                                                                                                      | `jali/testing` (below)                                   |
| `@jali/react`: `JaliRoot`, `JaliView`, `definePane`, the hooks, `Shelf`, `PageBar`, `CuratedPage`, `KindIcon`, `Activity`, `IconButton`, `useJaliIcons` and their types | `jali/react`                                             |
| `@jali/react`: `definePage`, `Page`, `PageView`                                                                                                                         | `jali/page`                                              |
| `@jali/react`: `optional`, `oneOf`, `appOnly`, `keyBelongsToContent`                                                                                                    | `jali`                                                   |
| `@jali/react`: `unstable_popOut`, `unstable_bringBack`, `unstable_canPopOut`                                                                                            | `popOut()` from `jali/pop-out` (a feature; below)        |
| `@jali/react/icons`                                                                                                                                                     | `jali/icons`                                             |
| `@jali/react/styles.css`, `theme.css`, `tailwind.css`                                                                                                                   | `jali/styles.css`, `jali/theme.css`, `jali/tailwind.css` |
| `declare module "@jali/core" { interface Register … }`                                                                                                                  | `declare module "jali" { interface Register … }`         |
| `npm install @jali/core @jali/react`                                                                                                                                    | `npm install jali` (React 18.2+ is an optional peer)     |
| `node_modules/@jali/core/docs/`                                                                                                                                         | `node_modules/jali/docs/`                                |

## Features (`createJali({ features })`)

A feature is a value from its own entry. Give one again later in the list and it takes the earlier one's place, so `[...defaultFeatures(), urlSync({ location })]` keeps the defaults with the address in a router's hands.

| Before                                               | After                                                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| (everything on by default)                           | `features: defaultFeatures()` from `jali/features`: `urlSync()`, `palette()`, `settings()`, `chooser()`, `pressed()` |
| `url: true` (the default in a browser)               | `urlSync()` from `jali/url`                                                                                          |
| `url: { location, prefix, sizes }`                   | `urlSync({ location, prefix, sizes })`                                                                               |
| `url: false`                                         | leave `urlSync()` out                                                                                                |
| `url: writer` (a `UrlWriter` of your own)            | `url: writer`, unchanged                                                                                             |
| `palette: true` (the default)                        | `palette()` from `jali/palette`                                                                                      |
| `palette: false`                                     | leave `palette()` out                                                                                                |
| `<JaliRoot settings={false}>`                        | leave `settings()` (from `jali/settings`) out; `settingsExtra` stays a prop                                          |
| the chooser and `jali.dialogs.choose` (always there) | `chooser()` from `jali/chooser`                                                                                      |
| `rename: { can, run }`                               | `rename({ can, run })` from `jali/rename`                                                                            |
| `allow: { popOut: true }`                            | `popOut()` from `jali/pop-out`; `allow: { popOut: false }` still turns it off                                        |
| `data-pressed` on Jali's controls (always)           | `pressed()` from `jali/pressed`                                                                                      |

Without its feature: `jali.dialogs.openPalette()`, `openSettings()` and `choose()` are refused as `"unavailable"`; "Open settings", "Add to tabs of…", "Rename pane" and "Pop out pane" are not in `listCommands`; the palette's key is the app's unless `keyboard.keymap` binds `"palette.toggle"` (as with `palette: false` before).

What stays without any feature: the layout, fitting, actions, focus, undo, follow, the keyboard, tabs and their menus, the shelf, peek, phones (Single and stacked view), rows that scroll, full screen, the curated page (`jali/page`), and the words of all of it.

## Pop out

| Before                                                     | After                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `allow: { popOut: true }` and `unstable_popOut(jali, id)`  | `features: [popOut()]`; the header button, the menus and "Pop out pane" in ⌘K do it          |
| `unstable_bringBack()`                                     | Bring back in the pane's place, or closing the window                                        |
| `unstable_canPopOut()`                                     | (internal) the button and command show only where the browser can                            |
| one window for the whole page (module state)               | one window per workspace, owned by it; closed on unmount, `destroy()` and a store swap       |
| the content remounted in the window (its `useState` reset) | the content's own element moves into the window: its state, subscriptions and DOM survive    |
| Jali's keys didn't reach the window                        | they do, whatever `keyboard.scope`                                                           |
| theme and tokens copied once, from `<html>`                | the workspace's theme, tokens and direction kept in step; `[data-jali]` on the window's root |
| a refused request rejected (unhandled)                     | it resolves `false`, and nothing changes                                                     |
| `DomPort.popOut` (`PopOutPort`, adapters)                  | the feature's window (`PopOutWindow`, `popOutFeature` in `jali/adapter`)                     |

## Params (`definePane({ params })`)

Jali's constructors are unchanged. A Standard Schema of the whole object also works, from any library that implements Standard Schema v1 (Zod, Valibot, ArkType, Effect Schema); Jali depends on none of them:

```ts
import * as v from "valibot";
definePane("order", { params: v.object({ id: v.number(), tab: v.optional(v.string()) }), … });
// usePane(order).params is { id: number; tab?: string }
```

The schema decides what is valid and what the pane gets; Jali's codec still writes the link (a number comes back a number). A value the schema refuses is a `ParamProblem`, as before, keyed by the issue's first path segment. A schema must validate synchronously. A value a hand-written link carries as text reaches the schema as text (use your library's coercion, such as `z.coerce.number()`). `appOnly` and `link: false` are Jali's: declare params one by one with Jali's constructors to use them.

## Tests (`jali/testing`)

An app's tests no longer need `jali/adapter`:

| Before                                                                                                           | After                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `createJali({ …, url: { location: memoryLocation(search) }, storage: memoryStorage(), size, moveFocus: false })` | `createTestJali({ …, search, size })` → `{ jali, location }`      |
| the same options passed to the app's own `createMyJali(services, options)`                                       | `const { options, location } = testJaliOptions({ search, size })` |
| `storeOf(jali).actions.setUnsaved(pane, what)`                                                                   | `reportUnsaved(jali, pane, what)`                                 |
| `storeOf(jali).actions.setPaneState(pane, key, value)`                                                           | `reportPaneState(jali, pane, key, value)`                         |
| `paneStateFor(store.get(), store.env.kinds, pane, ref)`                                                          | `paneStateOf(jali, pane)`                                         |
| `storeOf(jali).get().confirm?.panes`                                                                             | `discardQuestion(jali)?.panes`                                    |
| `storeOf(jali).actions.discardAndContinue()` / `keepEditing()`                                                   | `answerDiscard(jali, "discard")` / `answerDiscard(jali, "keep")`  |
| `storeOf(jali).get().chooser` (`kind: "choose"`, `.request`)                                                     | `chooserRequest(jali)`                                            |
| `storeOf(jali).get().announcement.text`                                                                          | `lastAnnouncement(jali)`                                          |
| `keydown` events built by hand                                                                                   | `pressKeys("Mod+K Mod+W", { target })`                            |

An app whose function makes its workspace merges its features before the test's: `features: [...defaultFeatures(), ...(options.features ?? [])]`.

## Options Jali doesn't know (development)

In development, `createJali`, `definePane` and `definePage` warn once for each option they don't know, so an options object built at run time can't silently fall back to defaults. A production build drops the check. The warnings for options that moved:

| Option given                                                  | Warning                                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `createJali({ keys })`                                        | `keys moved to keyboard.scope ("page", or "local" for "scoped")`                                                           |
| `createJali({ keymap })`                                      | `keymap moved to keyboard.keymap`                                                                                          |
| `createJali({ keyPrefix })`                                   | `keyPrefix moved to keyboard.prefix`                                                                                       |
| `createJali({ reservedKeys })`                                | `reservedKeys moved to keyboard.reserved`                                                                                  |
| `createJali({ keymapOptions })`                               | `keymapOptions moved to keyboard (keyboard.platform, keyboard.onInvalid, keyboard.words)`                                  |
| `createJali({ palette })`                                     | `palette is a feature: features: [palette()] from "jali/palette" (leave it out for palette: false)`                        |
| `createJali({ rename })`                                      | `rename is a feature: features: [rename({ can, run })] from "jali/rename"`                                                 |
| `createJali({ url })`, not a writer                           | `url is a feature: features: [urlSync({ location, prefix, sizes })] from "jali/url" (url takes only a writer of your own)` |
| `definePane({ minWidth })`, `maxWidth`, `comfortableWidth`    | `minWidth moved to width: { min }` (and `{ max }`, `{ comfortable }`)                                                      |
| `definePane({ minHeight })`, `maxHeight`, `comfortableHeight` | `minHeight moved to height: { min }` (and `{ max }`, `{ comfortable }`)                                                    |

Any other unknown option: `Jali: createJali has no option "colour", and ignores it` (or `definePane`, `definePage`). Each is prefixed `Jali: <function> has no option "<name>": `.

## For adapters (`jali/adapter`)

| Before                                                                 | After                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JaliConfig.palette`                                                   | `JaliConfig.features` (`env.palette` is still there: whether the palette feature is)                                                                                                         |
| `JaliConfig.url` made from `true` / options                            | the `urlSync` feature's `address(storage)`; `JaliConfig.url` is the writer in use                                                                                                            |
| `boot(store, url)`, `startUi(store, url, options)`                     | `boot(store)`, `startUi(store, options)`; a feature's `boot` and `start` run inside them                                                                                                     |
| `DomPort.popOut`, `PopOutPort`, `CommandDef.check`'s store for Pop out | `popOutFeature(window: PopOutWindow, parts)`; `partOf(env, "popOutWindow")`                                                                                                                  |
| (none)                                                                 | `Feature`, `featureOf`, `partOf`, `paletteFeature`, `settingsFeature`, `chooserFeature`, `renameFeature`, `popOutFeature`, `urlSync`, each feature's English (`paletteEn`, …), `warnUnknown` |
| `trackInput()` counted for one document                                | counted per document (a floating window's is its own)                                                                                                                                        |

---

# Migrating to the API of phase 3a

What phase 3a of the API review (docs/API-REVIEW.md, sections 3, 5 to 10) changes for an app, old to new. The packages keep their names (`@jali/core`, `@jali/react`) in this phase; phase 3b moves them to one `jali` package with subpaths and gets a migration note of its own.

Nothing here changes what a person sees, except one line: on a curated page, the command that leaves the page reads "Open <name>" when the app gives `createJali({ name })`, and "Leave <page>" when it doesn't (it was "Open Workspace").

## For Data Studio

Data Studio's code in `packages/workbench/src/platform` uses 45 of Jali's names: 16 imports, 19 `createJali` options and 10 members of the instance. All but five options are unchanged. The one edit, in `jali/document-jali.ts`:

```ts
// Before
createJali({
  keys: "scoped",
  keyPrefix: "Mod+J",
  keymap: JALI_KEYMAP,
  reservedKeys,
  keymapOptions: { onInvalid: () => {} },
  // …
});

// After
createJali({
  keyboard: {
    scope: "local",
    prefix: "Mod+J",
    keymap: JALI_KEYMAP,
    reserved: reservedKeys,
    onInvalid: () => {},
  },
  // …
});
```

Checked and unchanged: `createJali`, `keyHint`, `listCommands` (and every field of `ListedCommand` it reads), `Jali`, `KeyString`, `LocationPort`, `ObjectRef`, `TabMenuItem`, `JaliRoot` (with `icons` and `className`), `JaliIcons`, `definePane`, `Pane`, `PaneProps`, `usePaneAttributes`, `useTitle`, `useUnsaved`; the options `id`, `name`, `panes`, `launcher`, `layout`, `url` (`location`, `sizes`), `storage`, `pageTheme`, `palette`, `confirmDiscard`, `beforeClose`, `rename`, `tabMenu`; and `jali.actions.openHere`, `addTab`, `remove`, `setPinned`, `focus`, `startRename`, `jali.get()`, `jali.model()`, `jali.subscribe()` and `jali.on("close" | "focus" | "pin")`.

Two things it may notice without changing code:

- `createJali` now returns a typed workspace (`Jali<RefOf<kinds>, undefined>`). It still assigns to a plain `Jali`, so `DocumentJali.jali: Jali` compiles as it is.
- `jali.get()`, `jali.model()` and events are typed read-only. Data Studio only reads them.

## Options (`createJali`)

| Before                                          | After                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `keys: "page"`                                  | `keyboard: { scope: "page" }` (default)                                               |
| `keys: "scoped"`                                | `keyboard: { scope: "local" }`                                                        |
| `keymap: {…}`                                   | `keyboard: { keymap: {…} }`                                                           |
| `keyPrefix: "Mod+J"`                            | `keyboard: { prefix: "Mod+J" }`                                                       |
| `reservedKeys: [...]`                           | `keyboard: { reserved: [...] }`                                                       |
| `keymapOptions: { platform, onInvalid, words }` | `keyboard: { platform, onInvalid, words }`                                            |
| `name` defaulted to `"Workspace"`               | `name` has no default (see above)                                                     |
| (none)                                          | `linkMode: "open" \| "peek"`: what following a link on the curated page does at first |

`palette: false` stays where it was (phase 3b makes the palette an opt-in feature).

## Actions

`jali.actions` keeps the actions on panes and layouts. The curated page's actions move to `jali.page`, which is there (and typed) only when `createJali({ page })` was given one, and the dialogs' to `jali.dialogs`.

| Before                                            | After                                             |
| ------------------------------------------------- | ------------------------------------------------- |
| `jali.actions.openPage({ item, tab })`            | `jali.page.open({ item, tab })`                   |
| `jali.actions.leavePage()`                        | `jali.page.leave()`                               |
| `jali.actions.setMode(mode)`                      | `jali.page.setMode(mode)`                         |
| `jali.actions.openTab(view)`                      | `jali.page.showView(view)`                        |
| `jali.actions.activate(item)`                     | `jali.page.showItem(item)`                        |
| `jali.actions.backToPage()`                       | `jali.page.back()`                                |
| `jali.actions.resetPage()`                        | `jali.page.reset()`                               |
| `jali.actions.setCanInvestigate(true)`            | `jali.page.setLinkMode("open")`                   |
| `jali.actions.setCanInvestigate(false)`           | `jali.page.setLinkMode("peek")`                   |
| `jali.actions.choose(options)`                    | `jali.dialogs.choose(options)`                    |
| `jali.actions.openPalette()` / `closePalette()`   | `jali.dialogs.openPalette()` / `closePalette()`   |
| `jali.actions.openSettings()` / `closeSettings()` | `jali.dialogs.openSettings()` / `closeSettings()` |

In a component, the same through the hook: `useJali().page?.showView("summary")`. Without a registered workspace, `page` is typed `JaliPage | undefined`, so `?.` reads it.

The `layout` event's `action` names a page action with its group: `"page.showView"`, `"page.open"` (it was `"openTab"`, `"openPage"`).

## State

| Before                                                       | After                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `jali.get().page.canInvestigate` (true)                      | `jali.get().page.linkMode === "open"`                                     |
| `jali.get().page.canInvestigate` (false)                     | `jali.get().page.linkMode === "peek"`                                     |
| `JaliState`, `getLayout()`, `model()`, events: mutable types | read-only types (`DeepReadonly`); they were frozen in development already |

A read-only layout goes back into `setLayout`, `createJali({ layout })` and a preset's `saved` as it is. To edit one, copy it: `layout.tree.clone(jali.getLayout())`. A record of saved layouts is typed `Record<string, DeepReadonly<Layout>>`.

## Events

| Before                                                 | After                                                    |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `jali.onToast((t) => show(t))`                         | `jali.on("toast", (t) => show(t))`                       |
| `useEffect(() => jali.on("open", f), [jali])` in React | `useJaliEvent("open", f)` (latest `f`, stops on unmount) |
| `useEffect(() => jali.onToast(f), [jali])`             | `useJaliEvent("toast", f)`                               |

A toast event carries the toast's fields (`title`, `description`, `undo`, `error`) and `input`, as other events do. Toasts sent before anyone listens are still kept until someone does.

## React

| Before                                                                                                            | After                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTheme()`                                                                                                      | `useJaliTheme()`                                                                                                                                                             |
| `useShortcut(id)`                                                                                                 | `useJaliShortcut(id)`                                                                                                                                                        |
| `usePane<{ id: number }>()`                                                                                       | `usePane(order)`: params typed from the kind, no cast; `usePane()` for plain params                                                                                          |
| `keyBelongsToContent` from `@jali/react`                                                                          | still there, and now from `@jali/core` too                                                                                                                                   |
| A page's `Rail` got `activate(item)`                                                                              | `Rail` gets `showItem(item)`                                                                                                                                                 |
| `<JaliProvider jali>` and the parts `Panes`, `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard`, `Announcer` | internal. Put your own chrome inside `<JaliRoot>` around `<JaliView />`; the root renders the dialogs, the live region and the full-screen layer for every way of using Jali |

```tsx
// Before: composing your own root
<JaliProvider jali={jali}>
  <Panes />
  <Shelf />
  <Palette />
  <SettingsPanel />
  <Chooser />
  <ConfirmDiscard />
  <Announcer />
</JaliProvider>

// After
<JaliRoot jali={jali}>
  <JaliView />
  <Shelf />
</JaliRoot>
```

`Shelf`, `PageBar`, `CuratedPage`, `KindIcon`, `IconButton` and `Activity` stay.

## Types

New, and what they replace:

| Before                                                             | After                                                                                                                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `definePane("note", …)` returned `ObjectRef`s                      | it returns `Ref<"note", { id: number }>` refs (still `ObjectRef`s)                                                                                        |
| `createJali(…): Jali`                                              | `createJali(…): Jali<RefOf<kinds>, PageOf<page>>`                                                                                                         |
| `JaliActions`, `JaliEvents`, `JaliModel`, `JaliState`, `Selection` | the same names, with a ref type parameter `R` that defaults to `ObjectRef`                                                                                |
| (none)                                                             | `Register`: `declare module "@jali/core" { interface Register { jali: typeof jali } }` types `useJali`, `useJaliState`, `useJaliModel` and `useJaliEvent` |
| (none)                                                             | `JaliPage`, `JaliDialogs`, `LinkMode`, `KeyboardOptions`, `DeepReadonly`, `PaneOf`, `RefOf`, `RefsOf`, `PageOf`, `AnyJali`, `RegisteredJali`, `JaliEvent` |
| `OpenPageOptions`                                                  | `OpenPageOptions<I>`, with the page's item type                                                                                                           |

A function that takes any workspace takes `AnyJali`. The hooks also take the workspace type explicitly when nothing is registered: `useJali<typeof jali>()`.

## Removed

| Removed                                                             | Instead                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `definePage` from `@jali/core`                                      | `definePage` from `@jali/react` (core's renders nothing in React); adapters: `definePageEngine` from `@jali/core/adapter` |
| `layout.tree.parentOf`                                              | `layout.tree.parent`                                                                                                      |
| `layout.tree.replace`                                               | `layout.tree.map(root, (n) => (n.id === id ? next : n))`                                                                  |
| `layout.tree.balance`, `layout.tree.remove`, `layout.tree.activate` | the layout operations (`layout.close`, `layout.setActiveTab`), which return a new layout                                  |
| `isMac` (`@jali/core/adapter`)                                      | `jali.keymap.platform`, or `detectPlatform()`                                                                             |
| `setPopOutPort` (`@jali/core/adapter`)                              | the adapter's `DomPort.popOut`                                                                                            |
| `jali.onToast`                                                      | `jali.on("toast")`                                                                                                        |

## For adapters (`@jali/core/adapter`)

| Before                                                                                                                     | After                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UiStore`, `createUiStore(deps)`, `UiStoreDeps`                                                                            | `JaliStore`, `createJaliStore(config)`, `JaliConfig` (`resolveOptions(options)` makes one from `JaliOptions`)          |
| `ACTIONS`, `bindActions`, `pageStep`, `publicActions`                                                                      | `STEPS`, `stepOf`, and `store.run(name, ...args)`                                                                      |
| `store.actions.x(...)` returned the pane id or `undefined`                                                                 | it returns the `ActionResult` (`.pane` is the id)                                                                      |
| `store.actions.openPage(o)`, `setMode`, `openTab`, …                                                                       | `store.run("page.open", o)`, `store.run("page.setMode", m)`, …; an arrival from a link is `store.run("arrivePage", o)` |
| `store.actions.openTabBeside(view)`                                                                                        | `store.actions.showViewBeside(view)`                                                                                   |
| `store.actions.peek(ref, source)`, `peek(null)`                                                                            | `store.actions.peek(source, ref)`, `closePeek()`                                                                       |
| `store.actions.split(direction, pane)`                                                                                     | `store.actions.split(pane, direction)`                                                                                 |
| `store.actions.focus(id)` (focus only)                                                                                     | `store.actions.focus(id)`: focus and show, as `jali.actions.focus`                                                     |
| `store.onToast`                                                                                                            | `store.on("toast")`                                                                                                    |
| `deps.keys`, `deps.keymap`, `deps.keymapOptions`                                                                           | `config.keyboard`                                                                                                      |
| `PageEngine.openPage`, `leavePage`, `openTab`, `openTabBeside`, `activate`, `backToPage`, `resetPage`, `setCanInvestigate` | `open`, `leave`, `showView`, `showViewBeside`, `showItem`, `back`, `reset`, `setLinkMode`                              |
| the internal model type `JaliModel`                                                                                        | `Model` (`JaliModel<R>` is the app's read-only view)                                                                   |
| `createAgent` actions `openPage`, `leavePage`, `setMode`, `openTab`, `activate`                                            | `page.open`, `page.leave`, `page.setMode`, `page.showView`, `page.showItem`                                            |
