import { boot, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { customer, customerOrders, customerOverview, customerTickets, order } from "./customer";
import { customerPage } from "./customer-page";
import { listOnly } from "./layouts";
import { ticketList } from "./ticket-list";

export const store = createUiStore({
  kinds: createPaneKinds([customerOverview, customer, customerOrders, customerTickets, order, ticketList]),
  profile: customerPage,
  presets: [{ id: "list", label: "Tickets", build: listOnly }],
  url: createUrlSync(),
});

boot(store);
startUi(store);
// A link with ?page=customer opens the page. Open it from code, a menu or ⌘K ("Open Customer") otherwise.
if (!store.get().page) store.actions.openPage({ item: 7 });
