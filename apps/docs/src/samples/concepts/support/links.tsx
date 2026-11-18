import type { MouseEvent } from "react";
import { definePane, type PaneProps } from "@jali/react";
import { tickets } from "./data";
import { ticket } from "./ticket";

function CustomerTickets({ params, openBeside, openHere, peek }: PaneProps<{ customer: number }>) {
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
  params: { customer: Number },
  title: ({ customer }) => `Tickets of customer ${customer}`,
  width: { min: 320 },
  height: { min: 200 },
  Component: CustomerTickets,
});
