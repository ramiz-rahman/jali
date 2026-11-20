# @jali/core

Every function and constant @jali/core exports, with its options, defaults and what it returns.

The framework-free part of Jali: the workspace, the layouts it shows, the address and storage ports, commands and keys. Render it with [@jali/react](react.md). Types have their own page, [@jali/core types](core/types.md); the pure layout operations are on [The layout namespace](core/layout.md).

```sh
npm install @jali/core
```

Framework adapters import `@jali/core/adapter`, which exports everything inside the package. Apps need only what is on this page.

## The workspace

### createJali

*function*, from `@jali/core`

```ts
createJali(options: JaliOptions): Jali
```

Makes one workspace, ready to render: its state, the model derived from it, its actions and its keymap. Each workspace has its own; nothing is shared between two on one page.

Before it returns, it reads the address (a layout link opens as it is, a curated page link opens the page, a link that can't be read opens the starting layout with an error toast), adds what is on screen to Recent, fits the layout to the room and focuses the first pane. A page-only app (a `page` with no `layout` and no `presets`) starts with its page open on `firstItem`, and "Open Workspace" is refused. It throws ``Jali: give the workspace a `layout`, `presets` or a `page` to start from`` when it has none of them.

Its listeners (keys, Back and Forward, theme and saving) start with `jali.start()`, which `<JaliRoot>` calls while it is mounted.

**Parameters**

- **`options`** (`JaliOptions`, required):

**Fields**

- **`panes`** (`readonly PaneKindBase[]`, required): The kinds of pane it can show, from `definePane`. A layout can only show refs of these kinds.

- **`layout`** (`LayoutInput`): The layout it opens on: a builder's result (`row(...)`), a single ref, or a whole `Layout`. Give this or `presets`.

- **`presets`** (`readonly PresetOptions[]`): Layouts to start from, in menu order, each `{ id, label, layout }`. Each gets a `layout.preset.<id>` command, titled "Layout: label", and "Reset layout" rebuilds the one in use. `layout` may be a function, to build a fresh one each time. `saved` gives back the layout the person left a preset in.

- **`preset`** (`string`): The preset it opens on when no link says otherwise. An id that is not in `presets` also gives the first.

- **`launcher`** (`PaneKindBase`): What Split and "New tab here" open until the person chooses what to show. It closes quietly and its component reads `useLauncher()`. Without one, those commands and the tab strip's "+" are not offered.

- **`page`** (`Page | null`): A curated page this workspace can show, from `definePage`.

- **`name`** (`string`): The free workspace's name, in command titles such as "Open Workspace".

- **`url`** (`boolean | UrlSyncOptions`):

The address.

- `true`: The layout lives in the address bar: a link reopens it, and Back and Forward step through it.

- `options`: The same, configured: `{ location, prefix, sizes }`. See [`UrlSyncOptions`](core/types.md#UrlSyncOptions).

- `false`: The address is left alone.

- **`storage`** (`string | StoragePort`): What this person keeps on this device: settings, pane state, a curated page's mode and layout, dragged sizes. A string is a `localStorage` prefix; or pass a port, such as `memoryStorage()`. The default prefix is the workspace's `id` (`"jali"`), so two workspaces with their own ids keep their own.

- **`id`** (`string`): Prefix for DOM ids (`jali-pane-orders`). Give each workspace on one page its own.

- **`keys`** (`"page" | "scoped"`): `"page"`: every key on the page. `"scoped"`: only keys pressed inside it or in its dialogs (the palette, settings and the chooser render outside its root, so a ⌘K chord finishes there), and keys with nothing focused while it was the last one used. Use `"scoped"` for two on one page.

- **`pageTheme`** (`boolean`): Set `data-theme` on `<html>` from the person's theme setting. `false` when the workspace sits in a page that has its own theme.

- **`settings`** (`Partial<Settings>`): Settings for a person who has none saved on this device yet: `{ theme: "dark" }` for a dark-first app. They are not saved; what the person changes is, and wins from then on, setting by setting. See [`Settings`](core/types.md#Settings).

- **`commands`** (`readonly Command[]`): Your own commands. They are listed in ⌘K after Jali's, and `keymap` can bind them like any other (`{ "orders.refresh": "Mod+K Mod+U" }`). If an id repeats one of Jali's, Jali's wins.

- **`keymap`** (`KeymapOverrides`): Rebind or unbind commands: `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. A binding is refused (and reported) when it can't be parsed, is a single character key with no Mod, Ctrl or Alt (those belong to the content), or has more than two steps.

- **`keymapOptions`** (`KeymapOptions`): `platform` (`"mac"` or `"other"`, for tests and the server) and `onInvalid(id, binding, reason)` (default `console.warn`).

- **`keyPrefix`** (`KeyString`): The first step of every default two-step binding, and the palette's key. Move it when your app owns ⌘K: `"Mod+J"` makes "Restore last closed pane" ⌘J ⌘Z. Bindings in `keymap` are used as written.

- **`reservedKeys`** (`readonly KeyString[]`): Keys your app uses for itself. Any of Jali's bindings that is one of them, or starts with one, is dropped and reported to `keymapOptions.onInvalid` when the workspace is made.

- **`palette`** (`boolean`): `false`: your app's own command menu lists Jali's commands ([`useJaliCommands`](react.md#useJaliCommands), `listCommands`). `<JaliRoot>` renders no palette, and its key is unbound unless `keymap` binds `"palette.toggle"`.

- **`landmark`** (`"region" | "main"`): What the panes are to screen readers. `"region"`: a `<section>` labelled "Panes", which sits inside your page's own `<main>` and adds no second one. `"main"`: the panes render as the page's `<main>`. Use it when Jali is the whole app and the page has no `<main>` of its own.

- **`dir`** (`Direction`): The reading direction. By default the workspace reads its page's: the computed `direction` where it renders, so `<html dir="rtl">` is enough, and it follows a later change of `dir`. Give one to fix it; `<JaliRoot>` then sets `dir` on its elements, so the styles agree. Right to left, a row starts at the right, and every left and right a key, command, drop zone or message names is still the screen's. The layout and its links are the same in both. See [`Direction`](core/types.md#Direction).

- **`gap`** (`number`): The space between panes, in CSS pixels. The layout measures with it (splits, rows that scroll, the stacked view), and `<JaliRoot>` writes it on its root and its layer as `--jali-gap`, so a style that reads the variable agrees with where the panes are.

- **`inset`** (`number`): The space between the workspace's edges and its panes, in CSS pixels, written as `--jali-inset`. Set it apart from the gap to line the panes up with your own bars.

- **`size`** (`{ width: number; height: number }`): A fixed size instead of the window's, for tests and server rendering. `<JaliRoot>` measures the real one once it renders.

- **`moveFocus`** (`boolean`): `false` leaves DOM focus alone: for tests and a workspace that is never shown.

- **`onUnstable`** (`(op: string, before: string, after: string) => void`): Called when a focus or swap action moved a pane on screen, which it never should.

- **`beforeClose`** (`BeforeClose`): Asked before a change removes panes or makes a pane show another object: a close, close others, a preset, `setLayout`, Back and Forward, `openHere`. Return `true` to let it happen or `false` to keep the panes, or a promise of either for a check that takes time. Jali's own "Discard unsaved changes?" follows a yes when a pane still reports unsaved work. See [`BeforeClose`](core/types.md#BeforeClose).

- **`confirmDiscard`** (`boolean`): `false`: your app asks about unsaved work itself, from `beforeClose`. Panes still report it with `useUnsaved` and show the unsaved mark, but Jali never asks "Discard unsaved changes?" and doesn't hold the page's unload. A following detail with unsaved work still keeps its object.

- **`tabMenu`** (`TabMenu`): Your items for a tab's menu (right-click, Shift+F10 or the menu key on a tab), after Jali's: Close, Close other tabs, Close tabs to the right, Move tab left and right, Move out of tabs, Split right and down, Maximise. Called as the menu opens, with the tab's pane; `undefined` or `[]` for none. See [`TabMenuItem`](core/types.md#TabMenuItem).

- **`rename`** (`Rename`): Renaming in place: double-click or F2 on a tab or a lone pane's title opens a field there, and `run(pane, text)` saves the name in your app. `can(pane)` limits it to some panes. Without it, nothing offers renaming. See [`Rename`](core/types.md#Rename).

- **`allow`** (`WorkspaceAllow`): What may happen to panes: turn controls off for the whole workspace (`{ fullScreen: false }`), turn Pop out on (`{ popOut: true }`), and `when({ action, pane, presetId, page })` to decide by context; `false` refuses. Each kind's own `allow` is asked first, and only takes away. See [Choose what people can do with panes](../guides/pane-controls.md) and [`WorkspaceAllow`](core/types.md#WorkspaceAllow).

- **`buttons`** (`PaneButtons`): The buttons in a pane's header, as shortcuts: everything allowed is in the pane's menu (right-click, ⋯ or Shift+F10) and ⌘K either way. Leave it out for Jali's: Tuck, Maximise and Close, with Full screen in Maximise's place on a lone pane. A list replaces them; a function adjusts them (`(defaults) => [...defaults, "popOut"]`). A kind's own `buttons` win. See [`PaneButtons`](core/types.md#PaneButtons).

- **`phone`** (`PhoneOptions`): Phones: below `phone.below` pixels of workspace width (default 600) the workspace shows Single view, one pane at a time with a switcher, whatever the panes' minimums. `{ below: 0 }` switches only when even one pane can't fit. See [`PhoneOptions`](core/types.md#PhoneOptions).

- **`onPaneError`** (`(error: unknown, info: PaneErrorInfo) => void`): Called when a pane's component throws. That pane shows a failed state with Retry and Close, and the other panes carry on. `info` says which pane ([`PaneErrorInfo`](core/types.md#PaneErrorInfo)). Send it to your error reporting.

- **`messages`** (`MessageOverrides`): Words to use instead of Jali's English ones, by area: `{ commands: { close: "Fermer le volet" } }`. Keys you leave out stay English. See `en` and [Translate Jali](../guides/translating.md).

**Returns** `Jali`: The workspace. Its members are listed under [`Jali`](core/types.md#Jali): `actions`, `get()`, `subscribe()`, `on()`, `model()`, `getLayout()`, `setLayout()`, `keymap`, `env`, `messages`, `href()`, `onToast()` and `start()`.

### actions

*namespace*, from `@jali/core (jali.actions)`

```ts
jali.actions.openBeside(pane: PaneTarget, ref: ObjectRef): ActionResult
```

What an app asks the workspace to do. Each action reads the current state, makes its change once (layout, focus, address, announcement, toast) and returns what happened: `{ ok: true, pane }`, or `{ ok: false, reason }` with the reason it did not.

The pane comes first, by its id or by the object it shows: `close("order")` and `close(orderKind({ id: 7 }))` both work. An action that would remove or replace a pane with unsaved work is held instead (`reason: "unsaved"`), and "Discard unsaved changes?" opens. A following detail with unsaved work keeps its object and says so, while the list's other followers move on. Every action is listed under [`JaliActions`](core/types.md#JaliActions).

## Pane params

What a kind's refs hold, in its `params`: `Number`, `String`, `Boolean`, `oneOf(...)` or your own function, each required unless wrapped in `optional`. The [Pane kinds guide](../guides/pane-kinds.md#params) explains what happens to a ref that is missing a required param. Both are also exported from `@jali/react`.

### optional

*function*, from `@jali/core, @jali/react`

```ts
optional<T extends ParamType>(type: T): OptionalParam<T>
```

A param a ref may leave out. The kind's code sees it as optional (`tab?: string`), and its ref maker takes it or not. An optional param given as `undefined` is left out of the ref, as a link would leave it.

**Parameters**

- **`type`** (`ParamType`, required): How to read it when it is there: `Number`, `String`, `Boolean`, `oneOf(...)` or a function.

**Returns** `OptionalParam<T>`:

### oneOf

*function*, from `@jali/core, @jali/react`

```ts
oneOf<const V extends readonly (string | number)[]>(...values: V): OneOf<V[number]>
```

A param that is one of a few values: `oneOf("open", "closed")` gives `"open" | "closed"`. Values are compared as text, so `oneOf(10, 25)` reads `"25"` from a link as `25`. Any other value can't be read, and the ref doesn't open.

**Parameters**

- **`values`** (`(string | number)[]`, required): The values it can be.

**Returns** `OneOf<V[number]>`: A reader, with the values as `values`.

## Layouts

### row

*function*, from `@jali/core`

```ts
row(options?: RowOptions, ...children: (Draft | ObjectRef)[]): Draft
```

Children side by side. A child is a ref (a pane showing it), a `pane(ref, options)`, or another `row`, `column` or `tabs`. Options come first when there are any: `row({ weight: 2 }, a, b)`.

Nodes without an `id` are named after what they hold: `"row"`, `"column"`, `"tabs"`, or the pane's kind, then `"order-2"` and so on. Give an `id` to a pane another one links to, or that your code names.

**Parameters**

- **`options`** (`RowOptions`): `id`; `weight` (its share of the parent, default 1) or `px` (a fixed length); `scroll: "x"` for a row that scrolls sideways, its children at their own widths, instead of sharing its width and folding what doesn't fit.

- **`children`** (`(Draft | ObjectRef)[]`, required):

**Returns** `Draft`: For `createJali({ layout })`, a preset's `layout`, or `toLayout`.

### column

*function*, from `@jali/core`

```ts
column(options?: SizeOptions, ...children: (Draft | ObjectRef)[]): Draft
```

Children one above the other. Otherwise the same as `row`.

### tabs

*function*, from `@jali/core`

```ts
tabs(options?: TabsOptions, ...panes: (PaneDraft | ObjectRef)[]): Draft
```

Panes as tabs in one place: a stack the person made. `options.active` names the tab shown (default: the first); `id`, `weight` and `px` as for `row`.

### pane

*function*, from `@jali/core`

```ts
pane(ref: ObjectRef, options?: PaneNodeOptions): PaneDraft
```

A pane showing `ref`, with options. A bare ref in a `row` is the same as `pane(ref)`.

**Parameters**

- **`ref`** (`ObjectRef`, required): What it shows: `orderKind({ id: 1 })`.

- **`options`** (`PaneNodeOptions`):

**options**

- **`id`** (`string`): Its node id. Default: its kind's name, then `name-2`, ….

- **`weight`** (`number`): Its share of the parent.

- **`px`** (`number`): A fixed length along the parent's axis instead.

- **`linkedTo`** (`string`): The pane it was opened from. Closing that pane drops the link.

- **`follows`** (`boolean`): With `linkedTo`: it shows whatever is selected in that pane, and moves with the selection.

- **`kept`** (`boolean`): Kept by the person: never reused for another object, never following, the last to fold.

- **`pinned`** (`boolean`): A pinned tab: first in its tab group, left open by Close other tabs and Close tabs to the right, and still pinned if it leaves the group and joins another.

- **`role`** (`string`): The place it fills in a curated page's designed layout (the view's id).

- **`priority`** (`"primary" | "supporting"`): Supporting panes give way first when room runs out.

- **`hidden`** (`boolean`): Off screen at the start, with no slot or tab; showing it brings it back.

**Returns** `PaneDraft`:

### toLayout

*function*, from `@jali/core`

```ts
toLayout(input: LayoutInput): Layout
```

The plain layout tree a builder's result stands for, with an id on every node: what the address carries and the layout namespace works on. A whole `Layout` comes back as it is; a single ref becomes a one-pane layout. You rarely need it: everything that takes a layout takes a builder's result.

**Returns** `Layout`:

### sameRef

*function*, from `@jali/core`

```ts
sameRef(a: ObjectRef | undefined, b: ObjectRef | undefined): boolean
```

Whether two refs are exactly the same: the same kind and the same params, compared with `===`. `1` and `"1"` differ here; to ask whether two refs show the same object, use `kinds.sameObject`.

**Parameters**

- **`a`** (`ObjectRef | undefined`, required):
- **`b`** (`ObjectRef | undefined`, required):

**Returns** `boolean`: `false` when either is `undefined`.

## The address and storage

`createJali` makes these for you from its `url` and `storage` options. Pass one yourself for a router, a test or a workspace that must not touch the page.

### browserLocation

*function*, from `@jali/core`

```ts
browserLocation(win?: Window): LocationPort
```

The address as the browser's history: `navigate` calls `pushState` or `replaceState` with the same path and hash (and does nothing when the address would not change), and `subscribe` listens to `popstate`.

**Parameters**

- **`win`** (`Window`): The window whose history to use.

**Returns** `LocationPort`:

### memoryLocation

*function*, from `@jali/core`

```ts
memoryLocation(initial?: string): LocationPort & { entries: string[]; visit(search: string): void }
```

An address that lives in memory: for tests, server rendering, and a workspace in a dialog that must not touch the page's address.

**Parameters**

- **`initial`** (`string`): The first search string.

**Returns** `LocationPort & { entries: string[]; visit(search: string): void }`: `entries` is the history, newest last; `href()` is `memory:` plus the search. `visit(search)` is navigation the workspace did not make (Back, a router link): it adds an entry and calls every subscriber. `navigate` does not call subscribers.

### browserStorage

*function*, from `@jali/core`

```ts
browserStorage(prefix: string): StoragePort
```

`localStorage` under `prefix` (keys are `prefix:key`). Reads and writes never throw: in private mode or with storage blocked, nothing is saved and reads give `null`.

**Parameters**

- **`prefix`** (`string`, required): The key prefix. `createJali({ storage: "orders" })` makes one for you.

**Returns** `StoragePort`:

### memoryStorage

*function*, from `@jali/core`

```ts
memoryStorage(initial?: Record<string, string>): StoragePort
```

Storage in a `Map`, for tests, server rendering and embedded workspaces.

**Parameters**

- **`initial`** (`Record<string, string>`): Keys to start with (`settings`, `pane-state`, …).

**Returns** `StoragePort`:

## Commands and keys

### commandsOf

*function*, from `@jali/core`

```ts
commandsOf(jali: Jali): readonly Command[]
```

Every command the workspace has, in palette order: the fixed set, one per preset, and titles in the workspace's own words (its name, its page's name and viewers). The same array for the same workspace. Every id is on the [Commands](commands.md) page.

**Parameters**

- **`jali`** (`Jali`, required): The workspace (only its `env` is read).

**Returns** `readonly Command[]`: Each with `id`, `title`, `group`, an optional `check` that returns a refusal when it can't run now, and `run`.

### listCommands

*function*, from `@jali/core`

```ts
listCommands(jali: Jali): ListedCommand[]
```

Every command a person can run from a menu now, in the palette's order: the focused pane's own commands first (keys `pane:<id>`), then the workspace's and your own `commands`. Each has its `title`, `group`, `keys` label for this platform, `disabled` and the `reason`, and `run`. For an app with its own command menu (`palette: false`); in React, [`useJaliCommands`](react.md#useJaliCommands). Read it again after `jali.subscribe` calls back.

**Returns** `ListedCommand[]`:

### runCommand

*function*, from `@jali/core`

```ts
runCommand(jali: Jali, id: string): boolean
```

Runs a command by id if its check passes. A refusal is not announced here (the keyboard and the palette do that).

**Parameters**

- **`jali`** (`Jali`, required):
- **`id`** (`string`, required): A command id, such as `"pane.zoom"`.

**Returns** `boolean`: Whether it ran: `false` for an unknown id or a refused check.

### edgeScroll

*function*, from `@jali/core`

```ts
edgeScroll(jali: Jali, onScroll?: () => void): EdgeScroll
```

Scrolls a row that scrolls sideways while a drag is held within 56px of its left or right edge, faster the closer it is, so a drag can reach a pane out of view. For an app's own drag; Jali's pane drag (by a header) already does this. Call `move` on every pointer move and `stop` when the drag ends. `onScroll` runs after each step, so the drag can find what is under the pointer again as the panes slide past.

**Parameters**

- **`jali`** (`Jali`, required):
- **`onScroll`** (`() => void`): After each step of scrolling.

**Returns** `EdgeScroll`:

### EdgeScroll

*type*, from `@jali/core`

```ts
interface EdgeScroll { move(clientX: number, clientY: number): void; stop(): void }
```

What `edgeScroll` returns: tell it where the pointer is, and when the drag ends.

### copyLink

*function*, from `@jali/core`

```ts
copyLink(jali: Jali): void
```

Writes `jali.href()` to the clipboard and announces "Link copied", or "Couldn't copy the link" when the browser refuses. Where `navigator.clipboard` is missing it does nothing. The `layout.copy_link` command runs it.

**Parameters**

- **`jali`** (`Jali`, required):

**Returns** `void`:

### DEFAULT_KEYMAP

*constant*, from `@jali/core`

```ts
const DEFAULT_KEYMAP: { readonly "palette.toggle": readonly ["Mod+K"]; … }
```

The default bindings: command id to one or more binding strings. `Mod` is ⌘ on a Mac and Ctrl elsewhere. Each id and its keys, printed for both platforms, are on the [Commands](commands.md) page.

The defaults keep to three rules:

- single character keys belong to the focused content;
- no keys the browser keeps for itself (⌘W, ⌘T, Ctrl+Tab and the like), no Ctrl+Alt, and no ⌘ or Ctrl with a digit;
- one prefix, ⌘K or Ctrl+K, which opens the palette and starts a two-step chord whose second step keeps Mod held.

### formatKeys

*function*, from `@jali/core`

```ts
formatKeys(seq: KeySequence, platform?: Platform, words?: KeyWords): string
```

A key sequence as people read it: "⌘K ⌘M" on a Mac, "Ctrl+K Ctrl+M" elsewhere. Sequences come from `keymap.sequences(id)`. `jali.keymap.format(seq)` does the same in the workspace's own words.

**Parameters**

- **`seq`** (`readonly Chord[]`, required): One binding: a chord, or a prefix chord and a second chord.

- **`platform`** (`Platform`):
- **`words`** (`KeyWords`): The words for modifiers, Esc, Space and the arrows, such as `messages.keys`.

**Returns** `string`:

### keyHint

*function*, from `@jali/core`

```ts
keyHint(text: string, platform?: Platform, words?: KeyWords): string
```

A binding string printed for the platform: `keyHint("Alt+Enter")` is "⌥↵" on a Mac and "Alt+Enter" elsewhere. For keys a pane handles itself, which are not in the keymap. Throws on a key or modifier it doesn't know.

**Parameters**

- **`text`** (`string`, required): A binding such as `"Mod+K Mod+M"`.

- **`platform`** (`Platform`):
- **`words`** (`KeyWords`): As for `formatKeys`.

**Returns** `string`:

## Words

### en

*constant*, from `@jali/core`

```ts
const en: Messages
```

Jali's English messages: every word it shows or says, by area (`announcements`, `toasts`, `commands`, `commandGroups`, `keys`, `palette`, `chooser`, `confirmDiscard`, `settings`, `tabs`, `shelf`, `pane`, `peek`, `workspace`, `page`, `drop`). A workspace made without `messages` uses this object as is (`jali.messages === en`). Spread it to start a translation. A message that needs values is a function, such as `en.announcements.closed(pane)`; a message with a bold part takes `bold` and returns its parts in order.

## Lists and their detail

### activeItemPort

*function*, from `@jali/core`

```ts
activeItemPort(jali: Jali, pane: NodeId, mapping: ActiveItemMapping): ActiveItemPort
```

Lets a list inside a pane keep its current item through the workspace, so the pane's following detail follows it, Space shows it and an open peek steps with it. The shape matches Chakni's Quick Look port, so a Chakni collection plugs in with no dependency either way. In React, `useActiveItemPort`.

`write(id, "step")` reports the selection (the detail follows once it rests, 150 ms). `"open"` also shows the item: in the following detail when it is on screen, else the peek sheet. `"close"` closes the peek only if this pane opened it; the selection stays. `itemId` reads the pane's selection through `idOf`.

**Parameters**

- **`jali`** (`Jali`, required):
- **`pane`** (`NodeId`, required): The pane the list is in.

- **`mapping`** (`ActiveItemMapping`, required):

**mapping**

- **`toRef`** (`(itemId: string) => ObjectRef`, required): The object an item id shows.

- **`idOf`** (`(ref: ObjectRef) => string | null`, required): The item id of an object, or `null` when it is not one of this list's items.

**Returns** `ActiveItemPort`: `{ itemId, write(itemId, action) }`; `write` always returns `{ status: "accepted" }`.

## Geometry

### GAP

*constant*, from `@jali/core`

```ts
const GAP: number
```

The default gap between panes and inset from the workspace's edges, in pixels (6); a workspace's own are `createJali({ gap, inset })`. For measuring a workspace from outside: its usable area is its element's size minus twice its inset (`GAP * 2` by default).

## The layout namespace

### layout

*namespace*, from `@jali/core`

```ts
import { layout } from "@jali/core";
```

The pure layout tree API: every operation takes a layout (and usually the view and a `LayoutContext`) and returns a new one; nothing is changed in place. The workspace's actions are built on it. To write a layout, use the builders above; these are for working on one. Use it to build or test layouts, or to work out what an action would do. Each member is on [The layout namespace](core/layout.md).
