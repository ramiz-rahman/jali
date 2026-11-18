import { useState, type KeyboardEvent } from "react";
import type { ObjectRef } from "@jali/core";
import { definePaneKind, type PaneComponentProps } from "@jali/react";
import { tickets } from "./data";

const ticketRef = (id: number): ObjectRef => ({ kind: "ticket", params: { id } });

function TicketList({ select, peek, openBeside }: PaneComponentProps) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? undefined : tickets[index];

  // Move the cursor and tell the workspace what is selected. A following detail shows it once it rests.
  const selectAt = (i: number) => {
    const next = Math.max(0, Math.min(tickets.length - 1, i));
    setIndex(next);
    select(ticketRef(tickets[next]!.id));
  };
  // Select first, then open: the detail that opens is linked to the selection, so it follows the list.
  const openAt = (i: number) => {
    if (i !== index) selectAt(i);
    openBeside(ticketRef(tickets[i]!.id));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return; // ⌘K and the workspace's keys bubble on
    if ((e.key === "j" || e.key === "ArrowDown") && !e.altKey) selectAt((index ?? -1) + 1);
    else if ((e.key === "k" || e.key === "ArrowUp") && !e.altKey) selectAt((index ?? 1) - 1);
    else if (e.key === " " && current) peek(ticketRef(current.id));
    else if (e.key === "Enter" && e.altKey && index !== null) openAt(index);
    else return; // not ours: let it bubble
    e.preventDefault(); // claimed: the workspace leaves this key alone
  };

  return (
    <ul role="listbox" aria-label="Tickets" tabIndex={0} onKeyDown={onKeyDown}>
      {tickets.map((t, i) => (
        <li key={t.id} role="option" aria-selected={i === index} onClick={() => selectAt(i)} onDoubleClick={() => openAt(i)}>
          #{t.id} {t.subject}
        </li>
      ))}
    </ul>
  );
}

export const ticketList = definePaneKind({
  kind: "tickets",
  title: () => "Tickets",
  ref: (params) => ({ kind: "tickets", params }),
  minWidth: 320,
  minHeight: 200,
  Component: TicketList,
});
