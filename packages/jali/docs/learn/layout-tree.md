# The layout tree

A layout is a tree of rows, columns, stacks and panes, with a size on every node, and notes beside it for what is hidden.

Every workspace has one layout. It is a plain JSON tree, so it fits in the address and two of them can be compared. You write one with `row`, `column`, `tabs` and `pane`, which build the tree for you. Each live diagram on this page is a real workspace beside its own tree. Hover a node to see its pane, drag a divider to see the sizes change, and switch to JSON to see what goes in the link.

## Panes are the leaves

A [pane](../get-started/key-concepts.md#pane) node shows one [ref](../get-started/key-concepts.md#ref). It is always a leaf.

```ts
{ id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } }
```

The `id` names the node in the layout. Actions use it (`jali.actions.focus("a")`) and the address carries it. The builders name nodes after what they hold; give an `id` yourself when your code refers to a node.

*Live demo on the site: The smallest useful tree: a row with two panes.*

## Rows and columns split the room

A `row` puts its children side by side; a `column` puts them one above the other. Either can hold panes, stacks or other splits, as deep as you need.

*Live demo on the site: A row whose second child is a column: one pane at the left, two stacked at the right.*

Nest a column in a row when one area of the screen needs two things on top of each other, such as a ticket above its conversation.

## Stacks hold tabs

A `stack` holds panes as tabs, one shown at a time. `active` is the shown one. Its children are always panes, never splits.

*Live demo on the site: A stack of three panes. Click a tab: the tree's active child changes, and nothing else moves.*

A stack in the tree is one the person made, by dropping a pane in another's centre or with "Add to tabs of…". It stays until they change it. Tabs that appear because the window ran out of room are not in the tree at all; they are [folds](../get-started/key-concepts.md#fitting), in the overlay.

*Live demo on the site: The tab strip of a stack.*

## Every node has a size

A node's size is its length along its parent's direction: its width in a row, its height in a column.

- `{ weight: n }` takes a share of the room in proportion to its siblings' weights. Two panes of weight 1 split the room evenly; weights 2 and 1 split it two to one.
- `{ px: n }` asks for a fixed length. A fixed pane keeps its length and shrinks toward its kind's minimum only when room runs out.

`layouts.ts`

```tsx
import { column, pane, row, tabs } from "jali";
import { customer, customerOrders } from "./customer";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

// A fixed-width list, and a column beside it: the ticket above, two tabs below.
export const triage = row(
  pane(ticketList({ queue: "open" }), { id: "list", px: 360 }),
  column(
    pane(ticket({ id: 101 }), { id: "detail", weight: 2, linkedTo: "list", follows: true }),
    tabs(customer({ id: 7 }), customerOrders({ customer: 7 })),
  ),
);

// One pane: the list alone.
export const listOnly = pane(ticketList({ queue: "open" }), { id: "list" });
```

When nobody has dragged a divider, spare room is shared by each kind's sizes: every pane starts at its minimum, then grows toward its comfortable width, then toward its maximum. [How a layout fits](fitting.md) has the whole rule.

*Live demo on the site: Drag a divider and the split keeps those proportions at any width. Double-click it to reset.*

Once the person drags a divider, the split remembers their proportions exactly, at any window width. A double-click on the divider hands it back to the shared rule.

## The overlay: hidden without moving the tree

Some panes are not shown in their own place. The layout keeps a note about each, beside the tree, in `overlay`:

- **folds**: panes folded into a neighbour's tabs because the window is too small;
- **tucks**: panes the person tucked into a neighbour, each with its home;
- **hidden**: a curated page's views that are not on screen, with no slot and no tab.

```ts
overlay: { tucks: [], folds: [], shown: {}, hidden: ["overview"] }
```

The tree stays as it was. A fold, a tuck or a hide only adds a note, and undoing it removes the note. That is why a tucked pane goes back to its exact slot, and why widening the window brings folded panes back to where they were. `shown` records which tab is showing in each fold group, keyed by the group's home pane.

You rarely write the overlay by hand. A curated page's designed layout is the one place you do, to say which views start hidden.

## What is not in the layout

Focus, a maximised pane and the peek sheet are view state, kept beside the layout, not in it. Moving focus never changes the layout, and choosing a tab only changes which tab shows. Neither moves a pane.
