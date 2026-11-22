# Features

What a workspace does beyond laying out panes, each a value from its own entry, so an app ships only what it uses.

A workspace lays out panes, fits them, focuses, undoes and follows on its own. Everything else is a feature: a value you pass in `createJali({ features })`, imported from its own entry. An app that never imports `jali/palette` ships no palette, its words included.

```ts

const jali = createJali({ panes, layout, features: [...defaultFeatures(), rename({ run: save })] });
```

A feature given again takes the earlier one's place, so `[...defaultFeatures(), urlSync({ location })]` keeps the defaults with the address in a router's hands.

### defaultFeatures

*function*, from `jali/features`

```ts
defaultFeatures(): Feature[]
```

Every feature Jali had on by itself before features were opt-in: the address (`urlSync()`), ⌘K (`palette()`), Settings (`settings()`), the chooser (`chooser()`) and `data-pressed` (`pressed()`). Rename and Pop out need your app's say, so they are not in it.

### urlSync

*function*, from `jali/url`

```ts
urlSync(options?: { location?: LocationPort; prefix?: string; sizes?: LinkSizes }): Feature
```

The layout lives in the address: a link reopens it, Back and Forward step through it, and a reload keeps it. Without it, the workspace leaves the address alone. Framework-free. Outside a browser, with no `location`, it does nothing, so the same workspace renders on a server.

**Parameters**

- **`location`** (`LocationPort`): A router's address, or `memoryLocation()` in tests. See [The address and routers](../guides/url-and-routers.md).

- **`prefix`** (`string`): Names this workspace's params apart from another's on one address (`"n."` writes `n.l`).

- **`sizes`** (`"local" | "link"`): What a link says about sizes: the layout as designed, with dragged sizes kept on this device, or every size.

### palette

*function*, from `jali/palette`

```ts
palette(): Feature
```

Jali's command palette, on ⌘K (`keyboard.prefix`). Leave it out when your app's own command menu lists Jali's commands ([`useJaliCommands`](react.md#useJaliCommands)): the key is then yours, unless `keyboard.keymap` binds `"palette.toggle"`, and `jali.dialogs.openPalette()` is refused as `"unavailable"`.

### settings

*function*, from `jali/settings`

```ts
settings(): Feature
```

The settings panel (theme, centre drop, pane cap, the keys) and **Open settings** in ⌘K. `<JaliRoot settingsExtra>` adds your own fieldsets to it. Without it, `jali.dialogs.openSettings()` is refused as `"unavailable"`.

### chooser

*function*, from `jali/chooser`

```ts
chooser(): Feature
```

The chooser: **Add to tabs of…** (⌘K ⌘G) and `jali.dialogs.choose`, an item your command asks of the person. Without it, `choose` is refused as `"unavailable"`.

### rename

*function*, from `jali/rename`

```ts
rename(options: Rename): Feature
```

Renaming a pane in place: double-click or F2 on a tab, or on a lone pane's title, opens a field there, and **Rename pane** is in ⌘K and the tab's menu. `run(pane, text)` saves the name in your app, which then shows it (`useTitle`); return `false`, throw or reject to keep the field open. `can(pane)` says which panes may be renamed (default: all). See [`Rename`](core/types.md#Rename).

### popOut

*function*, from `jali/pop-out`

```ts
popOut(): Feature
```

A pane in a floating window that stays on top of every other window, as a video call's does, through Document Picture-in-Picture (Chrome and Edge on desktop). It adds a Pop out button to the header (before Close), Pop out to the pane's and the tab's menu, and **Pop out pane** (`pane.pop_out`) to ⌘K, with no key until you bind one. A kind or the workspace can still turn it off (`allow: { popOut: false }`).

The window is the workspace's own: one per workspace, closed when its `<JaliRoot>` unmounts, `destroy()`, or another workspace takes the root. The pane's content moves into the window whole, so its own state, subscriptions and DOM survive the trip there and back (iframes and media reload when moved). Jali's keys work in the window, and it keeps the workspace's theme, `--jali-*` tokens, direction and the page's zoom while it is open; its root has `[data-jali]`. A request the browser refuses (no gesture, another window in the way) does nothing. The pane keeps its place, saying "Popped out into its own window" with Bring back; closing the window brings it back too.

The browser's rules apply: Chrome keeps one floating window at a time across all its tabs, so opening another closes this one and the pane comes back; on macOS it doesn't appear over an app in full screen. A workspace that hydrated a server's HTML renders the content again in the window, so its own state starts again there.

### pressed

*function*, from `jali/pressed`

```ts
pressed(): Feature
```

`data-pressed` on Jali's controls while they are held, by pointer or by Space or Enter, for a theme that draws a key going down. Jali's own styles don't read it.

### Feature

*type*, from `jali`

```ts
interface Feature { readonly id: FeatureId }
```

A feature, made by its entry's function. Pass it in `createJali({ features })`; what it contains is Jali's own.

### FeatureId

*type*, from `jali`

```ts
type FeatureId = "urlSync" | "palette" | "settings" | "chooser" | "rename" | "popOut" | "pressed"
```

Which feature it is. One of each id is kept: a later one takes an earlier one's place.
