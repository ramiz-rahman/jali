import { createJali } from "@jali/core";
import { customer, customerOrders, customerOverview, customerTickets, order } from "./customer";
import { customerPage } from "./customer-page";
import { listOnly } from "./layouts";
import { ticketList } from "./ticket-list";

export const jali = createJali({
  panes: [customerOverview, customer, customerOrders, customerTickets, order, ticketList],
  page: customerPage,
  layout: listOnly,
});

// A link with ?page=customer opens the page. Open it from code, a menu or ⌘K ("Open Customer") otherwise.
if (!jali.get().page) jali.page.open({ item: 7 });
