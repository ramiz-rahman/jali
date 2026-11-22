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
