import { createWorkspace, memoryLocation, memoryStorage } from "@jali/core";
import { triage } from "./layouts";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

// The same workspace with nothing shared: its address and storage in memory, a fixed size, DOM focus left alone.
export const testWorkspace = () =>
  createWorkspace({
    panes: [ticketList, ticket],
    layout: triage,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1440, height: 900 },
    moveFocus: false,
  });
