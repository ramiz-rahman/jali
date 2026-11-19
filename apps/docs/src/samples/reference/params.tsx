import { definePane, oneOf, optional, type PaneProps } from "@jali/react";

// Declared first, so a component written apart from the kind is typed from it.
const ticketParams = {
  id: Number,
  status: optional(oneOf("open", "pending", "closed")),
  internal: optional(Boolean),
};

// params is { id: number; status?: "open" | "pending" | "closed"; internal?: boolean }
function TicketView({ params }: PaneProps<typeof ticketParams>) {
  return (
    <h3>
      Ticket {params.id} · {params.status ?? "any status"}
      {params.internal ? " · internal notes" : ""}
    </h3>
  );
}

export const ticket = definePane("ticket", {
  params: ticketParams,
  title: ({ id }) => `Ticket ${id}`,
  Component: TicketView,
});

ticket({ id: 7 }); // { kind: "ticket", params: { id: 7 } }
ticket({ id: 7, status: "open", internal: true });
