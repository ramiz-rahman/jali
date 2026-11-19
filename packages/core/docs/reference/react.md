# @jali/react

Every component, hook and type @jali/react exports, with its props, defaults and what it returns.

React components and hooks for a workspace made with [@jali/core](core.md). React 18.2 or later (18 or 19) is a peer dependency; nothing else is. Jali's icons are in the package. See [Icons](#icons).

```sh
npm install @jali/core @jali/react
```

Styles: `@jali/react/styles.css` is Jali's default theme and the workspace's styles; `@jali/react/theme.css` is the theme alone; `@jali/react/tailwind.css` points the tokens at your Tailwind theme. See [Tokens](tokens.md).

## Start here

### JaliRoot

*component*, from `@jali/react`

```ts
<JaliRoot jali={jali} icons? overlays? settings? settingsExtra?>{children?}</JaliRoot>
```

Draws a workspace: its panes, and the dialogs every workspace has (the command palette unless the workspace was made with `palette: false`, Settings, the "Add to tabs of…" chooser, "Discard unsaved changes?" and the live region). While it is mounted, it starts the workspace's keys, Back and Forward, theme and saving ([`Jali`](core/types.md#Jali)'s `start`), and stops them when it unmounts.

`<JaliRoot jali={jali} />` is a whole app. To add your own chrome, pass children and put `<JaliView />` where the panes go.

The root is a `<div data-jali>` that the workspace attaches to, so focus, drag and F6 stay inside it. The dialogs render after it, in a `<div data-jali-layer>` (styled `display: contents`), which counts as the workspace's for its keys. Mark your own chrome inside it with `data-jali-chrome` and Jali never pulls focus out of it.

Two things are yours to render. **The shelf** (tucked panes as chips): put `Shelf` in your status line or footer, or tucked panes have nowhere to come back from but ⌘K "Show a pane from the shelf". **Toasts**: Jali sends them through `jali.onToast` (closes and tucks come with Undo, which ⌘K ⌘Z also runs) and shows none itself; render them with your toaster in `overlays`.

**Props**

- **`workspace`** (`Jali`, required): From `createJali`.

- **`children`** (`ReactNode`): Rendered inside the root: `<JaliView>` and your chrome.

- **`overlays`** (`ReactNode`): Rendered after the root: things that must sit outside the workspace, such as a toaster. Focus is never pulled back from outside the root.

- **`settings`** (`boolean`): `false` leaves the Settings panel out.

- **`icons`** (`Partial<JaliIcons>`): Your own icons for any of the names Jali draws (`{ close: MyClose }`); the others stay Jali's. See [Icons](#icons).

- **`settingsExtra`** (`ReactNode`): Your own settings, as `<fieldset>`s with a `<legend>`, shown at the end of the Settings panel. Store their values yourself.

- **`...rest`** (`HTMLAttributes<HTMLDivElement>`): Passed to the root `<div>` (`className`, `style`, `id`). `ref` and `data-jali` are Jali's.

### JaliView

*component*, from `@jali/react`

```ts
<JaliView />
```

The panes, or the curated page while one is open. Takes no props. `<JaliRoot>` renders it when it has no children; place it yourself when you add chrome.

## Defining panes and pages

### definePane

*function*, from `@jali/react`

```ts
definePane(kind: string, options: PaneOptionsReact): Pane
```

Defines a kind of pane: what it shows (its params), its title and sizes, and the component that renders it. Pass your kinds to `createJali({ panes })`.

The result is also how you name an object of the kind: `orderKind({ id: 1041 })` is the [ref](../get-started/key-concepts.md#ref) `{ kind: "order", params: { id: 1041 } }`, to open, peek, select or put in a layout. When the kind declares `params`, the call is typed: a missing required param, a wrongly typed one or one the kind doesn't declare is a type error. Params are declared with `Number`, `String`, `Boolean`, [`oneOf`](core.md#oneOf) and [`optional`](core.md#optional), which `@jali/react` also exports.

**Parameters**

- **`kind`** (`string`, required): The kind's name. Every pane of this kind carries it, and links name it.

- **`options`** (`PaneOptionsReact`, required):

Everything in [`PaneOptions`](core/types.md#PaneOptions) (`params`, `title`, `width`, `height`, `shows`, `identity`, `scratch`, `inRecent`, `holdWhileResizing`, `follow`), and:

**view fields**

- **`Component`** (`ComponentType<PaneProps<P>>`, required): Renders the pane's content. It stays mounted while the pane is folded, tabbed, tucked or moved.

- **`Loading`** (`ComponentType<PaneProps<P>>`): Shown while `Component` suspends (for example, it reads data with `use()`). It gets the same props. Default: a quiet "Loading…". The pane's activity is `"loading"` meanwhile.

- **`icon`** (`JaliIcon`): The kind's icon in the header, tab and shelf: any component that takes `{ size, className, "aria-hidden" }`, such as Phosphor's `FileTextIcon`, which matches Jali's own. Jali passes `size` and `aria-hidden`, never a weight, so your icon set's default or its context decides it. Without one, the `defaultKind` icon (a square).

**Returns** `Pane<P>`: The kind, callable: `(params) => ObjectRef`.

### Pane

*type*, from `@jali/react`

```ts
type Pane<P = any> = PaneKindDef & {
  (params: P): ObjectRef;
  readonly kind: string;
}
```

A kind made with `definePane`. `P` is its params' type; `Pane` alone is any kind, for a list of them.

### PaneOptionsReact

*type*, from `@jali/react`

```ts
interface PaneOptionsReact<P> extends PaneOptions<P> {
  icon?: JaliIcon;
  Component: ComponentType<PaneProps<P>>;
  Loading?: ComponentType<PaneProps<P>>;
}
```

The options of `definePane`.

### PaneProps

*type*, from `@jali/react`

```ts
interface PaneProps<P = Params>
```

What a kind's `Component` gets. Components below it read the same with `usePane`. To type a component written apart from its kind, declare the params first and pass their declaration: `const orderParams = { id: Number }`, then `PaneProps<typeof orderParams>` (`params` is `{ id: number }`). `PaneProps<{ id: number }>`, the params' own type, also works.

Keys: content first. Claim the keys you use with `event.preventDefault()` (J and K, Space, Enter, ⌘Z for your own undo, the first Esc) and let the rest bubble; single character keys must act only while your content has focus. Content that needs every key (an editor) marks itself `data-pane-keys="content"`; the workspace then takes only F6 and Shift+F6 there.

**Props**

- **`params`** (`P`, required): What the pane shows, read with the kind's `params` types. A ref missing a required param, or holding a value its type can't read, never gets here: its pane shows a message naming the param instead.

- **`node`** (`PaneNode`, required): The layout node, with the full ref (`node.ref`). In the peek sheet, a node that is not in the layout.

- **`paused`** (`boolean`, required): The pane is hidden: tabbed away, tucked, folded, or behind a maximised pane. Pause subscriptions and timers; keep state.

- **`focused`** (`boolean`, required): The pane has workspace focus.

- **`inPeek`** (`boolean`, required): Rendered in the peek sheet rather than a pane.

- **`openBeside`** (`(ref: ObjectRef) => ActionResult`, required): Open `ref` beside this pane; focus stays here. The selected item opens a following detail (kept if one already follows); another link replaces this pane's earlier plain link of the same kind. Returns what `jali.actions.openBeside` does: `pane` is the pane that shows `ref`.

- **`openHere`** (`(ref: ObjectRef) => ActionResult`, required): Show `ref` in this pane. If it is open elsewhere, that pane is focused instead. In the peek sheet, which has no pane of its own, `{ ok: false, reason: "unavailable" }`.

- **`peek`** (`(ref: ObjectRef | null) => ActionResult`, required): Open or move the peek sheet; `null` closes it.

- **`select`** (`(ref: ObjectRef | null, options?: { inResults?: boolean }) => ActionResult`, required): Report the item a list is on. An open peek from this pane follows it at once; this pane's following detail once it rests. `{ inResults: false }`: the filter no longer shows `ref`. Report the selection before opening it, so the opened pane is linked to it.

- **`dismiss`** (`() => void`, required): Close this pane quietly, with no undo toast: for the launcher.

### definePage

*function*, from `@jali/react`

```ts
definePage(page: Page): Page
```

Defines a curated page: one item at a time (a loan application, a customer), its views as tabs, a list of items at the left (`Rail`, which calls `activate(item)` to show another) and the item's header above the tabs (`Header`). Pass it to `createJali({ page })`. It returns `page` as it is; it is there for the types.

**Returns** `Page`:

### Page

*type*, from `@jali/react`

```ts
interface Page<I extends ItemId = any> extends ProfileBase<PageView, I> {
  Rail: ComponentType<{ item: I; activate: (item: I) => void }>;
  Header: ComponentType<{ item: I }>;
}
```

A curated page for React: [`ProfileBase`](core/types.md#ProfileBase) with its rail and header. `I` is the item id's type, `number` or `string`, as in `firstItem`.

### PageView

*type*, from `@jali/react`

```ts
interface PageView extends RoleBase { icon: JaliIcon }
```

One of a curated page's views, with the icon for its tab.

## Inside a pane

Each of these acts for the pane it is called in, from any depth inside the kind's component.

### usePane

*hook*, from `@jali/react`

```ts
usePane<P = Params>(): PaneProps<P>
```

The pane's `PaneProps`, for components below the kind's own: `const { params, openBeside } = usePane<{ id: number }>()`. Throws outside a pane.

**Returns** `PaneProps<P>`:

### useActivity

*hook*, from `@jali/react`

```ts
useActivity(activity: PaneActivity | undefined): void
```

Report what the pane is doing (`"loading"`, `"working"`, `"needs-you"`, `"error"` or `"idle"`), for its header, its tab, the shelf and the status line. `undefined` reports nothing. Reported again whenever it changes.

### useUnsaved

*hook*, from `@jali/react`

```ts
useUnsaved(what: string | null | false | undefined): void
```

Report unsaved work in words (`"an unsaved query"`), or a falsy value once it is saved, so `useUnsaved(dirty && "an unsaved note")` works. While a pane has some, closing it, closing others, a preset or showing another object in it asks first; a following detail keeps its object. Moving, tabbing, folding and tucking never ask. Cleared when the component unmounts.

### useTitle

*hook*, from `@jali/react`

```ts
useTitle(title: string | null | undefined): void
```

Name the pane from its data: `useTitle(customer.data?.name)` shows "Acme Ltd" rather than the kind's "Customer 12". While set, it replaces the kind's `title` in the header, the tab, the shelf, the palette, the switcher, announcements and `jali.model().title(id)`. In a curated page, the view's label still names the pane, and this title is shown beside it. `null` or `undefined` goes back to the kind's title.

It is cleared when the component unmounts and when the pane shows another object, then set again from the next render. It is not saved, so a reload shows the kind's title until the data loads. The peek sheet keeps the kind's title.

### usePaneAttributes

*hook*, from `@jali/react`

```ts
usePaneAttributes(attributes: Record<\`data-\${string}\`, string> | null | undefined): void
```

Mark the pane from its data with `data-*` attributes, so your styles can tell it apart: `usePaneAttributes({ "data-connection": "production" })` on a query pane connected to production. Jali puts them on everything that stands for the pane: its section, its tab in any strip (folded and tucked too), its shelf chip, its entry in the phone's pane switcher, the tab and shelf menus, and the peek sheet while it shows the pane's object. Jali gives them no style of its own.

Only `data-*` names are kept, and not the ones Jali's own parts use (`data-pane`, `data-tab`, `data-focused`, `data-jali-*` and the rest). `null` or `undefined` clears them. They are cleared when the component unmounts and when the pane closes or shows another object, then set again from the next render. They are not saved. The peek sheet's own content can't set them.

### useCommands

*hook*, from `@jali/react`

```ts
useCommands(commands: readonly PaneCommand[]): void
```

The commands this pane lists first in the palette while it is focused. Pass them on every render: they are listed again only when an id, title, keys label or disabled reason changes, and each runs the latest `run` it was given, so `run` can close over current state. Removed when the component unmounts.

### useLauncher

*hook*, from `@jali/react`

```ts
useLauncher(): LauncherSources
```

For the workspace's launcher: what the person can choose from.

**Returns** `LauncherSources`:

### LauncherSources

*type*, from `@jali/react`

```ts
interface LauncherSources {
  recent: ObjectRef[];
  isOpen(ref: ObjectRef): boolean;
  titleOf(ref: ObjectRef): string;
}
```

Recent (newest first), whether an object is already open in another pane, and an object's title.

### usePaneState

*hook*, from `@jali/react`

```ts
usePaneState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void]
```

State the workspace keeps for a pane: it survives the pane being tabbed, folded, tucked or moved, and a reload (saved on this device 400 ms after it changes). It is dropped when the pane closes for good or shows another object. Use it for what a person expects back (a sort, a draft, a scroll position) and React state for the rest.

In the peek sheet there is no pane, so the state is local and goes with the sheet.

**Parameters**

- **`key`** (`string`, required): The value's name within the pane.

- **`initial`** (`T`, required): Used until a value is set. Read once, as with `useState`. Must be JSON.

**Returns** `[T, (next: T | ((prev: T) => T)) => void]`: The value, and a setter that takes a value or an updater. Values must be JSON.

### useActiveItemPort

*hook*, from `@jali/react`

```ts
useActiveItemPort(mapping: ActiveItemMapping): ActiveItemPort | null
```

The active-item port for the pane this content is in (see [`activeItemPort`](core.md#activeItemPort)). Re-renders when the pane's selection changes, so `itemId` reads fresh.

**Parameters**

- **`mapping`** (`ActiveItemMapping`, required): `toRef(itemId)` and `idOf(ref)`. The port always uses the latest render's mapping and stays the same object, so an inline object is fine.

**Returns** `ActiveItemPort | null`: `null` in the peek sheet.

## The workspace in React

### useJali

*hook*, from `@jali/react`

```ts
useJali(): Jali
```

The workspace from the nearest `<JaliRoot>`: its `actions`, `on`, `getLayout` and `setLayout`, `keymap`, `env` (kinds, presets, page) and state. Reading it does not subscribe; use `useJaliState` or `useJaliModel` for values that change. Throws outside `<JaliRoot>`.

**Returns** `Jali`:

### useJaliState

*hook*, from `@jali/react`

```ts
useJaliState<T>(select: (s: JaliState) => T): T
```

Subscribes to one value of the state. The component re-renders when that value changes (compared with `Object.is`), so return a field or a primitive, not a new object each time.

**Parameters**

- **`select`** (`(s: JaliState) => T`, required): Picks the value.

**Returns** `T`:

### useJaliModel

*hook*, from `@jali/react`

```ts
useJaliModel(): JaliModel
```

The workspace as it is on screen, subscribed: the panes, their boxes and titles, the groups, the shelf. A new object only when something it depends on changed (the layout, the maximised pane, the area, the kinds, the page or the pane cap); focus alone does not change it.

**Returns** `JaliModel`:

### useTheme

*hook*, from `@jali/react`

```ts
useTheme(): "light" | "dark"
```

The theme in use: the person's setting, or the system's when they chose "System". For a toaster or anything else of yours that needs to match.

### useJaliCommands

*hook*, from `@jali/react`

```ts
useJaliCommands(): ListedCommand[]
```

Jali's commands for your app's own command menu, when the workspace is made with `palette: false`: [`listCommands`](core.md#listCommands), re-rendering whenever the list can change (focus, the layout, what panes report). See [Commands and keys](../guides/commands-and-keys.md#inside-an-app-with-its-own-k-and-keys).

**Returns** `ListedCommand[]`:

### useShortcut

*hook*, from `@jali/react`

```ts
useShortcut(id: string): string
```

A command's keys in this workspace's keymap, for a tooltip ("⌘K ⌘[" or "Ctrl+K Ctrl+["); `""` when unbound.

**Parameters**

- **`id`** (`string`, required): A command id.

**Returns** `string`:

### JaliProvider

*component*, from `@jali/react`

```ts
<JaliProvider jali={jali} icons?>{children}</JaliProvider>
```

Makes a workspace available to the hooks and parts below it. `<JaliRoot>` renders one; use it alone when you compose the parts yourself, and call `jali.start()` in an effect.

**Props**

- **`workspace`** (`Jali`, required):
- **`icons`** (`Partial<JaliIcons>`): As on `<JaliRoot>`.

- **`children`** (`ReactNode`):

## Parts

`<JaliRoot>` and `<JaliView>` render these. Use them to compose your own: each must be inside a `<JaliProvider>`, and none takes props unless shown.

### Panes

*component*, from `@jali/react`

```ts
<Panes />
```

The panes: frames, dividers, drop zones, the drag chip, the peek sheet and (on a phone) the pane switcher. It is a `<section aria-label="Panes">` region, or the page's `<main>` with `createJali({ landmark: "main" })`, measures itself to set the workspace's `area`, keeps DOM focus on the focused pane, and announces panes folding or unfolding when the room changes. When even one pane's minimum doesn't fit, it shows one pane at a time. It is `position: relative` with `overflow: hidden` and no size of its own. Jali's styles make the root (`[data-jali]`) fill its box as a flex column, with the panes at `flex: 1`, so they take the room your own chrome leaves. Your own layout (a grid or flex cell) wins over those styles. If the panes still measure 0 high after they mount, a development warning in the console says so.

### CuratedPage

*component*, from `@jali/react`

```ts
<CuratedPage />
```

A curated page: the page's `Rail` at the left; its `Header`, the page tabs and `<Panes>` at the right. Renders only while a page is open (it reads it without checking).

### PageBar

*component*, from `@jali/react`

```ts
<PageBar />
```

A curated page's controls, for your top bar: the Single / Split view switch (Split view disabled for a limited viewer), in Split view the "Investigating · N opened" group with Back to the page, and Reset. Renders nothing while no page is open.

### Shelf

*component*, from `@jali/react`

```ts
<Shelf />
```

The panes the person tucked, as chips grouped by home (with Put back), for a status line. Folded panes are not here: they wait behind their tab strip's **N folded** chip. Arrow keys move between chips, Enter shows one, Shift+Enter puts it back. Renders nothing when no pane is tucked.

### Announcer

*component*, from `@jali/react`

```ts
<Announcer />
```

The one polite live region (`role="status"`) every layout change is announced in. It clears and then sets the text, so a repeat is announced again.

### Palette

*component*, from `@jali/react`

```ts
<Palette />
```

The command palette (⌘K or Ctrl+K), while `paletteOpen` is set. The focused pane's own commands come first, then every workspace command with its group and keys; refused ones are greyed. Choosing one closes the palette and runs it once focus is back.

### SettingsPanel

*component*, from `@jali/react`

```ts
<SettingsPanel>{extra?}</SettingsPanel>
```

The Settings dialog, while `settingsOpen` is set: theme, centre drop, pane cap (2 to 16), a curated page's opened-pane marking and viewer, every key binding from the workspace's keymap, then its children (your own fieldsets; `<JaliRoot settingsExtra>`). Changes go through `actions.changeSettings` and are saved on this device.

### Chooser

*component*, from `@jali/react`

```ts
<Chooser />
```

"Add to tabs of…" (the `pane.merge` command): pick a pane or tab group on screen by title, and the focused pane joins it. Renders while `chooser` is set.

### ConfirmDiscard

*component*, from `@jali/react`

```ts
<ConfirmDiscard />
```

"Discard unsaved changes?", while a change that would lose unsaved work is held (`confirm`). Lists each pane and its work. Keep editing is the default (focused, Esc and a click outside); Discard makes the held change as it was asked for.

### KindIcon

*component*, from `@jali/react`

```ts
<KindIcon kind={kind} size={16} />
```

A kind's icon at `size`, `aria-hidden`; the `defaultKind` icon (a square unless you replaced it) for an unknown kind or one without an icon.

**Props**

- **`kind`** (`string`, required): The kind's name.

- **`size`** (`number`): Pixels.

### Activity

*component*, from `@jali/react`

```ts
<Activity a={activity} shape? />
```

A pane's activity mark. Renders nothing for `idle` or `undefined`.

**Props**

- **`a`** (`PaneActivity | undefined`, required): What the pane reported.

- **`shape`** (`boolean`): `false`: a coloured dot labelled for screen readers ("Loading", "Working", "Needs you", "Error"). `true`: the shelf's mark, a shape as well as a colour (a ring for loading and working, "!" for needs-you, a cross for error), hidden from screen readers.

### JaliRootProps

*type*, from `@jali/react`

```ts
interface JaliRootProps extends HTMLAttributes<HTMLDivElement> {
  workspace: Jali; icons?: Partial<JaliIcons>; children?: ReactNode;
  overlays?: ReactNode; settings?: boolean;
}
```

The props of `JaliRoot`.

## Icons

Jali draws its own chrome icons from a map of names (`JaliIcons`). Its defaults are in the package (Phosphor's regular weight, copied, so you install no icon library), and `<JaliRoot icons>` replaces any of them. A kind's icon is the kind's own (`definePane({ icon })`). The host's buttons (your top bar, ⌘K, settings, a switcher) are yours and use your icons already. See [Your own icons](../guides/theming.md#your-own-icons).

```ts
import { JaliRoot } from "@jali/react"; // Jali's icons; icons={...} replaces any of them
import { defaultIcons } from "@jali/react/icons"; // Jali's full set, to spread under your own
```

### JaliIcons

*type*, from `@jali/react`

```ts
type JaliIcons = Record<JaliIconName, JaliIcon>
```

One icon per name Jali draws. `<JaliRoot icons>` takes any part of it; type your own set as `JaliIcons` to have the types check it names every icon.

- **`icons.close`**, `close: JaliIcon`: Close a pane, a tab, the peek and Settings. Default: Phosphor's `X`.

- **`icons.maximise`**, `maximise: JaliIcon`: Maximise a pane. Default: Phosphor's `ArrowsOutSimple`.

- **`icons.restore`**, `restore: JaliIcon`: Restore a maximised pane. Default: Phosphor's `ArrowsInSimple`.

- **`icons.fullScreen`**, `fullScreen: JaliIcon`: Put a pane on the whole screen. Default: Phosphor's `CornersOut`.

- **`icons.exitFullScreen`**, `exitFullScreen: JaliIcon`: Leave full screen. Default: Phosphor's `CornersIn`.

- **`icons.tuck`**, `tuck: JaliIcon`: Tuck a pane into the shelf. Default: Phosphor's `Minus`.

- **`icons.putBack`**, `putBack: JaliIcon`: Put a tucked or folded pane back, on its tab and shelf chip. Default: Phosphor's `ArrowUUpLeft`.

- **`icons.newTab`**, `newTab: JaliIcon`: A tab group's "New tab". Default: Phosphor's `Plus`.

- **`icons.more`**, `more: JaliIcon`: The tab-overflow menu's button. Default: Phosphor's `CaretDown`.

- **`icons.menu`**, `menu: JaliIcon`: The ⋯ button in a pane's header, which opens the pane's menu. Default: Phosphor's `DotsThree`.

- **`icons.popOut`**, `popOut: JaliIcon`: The Pop out button, when a pane's `buttons` include it (Bring back while popped out). Default: Phosphor's `PictureInPicture`.

- **`icons.current`**, `current: JaliIcon`: The shown tab in the tab-overflow menu. Default: Phosphor's `Check`.

- **`icons.fold`**, `fold: JaliIcon`: Marks a folded pane: the strip's **N folded** chip, and the tab of a folded pane while it is shown. Default: Phosphor's `ArrowsInLineHorizontal`.

- **`icons.grip`**, `grip: JaliIcon`: The drag handle on a pane's header. Default: Phosphor's `DotsSix`.

- **`icons.follow`**, `follow: JaliIcon`: A linked pane's toggle while it follows (**Following**). Default: Phosphor's `LinkSimpleHorizontal`.

- **`icons.keep`**, `keep: JaliIcon`: A kept pane's toggle (**Kept**). Default: Phosphor's `AnchorSimple`.

- **`icons.pin`**, `pin: JaliIcon`: A pinned tab's mark. Default: Phosphor's `PushPin`.

- **`icons.activityError`**, `activityError: JaliIcon`: The cross in an error activity mark (8px). Default: Phosphor's `X, bold`.

- **`icons.defaultKind`**, `defaultKind: JaliIcon`: A kind without an icon. Default: Phosphor's `Square`.

- **`icons.openBeside`**, `openBeside: JaliIcon`: The peek's "Open beside". Default: Phosphor's `SidebarSimple, mirrored`.

- **`icons.openFull`**, `openFull: JaliIcon`: The peek's "Open full". Default: Phosphor's `CornersOut`.

- **`icons.addToTabs`**, `addToTabs: JaliIcon`: Each group in the "Add to tabs of…" chooser. Default: Phosphor's `Stack`.

- **`icons.singleView`**, `singleView: JaliIcon`: A curated page's "Single view". Default: Phosphor's `Square`.

- **`icons.splitView`**, `splitView: JaliIcon`: A curated page's "Split view". Default: Phosphor's `SquareSplitHorizontal`.

- **`icons.back`**, `back: JaliIcon`: "Back to" the curated page. Default: Phosphor's `ArrowUUpLeft`.

- **`icons.reset`**, `reset: JaliIcon`: Reset a curated page's layout. Default: Phosphor's `ArrowCounterClockwise`.

- **`icons.dropLeft`**, `dropLeft: JaliIcon`: A drop that puts the pane left of its target. Default: Phosphor's `ArrowLeft`.

- **`icons.dropRight`**, `dropRight: JaliIcon`: A drop to the right. Default: Phosphor's `ArrowRight`.

- **`icons.dropTop`**, `dropTop: JaliIcon`: A drop above. Default: Phosphor's `ArrowUp`.

- **`icons.dropBottom`**, `dropBottom: JaliIcon`: A drop below. Default: Phosphor's `ArrowDown`.

- **`icons.dropSwap`**, `dropSwap: JaliIcon`: A centre drop that swaps the two panes. Default: Phosphor's `ArrowsLeftRight`.

- **`icons.dropTab`**, `dropTab: JaliIcon`: A centre drop that adds the pane as a tab. Default: Phosphor's `PlusSquare`.

### JaliIconName

*type*, from `@jali/react`

```ts
type JaliIconName = "close" | "maximise" | "restore" | … | "dropTab"
```

The names above.

### JaliIcon

*type*, from `@jali/react`

```ts
type JaliIcon = ComponentType<JaliIconProps>
```

An icon Jali can draw: any component that takes `JaliIconProps`. Also the type of a kind's `icon`.

### JaliIconProps

*type*, from `@jali/react`

```ts
interface JaliIconProps {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}
```

What Jali passes an icon: its size in pixels, sometimes a class, and `aria-hidden` (a label always sits beside it, or on its button).

### defaultIcons

*constant*, from `@jali/react/icons`

```ts
const defaultIcons: JaliIcons
```

Jali's icon for every name: Phosphor's regular weight, copied into the package. Spread it under a few of your own (`{ ...defaultIcons, close: MyClose }`), or draw your own chrome with it.

### useJaliIcons

*hook*, from `@jali/react`

```ts
useJaliIcons(): JaliIcons
```

The icons this workspace draws with, for chrome of your own that should match Jali's: `const { close } = useJaliIcons()`. Inside `<JaliRoot>` or `<JaliProvider>`.

## Experimental

Prototypes, to try and give feedback on. Their names start `unstable_`, and their shape may change in any release.

### unstable_popOut

*function*, from `@jali/react`

```ts
unstable_popOut(jali: Jali, pane?: string, size?: { width: number; height: number }): Promise<boolean>
```

Off until the workspace allows it: `createJali({ allow: { popOut: true } })`. Opens a pane (default: the focused one) in a floating window that stays on top of every other window, even while the person is in another tab or app, as a video call's does. It uses the browser's Document Picture-in-Picture, in Chrome and Edge on desktop; resolves `false` elsewhere. Call it from a click or a key, since the browser asks for the person's gesture. Where it's allowed, people also find Pop out in a tab's menu and a pane header's (right-click). The window matches the page's browser zoom.

The pane keeps its place in the layout, which says "Popped out into its own window" with a Bring back button. Its content renders in the window with the page's styles and theme, and keeps Jali's context, so its hooks, data and actions work. Closing the window, Bring back, or closing the pane puts it back. One pane at a time.

Known limits: the content remounts as it moves, so its own `useState` starts again (`usePaneState` and your data cache carry over); Jali's keys don't work inside the window yet; and the window closes when the page that opened it navigates away.

### unstable_bringBack

*function*, from `@jali/react`

```ts
unstable_bringBack(): void
```

Puts the popped-out pane back in its place and closes its window.

### unstable_canPopOut

*function*, from `@jali/react`

```ts
unstable_canPopOut(): boolean
```

Whether this browser can pop a pane out: Document Picture-in-Picture on a secure page. Use it to offer Pop out only where it works.
