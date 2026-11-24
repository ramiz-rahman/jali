import { definePane } from "jali-layout/react";
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
