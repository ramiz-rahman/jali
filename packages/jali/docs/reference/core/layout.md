# The layout namespace

The pure layout operations of jali, each taking a layout and returning a new one.

`layout` is a namespace export of `jali`. Every member is pure: the layout you pass is never changed, an operation that does nothing returns the same object, and the instance's actions are built from these. To write a layout, use the builders (`row`, `column`, `tabs`, `pane`); these work on one. Types such as `layout.OpenResult` and `layout.UndoEntry` are reachable through it as well.

### layout.open

*function*, from `jali`

```ts
layout.open(
  layout: Layout, view: ViewState, target: string, edge: Edge,
  ref: ObjectRef, ctx: LayoutContext, linked: boolean,
  place?: Placement, opts?: OpenOptions,
): OpenResult
```

Example, `layout.ts`:

```ts
import { layout, type Layout, type LayoutContext, type ViewState } from "jali";
import { orderKind } from "./kinds";
import { store } from "./store";

// Every operation is pure: a layout in, a new layout out. The context is the room, the gap and the kinds.
const ctx: LayoutContext = {
  fit: { ...store.get().area, gap: store.env.spacing.gap, kinds: store.env.kinds.registry() },
  paneCap: store.get().settings.paneCap,
};
const start: Layout = layout.tree.clone(store.getLayout());
const view: ViewState = { focused: "orders", focusHistory: ["orders"] };

const opened = layout.openBeside(start, view, "orders", orderKind({ id: 1043 }), ctx);
opened.mode; // "beside", "replaced" (an earlier link reused) or "tab" (no room)

const closed = layout.close(opened.layout, opened.view, opened.opened, ctx);
const boxes = layout.resolve(closed.layout, closed.view, ctx).panes; // a rect for every pane

const code = layout.encode(closed.layout); // "1.WzEseyJ…": what goes in ?l=
const back = layout.decode(code, store.env.kinds.registry()); // the same layout, or null when it can't be read
export { boxes, back };
```

Opens `ref` in a new pane at `edge` of `target`, then fits the layout. `openBeside` and `split` are the two common forms.

When there is no room, or the pane cap is passed, what folds is decided now and recorded in the overlay. With no room, the new pane becomes a tab of its source. Over the cap, the oldest pane that is not kept, focused or primary folds. A linked open (not from a selection) reuses the source's earlier plain link of the same kind instead of opening another pane; followers and kept panes are never reused. A linked open keeps focus on `target`; an unlinked one focuses the new pane.

**Parameters**

- **`layout`** (`Layout`, required): The layout now.

- **`view`** (`ViewState`, required): Focus, maximise and peek.

- **`target`** (`string`, required): The source pane's id. Throws `Unknown source pane` when it is not a pane.

- **`edge`** (`"left" | "right" | "top" | "bottom"`, required): Which side of `target`.

- **`ref`** (`ObjectRef`, required): What the new pane shows. Throws `Unknown pane kind` when its kind is not in `ctx.fit.kinds`.

- **`ctx`** (`LayoutContext`, required): The room, the gap, the kinds and the pane cap (see [`LayoutContext`](types.md#layoutcontext)). A negative width or height counts as zero. Throws a `RangeError` for a non-finite size or gap, a negative gap, or a cap that is not a positive integer.

- **`linked`** (`boolean`, required): Whether the new pane is linked to `target` (`linkedTo`). Closing the source drops the link.

- **`place`** (`{ target: string; edge: Edge }`): Somewhere else to put it: a curated page keeps opened panes after its arrangement. Ignored when `place.target` is not in the layout.

- **`opts`** (`{ yields?: boolean; fromSelection?: boolean }`): `yields: false`: no supporting pane gives way for the new one; short of room, the new pane becomes a tab of its source. `fromSelection`: `ref` is the source's selected row (or what its kind's `follow` shows for it), so the new pane follows the selection, or opens kept when the source already has a follower of that kind.

**Returns** `{ layout: Layout; view: ViewState; opened: NodeId; mode: "beside" | "replaced" | "tab" }`:

- `beside`: A new pane, on screen.

- `replaced`: An earlier plain link of the same kind now shows `ref` (`opened` is that pane).

- `tab`: A new pane, folded into a tab because there was no room.

### layout.openBeside

*function*, from `jali`

```ts
layout.openBeside(layout, view, source, ref, ctx, place?, opts?): OpenResult
```

`open` to the right of `source`, linked to it. What a pane's `openBeside(ref)` runs.

**Returns** `OpenResult`:

### layout.split

*function*, from `jali`

```ts
layout.split(layout, view, target, edge, ref, ctx): OpenResult
```

`open` at `edge` of `target`, not linked. Focus moves into the new pane.

**Returns** `OpenResult`:

### layout.addTab

*function*, from `jali`

```ts
layout.addTab(layout, view, target, ref, ctx): OpenResult
```

Opens `ref` as a new tab of `target`'s tab group (a new group when `target` has none) and focuses it. When `target` is in a group the layout folded, it opens beside instead and selects the new tab. Throws like `open` for an unknown pane or kind. `mode` is `"tab"`.

**Returns** `OpenResult`:

### layout.close

*function*, from `jali`

```ts
layout.close(layout, view, target, ctx): { layout: Layout; view: ViewState; undo?: UndoEntry }
```

Removes a pane. Its space goes to the pane it was opened from when that is a sibling, else the next sibling, else the previous. Links to it are dropped. When it had focus, focus goes to the most recently focused pane still open. The last pane is never closed: the same layout comes back.

**Returns** `{ layout; view; undo? }`: `undo`, for the instance's undo, records the operation, not the layout before: the closed pane as it was, where it was (its container, position and size, and its neighbours), and the sizes the close changed. Absent when nothing closed.

### layout.closeOthers

*function*, from `jali`

```ts
layout.closeOthers(layout, view, keep, ctx): { layout; view; undo? }
```

Leaves only `keep`, unlinked and at full size, focused, with an empty focus history.

**Returns** `{ layout; view; undo? }`: `undo` records every pane closed, in one entry, as `layout.close` does.

### layout.swap

*function*, from `jali`

```ts
layout.swap(layout: Layout, a: string, b: string, ctx: LayoutContext): Layout
```

Two panes trade places; every slot keeps its rect. Works inside one tab group too.

**Returns** `Layout`:

### layout.drop

*function*, from `jali`

```ts
layout.drop(
  layout, view, dragged: string, target: string,
  zone: Edge | "centre", centreMode: "swap" | "tab", ctx,
): { layout: Layout; view: ViewState }
```

What a drag and drop does: an edge zone places `dragged` beside `target` on that side; the centre swaps them (`"swap"`) or makes `dragged` a tab of `target` (`"tab"`, the `centreDrop` setting). Moving a tucked pane ends its tuck. Drops that would change nothing return the same layout. Focus moves to `dragged`.

**Returns** `{ layout; view }`:

### layout.moveDirection

*function*, from `jali`

```ts
layout.moveDirection(layout, view, pane, dir: Edge, ctx): { layout; view }
```

Moves `pane` past its nearest neighbour on screen in `dir` (a drop on that neighbour's edge). The same layout when there is none.

**Returns** `{ layout; view }`:

### layout.resizeDivider

*function*, from `jali`

```ts
layout.resizeDivider(layout, parentId: string, index: number, deltaPx: number, ctx): Layout
```

Moves the divider after child `index` of split `parentId` by `deltaPx`, clamped to the neighbours' minimums. Sizes are stored as proportions, never fixed pixels, so the split still fills its space after a close or a window resize; each child keeps its earlier size as `base` for a reset. A zero or non-finite delta returns the same layout.

**Returns** `Layout`:

### layout.resetDivider

*function*, from `jali`

```ts
layout.resetDivider(layout, parentId, index, ctx): Layout
```

Puts the two sides of a divider back to their `base` sizes (else an equal share), and siblings that a drag only re-expressed back to theirs.

**Returns** `Layout`:

### layout.canTuck

*function*, from `jali`

```ts
layout.canTuck(layout, pane, ctx): { ok: true; home: NodeId } | { ok: false; reason: "missing" | "tab" | "hidden" | "last" }
```

Whether `pane` can be tucked, and into which pane (its home): the pane it was opened from when that is on screen next to it, else the nearest pane on screen in a sibling slot before it, else after it, moving out one split level at a time.

- `missing`: Not a pane in this layout.

- `tab`: In a tab group, already tucked, or another tuck's home.

- `hidden`: Not on screen.

- `last`: The root pane, the only pane on screen, or no home found.

### layout.tuck

*function*, from `jali`

```ts
layout.tuck(layout, view, pane, ctx): TuckResult
```

Makes `pane` a tab of its home (see `canTuck`). The home keeps its shown tab and takes the space; nothing else moves or unfolds. Recorded in the overlay, so the tree keeps the pane's slot. Focus moves to the home.

**Returns** `{ ok: true; layout; view; home: NodeId; undo: UndoEntry } | { ok: false; reason }`:

### layout.putBack

*function*, from `jali`

```ts
layout.putBack(layout, view, pane, ctx): PutBackResult
```

Ends a tuck: the pane returns to its slot and size and is focused. Something folds only if room ran out.

**Returns** `{ ok: true; layout; view; home: NodeId } | { ok: false; reason: "missing" | "not-tucked" }`:

### layout.putBackEdge

*function*, from `jali`

```ts
layout.putBackEdge(layout: Layout, pane: string): Edge | undefined
```

The side of its home a tucked pane came from, read from the tree. Dragging the tab out on that side puts it back. `undefined` when the pane is not tucked or not in a split.

**Returns** `Edge | undefined`:

### layout.hide

*function*, from `jali`

```ts
layout.hide(layout, view, pane, ctx): HideResult
```

Takes a pane off screen with no tab and no slot; its neighbours take the space. The tree keeps it, so `show` brings it back in its place and size. A tab is first lifted out beside its group. Tucks behind it, or its own, are dropped. Never the last pane on screen.

**Returns** `{ ok: true; layout; view } | { ok: false; reason: "missing" | "hidden" | "last" }`: `"hidden"`: it is hidden already.

### layout.show

*function*, from `jali`

```ts
layout.show(layout, view, pane, ctx): HideResult
```

Shows a hidden pane in its own place and focuses it. Room is made by folding others, never the pane being shown. `reason: "hidden"` here means it was not hidden.

**Returns** `HideResult`:

### layout.replace

*function*, from `jali`

```ts
layout.replace(layout, view, current, incoming, ctx): { layout; view; reshaped: boolean }
```

`incoming` takes `current`'s place exactly (slot, size, tab position, fold and tuck records) and `current` takes `incoming`'s old place, off screen when that was hidden. Every rect stays the same unless `incoming` can't fit the slot; then the layout refits and `reshaped` is true. Focus moves to `incoming`.

**Returns** `{ layout; view; reshaped }`:

### layout.setRef

*function*, from `jali`

```ts
layout.setRef(layout, view, id, ref, ctx, opts?: { hold?: boolean }): Layout
```

Shows `ref` in pane `id`: same node, new object. By default the slot keeps its rect even when the new object would size differently; `hold: false` lets the layout settle to the new object's measure (filling a launcher). The same layout when `ref` is exactly what it shows. Throws for an unknown kind.

**Returns** `Layout`:

### layout.follower

*function*, from `jali`

```ts
layout.follower(layout, source: NodeId, kind: string): PaneNode | undefined
```

The pane following `source`'s selection for `kind`: linked to it, with `follows: true`. There is at most one per source and kind.

**Returns** `PaneNode | undefined`:

### layout.followers

*function*, from `jali`

```ts
layout.followers(layout, source: NodeId): PaneNode[]
```

Every pane following `source`'s selection, one per kind, in tree order. A list's selection moves each of them that can show it (see `follow` on [`PaneOptions`](types.md#paneoptions)).

**Returns** `PaneNode[]`:

### layout.follow

*function*, from `jali`

```ts
layout.follow(layout, view, source, ref, ctx): { layout: Layout; pane?: NodeId }
```

Shows `ref` in `source`'s follower of that kind, in place (a swap: same node, slot and size). The same layout, and no `pane`, when there is no follower.

**Returns** `{ layout; pane? }`:

### layout.selectionLink

*function*, from `jali`

```ts
layout.selectionLink(layout, source, kind): { follows: true } | { kept: true }
```

The link flags for a pane newly opened from `source`'s selection: it follows, unless the source already has a follower of that kind, then it opens kept.

**Returns** `Pick<PaneNode, "follows" | "kept">`:

### layout.setKept

*function*, from `jali`

```ts
layout.setKept(layout: Layout, id: NodeId, kept: boolean, opts?: { follow?: boolean }): Layout
```

Keeps a linked pane on its object (`kept: true`): a follower stops following, a plain link is no longer replaced by the next link from its source. Let go (`kept: false`) with `follow`, it follows its source again, and any other follower of that source and kind is kept in its place; without, it is a plain link again. Unlinked panes and unchanged states return `layout`.

**Returns** `Layout`:

### layout.moveTab

*function*, from `jali`

```ts
layout.moveTab(layout, pane: string, index: number): Layout
```

Moves `pane` to position `index` (from 0, clamped to its part of the group: the pinned tabs or the rest) among the tabs of its deliberate tab group. The shown tab stays shown and nothing refits. The same layout when `pane` is not in such a group or is already there.

**Returns** `Layout`:

### layout.setPinned

*function*, from `jali`

```ts
layout.setPinned(layout, pane: string, pinned: boolean): Layout
```

Pins or unpins `pane`'s tab. In a tab group it moves to where the pinned tabs end. The same layout when it already is as asked.

**Returns** `Layout`:

### layout.setActiveTab

*function*, from `jali`

```ts
layout.setActiveTab(layout, stack: string, pane: string, ctx): Layout
```

Shows `pane` in its tab group, deliberate or made by the layout. Nothing else moves and nothing refits.

**Returns** `Layout`:

### layout.reveal

*function*, from `jali`

```ts
layout.reveal(layout, pane, ctx): Layout
```

Shows a pane that is behind a tab (tucked, folded or an ordinary tab) by choosing its tab. The same layout when it is on screen.

**Returns** `Layout`:

### layout.resetLayout

*function*, from `jali`

```ts
layout.resetLayout(preset: Layout, view, ctx): Layout
```

A preset's layout, fitted, with every node's size recorded as its `base`, so a divider reset returns to the preset's proportions.

**Returns** `Layout`:

### layout.arrange

*function*, from `jali`

```ts
layout.arrange(layout: Layout, ctx: LayoutContext, options?: ArrangeOptions): Layout
```

A new arrangement of the same panes (same ids, refs, links, pins and keeps), from the room in `ctx` and each kind's size hints, with no sizes anyone chose. What `jali.actions.autoLayout()` uses.

1. **Order:** the panes in front, then those behind another tab; each in reading order with the panes opened from a pane right after it, so a list sits beside its detail. A row that scrolls sideways is one unit, kept whole.
2. **One row:** as many as fit across at their minimum widths, so it never shows fewer panes than the fit would.
3. **A second row**, below, only for what didn't fit across, when the height holds both rows' tallest minimum. Never more than two.
4. **The rest:** tabs of the pane they were opened from, else of the pane before them in the order. `options.focused` is the tab shown. A row that scrolls always gets a place of its own.

The result reads in the order it was built from, so arranging it again gives the same layout. Hidden panes stay hidden. The layout as it is when it holds fewer than two panes. Fit the result with `layout.refit`. See [Auto layout](../../guides/auto-layout.md).

**ArrangeOptions**

- **`focused`** (`string`): The pane to keep shown when it lands in tabs.

- **`maxColumns`** (`number`): At most this many panes across a row. Default: as many as fit.

- **`maxRows`** (`number`): At most this many rows, 1 or 2. Default 2.

**Returns** `Layout`:

### layout.focus

*function*, from `jali`

```ts
layout.focus(view: ViewState, pane: string, ctx): ViewState
```

Focuses `pane` and moves it to the front of the focus history. While a pane is maximised, the maximise moves to `pane`. The same view when nothing changes.

**Returns** `ViewState`:

### layout.focusCycle

*function*, from `jali`

```ts
layout.focusCycle(view, resolved: ResolvedLayout, delta: 1 | -1, ctx): ViewState
```

Focuses the next (`1`) or previous (`-1`) pane on screen in reading order, wrapping.

**Returns** `ViewState`:

### layout.focusDirection

*function*, from `jali`

```ts
layout.focusDirection(view, resolved, dir: Edge, ctx): ViewState
```

Focuses the nearest pane on screen in `dir` that overlaps the focused one across that axis. Ties at the same distance go to the most recently focused. The same view when there is none.

**Returns** `ViewState`:

### layout.toggleZoom

*function*, from `jali`

```ts
layout.toggleZoom(view, pane, ctx): ViewState
```

Maximises `pane`, or restores it when it is the maximised one. Maximise is a view overlay: the tree and its sizes don't change.

**Returns** `ViewState`:

### layout.resolve

*function*, from `jali`

```ts
layout.resolve(layout: Layout, view: ViewState, ctx: LayoutContext): ResolvedLayout
```

Where everything goes: a rect for every pane (marked hidden behind a tab, behind a maximised pane, or off), every divider with its range, the tab groups and the shelf. Folds the layout further if it still doesn't fit. Hidden panes get an empty rect so their content can stay mounted and paused.

**Returns** `ResolvedLayout`:

### layout.refit

*function*, from `jali`

```ts
layout.refit(layout, view, ctx): Layout
```

Fits a layout to a new room or pane cap, or one that arrived from a link: unfolds what now fits and folds what doesn't. Operations fit as they go; call this only for changes from outside. The same layout when nothing changes.

**Returns** `Layout`:

### layout.encode

*function*, from `jali`

```ts
layout.encode(layout: Layout): string
```

The layout as URL-safe text: `1.` and base64url JSON (what `?l=` holds).

**Returns** `string`:

### layout.decode

*function*, from `jali`

```ts
layout.decode(text: string, kinds: KindRegistry): Layout | null
```

Reads `encode`'s text back. `null` for anything malformed, over 1,000,000 characters, or that fails `validate` against `kinds` (an unknown kind included). Never throws.

**Returns** `Layout | null`:

### layout.validate

*function*, from `jali`

```ts
layout.validate(layout: Layout, kinds: KindRegistry): { ok: true } | { ok: false; errors: string[] }
```

Checks a layout from outside: version 1; unique ids of 1 to 128 letters, digits, `_`, `.`, `:` or `-`; exactly one positive `px` or `weight` per size; known kinds and string or finite number params; stacks of panes only, with an `active` child; at most 256 nodes and 128 levels; a well-formed overlay. Each error is `path: message`.

**Returns** `{ ok: true } | { ok: false; errors: string[] }`:

### layout.minSize

*function*, from `jali`

```ts
layout.minSize(node: LayoutNode, kinds: KindRegistry, gap: number, axis: Axis): number
```

The least a node needs along `axis`: side by side, minimums add up (plus gaps); stacked, the largest; tabbed, every tab must fit. Throws for an unknown kind.

**Returns** `number`:

### layout.extentAlong

*function*, from `jali`

```ts
layout.extentAlong(boxes: readonly PaneBox[], ids: readonly string[], axis: Axis): number
```

How far the shown boxes among `ids` reach along `axis`, gaps included. `0` when none is shown.

**Returns** `number`:

### layout.moveOutOfStrip

*function*, from `jali`

```ts
layout.moveOutOfStrip(layout, view, pane, side: "left" | "right", ctx): { layout; view }
```

Takes `pane` out of the row that scrolls holding it, from anywhere in the row, and puts it beside the row on `side`, a tree side (before or after it). A pane in a column in the row comes out alone; a row left with one child becomes that child. Unchanged for a pane in no such row.

**Returns** `{ layout: Layout; view: ViewState }`:

### layout.extentIn

*function*, from `jali`

```ts
layout.extentIn(resolved: ResolvedLayout, ids: readonly string[], axis: Axis): number
```

As `layout.extentAlong`, but a row that scrolls counts as its window: when every pane of a strip is among `ids`, the strip takes the room its window does, not the length of its content. What a divider beside a strip measures.

**Returns** `number`:

### layout.scrolled

*function*, from `jali`

```ts
layout.scrolled(resolved: ResolvedLayout, offsets: Offsets, dir?: "ltr" | "rtl"): ResolvedLayout
```

The resolved layout with each row that scrolls at its offset (`offsets`, by the row's id, in px along its content): its panes and dividers moved, and given `clip`, the strip's window. Right to left, an offset moves the content right. The model applies it with `view.scroll`.

**Returns** `ResolvedLayout`:

### layout.offsetToShow

*function*, from `jali`

```ts
layout.offsetToShow(strip: ScrollerBox, rect: Rect, offset: number, dir?: "ltr" | "rtl"): number
```

The offset that shows the whole of `rect` (a pane in the strip, unscrolled) with the least movement from `offset`; `offset` itself when it already shows. A pane wider than the window shows from its start.

**Returns** `number`:

### layout.clampOffset

*function*, from `jali`

```ts
layout.clampOffset(strip: ScrollerBox, offset: number): number
```

An offset kept between 0 and `layout.maxOffset`.

**Returns** `number`:

### layout.maxOffset

*function*, from `jali`

```ts
layout.maxOffset(strip: ScrollerBox): number
```

How far a strip scrolls: its content past its window, or 0.

**Returns** `number`:

### layout.inWindow

*function*, from `jali`

```ts
layout.inWindow(rect: Rect, clip: Rect): boolean
```

Whether a scrolled pane shows at all in its strip's window.

**Returns** `boolean`:

### layout.snapToCentre

*function*, from `jali`

```ts
layout.snapToCentre(value: number, centre: number, wasSnapped: boolean): number
```

A divider's centre snap with hysteresis: `centre` when `value` is within `SNAP_IN` px of it (within `SNAP_OUT` px if it was already snapped), else `value`.

**Returns** `number`:

### layout.SNAP_IN

*constant*, from `jali`

```ts
const SNAP_IN = 10
```

Pixels from the centre at which a divider snaps to it.

### layout.SNAP_OUT

*constant*, from `jali`

```ts
const SNAP_OUT = 16
```

Pixels from the centre at which a snapped divider lets go.

### layout.tree

*namespace*, from `jali`

```ts
layout.tree.panes(layout.root)
```

Helpers for reading the tree. Each one leaves the tree it is given as it is; `map` returns a new tree. To change a layout, use the operations on this page or `jali.actions`. Each takes a tree an instance gave (read-only) as well as one of your own; `clone` gives a copy to edit.

- **`layout.tree.clone`**, `clone<T>(value: T): T`: A deep copy (`structuredClone`).

- **`layout.tree.isSplit`**, `isSplit(n: LayoutNode): n is SplitNode`: Whether a node is a row or a column.

- **`layout.tree.nodes`**, `nodes(root: LayoutNode): LayoutNode[]`: Every node, depth first, root first.

- **`layout.tree.panes`**, `panes(root: LayoutNode): PaneNode[]`: Every pane, in tree order.

- **`layout.tree.find`**, `find(root: LayoutNode, id: NodeId): LayoutNode | undefined`: The node with this id.

- **`layout.tree.parent`**, `parent(root, id): SplitNode | StackNode | undefined`: The node that holds `id`.

- **`layout.tree.stackOf`**, `stackOf(root, id): StackNode | undefined`: The tab group (stack in the tree) that holds `id`.

- **`layout.tree.newId`**, `newId(root, prefix = "pane"): NodeId`: The first free id of the form `prefix-1`, `prefix-2`, …

- **`layout.tree.map`**, `map(root, fn: (node) => LayoutNode): LayoutNode`: A new tree with `fn` applied top down; a node `fn` replaces is not descended into, and unchanged branches keep their identity.

- **`layout.tree.shape`**, `shape(root): string`: The tree's structure as text, without sizes, tab choice or content.

- **`layout.tree.unzoom`**, `unzoom(view: ViewState): ViewState`: The view with no pane maximised.

- **`layout.tree.noFocus`**, `noFocus(): ViewState`: An empty view: `{ focusHistory: [] }`.
