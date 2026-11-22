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

| Before                                 | After                                    |
| -------------------------------------- | ---------------------------------------- |
| `keys: "page"`                         | `keyboard: { scope: "page" }` (default)  |
| `keys: "scoped"`                       | `keyboard: { scope: "local" }`           |
| `keymap: {…}`                          | `keyboard: { keymap: {…} }`              |
| `keyPrefix: "Mod+J"`                   | `keyboard: { prefix: "Mod+J" }`          |
| `reservedKeys: [...]`                  | `keyboard: { reserved: [...] }`          |
| `keymapOptions: { platform, onInvalid, words }` | `keyboard: { platform, onInvalid, words }` |
| `name` defaulted to `"Workspace"`      | `name` has no default (see above)        |
| (none)                                 | `linkMode: "open" \| "peek"`: what following a link on the curated page does at first |

`palette: false` stays where it was (phase 3b makes the palette an opt-in feature).

## Actions

`jali.actions` keeps the actions on panes and layouts. The curated page's actions move to `jali.page`, which is there (and typed) only when `createJali({ page })` was given one, and the dialogs' to `jali.dialogs`.

| Before                                     | After                                         |
| ------------------------------------------ | --------------------------------------------- |
| `jali.actions.openPage({ item, tab })`     | `jali.page.open({ item, tab })`               |
| `jali.actions.leavePage()`                 | `jali.page.leave()`                           |
| `jali.actions.setMode(mode)`               | `jali.page.setMode(mode)`                     |
| `jali.actions.openTab(view)`               | `jali.page.showView(view)`                    |
| `jali.actions.activate(item)`              | `jali.page.showItem(item)`                    |
| `jali.actions.backToPage()`                | `jali.page.back()`                            |
| `jali.actions.resetPage()`                 | `jali.page.reset()`                           |
| `jali.actions.setCanInvestigate(true)`     | `jali.page.setLinkMode("open")`               |
| `jali.actions.setCanInvestigate(false)`    | `jali.page.setLinkMode("peek")`               |
| `jali.actions.choose(options)`             | `jali.dialogs.choose(options)`                |
| `jali.actions.openPalette()` / `closePalette()` | `jali.dialogs.openPalette()` / `closePalette()` |
| `jali.actions.openSettings()` / `closeSettings()` | `jali.dialogs.openSettings()` / `closeSettings()` |

In a component, the same through the hook: `useJali().page?.showView("summary")`. Without a registered workspace, `page` is typed `JaliPage | undefined`, so `?.` reads it.

The `layout` event's `action` names a page action with its group: `"page.showView"`, `"page.open"` (it was `"openTab"`, `"openPage"`).

## State

| Before                                  | After                                            |
| --------------------------------------- | ------------------------------------------------ |
| `jali.get().page.canInvestigate` (true) | `jali.get().page.linkMode === "open"`            |
| `jali.get().page.canInvestigate` (false)| `jali.get().page.linkMode === "peek"`            |
| `JaliState`, `getLayout()`, `model()`, events: mutable types | read-only types (`DeepReadonly`); they were frozen in development already |

A read-only layout goes back into `setLayout`, `createJali({ layout })` and a preset's `saved` as it is. To edit one, copy it: `layout.tree.clone(jali.getLayout())`. A record of saved layouts is typed `Record<string, DeepReadonly<Layout>>`.

## Events

| Before                                  | After                                              |
| --------------------------------------- | -------------------------------------------------- |
| `jali.onToast((t) => show(t))`          | `jali.on("toast", (t) => show(t))`                 |
| `useEffect(() => jali.on("open", f), [jali])` in React | `useJaliEvent("open", f)` (latest `f`, stops on unmount) |
| `useEffect(() => jali.onToast(f), [jali])` | `useJaliEvent("toast", f)`                      |

A toast event carries the toast's fields (`title`, `description`, `undo`, `error`) and `input`, as other events do. Toasts sent before anyone listens are still kept until someone does.

## React

| Before                              | After                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| `useTheme()`                        | `useJaliTheme()`                                              |
| `useShortcut(id)`                   | `useJaliShortcut(id)`                                         |
| `usePane<{ id: number }>()`         | `usePane(order)`: params typed from the kind, no cast; `usePane()` for plain params |
| `keyBelongsToContent` from `@jali/react` | still there, and now from `@jali/core` too               |
| A page's `Rail` got `activate(item)` | `Rail` gets `showItem(item)`                                 |
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

| Before                                  | After                                                     |
| --------------------------------------- | --------------------------------------------------------- |
| `definePane("note", …)` returned `ObjectRef`s | it returns `Ref<"note", { id: number }>` refs (still `ObjectRef`s) |
| `createJali(…): Jali`                   | `createJali(…): Jali<RefOf<kinds>, PageOf<page>>`         |
| `JaliActions`, `JaliEvents`, `JaliModel`, `JaliState`, `Selection` | the same names, with a ref type parameter `R` that defaults to `ObjectRef` |
| (none)                                  | `Register`: `declare module "@jali/core" { interface Register { jali: typeof jali } }` types `useJali`, `useJaliState`, `useJaliModel` and `useJaliEvent` |
| (none)                                  | `JaliPage`, `JaliDialogs`, `LinkMode`, `KeyboardOptions`, `DeepReadonly`, `PaneOf`, `RefOf`, `RefsOf`, `PageOf`, `AnyJali`, `RegisteredJali`, `JaliEvent` |
| `OpenPageOptions`                       | `OpenPageOptions<I>`, with the page's item type           |

A function that takes any workspace takes `AnyJali`. The hooks also take the workspace type explicitly when nothing is registered: `useJali<typeof jali>()`.

## Removed

| Removed                                   | Instead                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `definePage` from `@jali/core`            | `definePage` from `@jali/react` (core's renders nothing in React); adapters: `definePageEngine` from `@jali/core/adapter` |
| `layout.tree.parentOf`                    | `layout.tree.parent`                                     |
| `layout.tree.replace`                     | `layout.tree.map(root, (n) => (n.id === id ? next : n))` |
| `layout.tree.balance`, `layout.tree.remove`, `layout.tree.activate` | the layout operations (`layout.close`, `layout.setActiveTab`), which return a new layout |
| `isMac` (`@jali/core/adapter`)            | `jali.keymap.platform`, or `detectPlatform()`            |
| `setPopOutPort` (`@jali/core/adapter`)    | the adapter's `DomPort.popOut`                           |
| `jali.onToast`                            | `jali.on("toast")`                                       |

## For adapters (`@jali/core/adapter`)

| Before                                          | After                                                     |
| ----------------------------------------------- | --------------------------------------------------------- |
| `UiStore`, `createUiStore(deps)`, `UiStoreDeps` | `JaliStore`, `createJaliStore(config)`, `JaliConfig` (`resolveOptions(options)` makes one from `JaliOptions`) |
| `ACTIONS`, `bindActions`, `pageStep`, `publicActions` | `STEPS`, `stepOf`, and `store.run(name, ...args)`    |
| `store.actions.x(...)` returned the pane id or `undefined` | it returns the `ActionResult` (`.pane` is the id) |
| `store.actions.openPage(o)`, `setMode`, `openTab`, … | `store.run("page.open", o)`, `store.run("page.setMode", m)`, …; an arrival from a link is `store.run("arrivePage", o)` |
| `store.actions.openTabBeside(view)`             | `store.actions.showViewBeside(view)`                      |
| `store.actions.peek(ref, source)`, `peek(null)` | `store.actions.peek(source, ref)`, `closePeek()`          |
| `store.actions.split(direction, pane)`          | `store.actions.split(pane, direction)`                    |
| `store.actions.focus(id)` (focus only)          | `store.actions.focus(id)`: focus and show, as `jali.actions.focus` |
| `store.onToast`                                 | `store.on("toast")`                                       |
| `deps.keys`, `deps.keymap`, `deps.keymapOptions` | `config.keyboard`                                        |
| `PageEngine.openPage`, `leavePage`, `openTab`, `openTabBeside`, `activate`, `backToPage`, `resetPage`, `setCanInvestigate` | `open`, `leave`, `showView`, `showViewBeside`, `showItem`, `back`, `reset`, `setLinkMode` |
| the internal model type `JaliModel`             | `Model` (`JaliModel<R>` is the app's read-only view)      |
| `createAgent` actions `openPage`, `leavePage`, `setMode`, `openTab`, `activate` | `page.open`, `page.leave`, `page.setMode`, `page.showView`, `page.showItem` |
