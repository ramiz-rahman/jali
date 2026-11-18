import { definePaneKind } from "@jali/react";
import { ticketById } from "./data";

export const ticket = definePaneKind({
  kind: "ticket",
  title: (ref) => `Ticket ${ref.params.id}`,
  ref: (params) => ({ kind: "ticket", params }),
  minWidth: 320,         // narrower than this, the pane folds into a tab
  comfortableWidth: 420, // spare room brings it here first
  maxWidth: 640,         // past this, spare room goes to its neighbours first
  minHeight: 200,
  Component: ({ ref, openBeside }) => {
    const t = ticketById(Number(ref.params.id));
    if (!t) return <p>Ticket {ref.params.id} was not found.</p>;
    return (
      <article>
        <h3>{t.subject}</h3>
        <p>Status: {t.status}</p>
        <button onClick={() => openBeside({ kind: "customer", params: { id: t.customer } })}>Customer {t.customer}</button>
      </article>
    );
  },
});
