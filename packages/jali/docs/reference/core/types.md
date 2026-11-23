# jali types

Every type jali exports, with its fields, and every instance action.

Import any of these with `import type { … } from "jali";`. Functions that use them are on [jali](../core.md) and [The layout namespace](layout.md).

## The layout tree

### Layout

*type*, from `jali`

```ts
interface Layout { version: 1; root: LayoutNode; overlay?: Overlay }
```

An instance's arrangement: a tree of rows, columns and tab stacks of panes. The tree is the arrangement the person made; folds, tucks, tab choices and hidden panes are recorded in `overlay`, so they can be undone without losing a slot. This is what `?l=` holds.

**Fields**

- **`version`** (`1`, required): Always `1`.

- **`root`** (`LayoutNode`, required): The top node. A single pane is a valid root.

- **`overlay`** (`Overlay`): What the layout and the person did on top of the tree. Written by the operations; leave it out when you build a layout.

### LayoutNode

*type*, from `jali`

```ts
type LayoutNode = PaneNode | StackNode | SplitNode
```

One node of the tree. Every node has an `id` (unique in the layout), a `size`, and optionally `userSized` (the person dragged it) and `base` (the size a divider reset returns to).

### PaneNode

*type*, from `jali`

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

*type*, from `jali`

```ts
interface SplitNode { type: "row" | "column"; id; size; children: LayoutNode[] }
```

Children side by side (`"row"`) or one above another (`"column"`), sharing the space by their sizes. Splits nobody sized share by the panes' comfortable and maximum widths; once the person sizes a child, the split keeps its proportions exactly.

### StackNode

*type*, from `jali`

```ts
interface StackNode { type: "stack"; id; size; children: PaneNode[]; active: NodeId; origin?: "user" }
```

A tab group the person made (by merging, a centre drop or a new tab). Groups made by folding are not in the tree; they exist in `overlay`. `active` is the shown tab; `origin` is optional (`"user"` when set); leave it out in hand-written layouts.

### Size

*type*, from `jali`

```ts
type Size = { px: number } | { weight: number }
```

A share of a split (`weight`, relative to the siblings) or a fixed length in pixels. Divider drags store weights, scaled so the ones a drag sets average 1.

### NodeId

*type*, from `jali`

```ts
type NodeId = string
```

A node's id: 1 to 128 letters, digits, `_`, `.`, `:` or `-` (`orders`, `pane-3`, `detail:7`). Every id Jali and the builders make fits; a layout from outside with any other id is refused.

### ObjectRef

*type*, from `jali`

```ts
interface ObjectRef { kind: string; params: Record<string, string | number | boolean> }
```

What a pane shows: a kind and the params that name the object (`{ kind: "order", params: { id: 1041 } }`). Params must be strings, finite numbers or booleans.

### Axis

*type*, from `jali`

```ts
type Axis = "row" | "column"
```

The direction of a split.

### Edge

*type*, from `jali`

```ts
type Edge = "left" | "right" | "top" | "bottom"
```

A side of a pane: where to open or drop. In actions and commands it is a side of the screen, in either reading direction. The layout operations (`layout.drop`, `layout.open`, `layout.split`) take a side in the tree instead: `"left"` is before, `"right"` after, which right to left is the other side of the screen.

### Direction

*type*, from `jali`

```ts
type Direction = "ltr" | "rtl"
```

The reading direction an instance lays its panes out in (`jali.get().dir`, `createJali({ dir })`). Right to left, a row's first child is at the right: the same tree, mirrored on screen.

### Overlay

*type*, from `jali`

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

*type*, from `jali`

```ts
interface ViewState { focused?: NodeId; zoomed?: NodeId; scroll?: Record<NodeId, number>; peek?: ObjectRef; focusHistory: NodeId[] }
```

What the person is looking at, apart from the layout.

**Fields**

- **`focused`** (`NodeId`): The pane with focus (the accent edge).

- **`zoomed`** (`NodeId`): The maximised pane. In the URL as `zoom`.

- **`scroll`** (`Record<NodeId, number>`): How far each row that scrolls has scrolled, by the row's id, in px along its content, set where the row comes to rest. In the URL as `scroll` (`week:732`); a strip at its start writes nothing, and scrolling replaces the history entry.

- **`peek`** (`ObjectRef`): What the peek sheet shows. Never in the address: a reload closes it.

- **`focusHistory`** (`NodeId[]`, required): Panes most recently focused first.

### PaneKind

*type*, from `jali`

```ts
interface PaneKind { kind; title(ref); minWidth; minHeight; comfortableWidth?; maxWidth?; comfortableHeight?; maxHeight?; checkParams? }
```

The part of a kind the layout operations read, from `kinds.registry()`. The sizes are explained under `PaneKindBase`. `checkParams(params)`, set for a kind that declares `params`, says what is wrong with a ref's params (a required param missing, a value its type can't read), or returns `undefined`; [`layout.validate`](layout.md#layoutvalidate) rejects a layout holding such a ref, so a link to it opens as broken.

### KindRegistry

*type*, from `jali`

```ts
type KindRegistry = Record<string, PaneKind>
```

Kinds by name, as the layout operations take them (`kinds.registry()`).

### LayoutContext

*type*, from `jali`

```ts
interface LayoutContext { fit: FitOptions; paneCap: number; dir?: Direction }
```

Everything a layout operation needs besides the layout. For an instance: `{ fit: { ...jali.get().area, gap: jali.env.spacing.gap, kinds: jali.env.kinds.registry() }, paneCap: jali.get().settings.paneCap, dir: jali.get().dir }`. `paneCap` is the most panes on screen before the oldest folds (the `paneCap` setting). `dir: "rtl"` mirrors the rects `resolve` returns, so they stay screen coordinates; the tree and the fit are the same.

### FitOptions

*type*, from `jali`

```ts
interface FitOptions { width: number; height: number; gap: number; kinds: KindRegistry }
```

The room: the instance's inner size in pixels, the gap between panes (6 in an instance), and the kinds.

### Rect

*type*, from `jali`

```ts
interface Rect { x: number; y: number; width: number; height: number }
```

A box in pixels, relative to the instance's inner area.

### ResolvedLayout

*type*, from `jali`

```ts
interface ResolvedLayout { panes: PaneBox[]; dividers: DividerBox[]; stacks; shelf; scrollers: ScrollerBox[] }
```

What `layout.resolve` returns: `panes` and `dividers` with their rects; `stacks`, the groups made by folding and tucking (`{ id, kind: "fold" | "tuck", homeId, paneIds }`); and `shelf`, every pane behind a tab with why (`{ paneId, homeId, stackId, reason: "tucked" | "folded" | "tab" }`).

### PaneBox

*type*, from `jali`

```ts
interface PaneBox { id: NodeId; rect: Rect; stackId?: NodeId; hidden?: "tab" | "zoom" | "off"; clip?: Rect }
```

A pane's place. `hidden`: behind another tab, behind a maximised pane, or `"off"` (hidden by the overlay, with an empty rect).

### DividerBox

*type*, from `jali`

```ts
interface DividerBox {
  parentId: NodeId; index: number; axis: Axis; rect: Rect;
  min: number; max: number; value: number;
  neighbours?: [NodeId[], NodeId[]];
}
```

A divider between child `index` and `index + 1` of split `parentId`. `value` is the first side's length now; `min` and `max` are how far a drag can take it; `neighbours` are the panes on each side.

### ScrollerBox

*type*, from `jali`

```ts
interface ScrollerBox { id: NodeId; rect: Rect; contentWidth: number; paneIds: NodeId[] }
```

A row that scrolls sideways (`row({ scroll: "x" }, …)`), as drawn. `rect` is its window on screen; its panes are laid along its content, `contentWidth` long, from `rect.x`. Once scrolled ([`layout.scrolled`](layout.md#layoutscrolled)), a strip's panes and dividers carry `clip`: the window they are cut to.

### ResolvedStack

*type*, from `jali`

```ts
interface ResolvedStack { id: NodeId; kind: "fold" | "tuck"; homeId: NodeId; paneIds: NodeId[] }
```

A tab group the fit made, not one in the tree: panes folded into a neighbour (`"fold"`) or tucked into their home (`"tuck"`). `homeId` is the pane whose slot holds them.

### ShelfEntry

*type*, from `jali`

```ts
interface ShelfEntry { paneId: NodeId; homeId: NodeId; stackId: NodeId; reason: "tucked" | "folded" | "tab" }
```

A pane that is not on screen, listed on the shelf: tucked, folded by the fit, or a background tab of a tucked or folded group. `homeId` is where it shows when put back.

### TuckedEntry

*type*, from `jali`

```ts
type TuckedEntry = ShelfEntry & { reason: "tucked" }
```

A pane the person tucked, as the model's `shelf` lists it. Folded panes are never on it: they wait behind their strip's "N folded" chip.

## Writing a layout

### LayoutInput

*type*, from `jali`

```ts
type LayoutInput = Layout | Draft | ObjectRef
```

Anything that stands for a layout: a builder's result (`row(...)`), a single ref (a one-pane layout), or a whole `Layout`. `createJali({ layout })`, a preset's `layout` and a page's `build` all take one.

### Draft

*type*, from `jali`

```ts
type Draft = PaneDraft | SplitDraft | TabsDraft
```

What the builders return: a layout not yet given ids. Pass it wherever a `LayoutInput` goes; Jali turns it into a `Layout`. Name it in a function of your own that builds part of a layout.

### PaneDraft

*type*, from `jali`

```ts
type PaneDraft = { type: "pane"; ref: ObjectRef; options: PaneNodeOptions }
```

What [`pane`](../core.md#pane) returns: one pane, with its options.

### SplitDraft

*type*, from `jali`

```ts
type SplitDraft = { type: Axis; options: RowOptions; children: Draft[] }
```

What [`row`](../core.md#row) and [`column`](../core.md#column) return: children side by side (`"row"`) or one above the other (`"column"`).

### TabsDraft

*type*, from `jali`

```ts
type TabsDraft = { type: "stack"; options: TabsOptions; children: PaneDraft[] }
```

What [`tabs`](../core.md#tabs) returns: panes as tabs of one group.

### RowOptions

*type*, from `jali`

```ts
interface RowOptions extends SizeOptions { scroll?: "x" }
```

A row's options. `scroll: "x"` makes a row that scrolls sideways: each child keeps its own width (its comfortable width until the person sizes it) and the row scrolls to the rest, so nothing folds. To its parent it needs one child's room; to the pane cap it is one slot. Focusing a pane in it scrolls it into view.

### SizeOptions

*type*, from `jali`

```ts
interface SizeOptions { id?: NodeId; weight?: number; px?: number }
```

A builder node's id and size: a share of its parent (`weight`, default 1) or a fixed length (`px`). See [`row`](../core.md#row).

### PaneNodeOptions

*type*, from `jali`

```ts
interface PaneNodeOptions extends SizeOptions {
  linkedTo?; follows?; kept?; pinned?; role?; priority?; hidden?: boolean;
}
```

The options of [`pane`](../core.md#pane).

### TabsOptions

*type*, from `jali`

```ts
interface TabsOptions extends SizeOptions { active?: NodeId }
```

The options of [`tabs`](../core.md#tabs).

## Kinds and pages

### PaneOptions

*type*, from `jali`

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

- **`identity`** (`(params: P) => Identity | undefined`): What makes two panes of this kind the same object (one object, one pane): a value compared as JSON (text, a number, a flag, or a list or record of those). `1` and `"1"` are the same by default. One it can't give (it throws, or gives what JSON can't write, such as a bigint) falls back to the default; `undefined` matches no other pane.

- **`scratch`** (`boolean`): Every pane is new (a scratch note, a launcher): never matched against an open pane, and left out of Recent unless `inRecent` says otherwise.

- **`inRecent`** (`boolean | ((params: P) => boolean)`): Whether opened objects of this kind go in Recent.

- **`holdWhileResizing`** (`boolean`): Keep the content as it is during a divider drag and reflow once, on release: for long lists and charts.

- **`allow`** (`PaneAllow`): What may happen to panes of this kind, for what its content can handle: `{ fullScreen: false }`. A kind can only turn controls off. See `PaneAllow`.

- **`buttons`** (`PaneButtons`): The buttons in this kind's header, replacing the instance's: a list, or a function that adjusts them (`(defaults) => defaults.filter((b) => b !== "tuck")`). Leave it out for the instance's, or Jali's. See `PaneButtons`.

- **`phone`** (`{ stack?: boolean; place?: "top" | "bottom" }`): Phones only, in stacked view (`createJali({ phone: { stack: true } })`). `stack: false` keeps panes of this kind out of it, so they show alone. `place` asks for the top or the bottom half; otherwise the pane others were opened from goes above.

- **`follow`** (`(selected: ObjectRef) => FollowParams<P> | undefined`): What a following pane of this kind shows when its list selects an object of another kind: the params for it, or `undefined` to keep what it shows. `follow: (selected) => ({ symbol: selected.params.symbol })` lets a chart follow a watchlist that selects quotes. A follower of the selected object's own kind shows that object without it. Params given as `undefined` are left out; if the kind can't read the result (a required param missing), the pane keeps what it shows. See [Following a list](../../learn/following.md#followers-of-other-kinds).

- **`selects`** (`string`): For a list: the kind of the objects it selects (`"quote"` for a watchlist that reports `select(quote(...))`). A pane of this kind with no selection starts on what its follower of that kind shows, when the layout gives it one: at start-up, on a link, after a preset or `setLayout`, in the same change. A follower of another kind gives nothing. See [Following a list](../../learn/following.md#where-a-list-starts).

### PaneWidth

*type*, from `jali`

```ts
interface PaneWidth { min?: number; comfortable?: number; max?: number }
```

A kind's widths in px; see `width` under `PaneOptions`.

### PaneHeight

*type*, from `jali`

```ts
interface PaneHeight { min?: number; comfortable?: number; max?: number }
```

A kind's heights in px; see `height` under `PaneOptions`.

### PaneDefinition

*type*, from `jali`

```ts
type PaneDefinition<P, D> = D & { (params: P): ObjectRef; readonly kind: string }
```

A defined kind, callable to make its refs. In React, `Pane<P>`.

### PaneKindBase

*type*, from `jali`

```ts
interface PaneKindBase extends PaneOptions { kind: string }
```

A kind as an instance keeps it: its name and its options. What `createJali({ panes })` takes.

### Params

*type*, from `jali`

```ts
type Params = Record<string, ParamValue>
```

A ref's params: plain data, so they fit in a link.

### ParamValue

*type*, from `jali`

```ts
type ParamValue = string | number | boolean
```

One param's value.

### ParamType

*type*, from `jali`

```ts
type ParamType = (value: ParamValue) => ParamValue | undefined
```

How to read one param back: `Number`, `String`, `Boolean`, [`oneOf`](../core.md#oneof), or your own function. `Number` reads text that is a finite number; `Boolean` reads `true`, `false`, `"true"`, `"false"`, `1` and `0`. Your function says it can't read a value by returning `undefined` or `NaN`, or by throwing.

### ParamTypes

*type*, from `jali`

```ts
type ParamTypes = Record<string, ParamReader | OptionalParam>
```

A kind's `params`, one by one.

### ParamReader

*type*, from `jali`

```ts
type ParamReader = ParamType | StandardSchemaV1
```

How to read one param: one of Jali's (`Number`, `String`, `Boolean`, `oneOf(...)`, a function), or a Standard Schema of the value from any library that implements it (`z.number()`, `v.picklist([...])`). A schema whose output may be `undefined` (`v.optional(…)`) lets a ref leave the param out, as `optional` does.

### Identity

*type*, from `jali`

```ts
type Identity = string | number | boolean | null | readonly Identity[] | { readonly [key: string]: Identity }
```

What a kind's `identity` gives for one object: any value JSON writes as it is. Two panes show the same object when their kinds' `shows` and these values, written as JSON, match.

### ParamsDeclaration

*type*, from `jali`

```ts
type ParamsDeclaration = ParamTypes | StandardSchemaV1
```

What `params` takes: params one by one, or one Standard Schema of the whole object (`v.object({ id: v.number() })`). A schema decides what is valid, and its output is what the pane gets (`ParamsOf` infers it); Jali's codec still decides how values are written in a link, and a value a link carries as text is read as a number or a flag when the schema wants one. A value the schema refuses is a `ParamProblem`, as for Jali's own types. A schema may transform values, but its output must still be params (text, numbers and flags): a field it gives as anything else (an object, a list, a date) is a problem of that param, and the ref keeps what it was given. A schema must validate synchronously. `appOnly` and `link: false` are Jali's own: declare params one by one to use them.

### StandardSchemaV1

*type*, from `jali`

```ts
interface StandardSchemaV1<Input = unknown, Output = Input> { readonly "~standard": StandardSchemaV1.Props<Input, Output> }
```

The [Standard Schema](https://standardschema.dev) interface that Zod, Valibot, ArkType and Effect Schema implement, copied into Jali as the spec asks, so Jali depends on none of them.

### OptionalParam

*type*, from `jali`

```ts
interface OptionalParam<T extends ParamReader = ParamReader> { readonly optional: T; readonly link?: false }
```

A param a ref may leave out, made by [`optional`](../core.md#optional). `link: false` when it stays out of the address.

### ParamOptions

*type*, from `jali`

```ts
interface ParamOptions { link?: false }
```

How an optional param travels, the second argument of [`optional`](../core.md#optional). `link: false` keeps it out of the address while it stays part of what the pane shows.

### AppOnlyParam

*type*, from `jali`

```ts
interface AppOnlyParam<T extends ParamType = ParamType> extends OptionalParam<T> { readonly appOnly: true }
```

A param only your app sets, from [`appOnly`](../core.md#apponly): optional, and never carried or set by a link.

### OneOf

*type*, from `jali`

```ts
type OneOf<V extends string | number> = ((value: ParamValue) => V | undefined) & { readonly values: readonly V[] }
```

A param that is one of a few values, made by [`oneOf`](../core.md#oneof).

### ParamsOf

*type*, from `jali`

```ts
type ParamsOf<T extends ParamTypes> = { [K in Required]: Read<T[K]> } & { [K in Optional]?: Read<T[K]> }
```

The params a kind's code sees, from its declaration: `ParamsOf<{ id: NumberConstructor; tab: OptionalParam<StringConstructor> }>` is `{ id: number; tab?: string }`. Use it as `ParamsOf<typeof orderParams>` to name the type of params declared apart from the kind. Without a declaration, `Params`.

### FollowParams

*type*, from `jali`

```ts
type FollowParams<P> = { [K in keyof P]?: ParamValue | undefined }
```

What a kind's `follow` returns: its params, any of which may be missing. Jali checks them against the kind's `params` before the pane shows them.

### ParamProblem

*type*, from `jali`

```ts
interface ParamProblem { param: string; value?: ParamValue }
```

A param a ref is missing (`value` is undefined), or holds a value its type can't read. A ref with one never reaches the component: a layout link or saved layout holding it opens as broken, a page's opened pane with it is left out of the link, and a pane your code opens with it shows a message naming the param. Listed by `PaneKinds.problems`.

### PaneKinds

*type*, from `jali`

```ts
interface PaneKinds<D extends PaneKindBase = PaneKindBase>
```

An instance's kinds, as `jali.env.kinds`.

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

- **`PaneKinds.isTransient`**, `isTransient(ref: ObjectRef): boolean`: Whether it is the instance's launcher.

### PaneCommand

*type*, from `jali`

```ts
interface PaneCommand { id: string; title: string; run: () => void; keys?: string; disabled?: string | false }
```

A command a pane adds to the palette while it is focused (`useCommands`). `keys` is only a label: the content handles its own keys. `disabled` greys it out; its text is the reason.

### ItemId

*type*, from `jali`

```ts
type ItemId = string | number
```

A curated page's item id: a number, or a string such as a UUID or a slug. See `firstItem` under `ProfileBase`.

### PaneActivity

*type*, from `jali`

```ts
type PaneActivity = "idle" | "loading" | "working" | "live" | "needs-you" | "error"
```

What a pane reports about itself (`useActivity`), shown in its header, its tab, the shelf and the status line. On the shelf, loading reads as working. `"live"` is ongoing, healthy work meant to go on (recording, streaming, playback): a dot rather than a spinner, read as "Live", and the least pressing on the "N folded" chip.

### PaneErrorInfo

*type*, from `jali`

```ts
interface PaneErrorInfo { pane: NodeId | null; ref: ObjectRef }
```

Which pane failed, for `createJali({ onPaneError })`: its id (`null` in the peek sheet) and the ref it was showing.

### ProfileBase

*type*, from `jali`

```ts
interface ProfileBase<R extends RoleBase = RoleBase, I extends ItemId = ItemId>
```

A curated page about one item (a loan application), framework-free. In React, `definePage` makes a `Page`, which adds the rail and header.

**Fields**

- **`id`** (`string`, required): What a link names: `?page=loan-review`.

- **`name`** (`string`, required): The page's name, in titles and commands ("Back to Loan review").

- **`itemNoun`** (`string`, required): The singular noun for an item ("application").

- **`roles`** (`R[]`, required): The views, in tab order.

- **`home`** (`string`, required): The view Single opens on.

- **`build`** (`(item: I) => LayoutInput`, required): Split view's designed layout. Every role is in the tree, as a pane whose `id` and `role` are the role's id; those not shown at first are `hidden`.

- **`bind`** (`(item: I) => Record<string, ObjectRef>`, required): What each role shows for an item. Another item swaps these in place. It runs inside every page action, so it answers at once: it names objects, and their panes load them. Ids only your data knows are read before `createJali` (see [Curated pages](../../learn/curated-pages.md#when-a-views-object-comes-from-your-data)).

- **`firstItem`** (`I`, required): The item the page opens on. Its type (number or string) is the type of every item id the page is given: a link's `"4"` comes back as `4` when `firstItem` is a number.

### RoleBase

*type*, from `jali`

```ts
interface RoleBase { id: string; label: string; priority: "primary" | "supporting" }
```

One view of a curated page. In React, `PageView` adds its icon.

### ViewMode

*type*, from `jali`

```ts
type ViewMode = "single" | "split"
```

How a curated page is shown: one view at a time (Single) or side by side (Split view). The person's choice, kept on their device and never in a link.

### PaneControl

*type*, from `jali`

```ts
type PaneControl = "open" | "close" | "tuck" | "maximise" | "fullScreen" | "move" | "resize" | "pin" | "popOut"
```

Something that can happen to a pane. `open` covers opening new panes from it (off, a link opens in the peek sheet instead); `move` covers dragging it, the move keys, swapping, merging into tabs, pulling a tab out and reordering tabs; `resize` the dividers beside it. Restoring a maximised pane and leaving full screen are always allowed.

### PaneAllow

*type*, from `jali`

```ts
type PaneAllow = Partial<Record<PaneControl, boolean>>
```

Controls turned off with `false`. Leaving one out, or `true`, leaves it to the other levels. A kind's `allow` and an instance's are both one.

### Allow

*type*, from `jali`

```ts
type Allow = PaneAllow & { when?: AllowRule }
```

`createJali({ allow })`: the instance's defaults, and `when` for rules that depend on context. `popOut` is off until this says `true`.

### AllowRule

*type*, from `jali`

```ts
type AllowRule = (ctx: AllowContext) => boolean | undefined | void
```

Asked before each action on a pane, after the kind's `allow`: `false` refuses it; anything else allows it.

### AllowContext

*type*, from `jali`

```ts
interface AllowContext { action: PaneControl; pane: PaneNode; presetId?: string; page?: { mode: ViewMode; item?: string } | null }
```

What `when` is asked about: the action, the pane (its id, kind and params, role, pins and links), the preset the layout came from, and the curated page while one is open.

### PaneButton

*type*, from `jali`

```ts
type PaneButton = "tuck" | "maximise" | "fullScreen" | "popOut" | "close"
```

A button a pane's header can show. `maximise` is Restore while the pane is maximised; `fullScreen` is Exit full screen while it is full screen; `popOut` is Bring back while it is popped out.

### PaneButtons

*type*, from `jali`

```ts
type PaneButtons = readonly PaneButton[] | ((defaults: readonly PaneButton[], ctx: ButtonsContext) => readonly PaneButton[])
```

A header's buttons, in order: a list that replaces the defaults, or a function that adjusts them (`(defaults) => defaults.filter((b) => b !== "tuck")`). Jali's defaults are `["tuck", "maximise", "popOut", "close"]` (Pop out only where `allow.popOut` turns it on), with `fullScreen` in Maximise's place on a lone pane. `allow` and Jali's own rules still filter the list, and Restore and Exit full screen always show while the pane is in that state. A ⋯ button opens the pane's menu whenever it offers more than the buttons do.

### ButtonsContext

*type*, from `jali`

```ts
interface ButtonsContext { pane: PaneNode; presetId?: string; page?: { mode: ViewMode; item?: string } | null }
```

What a `buttons` function is told: the pane, the preset the layout came from, and the curated page while one is open.

### PhoneOptions

*type*, from `jali`

```ts
interface PhoneOptions { below?: number; stack?: boolean; stackFloor?: number; fold?: boolean }
```

How the instance behaves on a phone (`createJali({ phone })`).

**Fields**

- **`below`** (`number`): Below this width of Jali's root, in CSS pixels, Jali shows one pane at a time, with a switcher at the top. Default 600, Android's compact width, which covers portrait phones. `0` leaves it to the panes' minimum widths alone: one pane at a time only when even one pane can't fit.

- **`stack`** (`boolean`): On a portrait phone, show two linked panes one above the other instead of one at a time: the focused pane and the pane it was opened from (a list above its detail), else one opened from it. Only with room for both: the instance at least 480 pixels tall, and each pane at least `stackFloor` and its kind's minimum height. While the on-screen keyboard is up, the focused pane shows alone. Default `false`.

- **`stackFloor`** (`number`): The shortest a stacked pane may be, in CSS pixels. Default 200.

- **`fold`** (`boolean`): On a screen that folds into two (a half-open Galaxy Fold or Pixel Fold, a Flip in flex mode, a dual-screen phone), put a pane each side of the fold so none straddles the hinge: the focused pane and the pane it was opened from, else the next pane. Read from the browser's viewport segments, in Chrome and Edge 138 and later; elsewhere nothing changes. Default `true`.

### Preset

*type*, from `jali`

```ts
interface Preset { id: string; label: string; build: () => Layout }
```

A layout to start from or switch to ("Layout: Orders"), as `jali.env.presets` holds it: made from a `PresetOptions`, with `build` returning a fresh layout each time.

### PresetOptions

*type*, from `jali`

```ts
interface PresetOptions { id: string; label: string; layout: LayoutInput | (() => LayoutInput); saved?: () => LayoutInput | undefined }
```

A preset, as `createJali({ presets })` takes it. `saved`, if given, is asked each time the preset is chosen: a layout it returns is shown instead of `layout`, so the preset comes back as the person left it. "Reset layout" always builds `layout`. See [Start from presets](../../guides/presets.md#keep-each-preset-as-it-was-left).

### Env

*type*, from `jali`

```ts
interface Env { kinds: PaneKinds; profile: ProfileBase | null; presets: readonly Preset[]; commands?: readonly Command[]; name: string; launcher?: string; dir?: Direction; messages?: Messages }
```

What an instance is made of besides its state: `jali.env`. `profile` is its curated page; `launcher` the kind Split opens; `dir` the reading direction `createJali({ dir })` fixed, if any.

## The instance

### Jali

*type*, from `jali`

```ts
interface Jali<R extends ObjectRef = ObjectRef, P = JaliPage | undefined>
```

An instance, from [`createJali`](../core.md#createjali). It is frozen: these members are all it has. `R` is the refs of its kinds (from `createJali`), so `actions`, events and the model are typed by kind; `P` is its page's actions, or `undefined` without a page.

- **`Jali.actions`**, `actions: JaliActions<R>`: What an app asks the instance to do with panes and layouts. See `JaliActions`.

- **`Jali.page`**, `page: P`: The curated page's actions; there only with `createJali({ page })`. See `JaliPage`.

- **`Jali.dialogs`**, `dialogs: JaliDialogs`: The palette, settings and the chooser. See `JaliDialogs`.

- **`Jali.get`**, `get(): JaliState<R>`: The state now, read-only.

- **`Jali.subscribe`**, `subscribe(fn: () => void): () => void`: Called once after each change of state, before the change's events. Returns the unsubscribe. To hear what changed, use `on`. A subscriber that throws is reported with `console.error`; the others, and the action that made the change, carry on.

- **`Jali.model`**, `model(): JaliModel<R>`: The derived model, read-only; the same object while nothing it depends on changed.

- **`Jali.on`**, `on(event: keyof JaliEvents, handler: (e) => void): () => void`: Hear one kind of change: `"open"`, `"close"`, `"pin"`, `"focus"`, `"layout"` or `"toast"`. Returns the unsubscribe. A change's events come once it is done, in this order: `close`, `open`, `pin`, `focus`, `layout`, then its toasts. A handler that throws is reported with `console.error` and the others still hear it. See `JaliEvents`.

- **`Jali.getLayout`**, `getLayout(): DeepReadonly<Layout>`: The layout on screen, to save. It is plain JSON, read-only; `layout.tree.clone` gives a copy to edit.

- **`Jali.setLayout`**, `setLayout(layout: LayoutInput): ActionResult`: Show a layout: anything `createJali({ layout })` takes. It is fitted to the room, focus stays on a pane that is still there, and the address gets a new entry, so Back returns to the layout before. A curated page that is open closes. Refused with `"invalid"` for a pane kind the instance doesn't have; held with `"unsaved"` when a pane that would go has unsaved work; asks `beforeClose` like a close.

- **`Jali.keymap`**, `keymap: Keymap`: This instance's keys: `label(id)` for a tooltip, `sequences(id)`, `platform`.

- **`Jali.messages`**, `messages: Messages`: Every word it shows or says: `en` with `createJali({ messages })` over it. Use it for your own UI in the same language. A curated page's own words (the `page` area, and the announcements, commands and toast only a page uses) are there when the instance has a page.

- **`Jali.env`**, `env: Env`: Its kinds, presets, page, name and launcher.

- **`Jali.href`**, `href(): string`: The address to share: the URL writer's, else `location.href`, else `""`.

- **`Jali.start`**, `start(): () => void`: Starts its listeners (keys, Back and Forward, theme, saving) and returns their stop; after the stop, `start()` starts them again. `<JaliRoot>` starts it while mounted and stops it on unmount; calling it while started does nothing. The stop saves pane state still waiting to be saved. After `destroy()` it does nothing.

- **`Jali.destroy`**, `destroy(): void`: Stops the instance for good, when it goes away (a route change, a test's end): its listeners stop, a drag in progress ends without a drop, pane state still waiting to be saved is saved, a follow waiting for the selection to rest and a debounced address write are dropped (so nothing lands on the next route's address), and the kind registry stops being listened to. Nothing is scheduled after it, and `start()` does nothing. Its state can still be read. Calling it again does nothing. `<JaliRoot>` doesn't call it: the instance is yours, and may outlive one mount.

To save a person's layout, listen for `"layout"` and store `getLayout()`. To restore it, pass it as `createJali({ layout })`: a link in the address still wins, so shared links keep working. A layout that arrives later goes through `setLayout`.

### JaliEvents

*type*, from `jali`

```ts
interface JaliEvents<R extends ObjectRef = ObjectRef> { open; close; pin; focus; layout; toast }
```

What `jali.on` (and `useJaliEvent` in React) tells you. `ref.kind` says which of the instance's kinds, and narrows `ref.params`. Each fires once per change, after the change is made, and never for the steps inside one action (a drag before it drops, the steps of a preset switch). In one change they come in this order: `close`, `open`, `pin`, `focus`, `layout`.

Every event also carries `input`, where the change came from (`JaliInput`), so you can tell a person's close from your own code's, or from an agent's:

```ts
import { analytics } from "./analytics";

jali.on("close", ({ pane, input }) => analytics.track("pane closed", { pane, by: input }));
```

**Events**

- **`open`** (`{ pane: NodeId; ref: R; previous?: R }`, required): A pane was added to the layout, or now shows another object. `previous` is what it showed before. A launcher pane counts.

- **`close`** (`{ pane: NodeId; ref: R }`, required): A pane left the layout. A tucked, folded or tabbed pane is still in it.

- **`pin`** (`{ pane: NodeId; pinned: boolean }`, required): A pane's tab was pinned or unpinned, however it happened: the tab menu, `setPinned`, `setLayout`, Back or a link. Not for a pane that arrives pinned, which is an `open`. Pinning a pinned tab is no change, so it says nothing.

- **`focus`** (`{ pane: NodeId | undefined; previous: NodeId | undefined }`, required): Another pane is focused.

- **`toast`** (`Toast`, required): A toast to show (a close offers Undo). Jali draws none: put your toaster in `<JaliRoot overlays>` and hear it with `useJaliEvent("toast", show)`. Toasts sent before anyone listens are kept until someone does.

- **`layout`** (`{ layout: DeepReadonly<Layout>; source: "action" | "address"; action?: ActionName }`, required): The layout changed. `"action"`: an action, a gesture, a key or `setLayout`. `"address"`: Back, Forward or a link. Fitting to a new window size does not fire it. `action` names the action that made it (`ActionName`), whoever ran it: your code, or the person from Jali's buttons, menus, keys or ⌘K. A change made after a question (Discard, or a later yes from `beforeClose`) names the action that asked. It is undefined for a change no action names: a drag, a divider, a linked pane following its list, and anything from the address.

```ts
import { forgetSavedLayouts } from "./saved-layouts";

jali.on("layout", ({ action }) => {
  if (action === "resetLayout") forgetSavedLayouts();
});
```

### JaliEventBase

*type*, from `jali`

```ts
interface JaliEventBase { input: JaliInput }
```

What every event in `JaliEvents` carries, beside its own fields.

### JaliInput

*type*, from `jali`

```ts
type JaliInput = "mouse" | "touch" | "pen" | "keyboard" | "virtual" | "agent" | "code"
```

Where a change came from. `mouse`, `touch` and `pen` are a person's pointer; `keyboard` a key; `virtual` a click with no pointer or key behind it, as a screen reader sends; `agent` an agent, when an adapter marks its actions; `code` your own code, with nothing a person did behind it.

A person's input is noted from the page while the instance is started (`<JaliRoot>` starts it), and lasts until the event that caused it is handled. A change your code makes after a timer or an `await` reads as `code`, even if a click started it. Use it for analytics and to tell changes apart, not to make Jali behave differently.

### JaliOptions

*type*, from `jali`

```ts
interface JaliOptions
```

The options of `createJali`. Each one, with its default, is under [`createJali`](../core.md#createjali).

### JaliState

*type*, from `jali`

```ts
type JaliState<R extends ObjectRef = ObjectRef>
```

What an instance holds that an app reads, read-only. Read it with `jali.get()` or `useJaliState(select)`. Change it through `actions`.

**Fields**

- **`layout`** (`Layout`, required): The arrangement.

- **`view`** (`ViewState`, required): Focus, maximise, peek.

- **`page`** (`PageState | null`, required): The curated page in use, or `null` for the free layout.

- **`presetId`** (`string | undefined`, required): The preset last chosen; "Reset layout" rebuilds it.

- **`peekSource`** (`NodeId`): The pane the peek acts for.

- **`resizeMode`** (`NodeId | null`, required): The pane in keyboard resize mode.

- **`settings`** (`Settings`, required): The person's settings.

- **`activity`** (`Record<NodeId, PaneActivity>`, required): What each pane reports (`useActivity`), merged across the components that report it. A pane nothing reports an activity for has no entry: it is idle.

- **`selection`** (`Record<NodeId, Selection<R>>`, required): Each list pane's selected item.

- **`recent`** (`readonly R[]`, required): Objects opened this session, newest first, at most 8.

- **`area`** (`{ width: number; height: number }`, required): The instance's inner size; the panes measure it.

- **`dir`** (`Direction`, required): The reading direction the panes are laid out in. The panes read it from the page, unless `createJali({ dir })` fixed it.

- **`unsaved`** (`Record<NodeId, string>`, required): Panes with unsaved work, and what it is.

- **`paletteOpen`** (`boolean`, required): The command palette is open.

- **`settingsOpen`** (`boolean`, required): Settings is open.

### PageState

*type*, from `jali`

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

### Selection

*type*, from `jali`

```ts
interface Selection { ref: ObjectRef; inResults: boolean }
```

A list's selected item. `inResults: false`: the list's filter no longer shows it; the following detail keeps it.

### UrlWriter

*type*, from `jali`

```ts
interface UrlWriter { write(state: () => UrlState, mode: HistoryMode): void; href?(): string; cancel?(): void }
```

Where an instance writes its address. Pass one as `url` to write it somewhere of your own. `write` gets a function, so a debounced write reads the latest state: the address's share of it (`UrlState`), as a link carries it, without params only your app sets (`appOnly`). `cancel`, when given, drops a write still waiting: `jali.destroy()` calls it.

### UrlState

*type*, from `jali`

```ts
interface UrlState { layout: Layout; view: ViewState; presetId: string | undefined; page: PageState | null }
```

What a `UrlWriter` reads: the layout on screen, the view (focus, the maximised pane, where rows that scroll came to rest; never the peek), the preset the layout came from, and the curated page open, if any. Refs in it are as a link carries them: without `appOnly` params.

### JaliModel

*type*, from `jali`

```ts
type JaliModel<R extends ObjectRef = ObjectRef>
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

- **`shelf`** (`TuckedEntry[]`, required): Tucked panes in tree order, with the pane each sits behind.

- **`folded`** (`NodeId[]`, required): Panes folded for room.

- **`off`** (`NodeId[]`, required): Panes hidden by the overlay.

- **`onScreen`** (`PaneNode[]`, required): Every pane except hidden ones: what the phone's switcher lists.

- **`onePane`** (`boolean`, required): One pane shows at a time: Jali's root is under `phone.below` wide, or even one pane's minimum is wider than the room.

- **`stacked`** (`{ top: NodeId; bottom: NodeId; axis?: "row" | "column" }`): On a portrait phone with `phone.stack`, the two linked panes shown one above the other (`axis: "row"`: either side of a fold).

- **`env`** (`Env`, required):
- **`layout`** (`Layout`, required):

### ActionResult

*type*, from `jali`

```ts
type ActionResult = { ok: true; pane?: NodeId } | Refusal
```

What every action and `setLayout` return. `ok: true` when it happened, or when what it asks for is already so. `pane` is the pane it opened, else the pane it acted on. `pane` is undefined on a refusal, and `reason`, `message` and `settled` are undefined on success, so `result.pane` and `result.reason` read without checking `ok` first.

### Done

*type*, from `jali`

```ts
interface Done { ok: true; pane?: NodeId }
```

An action that happened (or was already so): the `ok: true` side of `ActionResult`. Its `reason`, `message` and `settled` are always undefined.

### Refusal

*type*, from `jali`

```ts
interface Refusal { ok: false; reason: RefusalReason; message?: string; settled?: Promise<ActionResult> }
```

An action that did not happen. `message` is what Jali read out to screen readers, when it said anything; a refusal it did not say is silent, as before.

A refusal that asks a question carries `settled`, a promise of how the question ended: with `reason: "unsaved"`, once the person answers "Discard unsaved changes?"; with `reason: "pending"`, once `beforeClose` answers. It resolves with `{ ok: true, pane }` when the action went ahead, or with a refusal when it didn't (`"kept"` after Keep editing, or when a newer question took its place). It never rejects. A host's yes that leads to Jali's own question resolves with that `"unsaved"` refusal, whose `settled` says how the person answered.

```ts
import { forgetSavedLayouts } from "./saved-layouts";

const result = jali.actions.resetLayout();
if (result.ok) forgetSavedLayouts();
else void result.settled?.then((end) => end.ok && forgetSavedLayouts());
```

### RefusalReason

*type*, from `jali`

```ts
type RefusalReason = "not-found" | "invalid" | "unavailable" | "single-view" | "not-allowed" | "last-pane" | "blocked" | "nothing-to-do" | "unsaved" | "kept" | "pending"
```

**Reasons**

- **`not-found`**: The pane (by id or by what it shows), preset or view named is not there.

- **`invalid`**: What the action was given won't do. Every argument of every action is checked before anything happens, so JavaScript and an agent get the same answer TypeScript would give: a mode, edge, index or flag its type doesn't allow; a pane named by something that is neither an id nor a ref; a ref of a kind the instance doesn't have, or with params that aren't text, numbers or flags (these say why in `message`); or a layout that can't be shown. Nothing is stored as given, and it never throws.

- **`unavailable`**: The instance can't do this: no launcher (split, new tab), no curated page, no free layout to go back to.

- **`single-view`**: A curated page in Single view has no layout to change.

- **`not-allowed`**: The app's `allow` turns that control off for the pane: the kind's, the instance's, or its `when` (for a divider, a pane beside it). See [Choose what people can do with panes](../../guides/pane-controls.md).

- **`last-pane`**: The last pane, or a page's last view on screen, stays.

- **`blocked`**: The pane can't go there: past the edge, tucking the only pane or a tab. Also a change whose link no instance could reopen: more panes than a link holds, or, with the layout kept in the address, layout text too long to read back (one very long param).

- **`nothing-to-do`**: Nothing to undo, put back, close, resize or unmerge.

- **`unsaved`**: A pane that would go has unsaved work. Jali asks the person ("Discard unsaved changes?") and makes the change if they discard. See `settled`. (A linked detail that keeps its object because of its unsaved work doesn't ask, and has no `settled`.)

- **`kept`**: `beforeClose` kept the panes, or the person chose Keep editing.

- **`pending`**: `beforeClose` has not answered yet. See `settled`.

### BeforeClose

*type*, from `jali`

```ts
type BeforeClose = (request: CloseRequest) => boolean | Promise<boolean>
```

The host's close guard, `createJali({ beforeClose })`. Jali asks it before a change removes panes or makes a pane show another object. `true` lets the change happen; `false` keeps the panes (`reason: "kept"`). A promise holds the change (`reason: "pending"`) until it answers. If the layout changed in the meantime, the held change is dropped. A guard that throws or rejects keeps the panes.

It is asked first. If it says yes and a pane still reports unsaved work (`useUnsaved`), Jali's own "Discard unsaved changes?" follows; Discard does not ask the guard again. It is not asked while the instance is made, or for changes that remove nothing (focus, tuck, open beside). A later yes makes the change against the instance as it is then; if the panes it would remove or replace are no longer the ones asked about, the guard is asked again. When Back or Forward is not made in the end (the guard keeps the panes, or the person keeps editing), the address goes back to what is on screen.

### CloseReason

*type*, from `jali`

```ts
type CloseReason = "close" | "show" | "layout" | "address"
```

Why panes would go, in a `CloseRequest`: its `reason`, listed there.

### CloseRequest

*type*, from `jali`

```ts
interface CloseRequest { panes: { pane: NodeId; ref: ObjectRef }[]; reason: CloseReason }
```

What `beforeClose` is asked about: every pane the change would remove or point at another object, with what it shows now.

**reason**

- **`close`**: A close, close others, Back to the page, or a launcher dismissed.

- **`show`**: The pane would show another object: `openHere`, a following detail, another item or view on a page.

- **`layout`**: A new layout: a preset, `setLayout`, undo, a page's mode.

- **`address`**: Back, Forward or a link.

### Toast

*type*, from `jali`

```ts
interface Toast { title: string; description?: string; undo?: boolean; error?: boolean }
```

A toast for the host to render (`jali.on("toast")`, `useJaliEvent("toast")`). `undo`: offer Undo (run `jali.actions.undo()`).

### HistoryMode

*type*, from `jali`

```ts
type HistoryMode = "push" | "replace" | "debounce" | "none"
```

How a change reaches the address: a new entry, in place, in place 120 ms after the last call, or not at all.

### Settings

*type*, from `jali`

```ts
interface Settings
```

**Fields**

- **`centreDrop`** (`"swap" | "tab"`, required): What a drop on a pane's centre does.

- **`paneCap`** (`number`, required): The most panes on screen; past it the oldest pane that is not kept or focused folds. A whole number from 1 to 64; the Settings dialog offers 2 to 16.

- **`theme`** (`"system" | "light" | "dark"`, required): The theme choice.

- **`boundary`** (`"tint" | "none"`, required): How a curated page marks the panes opened from its views.

### ThemeChoice

*type*, from `jali`

```ts
type ThemeChoice = "system" | "light" | "dark"
```

The theme setting.

### Theme

*type*, from `jali`

```ts
type Theme = "light" | "dark"
```

The theme shown.

### OpenPageOptions

*type*, from `jali`

```ts
interface OpenPageOptions { item?: ItemId; tab?: string }
```

The options of `jali.page.open`: the item to show (default: the last one, else the page's `firstItem`) and the view Single view shows (a role id; default: the last one, else the home view).

### OpenBesideOptions

*type*, from `jali`

```ts
interface OpenBesideOptions { edge?: Edge }
```

The options of `actions.openBeside` and a pane's `openBeside`. `edge` is the side of the source pane the new pane opens on: `"left"`, `"right"`, `"top"` or `"bottom"`. Default: after the source in reading order (its right, or its left right to left).

- It is a side on screen, as for `move` and `split`: `"right"` is the right in either reading direction.
- It only places a new pane. Everything else is as without it: the new pane is linked to its source, focus stays in the source, it is one history entry and it is announced the same way. A link that replaces the source's earlier link of the same kind shows in that pane, where it is; an object already open is shown where it is.
- With no room on that edge, the new pane becomes a tab of its source, as without one. On a phone it goes on that edge in the layout, which shows one pane at a time until the screen is wider.
- On a curated page, panes opened from the page's views stay together, after the views. The first one starts it there whatever the edge; later ones open on that edge of the opened panes' last column. A pane opened from an opened pane opens on that edge of it. In Single view a link peeks, as always.

### StackPair

*type*, from `jali`

```ts
interface StackPair { top: NodeId; bottom: NodeId; axis?: "row" | "column"; hinge?: Hinge }
```

`JaliModel.stacked`: the two panes shown together while one pane shows at a time, on a portrait phone with `phone.stack` (`top` above `bottom`), or either side of a fold (`axis: "row"`, with its `hinge`).

### Hinge

*type*, from `jali`

```ts
interface Hinge { axis: "row" | "column"; start: number; size: number }
```

A fold that splits the screen in two, from the browser's viewport segments: `"row"` when the halves are side by side, `"column"` when one is above the other. `start` and `size` place it along that axis, in CSS pixels (`size` is 0 for a seamless fold).

### Group

*type*, from `jali`

```ts
interface Group { id: NodeId; kind: "stack" | "fold" | "tuck"; tabs: PaneNode[]; active: NodeId }
```

A tab group as the model sees it (`model().groups`): a stack in the tree, or one the fit made by folding or tucking, with its tabs and the shown one.

## The address and storage

### UrlSyncOptions

*type*, from `jali`

```ts
interface UrlSyncOptions { location?; storage?; prefix?; sizes? }
```

The `url` option of `createJali`: `location` (a `LocationPort`, default the browser's history), `prefix` (for two instances in one address: `"b."` writes `b.l`, `b.zoom`), `sizes` (`LinkSizes`) and `storage` (default: the instance's own).

### LinkSizes

*type*, from `jali`

```ts
type LinkSizes = "link" | "local"
```

What a layout link carries about sizes. `"local"` (the default): the layout as designed, with the sizes the person dragged kept on their device (for up to 12 layouts), so a colleague opens the link at the designed proportions. `"link"`: everything, so the link reopens exactly.

### LocationPort

*type*, from `jali`

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

*type*, from `jali`

```ts
type NavigateMode = "push" | "replace"
```

A new history entry, or in place.

### StoragePort

*type*, from `jali`

```ts
interface StoragePort { get(key: string): string | null; set(key: string, value: string): void }
```

What one person keeps on one device. Keys Jali uses: `settings`, `pane-state`, a curated page's preferences, `broken-layout`, and (from the address) `sizes`.

## Commands and keys

### ListedCommand

*type*, from `jali`

```ts
interface ListedCommand {
  key: string; id?: string; title: string; group: string;
  keys: string; disabled: boolean; reason?: string; run(): void;
}
```

One entry of a command menu, from [`listCommands`](../core.md#listcommands). `key` is unique in the list; `id` is the command id, undefined for a pane's own commands. `group` is the pane's title for those. Close your menu before `run`: some commands move focus.

### Rename

*type*, from `jali`

```ts
interface Rename {
  can?(pane: { id: NodeId; ref: ObjectRef }): boolean;
  run(pane: { id: NodeId; ref: ObjectRef }, text: string): void | false | Promise<void | false>;
}
```

Renaming in place, from `createJali({ rename })`. Double-click or F2 on a tab, or on a lone pane's title, the tab menu's Rename…, or `actions.startRename` opens a field there with the title selected. Enter or leaving the field calls `run` with the trimmed text; Esc keeps the old name, and an empty or unchanged name calls nothing. Jali stores no name: your app saves it and the pane shows it, usually with `useTitle`. Return `false`, throw or reject to keep the field open with the text, marked invalid; a promise keeps it busy until it settles. `can` says which panes may be renamed; leave it out for all.

### TabMenu

*type*, from `jali`

```ts
type TabMenu = (pane: { id: NodeId; ref: ObjectRef }) => readonly TabMenuItem[] | undefined
```

Your items for a tab's menu, from `createJali({ tabMenu })`. Called each time a tab's menu opens (right-click, Shift+F10 or the menu key on the tab), with that tab's pane. They come after Jali's own, after a separator. Return `undefined` or `[]` for a pane that has none.

### TabMenuItem

*type*, from `jali`

```ts
interface TabMenuItem {
  id: string; title: string; run(): void;
  disabled?: boolean | string; checked?: boolean; keys?: string;
}
```

One item in a tab's menu. `disabled` greys it out but keeps it reachable from the keyboard; give a reason as text and screen readers read it. `checked` makes it a checkbox item, ticked when true. `keys` is a hint shown beside the title, such as `keyHint("Mod+D")`; the key itself is yours to handle. The menu closes, and focus returns to the tab, before `run` runs.

### Command

*type*, from `jali`

```ts
interface Command {
  id: string; title: string;
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings";
  run: (jali: Jali) => void;
}
```

A command. `run` gets the instance. Your own commands go in `createJali({ commands })`, with a group of your own if you like. Whether one of Jali's can run now is in [`listCommands`](../core.md#listcommands) (`disabled`, `reason`).

### Keymap

*type*, from `jali`

```ts
interface Keymap
```

An instance's resolved keys (`jali.keymap`): the defaults with its `keymap` overrides applied, with `platform`, `entries`, `sequences(id)`, `label(id)`, `format(seq)`, `find(match, prefix?)`, `isPrefix(match)` and `forPlatform(platform)`. `label` and `format` print keys in the instance's words (`messages.keys`). `forPlatform` gives the same bindings matched and printed for another platform (the same object for its own), for labels a server prerenders: `jali/react` prints `"other"` until the page has hydrated.

### KeymapOverrides

*type*, from `jali`

```ts
type KeymapOverrides = Partial<Record<DefaultKeymapId | (string & {}), KeyString | readonly KeyString[] | null>>
```

A host's key changes: a binding, several, or `null` to unbind.

### KeymapOptions

*type*, from `jali`

```ts
interface KeymapOptions {
  platform?: Platform; prefix?: KeyString; reserved?: readonly KeyString[];
  onInvalid?: (id: string, binding: KeyString, reason: string) => void; words?: KeyWords;
}
```

Part of `createJali`'s `keyboard` (`KeyboardOptions`): `platform` to match and print keys for, `prefix` and `reserved`, and `onInvalid`, called for each refused binding (default `console.warn`). `words` defaults to the instance's `messages.keys`.

### DefaultKeymapId

*type*, from `jali`

```ts
type DefaultKeymapId = "palette.toggle" | "pane.focus.next" | …
```

The ids bound by default.

### KeyString

*type*, from `jali`

```ts
type KeyString = string
```

A binding as text: chords separated by a space, keys in a chord by `+` (`Mod+K Mod+ArrowLeft`, `F6`, `Mod+\`). Modifiers: `Mod` (⌘ on a Mac, Ctrl elsewhere; `Cmd` and `Meta` mean the same), `Ctrl`, `Alt` (`Option`), `Shift`. Keys: a letter, a digit, punctuation, `F1` to `F24`, or a name (`Enter`, `Esc`, `Space`, `Tab`, `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown`, the arrows). Letters, digits and punctuation match the physical key.

### Chord

*type*, from `jali`

```ts
interface Chord { key: string; mod?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean }
```

One key press. `key` is `KeyboardEvent.code` (`"KeyM"`, `"Backslash"`) or, for named keys, `KeyboardEvent.key` (`"ArrowLeft"`, `"F6"`). `mod` is ⌘ on a Mac and Ctrl elsewhere; `ctrl` is the Control key itself.

### KeySequence

*type*, from `jali`

```ts
type KeySequence = readonly Chord[]
```

One binding: a chord, or a prefix chord then a second chord (⌘K ⌘M).

### Platform

*type*, from `jali`

```ts
type Platform = "mac" | "other"
```

The platform keys are matched and printed for.

### KeyWords

*type*, from `jali`

```ts
interface KeyWords { ctrl; alt; shift; escape; space; left; right; up; down: string }
```

The words printed keys use: modifier names elsewhere than a Mac, and Esc, Space and the arrows. `messages.keys` is one.

## Words

### Messages

*type*, from `jali`

```ts
type Messages = { announcements: …; toasts: …; commands: …; … }
```

Every word Jali uses, by area, with the same keys and shapes as [`en`](../core.md#en). A full translation is a `Messages`: a missing area or key, or a message of the wrong shape, is a type error. See [Translate Jali](../../guides/translating.md).

### MessageOverrides

*type*, from `jali`

```ts
type MessageOverrides = { [Area in keyof Messages]?: Partial<Messages[Area]> }
```

What `createJali({ messages })` takes: any areas, and any keys in them. Keys you leave out stay English. A misspelt key is a type error.

### ScreenDirection

*type*, from `jali`

```ts
type ScreenDirection = "left" | "right" | "up" | "down"
```

A direction on screen (right to left too), as command ids name it (`pane.focus.left`), passed to `commands.focusDirection` and `commands.moveDirection`.

## Actions

### PaneTarget

*type*, from `jali`

```ts
type PaneTarget = NodeId | ObjectRef
```

A pane, by its id or by the object it shows. A ref means the pane showing that object: the focused pane if it does, else the first in the layout. `close(order({ id: 7 }))` closes the pane showing order 7, whatever its id.

### ActionName

*type*, from `jali`

```ts
type ActionName = keyof JaliActions | "setLayout"
```

An action by its name in `JaliActions` (`"openBeside"`, `"resetLayout"`), or `"setLayout"`. The `layout` event names the action that made a change with it. A person's click, key or ⌘K command counts as the action it is a form of: a click on a tab is `"focus"`, Split is `"split"`, Close on a tab is `"close"`.

### ChooseOptions

*type*, from `jali`

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

*type*, from `jali`

```ts
interface JaliActions<R extends ObjectRef = ObjectRef>
```

`jali.actions` (in React, `useJali().actions`): panes and layouts. A curated page's actions are `JaliPage`, the dialogs' `JaliDialogs`. `R` is the refs of the instance's kinds: a ref of another kind is a type error. Each one reads the state now, makes its change once and returns an `ActionResult`. They follow one rule:

- The pane comes first, as a `PaneTarget`. It is optional (`?`), meaning the focused pane, only when nothing required follows it.
- What the action uses comes next; options come last, in an object.

A pane that is not there gives `reason: "not-found"`. What a refusal reads out to screen readers is the same as before; `message` holds it.

- **`actions.focus`**, `focus(pane: PaneTarget)`: Focus a pane and show it. A pane that is folded, tucked or behind another tab has its tab chosen; nothing else on screen moves. While another pane is maximised, this one is maximised instead.

- **`actions.toggleZoom`**, `toggleZoom(pane?: PaneTarget)`: Maximise or restore. Refused with `"single-view"` in a curated page's Single view, and with `"blocked"` for a pane the layout hides (it has no place on screen to fill); nothing with one pane.

- **`actions.openBeside`**, `openBeside(pane: PaneTarget, ref: ObjectRef, options?: OpenBesideOptions)`: Open `ref` beside `pane`; focus stays in `pane`. `{ edge: "bottom" }` opens it below `pane` (see `OpenBesideOptions`); by default it opens after `pane`. `pane`'s selected item opens a following detail (kept if one already follows). A link never copies a pane of its own chain: when `ref`'s object is `pane` itself, a pane `pane` was opened from (up the chain), or one it opened, that pane is shown instead (`pane` in the result), focus stays, and it is announced "Already open". Outside a curated page, another chain may still show the same object. In a curated page: a peek in Single view, and an object already on the page is focused instead. `pane` in the result is the pane that shows `ref`. Where `allow` turns `open` off for `pane` (in the free layout or on a curated page), no pane opens: `ref` shows in the peek sheet instead, and the result is what `peek` returns.

- **`actions.openHere`**, `openHere(pane: PaneTarget, ref: ObjectRef)`: Show `ref` in `pane`. If it is open elsewhere, focus that pane (and close `pane` when it is a launcher).

- **`actions.peek`**, `peek(pane: PaneTarget, ref: ObjectRef)`: Show `ref` in the peek sheet, for `pane`. When `pane`'s following detail of that kind is on screen, the detail shows `ref` instead.

- **`actions.closePeek`**, `closePeek()`: Close the peek sheet.

- **`actions.select`**, `select(pane: PaneTarget, ref: ObjectRef | null, options?: { inResults?: boolean })`: Report a list's selection (`null`: none). An open peek from it follows at once; its following detail after 150 ms of rest. `inResults: false`: the list's filter no longer shows it.

- **`actions.setKept`**, `setKept(pane: PaneTarget, kept: boolean)`: Keep a linked pane on what it shows, or let it go. A kept follower stops following its list; a kept plain link is no longer replaced by the next link from its source, which opens beside it instead. Let go, a detail of a list (its source reports a selection) follows the selection again and catches up; a plain link goes back to being replaced. `"nothing-to-do"` for a pane with no link.

- **`actions.split`**, `split(pane?: PaneTarget, direction?: "right" | "bottom")`: Open the launcher beside `pane` and focus it. Without `direction`: right of a wide pane, below a tall one. `"unavailable"` without a launcher, or on a curated page (its layout is its design; links open panes there). `"not-allowed"` where `allow` turns `open` off for `pane`.

- **`actions.newTab`**, `newTab(pane?: PaneTarget)`: The launcher as a new tab of the pane's group. `"unavailable"` without a launcher, `"not-allowed"` where `allow` turns `open` off for the pane.

- **`actions.addTab`**, `addTab(pane: PaneTarget, ref: ObjectRef)`: Show `ref` as a new tab of `pane`'s group (or a new group), and focus it. It is one step: one entry in the history, and the tab takes `pane`'s slot, so nothing else folds or moves. Use it rather than `openBeside` then `mergeInto`, which is two entries and can fold other panes in between. If `ref` is already open, that pane is shown instead. `"invalid"` for a kind the instance doesn't have, as for every action that takes a ref. `"not-allowed"` where `allow` turns `open` off for `pane`.

- **`actions.close`**, `close(pane?: PaneTarget)`: Close a pane, with an Undo toast. The last pane stays (`"last-pane"`). A curated page's view goes back to the tabs.

- **`actions.closeOthers`**, `closeOthers(pane?: PaneTarget)`: Close every other pane. In a curated page, `jali.page.back()`.

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

- **`actions.preset`**, `preset(id: string)`: Switch to a preset. `"not-found"` for an id the instance doesn't have.

- **`actions.toggleFullScreen`**, `toggleFullScreen(pane?)`: Put a pane (default: the focused one) on the whole screen: maximised, with the page in the browser's full screen. Again, Escape, or leaving the browser's full screen puts it back as it was. Where the browser has no full screen (an iPhone), the pane still covers the page. `"blocked"` for a pane the layout hides. ⌘K: "Full screen pane, or exit full screen".

- **`actions.resetLayout`**, `resetLayout()`: Rebuild the preset last chosen.

- **`actions.autoLayout`**, `autoLayout()`: Arrange every pane from the room there is and each kind's size hints ([`layout.arrange`](layout.md#layoutarrange)): columns at the kinds' comfortable widths, a second row when the height allows, the rest as tabs beside the pane they were opened from. The same panes, so nothing reloads; tucked and folded panes are placed too. Back returns to the arrangement before. `"unavailable"` on a curated page, `"nothing-to-do"` with one pane. ⌘K: "Arrange panes automatically".

- **`actions.changeSettings`**, `changeSettings(patch: Partial<Settings>)`: Change the person's settings. They are saved on this device; a new theme is applied and a new pane cap refits the layout. `"invalid"`, changing nothing, when a value is one its setting can't take (a `paneCap` that isn't a whole number from 1 to 64, a `theme` or `centreDrop` it doesn't know). A saved value like that is never used either: that one setting starts on its default.

What drags, keys and panes report (dividers, drops, focus keys, `useUnsaved`, `useCommands`, `usePaneState`, the discard dialog) runs through the engine's own steps, which are not part of `jali.actions`.

### JaliPage

*type*, from `jali`

```ts
interface JaliPage<I extends ItemId = ItemId>
```

`jali.page`: the curated page's actions, there (and typed) only when `createJali({ page })` was given one. `I` is the page's item type, its `firstItem`'s.

- **`page.open`**, `open(options?: OpenPageOptions<I>)`: Open the curated page.

- **`page.leave`**, `leave()`: Back to the free layout's preset. The page's mode and layout are kept. `"unavailable"` in a page-only app.

- **`page.setMode`**, `setMode(mode: ViewMode)`: Single view or Split view.

- **`page.showView`**, `showView(view: string)`: What a click on a page tab does. It never reshapes: Single view swaps the view; Split view focuses it, chooses its tab, or puts it in place of the view you're in.

- **`page.showItem`**, `showItem(item: I)`: Show another item; the previous item's opened panes close.

- **`page.back`**, `back()`: Close every opened pane, with Undo.

- **`page.reset`**, `reset()`: Split view back to the design; opened panes stay.

### JaliDialogs

*type*, from `jali`

```ts
interface JaliDialogs
```

`jali.dialogs`: Jali's palette, settings and chooser.

- **`dialogs.choose`**, `choose<T>(options: ChooseOptions<T>)`: Ask the person for one of `options.items` in Jali's chooser: type to filter, arrows, Enter, Esc. `options.onChoose(item)` runs once it has closed and focus is back. Closes ⌘K if it is open.

- **`dialogs.openPalette`**, `openPalette()`: Open the command palette.

- **`dialogs.closePalette`**, `closePalette()`: Close it.

- **`dialogs.openSettings`**, `openSettings()`: Open Settings.

- **`dialogs.closeSettings`**, `closeSettings()`: Close it.

### Ref

*type*, from `jali`

```ts
interface Ref<K extends string = string, P = Params> { readonly kind: K; readonly params: P }
```

An object of the kind `K`, with its params typed: what a kind's call returns (`note({ id: 2 })` is a `Ref<"note", { id: number }>`). It is an `ObjectRef` too, the wide type links and agents use; `kind` tells one kind's refs from another's, so checking it narrows `params`.

### RefOf

*type*, from `jali`

```ts
type RefOf<D>
```

The refs of kinds `D`: each defined kind's `Ref`, and `ObjectRef` for a kind without a call. `createJali` uses it to type the instance.

### RefsOf

*type*, from `jali`

```ts
type RefsOf<J extends AnyJali>
```

The refs of instance `J`'s kinds.

### PageOf

*type*, from `jali`

```ts
type PageOf<P>
```

The page's actions an instance made with page `P` has: `JaliPage` for its item type, or `undefined`.

### AnyJali

*type*, from `jali`

```ts
type AnyJali = Jali<any, any>
```

Any instance, whatever its kinds and page: for a function that takes one.

### Register

*type*, from `jali`

```ts
interface Register { jali?: AnyJali }
```

One declaration types the app's instance everywhere, React's hooks included (the full example is on [Installation](../../get-started/installation.md#typescript-register-your-instance)):

```ts nocheck
declare module "jali" {
  interface Register {
    jali: typeof jali;
  }
}
```

### RegisteredJali

*type*, from `jali`

```ts
type RegisteredJali
```

The app's instance type from `Register`, or any instance when nothing is registered. The React hooks default to it.

### JaliEvent

*type*, from `jali`

```ts
type JaliEvent = keyof JaliEvents
```

The name of an event: `"open"`, `"close"`, `"pin"`, `"focus"`, `"layout"` or `"toast"`.

### DeepReadonly

*type*, from `jali`

```ts
type DeepReadonly<T>
```

`T`, read-only all the way down: what an instance gives an app to read (its state, layout, model and events). An edit would change the instance behind its back, with no history and no event; in development it throws. `layout.tree.clone` gives a copy to edit; a read-only layout goes back into `setLayout` and `createJali({ layout })` as it is.

### PaneOf

*type*, from `jali`

```ts
type PaneOf<R extends ObjectRef = ObjectRef>
```

A pane as the model gives it: read-only, with its `ref` typed by the instance's kinds.

### KeyboardOptions

*type*, from `jali`

```ts
interface KeyboardOptions extends KeymapOptions { scope?; keymap? }
```

`createJali({ keyboard })`: Jali's keys in one place. `scope` (`"page"` or `"local"`), `keymap`, and the `KeymapOptions` `prefix`, `reserved`, `platform`, `onInvalid` and `words`. See [`createJali`](../core.md#createjali).
