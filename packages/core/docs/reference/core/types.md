# @jali/core types

Every type @jali/core exports, with its fields, and every workspace action.

Import any of these with `import type { … } from "@jali/core"`. Functions that use them are on [@jali/core](../core.md) and [The layout namespace](layout.md).

## The layout tree

### Layout

*type*, from `@jali/core`

```ts
interface Layout { version: 1; root: LayoutNode; overlay?: Overlay }
```

A workspace's arrangement: a tree of rows, columns and tab stacks of panes. The tree is the arrangement the person made; folds, tucks, tab choices and hidden panes are recorded in `overlay`, so they can be undone without losing a slot. This is what `?l=` holds.

**Fields**

- **`version`** (`1`, required): Always `1`.

- **`root`** (`LayoutNode`, required): The top node. A single pane is a valid root.

- **`overlay`** (`Overlay`): What the layout and the person did on top of the tree. Written by the operations; leave it out when you build a layout.

### LayoutNode

*type*, from `@jali/core`

```ts
type LayoutNode = PaneNode | StackNode | SplitNode
```

One node of the tree. Every node has an `id` (unique in the layout), a `size`, and optionally `userSized` (the person dragged it) and `base` (the size a divider reset returns to).

### PaneNode

*type*, from `@jali/core`

```ts
interface PaneNode { type: "pane"; id; size; ref: ObjectRef; … }
```

A pane: one object, shown by its kind's component.

**Fields**

- **`type`** (`"pane"`, required):
- **`id`** (`NodeId`, required): Unique in the layout. In a curated page a role's pane id equals its role id.

- **`size`** (`Size`, required): Its share of its split.

- **`ref`** (`ObjectRef`, required): What it shows.

- **`userSized`** (`boolean`): The person sized it with a divider.

- **`base`** (`Size`): The size a divider reset returns to. Carried in the layout and the URL.

- **`linkedTo`** (`NodeId`): The pane it was opened from. Closing that pane drops the link.

- **`follows`** (`boolean`): It shows the object selected in `linkedTo` and changes in place when the selection moves. At most one per source and kind.

- **`kept`** (`boolean`): Kept by the person: never reused for another object, never following, the last to fold.

- **`pinned`** (`boolean`): A pinned tab: first in its tab group, left open by Close other tabs and Close tabs to the right, and still pinned if it leaves the group and joins another.

- **`born`** (`number`): Its age, rising with each open; older panes fold first when over the cap. Panes without one come before new ones.

- **`role`** (`string`): The view of a curated page it fills ("borrower"). Panes without a role were opened by the person.

- **`priority`** (`"primary" | "supporting"`): Supporting panes give way first when room runs out; a primary pane never folds while another can.

### SplitNode

*type*, from `@jali/core`

```ts
interface SplitNode { type: "row" | "column"; id; size; children: LayoutNode[] }
```

Children side by side (`"row"`) or one above another (`"column"`), sharing the space by their sizes. Splits nobody sized share by the panes' comfortable and maximum widths; once the person sizes a child, the split keeps its proportions exactly.

### StackNode

*type*, from `@jali/core`

```ts
interface StackNode { type: "stack"; id; size; children: PaneNode[]; active: NodeId; origin?: "user" }
```

A tab group the person made (by merging, a centre drop or a new tab). Groups made by folding are not in the tree; they exist in `overlay`. `active` is the shown tab; `origin` is optional (`"user"` when set); leave it out in hand-written layouts.

### Size

*type*, from `@jali/core`

```ts
type Size = { px: number } | { weight: number }
```

A share of a split (`weight`, relative to the siblings) or a fixed length in pixels. Divider drags store weights, scaled so the ones a drag sets average 1.

### NodeId

*type*, from `@jali/core`

```ts
type NodeId = string
```

A node's id.

### ObjectRef

*type*, from `@jali/core`

```ts
interface ObjectRef { kind: string; params: Record<string, string | number | boolean> }
```

What a pane shows: a kind and the params that name the object (`{ kind: "order", params: { id: 1041 } }`). Params must be strings, finite numbers or booleans.

### Axis

*type*, from `@jali/core`

```ts
type Axis = "row" | "column"
```

The direction of a split.

### Edge

*type*, from `@jali/core`

```ts
type Edge = "left" | "right" | "top" | "bottom"
```

A side of a pane: where to open or drop. In actions and commands it is a side of the screen, in either reading direction. The layout operations (`layout.drop`, `layout.open`, `layout.split`) take a side in the tree instead: `"left"` is before, `"right"` after, which right to left is the other side of the screen.

### Direction

*type*, from `@jali/core`

```ts
type Direction = "ltr" | "rtl"
```

The reading direction a workspace lays its panes out in (`jali.get().dir`, `createJali({ dir })`). Right to left, a row's first child is at the right: the same tree, mirrored on screen.

### Overlay

*type*, from `@jali/core`

```ts
interface Overlay { tucks; folds; shown; hidden? }
```

What sits on top of the tree. Written by the operations; read it, don't write it.

**Fields**

- **`tucks`** (`{ pane: NodeId; home: NodeId; seq: number }[]`, required): Panes tucked into another pane (their home), in order.

- **`folds`** (`NodeId[]`, required): Slots folded for room, in order. The ids are opaque.

- **`shown`** (`Record<NodeId, NodeId>`, required): The chosen tab of each folded or tucked group, keyed by the group's home pane.

- **`hidden`** (`NodeId[]`): Panes taken off screen with no tab and no slot (a curated page's views in the tabs).

### ViewState

*type*, from `@jali/core`

```ts
interface ViewState { focused?: NodeId; zoomed?: NodeId; scroll?: Record<NodeId, number>; peek?: ObjectRef; focusHistory: NodeId[] }
```

What the person is looking at, apart from the layout.

**Fields**

- **`focused`** (`NodeId`): The pane with workspace focus (the accent edge).

- **`zoomed`** (`NodeId`): The maximised pane. In the URL as `zoom`.

- **`scroll`** (`Record<NodeId, number>`): How far each row that scrolls has scrolled, by the row's id, in px along its content, set where the row comes to rest. In the URL as `scroll` (`week:732`); a strip at its start writes nothing, and scrolling replaces the history entry.

- **`peek`** (`ObjectRef`): What the peek sheet shows. In the URL as `peek`.

- **`focusHistory`** (`NodeId[]`, required): Panes most recently focused first.

### PaneKind

*type*, from `@jali/core`

```ts
interface PaneKind { kind; title(ref); minWidth; minHeight; comfortableWidth?; maxWidth?; comfortableHeight?; maxHeight?; checkParams? }
```

The part of a kind the layout operations read, from `kinds.registry()`. The sizes are explained under `PaneKindBase`. `checkParams(params)`, set for a kind that declares `params`, says what is wrong with a ref's params (a required param missing, a value its type can't read), or returns `undefined`; [`layout.validate`](layout.md#layout.validate) rejects a layout holding such a ref, so a link to it opens as broken.

### KindRegistry

*type*, from `@jali/core`

```ts
type KindRegistry = Record<string, PaneKind>
```

Kinds by name, as the layout operations take them (`kinds.registry()`).

### LayoutContext

*type*, from `@jali/core`

```ts
interface LayoutContext { fit: FitOptions; paneCap: number; dir?: Direction }
```

Everything a layout operation needs besides the layout. For a workspace: `{ fit: { ...jali.get().area, gap: GAP, kinds: jali.env.kinds.registry() }, paneCap: jali.get().settings.paneCap, dir: jali.get().dir }`. `paneCap` is the most panes on screen before the oldest folds (the `paneCap` setting). `dir: "rtl"` mirrors the rects `resolve` returns, so they stay screen coordinates; the tree and the fit are the same.

### FitOptions

*type*, from `@jali/core`

```ts
interface FitOptions { width: number; height: number; gap: number; kinds: KindRegistry }
```

The room: the workspace's inner size in pixels, the gap between panes (6 in a workspace), and the kinds.

### Rect

*type*, from `@jali/core`

```ts
interface Rect { x: number; y: number; width: number; height: number }
```

A box in pixels, relative to the workspace's inner area.

### ResolvedLayout

*type*, from `@jali/core`

```ts
interface ResolvedLayout { panes: PaneBox[]; dividers: DividerBox[]; stacks; shelf; scrollers: ScrollerBox[] }
```

What `layout.resolve` returns: `panes` and `dividers` with their rects; `stacks`, the groups made by folding and tucking (`{ id, kind: "fold" | "tuck", homeId, paneIds }`); and `shelf`, every pane behind a tab with why (`{ paneId, homeId, stackId, reason: "tucked" | "folded" | "tab" }`).

### PaneBox

*type*, from `@jali/core`

```ts
interface PaneBox { id: NodeId; rect: Rect; stackId?: NodeId; hidden?: "tab" | "zoom" | "off"; clip?: Rect }
```

A pane's place. `hidden`: behind another tab, behind a maximised pane, or `"off"` (hidden by the overlay, with an empty rect).

### DividerBox

*type*, from `@jali/core`

```ts
interface DividerBox {
  parentId: NodeId; index: number; axis: Axis; rect: Rect;
  min: number; max: number; value: number;
  neighbours?: [NodeId[], NodeId[]];
}
```

A divider between child `index` and `index + 1` of split `parentId`. `value` is the first side's length now; `min` and `max` are how far a drag can take it; `neighbours` are the panes on each side.

### ScrollerBox

*type*, from `@jali/core`

```ts
interface ScrollerBox { id: NodeId; rect: Rect; contentWidth: number; paneIds: NodeId[] }
```

A row that scrolls sideways (`row({ scroll: "x" }, …)`), as drawn. `rect` is its window on screen; its panes are laid along its content, `contentWidth` long, from `rect.x`. Once scrolled (`layout.scrolled`), a strip's panes and dividers carry `clip`: the window they are cut to.

### ResolvedStack

*type*, from `@jali/core`

```ts
interface ResolvedStack { id: NodeId; kind: "fold" | "tuck"; homeId: NodeId; paneIds: NodeId[] }
```

A tab group the fit made, not one in the tree: panes folded into a neighbour (`"fold"`) or tucked into their home (`"tuck"`). `homeId` is the pane whose slot holds them.

### ShelfEntry

*type*, from `@jali/core`

```ts
interface ShelfEntry { paneId: NodeId; homeId: NodeId; stackId: NodeId; reason: "tucked" | "folded" | "tab" }
```

A pane that is not on screen, listed on the shelf: tucked, folded by the fit, or a background tab of a tucked or folded group. `homeId` is where it shows when put back.

## Writing a layout

### LayoutInput

*type*, from `@jali/core`

```ts
type LayoutInput = Layout | Draft | ObjectRef
```

Anything that stands for a layout: a builder's result (`row(...)`), a single ref (a one-pane layout), or a whole `Layout`. `createJali({ layout })`, a preset's `layout` and a page's `build` all take one.

### RowOptions

*type*, from `@jali/core`

```ts
interface RowOptions extends SizeOptions { scroll?: "x" }
```

A row's options. `scroll: "x"` makes a row that scrolls sideways: each child keeps its own width (its comfortable width until the person sizes it) and the row scrolls to the rest, so nothing folds. To its parent it needs one child's room; to the pane cap it is one slot. Focusing a pane in it scrolls it into view.

### SizeOptions

*type*, from `@jali/core`

```ts
interface SizeOptions { id?: NodeId; weight?: number; px?: number }
```

A builder node's id and size: a share of its parent (`weight`, default 1) or a fixed length (`px`). See [`row`](../core.md#row).

### PaneNodeOptions

*type*, from `@jali/core`

```ts
interface PaneNodeOptions extends SizeOptions {
  linkedTo?; follows?; kept?; pinned?; role?; priority?; hidden?: boolean;
}
```

The options of [`pane`](../core.md#pane).

### TabsOptions

*type*, from `@jali/core`

```ts
interface TabsOptions extends SizeOptions { active?: NodeId }
```

The options of [`tabs`](../core.md#tabs).

## Kinds and pages

### PaneOptions

*type*, from `@jali/core`

```ts
interface PaneOptions<P = Params> { params?; title; width?; height?; … }
```

What a kind says about itself, apart from how it renders. In React, `definePane(kind, options)` takes these with `Component` and `icon`.

**Fields**

- **`params`** (`ParamTypes`): What a ref of the kind holds, and how to read each param back from a link, which can turn values into text: `{ id: Number, tab: optional(String) }` gives the component and `title` `{ id: number; tab?: string }`. A ref missing a required param, or holding a value its type can't read, never reaches the component (see `ParamProblem`). Without `params`, params are plain values.

- **`title`** (`string | ((params: P) => string)`, required): The pane's title in its header, its tab and the palette.

- **`width`** (`PaneWidth`):

**width**

- **`min`** (`number`): The narrowest the content works at, once it adapts. Below it the pane folds into a tab; it is never squeezed past it.

- **`comfortable`** (`number`): Where spare space takes the pane first, before any sibling grows past its own.

- **`max`** (`number`): The widest the content usefully uses. Spare space past it goes to siblings that can use it; only when every sibling is at its maximum does the pane grow on, and the content keeps its measure. Leave it out for tables and charts.

- **`height`** (`PaneHeight`):

The same three as `width`, down a column.

**height**

- **`min`** (`number`): The shortest the content works at. Below it the pane folds into a tab.

- **`comfortable`** (`number`): Where spare height takes the pane first, before any pane above or below grows past its own.

- **`max`** (`number`): The tallest the content usefully uses. Spare height past it goes to the panes above and below first; only when every one is at its maximum does the pane grow on. A short, wide pane such as a timeline sets it.

- **`shows`** (`string`): The type of object shown, shared by kinds that show the same objects differently. Two panes show the same object when this and their identities match.

- **`identity`** (`(params: P) => unknown`): What makes two panes of this kind the same object (one object, one pane). `1` and `"1"` are the same by default.

- **`scratch`** (`boolean`): Every pane is new (a scratch note, a launcher): never matched against an open pane, and left out of Recent unless `inRecent` says otherwise.

- **`inRecent`** (`boolean | ((params: P) => boolean)`): Whether opened objects of this kind go in Recent.

- **`holdWhileResizing`** (`boolean`): Keep the content as it is during a divider drag and reflow once, on release: for long lists and charts.

- **`allow`** (`PaneAllow`): What may happen to panes of this kind, for what its content can handle: `{ fullScreen: false }`. A kind can only turn controls off. See `PaneAllow`.

- **`buttons`** (`PaneButtons`): The buttons in this kind's header, replacing the workspace's: a list, or a function that adjusts them (`(defaults) => [...defaults, "popOut"]`). Leave it out for the workspace's, or Jali's. See `PaneButtons`.

- **`phone`** (`{ stack?: boolean; place?: "top" | "bottom" }`): Phones only, in stacked view (`createJali({ phone: { stack: true } })`). `stack: false` keeps panes of this kind out of it, so they show alone. `place` asks for the top or the bottom half; otherwise the pane others were opened from goes above.

- **`follow`** (`(selected: ObjectRef) => FollowParams<P> | undefined`): What a following pane of this kind shows when its list selects an object of another kind: the params for it, or `undefined` to keep what it shows. `follow: (selected) => ({ symbol: selected.params.symbol })` lets a chart follow a watchlist that selects quotes. A follower of the selected object's own kind shows that object without it. Params given as `undefined` are left out; if the kind can't read the result (a required param missing), the pane keeps what it shows. See [Following a list](../../learn/following.md#followers-of-other-kinds).

- **`selects`** (`string`): For a list: the kind of the objects it selects (`"quote"` for a watchlist that reports `select(quote(...))`). A pane of this kind with no selection starts on what its follower of that kind shows, when the layout gives it one: at start-up, on a link, after a preset or `setLayout`, in the same change. A follower of another kind gives nothing. See [Following a list](../../learn/following.md#where-a-list-starts).

### PaneWidth

*type*, from `@jali/core`

```ts
interface PaneWidth { min?: number; comfortable?: number; max?: number }
```

A kind's widths in px; see `width` under `PaneOptions`.

### PaneHeight

*type*, from `@jali/core`

```ts
interface PaneHeight { min?: number; comfortable?: number; max?: number }
```

A kind's heights in px; see `height` under `PaneOptions`.

### PaneDefinition

*type*, from `@jali/core`

```ts
type PaneDefinition<P, D> = D & { (params: P): ObjectRef; readonly kind: string }
```

A defined kind, callable to make its refs. In React, `Pane<P>`.

### PaneKindBase

*type*, from `@jali/core`

```ts
interface PaneKindBase extends PaneOptions { kind: string }
```

A kind as a workspace keeps it: its name and its options. What `createJali({ panes })` takes.

### Params

*type*, from `@jali/core`

```ts
type Params = Record<string, ParamValue>
```

A ref's params: plain data, so they fit in a link.

### ParamValue

*type*, from `@jali/core`

```ts
type ParamValue = string | number | boolean
```

One param's value.

### ParamType

*type*, from `@jali/core`

```ts
type ParamType = (value: ParamValue) => ParamValue | undefined
```

How to read one param back: `Number`, `String`, `Boolean`, [`oneOf`](../core.md#oneOf), or your own function. `Number` reads text that is a finite number; `Boolean` reads `true`, `false`, `"true"`, `"false"`, `1` and `0`. Your function says it can't read a value by returning `undefined` or `NaN`, or by throwing.

### ParamTypes

*type*, from `@jali/core`

```ts
type ParamTypes = Record<string, ParamType | OptionalParam>
```

A kind's `params`.

### OptionalParam

*type*, from `@jali/core`

```ts
interface OptionalParam<T extends ParamType = ParamType> { readonly optional: T }
```

A param a ref may leave out, made by [`optional`](../core.md#optional).

### OneOf

*type*, from `@jali/core`

```ts
type OneOf<V extends string | number> = ((value: ParamValue) => V | undefined) & { readonly values: readonly V[] }
```

A param that is one of a few values, made by [`oneOf`](../core.md#oneOf).

### ParamsOf

*type*, from `@jali/core`

```ts
type ParamsOf<T extends ParamTypes> = { [K in Required]: Read<T[K]> } & { [K in Optional]?: Read<T[K]> }
```

The params a kind's code sees, from its declaration: `ParamsOf<{ id: NumberConstructor; tab: OptionalParam<StringConstructor> }>` is `{ id: number; tab?: string }`. Use it as `ParamsOf<typeof orderParams>` to name the type of params declared apart from the kind. Without a declaration, `Params`.

### FollowParams

*type*, from `@jali/core`

```ts
type FollowParams<P> = { [K in keyof P]?: ParamValue | undefined }
```

What a kind's `follow` returns: its params, any of which may be missing. Jali checks them against the kind's `params` before the pane shows them.

### ParamProblem

*type*, from `@jali/core`

```ts
interface ParamProblem { param: string; value?: ParamValue }
```

A param a ref is missing (`value` is undefined), or holds a value its type can't read. A ref with one never reaches the component: a layout link or saved layout holding it opens as broken, a peek or a page's opened pane with it is left out of the link, and a pane your code opens with it shows a message naming the param. Listed by `PaneKinds.problems`.

### PaneKinds

*type*, from `@jali/core`

```ts
interface PaneKinds<D extends PaneKindBase = PaneKindBase>
```

A workspace's kinds, as `jali.env.kinds`.

- **`PaneKinds.register`**, `register(def: D): void`: Adds or replaces a kind and bumps `version()`.

- **`PaneKinds.get`**, `get(kind: string): D | undefined`: The kind's definition.

- **`PaneKinds.version`**, `version(): number`: Bumped by every registration; caches of kind-derived values key on it.

- **`PaneKinds.onChange`**, `onChange(l: () => void): () => void`: Hear registrations. Returns the unsubscribe.

- **`PaneKinds.registry`**, `registry(): KindRegistry`: The framework-free view for the layout operations; the same object until the next registration.

- **`PaneKinds.params`**, `params(ref: ObjectRef): Params`: The ref's params, read with its kind's `params` types.

- **`PaneKinds.problems`**, `problems(ref: ObjectRef): ParamProblem[]`: What its kind can't read in the ref's params: required params missing, values of the wrong type. Empty when it opens.

- **`PaneKinds.title`**, `title(ref: ObjectRef): string`: The title, or the kind name for an unknown kind, a ref with problems or a title that throws.

- **`PaneKinds.identityOf`**, `identityOf(ref: ObjectRef): string | undefined`: The ref's identity as text, `undefined` for scratch kinds.

- **`PaneKinds.sameObject`**, `sameObject(a: ObjectRef, b: ObjectRef): boolean`: Same object type and identity. Scratch refs are never the same object.

- **`PaneKinds.follow`**, `follow(kind: string, selected: ObjectRef): ObjectRef | undefined`: What a following pane of `kind` shows when its list selects `selected`: `selected` itself for its own kind, else what the kind's `follow` gives, when the kind can read it. `undefined`: the pane keeps what it shows.

- **`PaneKinds.sameRecent`**, `sameRecent(a: ObjectRef, b: ObjectRef): boolean`: The same entry in Recent: same kind and identity (scratch kinds: same params).

- **`PaneKinds.isRecordable`**, `isRecordable(ref: ObjectRef): boolean`: Whether it goes in Recent: the kind's `inRecent`.

- **`PaneKinds.isTransient`**, `isTransient(ref: ObjectRef): boolean`: Whether it is the workspace's launcher.

### PaneCommand

*type*, from `@jali/core`

```ts
interface PaneCommand { id: string; title: string; run: () => void; keys?: string; disabled?: string | false }
```

A command a pane adds to the palette while it is focused (`useCommands`). `keys` is only a label: the content handles its own keys. `disabled` greys it out; its text is the reason.

### ItemId

*type*, from `@jali/core`

```ts
type ItemId = string | number
```

A curated page's item id: a number, or a string such as a UUID or a slug. See `firstItem` under `ProfileBase`.

### PaneActivity

*type*, from `@jali/core`

```ts
type PaneActivity = "idle" | "loading" | "working" | "live" | "needs-you" | "error"
```

What a pane reports about itself (`useActivity`), shown in its header, its tab, the shelf and the status line. On the shelf, loading reads as working. `"live"` is ongoing, healthy work meant to go on (recording, streaming, playback): a dot rather than a spinner, read as "Live", and the least pressing on the "N folded" chip.

### PaneErrorInfo

*type*, from `@jali/core`

```ts
interface PaneErrorInfo { pane: NodeId | null; ref: ObjectRef }
```

Which pane failed, for `createJali({ onPaneError })`: its id (`null` in the peek sheet) and the ref it was showing.

### ProfileBase

*type*, from `@jali/core`

```ts
interface ProfileBase<R extends RoleBase = RoleBase, I extends ItemId = ItemId>
```

A curated page about one item (a loan application), framework-free. In React, `definePage` makes a `Page`, which adds the rail and header.

**Fields**

- **`id`** (`string`, required): What a link names: `?page=loan-review`.

- **`name`** (`string`, required): The page's name, in titles and commands ("Back to Loan review").

- **`itemNoun`** (`string`, required): The singular noun for an item ("application").

- **`viewers`** (`{ full: string; limited: string }`): Who works with full access (links open beside, Split view available) and who works in Single with links as a peek, in the person's words.

- **`roles`** (`R[]`, required): The views, in tab order.

- **`home`** (`string`, required): The view Single opens on.

- **`build`** (`(item: I) => LayoutInput`, required): Split view's designed layout. Every role is in the tree, as a pane whose `id` and `role` are the role's id; those not shown at first are `hidden`.

- **`bind`** (`(item: I) => Record<string, ObjectRef>`, required): What each role shows for an item. Another item swaps these in place.

- **`firstItem`** (`I`, required): The item the page opens on. Its type (number or string) is the type of every item id the page is given: a link's `"4"` comes back as `4` when `firstItem` is a number.

### RoleBase

*type*, from `@jali/core`

```ts
interface RoleBase { id: string; label: string; priority: "primary" | "supporting" }
```

One view of a curated page. In React, `PageView` adds its icon.

### ViewMode

*type*, from `@jali/core`

```ts
type ViewMode = "single" | "split"
```

How a curated page is shown: one view at a time (Single) or side by side (Split view). The person's choice, kept on their device and never in a link.

### PaneControl

*type*, from `@jali/core`

```ts
type PaneControl = "close" | "tuck" | "maximise" | "fullScreen" | "move" | "resize" | "pin" | "popOut"
```

Something that can happen to a pane. `move` covers dragging it, the move keys, swapping, merging into tabs, pulling a tab out and reordering tabs; `resize` the dividers beside it. Restoring a maximised pane and leaving full screen are always allowed.

### PaneAllow

*type*, from `@jali/core`

```ts
type PaneAllow = Partial<Record<PaneControl, boolean>>
```

Controls turned off with `false`. Leaving one out, or `true`, leaves it to the other levels. A kind's `allow` and a workspace's are both one.

### WorkspaceAllow

*type*, from `@jali/core`

```ts
type WorkspaceAllow = PaneAllow & { when?: AllowRule }
```

`createJali({ allow })`: the workspace's defaults, and `when` for rules that depend on context. `popOut` is off until this says `true`.

### AllowRule

*type*, from `@jali/core`

```ts
type AllowRule = (ctx: AllowContext) => boolean | undefined | void
```

Asked before each action on a pane, after the kind's `allow`: `false` refuses it; anything else allows it.

### AllowContext

*type*, from `@jali/core`

```ts
interface AllowContext { action: PaneControl; pane: PaneNode; presetId?: string; page?: { mode: ViewMode; item?: string } | null }
```

What `when` is asked about: the action, the pane (its id, kind and params, role, pins and links), the preset the layout came from, and the curated page while one is open.

### PaneButton

*type*, from `@jali/core`

```ts
type PaneButton = "tuck" | "maximise" | "fullScreen" | "popOut" | "close"
```

A button a pane's header can show. `maximise` is Restore while the pane is maximised; `fullScreen` is Exit full screen while it is full screen; `popOut` is Bring back while it is popped out.

### PaneButtons

*type*, from `@jali/core`

```ts
type PaneButtons = readonly PaneButton[] | ((defaults: readonly PaneButton[], ctx: ButtonsContext) => readonly PaneButton[])
```

A header's buttons, in order: a list that replaces the defaults, or a function that adjusts them (`(defaults) => [...defaults, "popOut"]`). Jali's defaults are `["tuck", "maximise", "close"]`, with `fullScreen` in Maximise's place on a lone pane. `allow` and Jali's own rules still filter the list, and Restore and Exit full screen always show while the pane is in that state. A ⋯ button opens the pane's menu whenever it offers more than the buttons do.

### ButtonsContext

*type*, from `@jali/core`

```ts
interface ButtonsContext { pane: PaneNode; presetId?: string; page?: { mode: ViewMode; item?: string } | null }
```

What a `buttons` function is told: the pane, the preset the layout came from, and the curated page while one is open.

### PhoneOptions

*type*, from `@jali/core`

```ts
interface PhoneOptions { below?: number; stack?: boolean; stackFloor?: number; fold?: boolean }
```

How the workspace behaves on a phone (`createJali({ phone })`).

**Fields**

- **`below`** (`number`): Below this workspace width, in CSS pixels, the workspace shows Single view: one pane at a time, with a switcher at the top. Default 600, Android's compact width, which covers portrait phones. `0` leaves it to the panes' minimum widths alone: Single view only when even one pane can't fit.

- **`stack`** (`boolean`): On a portrait phone, show two linked panes one above the other instead of one at a time: the focused pane and the pane it was opened from (a list above its detail), else one opened from it. Only with room for both: the workspace at least 480 pixels tall, and each pane at least `stackFloor` and its kind's minimum height. While the on-screen keyboard is up, the focused pane shows alone. Default `false`.

- **`stackFloor`** (`number`): The shortest a stacked pane may be, in CSS pixels. Default 200.

- **`fold`** (`boolean`): On a screen that folds into two (a half-open Galaxy Fold or Pixel Fold, a Flip in flex mode, a dual-screen phone), put a pane each side of the fold so none straddles the hinge: the focused pane and the pane it was opened from, else the next pane. Read from the browser's viewport segments, in Chrome and Edge 138 and later; elsewhere nothing changes. Default `true`.

### Preset

*type*, from `@jali/core`

```ts
interface Preset { id: string; label: string; build: () => Layout }
```

A layout to start from or switch to ("Layout: Orders"), as `jali.env.presets` holds it: made from a `PresetOptions`, with `build` returning a fresh layout each time.

### PresetOptions

*type*, from `@jali/core`

```ts
interface PresetOptions { id: string; label: string; layout: LayoutInput | (() => LayoutInput); saved?: () => LayoutInput | undefined }
```

A preset, as `createJali({ presets })` takes it. `saved`, if given, is asked each time the preset is chosen: a layout it returns is shown instead of `layout`, so the preset comes back as the person left it. "Reset layout" always builds `layout`. See [Start from presets](../../guides/presets.md#keep-each-preset-as-it-was-left).

### Env

*type*, from `@jali/core`

```ts
interface Env { kinds: PaneKinds; profile: ProfileBase | null; presets: readonly Preset[]; commands?: readonly Command[]; name: string; launcher?: string; dir?: Direction; messages?: Messages }
```

What a workspace is made of besides its state: `jali.env`. `profile` is its curated page; `launcher` the kind Split opens; `dir` the reading direction `createJali({ dir })` fixed, if any.

## The workspace

### Jali

*type*, from `@jali/core`

```ts
interface Jali
```

A workspace, from [`createJali`](../core.md#createJali). It is frozen: these members are all it has.

- **`Jali.actions`**, `actions: JaliActions`: What an app asks the workspace to do. See `JaliActions`.

- **`Jali.get`**, `get(): JaliState`: The state now.

- **`Jali.subscribe`**, `subscribe(fn: () => void): () => void`: Called after every change of state. Returns the unsubscribe. To hear what changed, use `on`.

- **`Jali.model`**, `model(): JaliModel`: The derived model; the same object while nothing it depends on changed.

- **`Jali.on`**, `on(event: keyof JaliEvents, handler: (e) => void): () => void`: Hear one kind of change: `"open"`, `"close"`, `"pin"`, `"focus"` or `"layout"`. Returns the unsubscribe. See `JaliEvents`.

- **`Jali.getLayout`**, `getLayout(): Layout`: The layout on screen, to save. It is plain JSON.

- **`Jali.setLayout`**, `setLayout(layout: LayoutInput): ActionResult`: Show a layout: anything `createJali({ layout })` takes. It is fitted to the room, focus stays on a pane that is still there, and the address gets a new entry, so Back returns to the layout before. A curated page that is open closes. Refused with `"invalid"` for a pane kind the workspace doesn't have; held with `"unsaved"` when a pane that would go has unsaved work; asks `beforeClose` like a close.

- **`Jali.keymap`**, `keymap: Keymap`: This workspace's keys: `label(id)` for a tooltip, `sequences(id)`, `platform`.

- **`Jali.messages`**, `messages: Messages`: Every word it shows or says: `en` with `createJali({ messages })` over it. Use it for your own UI in the same language.

- **`Jali.env`**, `env: Env`: Its kinds, presets, page, name and launcher.

- **`Jali.href`**, `href(): string`: The address to share: the URL writer's, else `location.href`, else `""`.

- **`Jali.onToast`**, `onToast(fn: (t: Toast) => void): () => void`: Render toasts. Toasts sent earlier arrive at once.

- **`Jali.start`**, `start(): () => void`: Starts its listeners (keys, Back and Forward, theme, saving) and returns their stop. `<JaliRoot>` calls it while mounted; calling it while started does nothing.

To save a person's layout, listen for `"layout"` and store `getLayout()`. To restore it, pass it as `createJali({ layout })`: a link in the address still wins, so shared links keep working. A layout that arrives later goes through `setLayout`.

### JaliEvents

*type*, from `@jali/core`

```ts
interface JaliEvents { open; close; pin; focus; layout }
```

What `jali.on` tells you. Each fires once per change, after the change is made, and never for the steps inside one action (a drag before it drops, the steps of a preset switch). In one change they come in this order: `close`, `open`, `pin`, `focus`, `layout`.

Every event also carries `input`, where the change came from (`JaliInput`), so you can tell a person's close from your own code's, or from an agent's:

```ts
jali.on("close", ({ pane, input }) => track("pane closed", { pane, by: input }));
```

**Events**

- **`open`** (`{ pane: NodeId; ref: ObjectRef; previous?: ObjectRef }`, required): A pane was added to the layout, or now shows another object. `previous` is what it showed before. A launcher pane counts.

- **`close`** (`{ pane: NodeId; ref: ObjectRef }`, required): A pane left the layout. A tucked, folded or tabbed pane is still in it.

- **`pin`** (`{ pane: NodeId; pinned: boolean }`, required): A pane's tab was pinned or unpinned, however it happened: the tab menu, `setPinned`, `setLayout`, Back or a link. Not for a pane that arrives pinned, which is an `open`. Pinning a pinned tab is no change, so it says nothing.

- **`focus`** (`{ pane: NodeId | undefined; previous: NodeId | undefined }`, required): Another pane is focused.

- **`layout`** (`{ layout: Layout; source: "action" | "address" }`, required): The layout changed. `"action"`: an action, a gesture, a key or `setLayout`. `"address"`: Back, Forward or a link. Fitting to a new window size does not fire it.

### JaliEventBase

*type*, from `@jali/core`

```ts
interface JaliEventBase { input: JaliInput }
```

What every event in `JaliEvents` carries, beside its own fields.

### JaliInput

*type*, from `@jali/core`

```ts
type JaliInput = "mouse" | "touch" | "pen" | "keyboard" | "virtual" | "agent" | "code"
```

Where a change came from. `mouse`, `touch` and `pen` are a person's pointer; `keyboard` a key; `virtual` a click with no pointer or key behind it, as a screen reader sends; `agent` an agent, through the agent bridge; `code` your own code, with nothing a person did behind it.

A person's input is noted from the page while the workspace is started (`<JaliRoot>` starts it), and lasts until the event that caused it is handled. A change your code makes after a timer or an `await` reads as `code`, even if a click started it. Use it for analytics and to tell changes apart, not to make Jali behave differently.

### JaliOptions

*type*, from `@jali/core`

```ts
interface JaliOptions
```

The options of `createJali`. Each one, with its default, is under [`createJali`](../core.md#createJali).

### JaliState

*type*, from `@jali/core`

```ts
interface JaliState
```

What a workspace holds that an app reads. Read it with `jali.get()` or `useJaliState(select)`. Change it through `actions`.

**Fields**

- **`layout`** (`Layout`, required): The arrangement.

- **`view`** (`ViewState`, required): Focus, maximise, peek.

- **`page`** (`PageState | null`, required): The curated page in use, or `null` for the free workspace.

- **`presetId`** (`string | undefined`, required): The preset last chosen; "Reset layout" rebuilds it.

- **`peekSource`** (`NodeId`): The pane the peek acts for.

- **`resizeMode`** (`NodeId | null`, required): The pane in keyboard resize mode.

- **`settings`** (`Settings`, required): The person's settings.

- **`activity`** (`Record<NodeId, PaneActivity>`, required): What each pane reported.

- **`selection`** (`Record<NodeId, Selection>`, required): Each list pane's selected item.

- **`recent`** (`ObjectRef[]`, required): Objects opened this session, newest first, at most 8.

- **`area`** (`{ width: number; height: number }`, required): The workspace's inner size; `<Panes>` measures it.

- **`dir`** (`Direction`, required): The reading direction the panes are laid out in. `<Panes>` reads it from the page, unless `createJali({ dir })` fixed it.

- **`unsaved`** (`Record<NodeId, string>`, required): Panes with unsaved work, and what it is.

- **`paletteOpen`** (`boolean`, required): The command palette is open.

- **`settingsOpen`** (`boolean`, required): Settings is open.

### PageState

*type*, from `@jali/core`

```ts
interface PageState
```

A curated page in use.

**Fields**

- **`profile`** (`string`, required): The profile's id.

- **`item`** (`ItemId`, required): The item shown.

- **`mode`** (`ViewMode`, required): Single or Split view.

- **`tab`** (`string`, required): The view Single shows (in Split view, the last role focused).

- **`before`** (`Layout`): The Split view layout just before the first opened pane; "Back to …" returns to it.

- **`canInvestigate`** (`boolean`, required): Links open beside (true) or only peek (false).

### Selection

*type*, from `@jali/core`

```ts
interface Selection { ref: ObjectRef; inResults: boolean }
```

A list's selected item. `inResults: false`: the list's filter no longer shows it; the following detail keeps it.

### UrlWriter

*type*, from `@jali/core`

```ts
interface UrlWriter { write(state: () => JaliState, mode: HistoryMode): void; href?(): string }
```

Where a workspace writes its address. Pass one as `url` to write it somewhere of your own. `write` gets a function, so a debounced write reads the latest state.

### JaliModel

*type*, from `@jali/core`

```ts
interface JaliModel
```

What is on screen, derived once per change (`jali.model()`, `useJaliModel()`).

**Fields**

- **`resolved`** (`ResolvedLayout`, required): Boxes, dividers, groups and shelf, with the maximise applied and each row that scrolls at its scroll position.

- **`content`** (`ResolvedLayout`, required): The same, unscrolled: each strip's panes along its content.

- **`outOfView`** (`ReadonlySet<NodeId>`, required): Panes in a row that scrolls, scrolled out of its window. They stay mounted and in the focus order, and are `paused`.

- **`flat`** (`ResolvedLayout`, required): The same as if nothing were maximised.

- **`panes`** (`PaneNode[]`, required): Every pane in tree order.

- **`pane`** (`(id: NodeId | undefined) => PaneNode | undefined`, required): A pane by id.

- **`title`** (`(id: NodeId | undefined) => string`, required): A pane's name, or `"pane"` when there is none.

- **`visible`** (`NodeId[]`, required): Panes on screen, reading order.

- **`flatVisible`** (`NodeId[]`, required): The same as if nothing were maximised.

- **`groups`** (`Map<NodeId, Group>`, required): Every tab group: `{ id, kind: "stack" | "fold" | "tuck", tabs, active }`.

- **`stackOf`** (`(id) => StackNode | undefined`, required): The person's tab group holding a pane.

- **`tuckOf`** (`(id) => { pane; home; seq } | undefined`, required): A pane's tuck.

- **`shownWith`** (`(id: NodeId) => NodeId`, required): The pane on screen in the same group (itself when shown).

- **`shelf`** (`ShelfEntry[]`, required): Tucked panes in tree order, with the pane each sits behind.

- **`folded`** (`NodeId[]`, required): Panes folded for room.

- **`off`** (`NodeId[]`, required): Panes hidden by the overlay.

- **`onScreen`** (`PaneNode[]`, required): Every pane except hidden ones: what the phone's switcher lists.

- **`single`** (`boolean`, required): Even one pane's minimum is wider than the room, so one pane shows at a time.

- **`env`** (`Env`, required):
- **`layout`** (`Layout`, required):

### ActionResult

*type*, from `@jali/core`

```ts
type ActionResult = { ok: true; pane?: NodeId } | Refusal
```

What every action and `setLayout` return. `ok: true` when it happened, or when what it asks for is already so. `pane` is the pane it opened, else the pane it acted on. `pane` is undefined on a refusal, and `reason`, `message` and `settled` are undefined on success, so `result.pane` and `result.reason` read without checking `ok` first.

### Refusal

*type*, from `@jali/core`

```ts
interface Refusal { ok: false; reason: RefusalReason; message?: string; settled?: Promise<ActionResult> }
```

An action that did not happen. `message` is what Jali read out to screen readers, when it said anything; a refusal it did not say is silent, as before. With `reason: "pending"`, `settled` gives the result once `beforeClose` has answered.

### RefusalReason

*type*, from `@jali/core`

```ts
type RefusalReason = "not-found" | "invalid" | "unavailable" | "single-view" | "not-allowed" | "last-pane" | "blocked" | "nothing-to-do" | "unsaved" | "kept" | "pending"
```

**Reasons**

- **`not-found`**: The pane (by id or by what it shows), preset or view named is not there.

- **`invalid`**: The layout given can't be shown: a pane kind the workspace doesn't have, or a malformed tree.

- **`unavailable`**: The workspace can't do this: no launcher (split, new tab), no curated page, no free workspace to go back to.

- **`single-view`**: A curated page in Single view has no layout to change.

- **`not-allowed`**: The person may only peek on this page (`setCanInvestigate(false)`).

- **`last-pane`**: The last pane, or a page's last view on screen, stays.

- **`blocked`**: The pane can't go there: past the edge, tucking the only pane or a tab.

- **`nothing-to-do`**: Nothing to undo, put back, close, resize or unmerge.

- **`unsaved`**: A pane that would go has unsaved work. Jali asks the person ("Discard unsaved changes?") and makes the change if they discard.

- **`kept`**: `beforeClose` kept the panes.

- **`pending`**: `beforeClose` has not answered yet. See `settled`.

### BeforeClose

*type*, from `@jali/core`

```ts
type BeforeClose = (request: CloseRequest) => boolean | Promise<boolean>
```

The host's close guard, `createJali({ beforeClose })`. Jali asks it before a change removes panes or makes a pane show another object. `true` lets the change happen; `false` keeps the panes (`reason: "kept"`). A promise holds the change (`reason: "pending"`) until it answers. If the layout changed in the meantime, the held change is dropped. A guard that throws or rejects keeps the panes.

It is asked first. If it says yes and a pane still reports unsaved work (`useUnsaved`), Jali's own "Discard unsaved changes?" follows; Discard does not ask the guard again. It is not asked while the workspace is made, or for changes that remove nothing (focus, tuck, open beside). When it keeps the panes on Back or Forward, the address goes back to what is on screen.

### CloseRequest

*type*, from `@jali/core`

```ts
interface CloseRequest { panes: { pane: NodeId; ref: ObjectRef }[]; reason: "close" | "show" | "layout" | "address" }
```

What `beforeClose` is asked about: every pane the change would remove or point at another object, with what it shows now.

**reason**

- **`close`**: A close, close others, Back to the page, or a launcher dismissed.

- **`show`**: The pane would show another object: `openHere`, a following detail, another item or view on a page.

- **`layout`**: A new layout: a preset, `setLayout`, undo, a page's mode.

- **`address`**: Back, Forward or a link.

### Toast

*type*, from `@jali/core`

```ts
interface Toast { title: string; description?: string; undo?: boolean; error?: boolean }
```

A toast for the host to render (`jali.onToast`). `undo`: offer Undo (run `jali.actions.undo()`).

### HistoryMode

*type*, from `@jali/core`

```ts
type HistoryMode = "push" | "replace" | "debounce" | "none"
```

How a change reaches the address: a new entry, in place, in place 120 ms after the last call, or not at all.

### Settings

*type*, from `@jali/core`

```ts
interface Settings
```

**Fields**

- **`centreDrop`** (`"swap" | "tab"`, required): What a drop on a pane's centre does.

- **`paneCap`** (`number`, required): The most panes on screen; past it the oldest pane that is not kept or focused folds. Settings allows 2 to 16.

- **`theme`** (`"system" | "light" | "dark"`, required): The theme choice.

- **`boundary`** (`"tint" | "none"`, required): How a curated page marks panes opened while investigating.

### ThemeChoice

*type*, from `@jali/core`

```ts
type ThemeChoice = "system" | "light" | "dark"
```

The theme setting.

### Theme

*type*, from `@jali/core`

```ts
type Theme = "light" | "dark"
```

The theme shown.

### OpenPageOptions

*type*, from `@jali/core`

```ts
interface OpenPageOptions { item?: ItemId; tab?: string }
```

The options of `actions.openPage`: the item to show (default: the last one, else the page's `firstItem`) and the view Single view shows (a role id; default: the last one, else the home view).

### Group

*type*, from `@jali/core`

```ts
interface Group { id: NodeId; kind: "stack" | "fold" | "tuck"; tabs: PaneNode[]; active: NodeId }
```

A tab group as the model sees it (`model().groups`): a stack in the tree, or one the fit made by folding or tucking, with its tabs and the shown one.

## The address and storage

### UrlSyncOptions

*type*, from `@jali/core`

```ts
interface UrlSyncOptions { location?; storage?; prefix?; sizes? }
```

The `url` option of `createJali`: `location` (a `LocationPort`, default the browser's history), `prefix` (for two workspaces in one address: `"b."` writes `b.l`, `b.zoom`), `sizes` (`LinkSizes`) and `storage` (default: the workspace's own).

### LinkSizes

*type*, from `@jali/core`

```ts
type LinkSizes = "link" | "local"
```

What a layout link carries about sizes. `"local"` (the default): the layout as designed, with the sizes the person dragged kept on their device (for up to 12 layouts), so a colleague opens the link at the designed proportions. `"link"`: everything, so the link reopens exactly.

### LocationPort

*type*, from `@jali/core`

```ts
interface LocationPort {
  search(): string;
  href(): string;
  navigate(search: string, mode: NavigateMode): void;
  subscribe(fn: () => void): () => void;
}
```

The address, as a port a router can implement. Jali reads and writes only its own search params. `navigate` goes to the same address with a new search string; `subscribe` hears changes made any other way. An adapter for React Router calls `navigate({ search }, { replace: mode === "replace" })`; for TanStack Router, `router.navigate` and `router.subscribe("onResolved", fn)`.

### NavigateMode

*type*, from `@jali/core`

```ts
type NavigateMode = "push" | "replace"
```

A new history entry, or in place.

### StoragePort

*type*, from `@jali/core`

```ts
interface StoragePort { get(key: string): string | null; set(key: string, value: string): void }
```

What one person keeps on one device. Keys Jali uses: `settings`, `pane-state`, a curated page's preferences, `broken-layout`, and (from the address) `sizes`.

## Commands and keys

### ListedCommand

*type*, from `@jali/core`

```ts
interface ListedCommand {
  key: string; id?: string; title: string; group: string;
  keys: string; disabled: boolean; reason?: string; run(): void;
}
```

One entry of a command menu, from [`listCommands`](../core.md#listCommands). `key` is unique in the list; `id` is the command id, undefined for a pane's own commands. `group` is the pane's title for those. Close your menu before `run`: some commands move focus.

### Rename

*type*, from `@jali/core`

```ts
interface Rename {
  can?(pane: { id: NodeId; ref: ObjectRef }): boolean;
  run(pane: { id: NodeId; ref: ObjectRef }, text: string): void | false | Promise<void | false>;
}
```

Renaming in place, from `createJali({ rename })`. Double-click or F2 on a tab, or on a lone pane's title, the tab menu's Rename…, or `actions.startRename` opens a field there with the title selected. Enter or leaving the field calls `run` with the trimmed text; Esc keeps the old name, and an empty or unchanged name calls nothing. Jali stores no name: your app saves it and the pane shows it, usually with `useTitle`. Return `false`, throw or reject to keep the field open with the text, marked invalid; a promise keeps it busy until it settles. `can` says which panes may be renamed; leave it out for all.

### TabMenu

*type*, from `@jali/core`

```ts
type TabMenu = (pane: { id: NodeId; ref: ObjectRef }) => readonly TabMenuItem[] | undefined
```

Your items for a tab's menu, from `createJali({ tabMenu })`. Called each time a tab's menu opens (right-click, Shift+F10 or the menu key on the tab), with that tab's pane. They come after Jali's own, after a separator. Return `undefined` or `[]` for a pane that has none.

### TabMenuItem

*type*, from `@jali/core`

```ts
interface TabMenuItem {
  id: string; title: string; run(): void;
  disabled?: boolean | string; checked?: boolean; keys?: string;
}
```

One item in a tab's menu. `disabled` greys it out but keeps it reachable from the keyboard; give a reason as text and screen readers read it. `checked` makes it a checkbox item, ticked when true. `keys` is a hint shown beside the title, such as `keyHint("Mod+D")`; the key itself is yours to handle. The menu closes, and focus returns to the tab, before `run` runs.

### Command

*type*, from `@jali/core`

```ts
interface Command {
  id: string; title: string;
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings";
  run: (jali: Jali) => void;
}
```

A workspace command. `run` gets the workspace. Your own commands go in `createJali({ commands })`, with a group of your own if you like. Whether one of Jali's can run now is in [`listCommands`](../core.md#listCommands) (`disabled`, `reason`).

### Keymap

*type*, from `@jali/core`

```ts
interface Keymap
```

A workspace's resolved keys (`jali.keymap`): the defaults with its `keymap` overrides applied, with `platform`, `entries`, `sequences(id)`, `label(id)`, `format(seq)`, `find(match, prefix?)` and `isPrefix(match)`. `label` and `format` print keys in the workspace's words (`messages.keys`).

### KeymapOverrides

*type*, from `@jali/core`

```ts
type KeymapOverrides = Partial<Record<DefaultKeymapId | (string & {}), KeyString | readonly KeyString[] | null>>
```

A host's key changes: a binding, several, or `null` to unbind.

### KeymapOptions

*type*, from `@jali/core`

```ts
interface KeymapOptions {
  platform?: Platform; prefix?: KeyString; reserved?: readonly KeyString[];
  onInvalid?: (id: string, binding: KeyString, reason: string) => void; words?: KeyWords;
}
```

The `keymapOptions` of `createJali`: `platform` to match and print keys for, and `onInvalid`, called for each refused binding (default `console.warn`). `prefix` and `reserved` are what `createJali`'s `keyPrefix` and `reservedKeys` set. `words` defaults to the workspace's `messages.keys`.

### DefaultKeymapId

*type*, from `@jali/core`

```ts
type DefaultKeymapId = keyof typeof DEFAULT_KEYMAP
```

The ids bound by default.

### KeyString

*type*, from `@jali/core`

```ts
type KeyString = string
```

A binding as text: chords separated by a space, keys in a chord by `+` (`Mod+K Mod+ArrowLeft`, `F6`, `Mod+\`). Modifiers: `Mod` (⌘ on a Mac, Ctrl elsewhere; `Cmd` and `Meta` mean the same), `Ctrl`, `Alt` (`Option`), `Shift`. Keys: a letter, a digit, punctuation, `F1` to `F24`, or a name (`Enter`, `Esc`, `Space`, `Tab`, `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown`, the arrows). Letters, digits and punctuation match the physical key.

### Chord

*type*, from `@jali/core`

```ts
interface Chord { key: string; mod?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean }
```

One key press. `key` is `KeyboardEvent.code` (`"KeyM"`, `"Backslash"`) or, for named keys, `KeyboardEvent.key` (`"ArrowLeft"`, `"F6"`). `mod` is ⌘ on a Mac and Ctrl elsewhere; `ctrl` is the Control key itself.

### KeySequence

*type*, from `@jali/core`

```ts
type KeySequence = readonly Chord[]
```

One binding: a chord, or a prefix chord then a second chord (⌘K ⌘M).

### Platform

*type*, from `@jali/core`

```ts
type Platform = "mac" | "other"
```

The platform keys are matched and printed for.

### KeyWords

*type*, from `@jali/core`

```ts
interface KeyWords { ctrl; alt; shift; escape; space; left; right; up; down: string }
```

The words printed keys use: modifier names elsewhere than a Mac, and Esc, Space and the arrows. `messages.keys` is one.

## Words

### Messages

*type*, from `@jali/core`

```ts
type Messages = { announcements: …; toasts: …; commands: …; … }
```

Every word Jali uses, by area, with the same keys and shapes as [`en`](../core.md#en). A full translation is a `Messages`: a missing area or key, or a message of the wrong shape, is a type error. See [Translate Jali](../../guides/translating.md).

### MessageOverrides

*type*, from `@jali/core`

```ts
type MessageOverrides = { [Area in keyof Messages]?: Partial<Messages[Area]> }
```

What `createJali({ messages })` takes: any areas, and any keys in them. Keys you leave out stay English. A misspelt key is a type error.

### ScreenDirection

*type*, from `@jali/core`

```ts
type ScreenDirection = "left" | "right" | "up" | "down"
```

A direction on screen (right to left too), as command ids name it (`pane.focus.left`), passed to `commands.focusDirection` and `commands.moveDirection`.

## Lists and their detail

### ActiveItemPort

*type*, from `@jali/core`

```ts
interface ActiveItemPort {
  readonly itemId: string | null;
  readonly write: (itemId: string | null, action: ActiveItemAction) => ActiveItemWriteResult;
}
```

The item a list is on, as a list and a workspace both understand it. Not the multi-select set and not DOM focus.

### ActiveItemAction

*type*, from `@jali/core`

```ts
type ActiveItemAction = "open" | "close" | "step"
```

- `step`: The cursor moved. A following detail follows once it rests.

- `open`: Show the item (Space).

- `close`: Stop showing it (Esc). The cursor stays.

### ActiveItemWriteResult

*type*, from `@jali/core`

```ts
interface ActiveItemWriteResult { readonly status: "accepted" }
```

Always accepted.

### ActiveItemMapping

*type*, from `@jali/core`

```ts
interface ActiveItemMapping { toRef(itemId: string): ObjectRef; idOf(ref: ObjectRef): string | null }
```

How a list's item ids map to refs; see [`activeItemPort`](../core.md#activeItemPort).

## Actions

### PaneTarget

*type*, from `@jali/core`

```ts
type PaneTarget = NodeId | ObjectRef
```

A pane, by its id or by the object it shows. A ref means the pane showing that object: the focused pane if it does, else the first in the layout. `close(order({ id: 7 }))` closes the pane showing order 7, whatever its id.

### ChooseOptions

*type*, from `@jali/core`

```ts
interface ChooseOptions<T> { title: string; items: readonly T[]; label(item: T): string; hint?(item: T): string; current?: T; placeholder?: string; onChoose(item: T): void }
```

What `JaliActions` `choose` asks the person for. `T` is whatever your items are.

**Parameters**

- **`title`** (`string`, required): What the choice is for: the dialog's name, its heading and its field's label ("Open chart for…").

- **`items`** (`readonly T[]`, required): What to choose from, in order. Typing keeps the items whose label or hint has the text, labels that start with it first.

- **`label`** (`(item: T) => string`, required): An item's name in the list.

- **`hint`** (`(item: T) => string`): Words beside the name, matched too.

- **`current`** (`T`): The item in use. The chooser opens with it selected, and its row is marked (`data-current`, `aria-current="true"` and a tick). Compared with `Object.is`: pass one of `items` itself.

- **`placeholder`** (`string`): The field's placeholder.

- **`onChoose`** (`(item: T) => void`, required): Gets the chosen item once the chooser has closed and focus is back where it was. Not called when the person closes it with Esc or a click outside.

### JaliActions

*type*, from `@jali/core`

```ts
interface JaliActions
```

`jali.actions` (in React, `useJali().actions`). Each one reads the state now, makes its change once and returns an `ActionResult`. They follow one rule:

- The pane comes first, as a `PaneTarget`. It is optional (`?`), meaning the focused pane, only when nothing required follows it.
- What the action uses comes next; options come last, in an object.

A pane that is not there gives `reason: "not-found"`. What a refusal reads out to screen readers is the same as before; `message` holds it.

- **`actions.focus`**, `focus(pane: PaneTarget)`: Focus a pane and show it. A pane that is folded, tucked or behind another tab has its tab chosen; nothing else on screen moves. While another pane is maximised, this one is maximised instead.

- **`actions.toggleZoom`**, `toggleZoom(pane?: PaneTarget)`: Maximise or restore. Refused with `"single-view"` in a curated page's Single view; nothing with one pane.

- **`actions.openBeside`**, `openBeside(pane: PaneTarget, ref: ObjectRef)`: Open `ref` beside `pane`; focus stays in `pane`. `pane`'s selected item opens a following detail (kept if one already follows). A link never copies a pane of its own chain: when `ref`'s object is `pane` itself, a pane `pane` was opened from (up the chain), or one it opened, that pane is shown instead (`pane` in the result), focus stays, and it is announced "Already open". Outside a curated page, another chain may still show the same object. In a curated page: a peek in Single view or for a limited viewer, and an object already on the page is focused instead. `pane` in the result is the pane that shows `ref`.

- **`actions.openHere`**, `openHere(pane: PaneTarget, ref: ObjectRef)`: Show `ref` in `pane`. If it is open elsewhere, focus that pane (and close `pane` when it is a launcher).

- **`actions.peek`**, `peek(pane: PaneTarget, ref: ObjectRef)`: Show `ref` in the peek sheet, for `pane`. When `pane`'s following detail of that kind is on screen, the detail shows `ref` instead.

- **`actions.closePeek`**, `closePeek()`: Close the peek sheet.

- **`actions.select`**, `select(pane: PaneTarget, ref: ObjectRef | null, options?: { inResults?: boolean })`: Report a list's selection (`null`: none). An open peek from it follows at once; its following detail after 150 ms of rest. `inResults: false`: the list's filter no longer shows it.

- **`actions.setKept`**, `setKept(pane: PaneTarget, kept: boolean)`: Keep a linked pane on what it shows, or let it go. A kept follower stops following its list; a kept plain link is no longer replaced by the next link from its source, which opens beside it instead. Let go, a detail of a list (its source reports a selection) follows the selection again and catches up; a plain link goes back to being replaced. `"nothing-to-do"` for a pane with no link.

- **`actions.split`**, `split(pane?: PaneTarget, direction?: "right" | "bottom")`: Open the launcher beside `pane` and focus it. Without `direction`: right of a wide pane, below a tall one. `"unavailable"` without a launcher.

- **`actions.newTab`**, `newTab(pane?: PaneTarget)`: The launcher as a new tab of the pane's group. `"unavailable"` without a launcher.

- **`actions.addTab`**, `addTab(pane: PaneTarget, ref: ObjectRef)`: Show `ref` as a new tab of `pane`'s group (or a new group), and focus it. It is one step: one entry in the history, and the tab takes `pane`'s slot, so nothing else folds or moves. Use it rather than `openBeside` then `mergeInto`, which is two entries and can fold other panes in between. If `ref` is already open, that pane is shown instead. `"invalid"` for a kind the workspace doesn't have.

- **`actions.close`**, `close(pane?: PaneTarget)`: Close a pane, with an Undo toast. The last pane stays (`"last-pane"`). A curated page's view goes back to the tabs.

- **`actions.closeOthers`**, `closeOthers(pane?: PaneTarget)`: Close every other pane. In a curated page, `backToPage`.

- **`actions.undo`**, `undo()`: Undo the last close, close others or tuck. `"nothing-to-do"` when there is none.

- **`actions.remove`**, `remove(pane: PaneTarget)`: Take away a pane whose object your app closed elsewhere. It is quiet: no Undo, no toast, nothing read out, and nothing asked (`beforeClose` and "Discard unsaved changes?" are skipped, since the object is gone). The address is replaced, so Back does not bring it back. The last pane becomes the launcher; without a launcher it stays (`"last-pane"`), so show something else in it with `openHere`. A curated page's views are refused (`"unavailable"`).

- **`actions.tuck`**, `tuck(pane?: PaneTarget)`: Tuck a pane into its neighbour. Without `pane`, the focused pane or the one focused last.

- **`actions.putBack`**, `putBack(pane?: PaneTarget)`: Put a tucked pane back where it was. Without `pane`, the focused pane if it is tucked, else the most recently tucked.

- **`actions.move`**, `move(pane: PaneTarget, direction: Edge)`: Move a pane past its neighbour. `"blocked"` at the edge.

- **`actions.swapWithNext`**, `swapWithNext(pane?: PaneTarget)`: Swap with the next pane on screen (or the previous, for the last).

- **`actions.mergeInto`**, `mergeInto(pane: PaneTarget, target: PaneTarget)`: `pane` joins `target`'s tab group.

- **`actions.unmerge`**, `unmerge(pane?: PaneTarget)`: Move a tab out of its group, to the right of it.

- **`actions.moveOutOfRow`**, `moveOutOfRow(pane?: PaneTarget)`: Take a pane (default: the focused one) out of the row that scrolls sideways holding it, beside the row on the side the pane is nearer on screen. Also in the pane's menu and ⌘K ("Move out of the row"). Nothing happens for a pane in no such row.

- **`actions.closeTabs`**, `closeTabs(pane: PaneTarget, which: "others" | "after")`: Close the other tabs of `pane`'s group, or the tabs after it in reading order (to its right, or its left right to left). One change: `beforeClose` is asked once, listing them all, and one Undo brings them back. Refused with `"nothing-to-do"` when there are none. The tab menu's Close other tabs and Close tabs to the right.

- **`actions.setPinned`**, `setPinned(pane: PaneTarget, pinned: boolean)`: Pin a pane's tab, or unpin it. A pinned tab goes to the end of its group's pinned tabs, at the start of the group; unpinned, it goes to the start of the rest. Close other tabs and Close tabs to the right leave it open; Close, middle-click and ⌘W still close it. Already as asked: nothing happens, with no `pin` event and no history entry. Each change fires `pin`.

- **`actions.startRename`**, `startRename(pane?: PaneTarget)`: Open the rename field on `pane`'s tab, or its title when it is alone (default: the focused pane). For an app that owns its own rename key or menu item. `"unavailable"` without `createJali({ rename })`, or when `rename.can` says no.

- **`actions.moveTab`**, `moveTab(pane: PaneTarget, index: number)`: Move a tab to position `index` (from 0) among its group's tabs, clamped to the group and to its part of it (a pinned tab among the pinned tabs, any other after them); the group keeps its place and size, and its shown tab. Announced as "Orders moved to position 2 of 4". Refused with `"nothing-to-do"` for a pane that is not a tab in a group the person or the app made (a folded or tucked tab is placed by the layout).

- **`actions.preset`**, `preset(id: string)`: Switch to a preset. `"not-found"` for an id the workspace doesn't have.

- **`actions.toggleFullScreen`**, `toggleFullScreen(pane?)`: Put a pane (default: the focused one) on the whole screen: maximised, with the page in the browser's full screen. Again, Escape, or leaving the browser's full screen puts it back as it was. Where the browser has no full screen (an iPhone), the pane still covers the page. ⌘K: "Full screen pane, or exit full screen".

- **`actions.resetLayout`**, `resetLayout()`: Rebuild the preset last chosen.

- **`actions.autoLayout`**, `autoLayout()`: Arrange every pane from the room there is and each kind's size hints ([`layout.arrange`](layout.md#layout.arrange)): columns at the kinds' comfortable widths, a second row when the height allows, the rest as tabs beside the pane they were opened from. The same panes, so nothing reloads; tucked and folded panes are placed too. Back returns to the arrangement before. `"unavailable"` on a curated page, `"nothing-to-do"` with one pane. ⌘K: "Arrange panes automatically".

- **`actions.openPage`**, `openPage(options?: OpenPageOptions)`: Open the workspace's curated page. `"unavailable"` without one.

- **`actions.leavePage`**, `leavePage()`: Back to the free workspace's preset. The page's mode and layout are kept. `"unavailable"` in a page-only app.

- **`actions.setMode`**, `setMode(mode: ViewMode)`: Single or Split view. Split view is refused for a limited viewer (`"not-allowed"`).

- **`actions.openTab`**, `openTab(tab: string)`: What a click on a page tab does. It never reshapes: Single view swaps the view; Split view focuses it, chooses its tab, or puts it in place of the view you're in.

- **`actions.activate`**, `activate(item: ItemId)`: Show another item; the previous item's opened panes close.

- **`actions.backToPage`**, `backToPage()`: Close every opened pane, with Undo.

- **`actions.resetPage`**, `resetPage()`: Split view back to the design; opened panes stay.

- **`actions.setCanInvestigate`**, `setCanInvestigate(canInvestigate: boolean)`: The viewer's permission. Taking it away switches to Single view.

- **`actions.choose`**, `choose<T>(options: ChooseOptions<T>)`: Ask the person for one of `options.items` in Jali's chooser: type to filter, arrows, Enter, Esc. `options.onChoose(item)` runs once it has closed and focus is back. Closes ⌘K if it is open. `"invalid"` without a `title`, `items` or `label`. For a command that needs an argument; see [Commands and keys](../../guides/commands-and-keys.md#commands-that-ask-for-something).

- **`actions.openPalette`**, `openPalette()`: Open the command palette.

- **`actions.closePalette`**, `closePalette()`: Close it.

- **`actions.openSettings`**, `openSettings()`: Open Settings.

- **`actions.closeSettings`**, `closeSettings()`: Close it.

- **`actions.changeSettings`**, `changeSettings(patch: Partial<Settings>)`: Change the person's settings. They are saved on this device; a new theme is applied and a new pane cap refits the layout.

What drags, keys and panes report (dividers, drops, focus keys, `useUnsaved`, `useCommands`, `usePaneState`, the discard dialog) runs through the engine's own steps, which are not part of `jali.actions`.
