import { createJali } from "jali-layout";
import { customer, customerOrders, order } from "./customer";
import { listOnly, triage } from "./layouts";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

export const jali = createJali({
  // The kinds of pane it can show. Each instance has its own.
  panes: [ticketList, ticket, customer, customerOrders, order],
  // Layouts to start from, in ⌘K as "Layout: Triage". The first opens when no link says otherwise.
  presets: [
    { id: "triage", label: "Triage", layout: triage },
    { id: "list", label: "One list", layout: listOnly },
  ],
  // What this person keeps on this device (settings, pane state, sizes): localStorage under this prefix.
  storage: "support-desk",
  // Rebind or unbind commands. Ids not listed keep their default keys.
  keyboard: { keymap: { "pane.close": "Mod+K Mod+X", "pane.zoom": null } },
});
