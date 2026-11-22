import { createTestJali } from "jali/testing";
import { triage } from "./layouts";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

// The same instance with nothing shared: its address and storage in memory, a fixed size, DOM focus left alone.
export const testJali = () => createTestJali({ panes: [ticketList, ticket], layout: triage }).jali;
