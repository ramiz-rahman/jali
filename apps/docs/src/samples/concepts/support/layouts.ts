import { column, pane, row, tabs } from "jali-layout";
import { customer, customerOrders } from "./customer";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

// A fixed-width list, and a column beside it: the ticket above, two tabs below.
export const triage = row(
  pane(ticketList({ queue: "open" }), { id: "list", px: 360 }),
  column(
    pane(ticket({ id: 101 }), { id: "detail", weight: 2, linkedTo: "list", follows: true }),
    tabs(customer({ id: 7 }), customerOrders({ customer: 7 })),
  ),
);

// One pane: the list alone.
export const listOnly = pane(ticketList({ queue: "open" }), { id: "list" });
