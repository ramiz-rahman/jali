import { boot, browserStorage, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { ticketList } from "./ticket-list";
import { ticket } from "./ticket";
import { customer, customerOrders, order } from "./customer";
import { listOnly, triage } from "./layouts";

export const store = createUiStore({
  // The kinds this workspace can show. Each store has its own.
  kinds: createPaneKinds([ticketList, ticket, customer, customerOrders, order]),
  // Layouts to start from: in ⌘K as "Layout: Triage". The first one opens when no link says otherwise.
  presets: [
    { id: "triage", label: "Triage", build: triage },
    { id: "list", label: "One list", build: listOnly },
  ],
  // The address port: the layout lives in the URL, and Back and Forward step through it.
  url: createUrlSync({ sizes: "local" }),
  // The storage port: what this person keeps on this device (settings, pane state, dragged sizes).
  storage: browserStorage("support-desk"),
  // Rebind or unbind commands. Ids not listed keep their default keys.
  keymap: { "pane.close": "Mod+K Mod+X", "pane.zoom": null },
});

boot(store);
startUi(store);
