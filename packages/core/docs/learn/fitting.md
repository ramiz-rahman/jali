# How a layout fits

Each kind says how narrow it can go, and when the panes don't fit, Jali folds them into tabs one at a time and brings them back in reverse as room returns.

A workspace has to work in a 1920px window, a 1280px laptop and a phone, with whatever panes the person opened. Jali never squeezes a pane below the width its content works at. When there is not enough room, it folds a pane into a tab of a neighbour instead, and brings it back when there is.

*Live demo on the site: Drag the frame's edge. Panes fold into tabs one at a time as it narrows, and return in reverse as it widens.*

## Three widths per kind

Each [kind](../get-started/key-concepts.md#kind) can give three widths. Each has one job.

`ticket.tsx`

```tsx
import { definePane } from "@jali/react";
import { customer } from "./customer";
import { ticketById } from "./data";

export const ticket = definePane("ticket", {
  params: { id: Number },
  title: ({ id }) => `Ticket ${id}`,
  width: {
    min: 320, // narrower than this, the pane folds into a tab
    comfortable: 420, // spare room brings it here first
    max: 640, // past this, spare room goes to its neighbours first
  },
  height: { min: 200 },

  Component: ({ params, openBeside }) => {
    const t = ticketById(params.id);
    if (!t) return <p>Ticket {params.id} was not found.</p>;
    return (
      <article>
        <h3>{t.subject}</h3>
        <p>Status: {t.status}</p>
        <button onClick={() => openBeside(customer({ id: t.customer }))}>
          Customer {t.customer}
        </button>
      </article>
    );
  },
});
```

- **`width.min`** is the narrowest the content still works at, once it adapts to a narrow box (with container queries, for example). It is the only width that decides folding: a pane folds when the minimums of what is shown don't fit, never because it would be below its comfortable width. A tab group's minimum is its widest tab's: every tab must fit when it is chosen, and choosing a tab never resizes the group.
- **`width.comfortable`** is where spare room takes the pane first. It defaults to the minimum.
- **`width.max`** is the widest the content usefully uses. It is soft: spare room past it goes to neighbours that can still use it, and only when every neighbour is at its maximum does the pane grow on. A split never leaves an empty gap. Leave it out for content that can use any width, such as tables and charts.

`height.min` works like `width.min`, for columns. Jali checks both after every fold.

**Why a minimum, not a percentage:** a ticket at 200px is broken whatever the window. A width the content needs is a fact about the content, so the kind says it once, and every layout respects it.

## How spare room is shared

In a split nobody has resized, every pane starts at its minimum. Spare room brings each up to its comfortable width, evenly. Then it brings them toward their maximums, in proportion to their weights, and past that, still by weight.

With no comfortable or maximum width declared, this is simply a split by weight.

Once the person drags a divider, that split keeps their proportions exactly at any width, and comfortable and maximum widths no longer apply to it. Double-click the divider to hand it back.

## What folds first

When a fold is needed, Jali picks one slot (a pane, or a group of tabs) to fold, checks again, and stops as soon as everything fits. It keeps the panes nearest the work on screen the longest.

The panes it protects are the focused pane, the pane it was opened from, and the panes opened from it. The order, first to fold to last:

1. In a [curated page](../get-started/key-concepts.md#curated-page), supporting views, but only one whose fold actually makes room.
2. Panes that are not protected and not kept.
3. Panes that are not protected but [kept](../get-started/key-concepts.md#linked).
4. Protected panes that are not kept, then protected kept ones.
5. A curated page's primary view.
6. The focused pane, last.

Within one of those steps, ties are broken in this order:

- panes with no links before linked ones;
- the far end of a chain of links before the near end;
- the pane focused least recently;
- the narrowest;
- the one earlier in reading order.

**Why this order:** a person working down a chain (tickets, a ticket, its customer) is looking at the end they are on. The far end of the chain, and panes unrelated to it, are what they need least right now.

## Where a folded pane goes

A folded pane becomes a tab of the pane it was opened from, so a ticket folds behind the list it came from, not behind something unrelated. If that pane is folded too, it joins the same group. A pane with no link joins its nearest neighbour.

*Live demo on the site: Folded tabs are italic, with a fold icon: the layout made them, and they return on their own.*

A folded tab is marked as made by the layout. Its tooltip says it returns when there is room. The person doesn't need to do anything with it, which is what tells it apart from a tab they made or a pane they [tucked](../get-started/key-concepts.md#tuck).

## What comes back first

As room returns, the folds are undone in reverse: the last pane to fold is the first to come back. The same width always gives the same arrangement, so narrowing and widening the window again lands exactly where it started.

## Folds change only when the room or the layout does

Jali decides folds after a window or container resize, a change to the pane cap, a layout arriving from a link or Back, and a structural change such as opening or closing a pane.

Focusing a pane or choosing a tab never refolds anything. If clicking a folded tab pulled it out and folded something else, every click would rearrange the screen.

Tucking never unfolds anything either. The space a tuck frees goes to the tuck's home, and a reload doesn't spend it on folded panes.

## Opening when there is no room

If a pane opens beside another and there is no room for it, it joins the tab group of the pane it came from. The announcement says so: "opened as a tab: not enough room". The pane it came from stays on screen and keeps focus, and nothing else moves. Widen the window and the new pane unfolds beside it.

On a curated page the opened pane is the shown tab instead, so the link the person followed is in front of them ([Curated pages](curated-pages.md)).

## The pane cap

Even with room, a workspace shows at most 8 panes at once by default. The person can change this in Settings, from 2 to 16. Past the cap, the oldest pane that is not kept, not focused and not a primary view becomes a tab. Every object stays open; only what is shown changes.

## One pane is quiet

The workspace's chrome grows only when there is something to arrange. While one pane is on screen, with or without tabs, it fills the workspace edge to edge, with no border or focus edge, and its header has no tuck or maximise. If it has tabs, each tab's × closes it, so the header has no close button either. Open a second pane and both get their edges and buttons back.

## Maximise and full screen

Maximise lets one pane cover the workspace, with the others kept behind it (⇧⌘↵, or the button in its header). Full screen goes further: the pane covers the whole screen, the browser's own bars included, for a chart, a document or a presentation. Its button sits beside Maximise; ⌘K has "Full screen pane, or exit full screen", and `jali.actions.toggleFullScreen(pane)` does it from your code. Escape, the button again, or leaving the browser's full screen puts everything back as it was. ⌘K and Jali's dialogs still open over it. Where the browser has no full screen, as on an iPhone, the pane still covers the page.

The pane is placed over the window, so an element of yours around the workspace that is its own stacking context (a `transform`, a `filter`, `isolation: isolate`) keeps it inside that element.

## Phones get a single view

On a phone, a workspace narrower than 600 pixels shows a single view: one pane fills the width, with a switcher at the top listing every pane. It does the same at any width when even one pane is too wide at its minimum, since folding can't help then. Other panes stay mounted, so their state survives. `createJali({ phone: { below } })` moves the line; `below: 0` keeps only the second rule.

### Two panes, stacked

A list and its detail often work best together, even on a phone. With `createJali({ phone: { stack: true } })`, a portrait phone shows the focused pane together with the pane it was opened from, one above the other, instead of one at a time. A divider between them, a 44 pixel touch target, settles on a third, a half or two thirds of the height, by drag or arrow keys. The switcher marks both panes.

Stacking happens only when both panes have room: the workspace at least 480 pixels tall, each pane at least 200 (`stackFloor`) and at least its kind's minimum height. It never stacks more than two. Held sideways, the phone is wide enough for the normal layout. While the on-screen keyboard is up, the pane you're typing in shows alone, so the keyboard doesn't cover it. A kind can stay out with `phone: { stack: false }`, or ask for its half with `phone: { place: "top" }`.

### Folding screens

A phone that folds into two halves, held half open like a book or a laptop, or a phone with two screens, has a hinge where content shouldn't sit. When the browser reports the fold, Jali puts a pane each side of it: the focused pane and the pane it was opened from, else the next pane, with a hairline on the hinge. Book posture puts them side by side, tabletop one above the other. Unfold the phone and the layout comes back. This is on by default, and changes nothing on a screen that doesn't fold. Turn it off with `phone: { fold: false }`. Browsers report folds in Chrome and Edge 138 and later; Safari and Firefox don't yet, and there the normal rules apply.

The layout, the address and the history don't change. Widen the window and the arrangement comes back.
