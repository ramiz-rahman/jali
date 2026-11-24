# Opening and linking

A pane opens other objects beside itself, in its own place, or in a peek, and Jali keeps a chain of links from filling the screen.

A pane never builds the layout itself. It asks Jali to show an object, with one of three functions it gets as props, and Jali decides where it goes. That keeps each pane's code small, and links behave the same way in every pane.

`customer-tickets.tsx`

```tsx
import type { MouseEvent } from "react";
import { definePane, type PaneProps } from "jali-layout/react";
import { tickets } from "./data";
import { ticket } from "./ticket";

const ticketsParams = { customer: Number };

function CustomerTickets({ params, openBeside, openHere, peek }: PaneProps<typeof ticketsParams>) {
  const mine = tickets.filter((t) => t.customer === params.customer);

  // A plain link, made a pane link. A click opens the ticket beside; ⌘-click still opens a browser tab.
  const open = (e: MouseEvent, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openBeside(ticket({ id }));
  };

  return (
    <ul>
      {mine.map((t) => (
        <li key={t.id}>
          <a href={`/tickets/${t.id}`} onClick={(e) => open(e, t.id)}>
            #{t.id} {t.subject}
          </a>
          <button onClick={() => peek(ticket({ id: t.id }))}>Peek</button>
          <button onClick={() => openHere(ticket({ id: t.id }))}>Show here</button>
        </li>
      ))}
    </ul>
  );
}

export const customerTicketLinks = definePane("customer-tickets", {
  params: ticketsParams,
  title: ({ customer }) => `Tickets of customer ${customer}`,
  width: { min: 320 },
  height: { min: 200 },
  Component: CustomerTickets,
});
```

## Open beside

`openBeside(ref)` opens the object in a new pane to the right of this one. It is the usual way to follow a link: from a ticket to its customer, from a customer to an order.

Focus stays in the pane you opened from. The person can open three tickets from a list, one after another, without clicking back into the list each time.

The new pane is linked to the one it came from (`linkedTo`). The link is what lets the layout fold sensibly: a linked pane folds behind the pane it came from, and closing that pane drops the link.

*Live demo on the site: A list, its detail, and a related record: each opened beside the one before.*

### On another edge

Some objects belong below their source rather than beside it: a recording's transcript under its video, a chart's data under the chart. Pass the edge: `openBeside(transcript({ id }), { edge: "bottom" })`. The edges are `"left"`, `"right"`, `"top"` and `"bottom"`, as on screen, so `"right"` is the right in a right-to-left page too. Without one, the pane opens after its source in reading order.

The edge only says where a new pane goes. The new pane is linked and announced the same way, and focus stays where it was. A link that replaces an earlier one shows in that pane, wherever it is. With no room on that edge, the pane opens as a tab of its source, as it would beside it.

On a [curated page](curated-pages.md), opened panes stay together after the page's views. The first one opened from a view starts that group at the end, whatever the edge. Later ones go on that edge of the group's last column, and a pane opened from an opened pane goes on that edge of it. In Single view a link still peeks.

## A plain link replaces the last one

When a pane opens an object of the same kind as a link it opened before, the new object replaces the earlier one, in the same pane, at the same size. Click three orders in a row from one customer's list of orders and you see one order pane, showing the last one.

**Why:** a person following links is usually looking for one thing. Without this rule, each click adds a pane, and the screen fills with objects they have already moved past.

The rule has two exceptions. A [kept](../get-started/key-concepts.md#linked) pane is never replaced: click **Following** in its header so it says **Kept**, and the next link opens beside it. And a pane following the list's [selection](../get-started/key-concepts.md#selection) is never reused by a plain link; [Following a list](following.md) covers how a detail changes there.

## Open here

`openHere(ref)` shows a different object in this same pane: same place, same size. Use it for navigation inside a pane, such as "next ticket", or for a pane that stands in until the person picks something.

If the object is already open in another pane, that pane is focused instead, and nothing opens twice. If this pane has [unsaved work](../get-started/key-concepts.md#unsaved-work), the person is asked before it is replaced.

## Open as a tab

`jali.actions.addTab(pane, ref)` shows an object as a new tab of a pane, in that pane's place, and focuses it: a second chart beside the first, behind one tab strip. It is one step, so Back undoes it in one, and since the tab takes the pane's slot, nothing else on screen folds or moves. If the object is already open, that pane is shown instead.

## Peek

`peek(ref)` shows the object in a sheet over the right of the panes, without adding a pane or changing the layout. `peek(null)` closes it. In a list, Space usually opens it; Esc closes it.

From the sheet, **Open beside** closes the peek and opens the object beside the pane it was peeked from. While the sheet is open, moving the list's selection moves the peek with it.

If the list already has a following detail on screen, Space shows the row in that detail instead of opening a sheet. Two answers to one question would be one too many.

## Turning a plain link into a pane link

Content often has ordinary links in it: a ticket number in a note, a customer name in a table. Keep the `href`, so the browser's own ⌘-click and middle-click still open a new browser tab, and call `openBeside` on a plain click, as the sample above does.

## One object, one pane, on curated pages

On a [curated page](../get-started/key-concepts.md#curated-page), each object appears once. A link to something that is already one of the page's views goes to that view instead of opening a copy. Two kinds count as showing the same object when they declare the same `shows` type in `definePane` and the same identity:

- if the view is on screen, it is focused;
- if it is behind another tab, its tab is chosen;
- if it is not on screen, it is placed beside the pane the link is in, so the person never loses the pane they followed the link from.

A link to an opened pane that is already on screen focuses that pane.

In Single view, and from a pane whose `allow` turns `open` off, a link opens as a peek instead. [Curated pages](curated-pages.md) explains why.

## What a free layout does instead

In a layout without a curated page, where the person builds the layout, each chain of links is its own. Opening the same customer from two different orders gives two customer panes, one beside each order. Each is part of its own chain of links, and the person may want them side by side.

Within one chain, a link never makes a copy. The object may already be on screen in the link's own chain: the pane the link is in, a pane it was opened from, or a pane it opened. Then that pane is shown instead, focus stays where it was, and Jali says "Already open: Order 1". So a customer's link back to the order you came from goes to that order.

What else stops copies is the plain-link rule above, and `openHere`, which focuses an object that is already open rather than showing it twice. A list's following detail never opens a second copy of a row either.

## What Jali says

Every open is announced to screen readers, briefly:

- a new pane: "Ticket 103 opened beside Tickets";
- a link that replaced an earlier one: "Order 9002 shown beside Orders of customer 7";
- no room: "…opened as a tab: not enough room beside…".
