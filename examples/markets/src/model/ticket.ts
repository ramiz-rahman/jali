/**
 * "Buy LMNA" from a quote or ⌘K, on its way to the blotter's ticket: a request waits here until the ticket takes it,
 * so it is applied once, whether the blotter was on screen or opens because of it.
 */
import { createStore, type Store } from "@jali-examples/shared/store";
import type { Side } from "../market/types";

export interface TicketRequest {
  symbol: string;
  side: Side;
}

export type TicketInbox = Store<TicketRequest | null> & {
  send(request: TicketRequest): void;
  /** The waiting request, which leaves the inbox. */
  take(): TicketRequest | null;
};

export function createTicketInbox(): TicketInbox {
  const store = createStore<TicketRequest | null>(null);
  return {
    ...store,
    // A new object every time: "Buy LMNA" twice is two requests.
    send: (request) => store.set({ ...request }),
    take() {
      const request = store.get();
      if (request) store.set(null);
      return request;
    },
  };
}
