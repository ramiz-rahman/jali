# Rows that scroll sideways

Keep a sequence of panes at a width you can read, a board's stages or a week of days, in a row that scrolls instead of folding.

Jali's root is the size its page gives it. When panes don't fit, Jali folds some into tabs, which suits a layout of different things: a fifth table beside four others is clutter. It suits a sequence of like things less well. Stages of a pipeline, days of a trip or columns of a board are something people move along, not pick from a menu. Give that row `scroll: "x"` and each pane keeps its own width, and the row scrolls to the rest.

*Live demo on the site: Six orders in a row that scrolls, beside the list they came from. Swipe sideways over them, or hold Shift and use the wheel.*

```ts
import { row } from "jali";
import { stage } from "./pipeline";

row({ scroll: "x" }, stage({ name: "Lead" }), stage({ name: "Qualified" }), stage({ name: "Demo" }));
```

The panes in it are ordinary panes, of any kind: headers, menus, tabs, following, Keep, links and undo all work as anywhere else. Here is a pipeline whose stages scroll while the deal beside them stays put:

`src/jali.tsx`

```tsx
import { column, createJali, pane, row } from "jali";
import { definePane } from "jali/react";

// A sales pipeline: every stage is a pane, side by side at a width you can read, in a row that scrolls.
const STAGES = ["Lead", "Qualified", "Demo", "Proposal", "Negotiation", "Won"] as const;

export const stageKind = definePane("stage", {
  params: { name: String },
  title: ({ name }) => name,
  // The width each stage keeps in the row: it never shares out or folds.
  width: { min: 260, comfortable: 300, max: 420 },
  Component: ({ params }) => <StageList stage={params.name} />,
});

export const dealKind = definePane("deal", {
  params: { id: Number },
  title: ({ id }) => `Deal ${id}`,
  width: { min: 300, comfortable: 340 },
  Component: ({ params }) => <DealDetail id={params.id} />,
});

export const jali = createJali({
  panes: [stageKind, dealKind],
  layout: row(
    // Every stage, in a row that scrolls sideways: none folds into a tab, however narrow the window.
    row(
      { id: "pipeline", scroll: "x" },
      ...STAGES.map((name) => pane(stageKind({ name }), { id: name.toLowerCase() })),
    ),
    // Outside the row, the deal stays put while the stages scroll beside it.
    column({ px: 360 }, pane(dealKind({ id: 1042 }), { id: "deal" })),
  ),
});

function StageList({ stage }: { stage: string }) {
  return <p>The deals in {stage}.</p>;
}
function DealDetail({ id }: { id: number }) {
  return <p>Deal {id}.</p>;
}
```

## How a row that scrolls takes its room

Each pane in the row gets its kind's `width.comfortable`, within its `min` and `max`, or the width the person dragged it to. Together they can be wider than the row's window, and the row scrolls. When they're narrower, they share the window out as any row does, so no gap opens at the end.

To the panes around it, the row asks for one of its panes, whole, at its comfortable width. A window narrower than that would cut off even the pane in view. When there isn't room for that, the panes beside the row fold first. The row itself folds only after them, like a [primary](../learn/fitting.md) pane, because it holds the most.

Inside the row, nothing folds, and the pane cap counts the whole row as one pane. A row that scrolls inside another row that scrolls is a plain row.

Make the whole layout scroll by making the row at its root scroll. Mix the two by putting fixed panes beside it, outside the row: in Trips, the trip's overview and the map stay where they are, and the week scrolls between them.

## Scrolling

The browser scrolls the row, so it feels like any page: a trackpad swipe with its momentum, Shift and the wheel, and a thin scrollbar in the gap under the panes. A swipe past the end stops there, rather than going back a page. The edges fade where there is more to see.

Moving focus brings the pane wholly into view, scrolling as little as it can: a click, F6, ⌘K and an arrow, a link, or opening a pane. So a keyboard user never lands on a pane they can't see. A pane opened beside one in the row goes right after it, and comes into view with it, even though focus stays at the pane it came from. When both don't fit, the new pane shows whole. Panes scrolled out of view stay mounted and stay in the focus order, and they're `paused`, so a long row costs about what the few panes on screen do.

Where the row came to rest is in the link: `?scroll=pipeline:732`, by the row's id. A reload or a shared link reopens there. Scrolling replaces the history entry, so Back doesn't step through every swipe. A row at its start adds nothing to the link.

Right to left, the row starts at its right edge and scrolls towards the left.

## Resizing

A divider between two panes in the row widens or narrows the pane before it, and the rest of the row moves along: the row gets longer, and no neighbour is squeezed. A divider beside the row, between it and a fixed pane, shares out the row's window, and the panes in the row keep their width.

## Moving panes in and out

A pane leaves the row in any of these ways:

- **Its menu.** Right-click its header, or use ⋯ or Shift+F10, and choose **Move out of the row**. It goes beside the row, on the side it's nearer on screen. In ⌘K, it's **Move pane out of the row**. From your code: `jali.actions.moveOutOfRow(pane)`.
- **Moving it past the end.** "Move pane left" on the row's first pane, or "Move pane right" on its last, takes it out, even with nothing beside the row. Inside the row, those moves swap it with its neighbour.
- **Dragging its header** onto a pane beside the row.

Moving a pane in is the same in reverse: drag it onto a pane in the row, or move it towards the row. Hold a dragged pane at the row's edge, and the row scrolls on, so you can drop it on a pane out of view.

If your app has its own drag, a card or a list row, give it the same edge scrolling with `edgeScroll`:

```ts
import { edgeScroll } from "jali";

let last = { x: 0, y: 0 };
// Runs after each step of scrolling, so your drag can find what is under the pointer again.
const edge = edgeScroll(jali, () => findDropTarget(last.x, last.y));

window.addEventListener("pointermove", (event) => {
  last = { x: event.clientX, y: event.clientY };
  edge.move(event.clientX, event.clientY);
});
window.addEventListener("pointerup", () => edge.stop());

declare function findDropTarget(x: number, y: number): void; // your drag's own
```

The function you pass runs after each step of scrolling, so the drag can find what is under the pointer again as the panes slide past it.

## On a phone

On a phone, Jali shows one pane at a time, and its switcher lists every pane in the row.

## Reading it from your code

A pane in the row's window is `where: "shown"` in `jali.model()`, with its `box`; a pane scrolled out of it is `"hidden"`, with no box. Focusing it (`jali.actions.focus(id)`) scrolls the row to it. Where each row came to rest is in the address, as `scroll`.
