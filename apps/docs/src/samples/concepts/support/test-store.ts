import { createPaneKinds, createUiStore, createUrlSync, memoryLocation, memoryStorage } from "@jali/core";
import { ticketList } from "./ticket-list";
import { ticket } from "./ticket";
import { triage } from "./layouts";

// The same workspace with both ports in memory: it never touches the page's address or localStorage.
export const testStore = () =>
  createUiStore({
    kinds: createPaneKinds([ticketList, ticket]),
    presets: [{ id: "triage", label: "Triage", build: triage }],
    url: createUrlSync({ location: memoryLocation(), storage: memoryStorage() }),
    storage: memoryStorage(),
    focusPane: null, // leave DOM focus alone
  });
