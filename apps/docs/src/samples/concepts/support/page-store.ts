import { createWorkspace } from "@jali/core";
import { customer, customerOrders, customerOverview, customerTickets, order } from "./customer";
import { customerPage } from "./customer-page";
import { listOnly } from "./layouts";
import { ticketList } from "./ticket-list";

export const workspace = createWorkspace({
  panes: [customerOverview, customer, customerOrders, customerTickets, order, ticketList],
  page: customerPage,
  layout: listOnly,
});

// A link with ?page=customer opens the page. Open it from code, a menu or ⌘K ("Open Customer") otherwise.
if (!workspace.get().page) workspace.actions.openPage({ item: 7 });
