import type { MouseEvent } from "react";
import type { ObjectRef } from "@jali/core";
import { definePaneKind, type PaneComponentProps } from "@jali/react";
import { tickets } from "./data";

const ticketRef = (id: number): ObjectRef => ({ kind: "ticket", params: { id } });

function CustomerTickets({ ref, openBeside, openHere, peek }: PaneComponentProps) {
  const mine = tickets.filter((t) => t.customer === Number(ref.params.customer));

  // A plain link, made a pane link. A click opens the ticket beside; ⌘-click still opens a browser tab.
  const open = (e: MouseEvent, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openBeside(ticketRef(id));
  };

  return (
    <ul>
      {mine.map((t) => (
        <li key={t.id}>
          <a href={`/tickets/${t.id}`} onClick={(e) => open(e, t.id)}>#{t.id} {t.subject}</a>
          <button onClick={() => peek(ticketRef(t.id))}>Peek</button>
          <button onClick={() => openHere(ticketRef(t.id))}>Show here</button>
        </li>
      ))}
    </ul>
  );
}

export const customerTicketLinks = definePaneKind({
  kind: "customer-tickets",
  title: (ref) => `Tickets of customer ${ref.params.customer}`,
  ref: (params) => ({ kind: "customer-tickets", params }),
  minWidth: 320,
  minHeight: 200,
  Component: CustomerTickets,
});
