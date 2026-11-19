# Following a list

A list reports its selection, and a detail opened from it follows that selection, in place, until the person pins it.

The most common shape in a workspace is a list and its detail: tickets on the left, the selected ticket on the right. The person moves down the list and expects the detail to keep up. Jali does this for you, as long as the list says what is selected.

*Live demo on the site: Select rows in the list with J and K: the detail beside it follows, in place.*

## The list reports its selection

The selection is the one item the list's cursor is on: what J and K, or the arrow keys, move. It is not focus, and it is not a set of checked rows. A list reports it with `select(ref)` every time it moves, and `select(null)` when nothing is selected.

`ticket-list.tsx`

```tsx
import { useState, type KeyboardEvent } from "react";
import { definePane, type PaneProps } from "@jali/react";
import { tickets } from "./data";
import { ticket } from "./ticket";

function TicketList({ select, peek, openBeside }: PaneProps) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? undefined : tickets[index];

  // Move the cursor and tell the workspace what is selected. A following detail shows it once it rests.
  const selectAt = (i: number) => {
    const next = Math.max(0, Math.min(tickets.length - 1, i));
    setIndex(next);
    select(ticket({ id: tickets[next]!.id }));
  };
  // Select first, then open: the detail that opens is linked to the selection, so it follows the list.
  const openAt = (i: number) => {
    if (i !== index) selectAt(i);
    openBeside(ticket({ id: tickets[i]!.id }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return; // ⌘K and the workspace's keys bubble on
    if ((e.key === "j" || e.key === "ArrowDown") && !e.altKey) selectAt((index ?? -1) + 1);
    else if ((e.key === "k" || e.key === "ArrowUp") && !e.altKey) selectAt((index ?? 1) - 1);
    else if (e.key === " " && current) peek(ticket({ id: current.id }));
    else if (e.key === "Enter" && e.altKey && index !== null) openAt(index);
    else return; // not ours: let it bubble
    e.preventDefault(); // claimed: the workspace leaves this key alone
  };

  return (
    <ul role="listbox" aria-label="Tickets" tabIndex={0} onKeyDown={onKeyDown}>
      {tickets.map((t, i) => (
        <li
          key={t.id}
          role="option"
          aria-selected={i === index}
          onClick={() => selectAt(i)}
          onDoubleClick={() => openAt(i)}
        >
          #{t.id} {t.subject}
        </li>
      ))}
    </ul>
  );
}

export const ticketList = definePane("tickets", {
  title: "Tickets",
  width: { min: 320 },
  height: { min: 200 },
  Component: TicketList,
});
```

Opening a row selects it first. That order matters: when `openBeside` is called with the list's selected item, the workspace knows the new pane came from the selection.

## The following detail

A detail opened from the list's selected row **follows** the list. Move the selection, and the detail shows the new row in the same pane, at the same place and size. Nothing else on screen moves.

A list has at most one following detail of each kind, and it can have followers of several kinds. The detail's header shows a **Following** toggle, so the person can see that it moves with the list.

*Live demo on the site: Following, and the Keep toggle, in the detail's header. Press Keep to stay on this item.*

Focus stays in the list the whole time, so the person keeps moving with J and K. A following step replaces the address rather than adding to the history, so Back skips the rows they passed through.

## Followers of other kinds

One list can drive details of several kinds. A watchlist selects a quote, and beside it a chart, an order book and the news follow the same instrument. A follower of the selected object's kind shows that object. A follower of another kind shows what its kind says it shows for it, with `follow`:

```tsx filename="src/panes/chart.tsx"
export const chart = definePane("chart", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} chart`,
  // The watchlist selects quote({ symbol }): show the chart of the same symbol.
  follow: (selected) => ({ symbol: selected.params.symbol }),
  Component: Chart,
});
```

When the selection moves, every follower of the list that can show it moves, together, as one change: one entry replaced in the history, and one announcement. A follower keeps what it shows when its kind has no `follow`, when `follow` returns `undefined`, or when its kind can't read what `follow` gives (a required param missing). A kept detail never moves.

Opening a chart for the selected quote counts as opening the selection, so the new chart follows the list, or opens kept beside the list's following chart, just as a second quote would.

## It waits for the selection to rest

The detail changes once the selection has rested for 150ms. Holding J to run down the list moves the cursor through every row but loads only the one it stops on. A screen reader hears one "Showing Ticket 104", not one per row.

Opening a row (⌥↵, or a row's open button) while that wait is running shows the row in the detail at once.

## Pinning

To keep a ticket on screen and go on browsing, the person keeps the detail: press **Keep** in its header (it stays pressed, and **Following** goes), or open the row the detail already shows.

A kept detail stays on its object. The next row opened from the list makes a new following detail beside it, so comparing two tickets is "keep this one, go on".

Pressing **Keep** again makes it follow again, and it catches up with the list's selection at once. If another detail was following that list, that one is kept in its place, so there is still only one follower.

## Space shows the row in the detail

With a following detail on screen, Space on a row shows that row in the detail, at once, instead of opening a [peek](../get-started/key-concepts.md#peek). The peek sheet would answer the same question a second time, on top of the answer.

With no following detail, or one that is out of sight (folded, behind a tab, tucked), Space opens the peek sheet as usual.

## Not in the current results

If the person filters the list and the followed row is no longer in it, the detail keeps showing it, with a note: "Not in the current results of Tickets". The detail doesn't go blank under them because of a filter.

The list says so with `select(ref, { inResults: false })`. Only say it when you know: when the whole result is loaded and the row is not in it. If the row could be further down, past what is loaded, report nothing.

A list should keep its selection on the same item, not the same position, when it is sorted or filtered.

## Unsaved work in the detail

If the following detail has [unsaved work](../get-started/key-concepts.md#unsaved-work), it stays on its object while the list moves on, and the workspace says why: "The detail stays put: it has an unsaved reply". Asking on every row would be worse than a detail that waits.

## Links that are not the selection

A link that is not the list's selected row, such as a customer name in a ticket, opens a plain linked pane. It never replaces the following detail or a kept one.

Closing the list unlinks its detail: the detail stays, showing what it showed, and stops following. Undo brings the list back with the link.
