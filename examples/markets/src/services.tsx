/**
 * The app's own services, beside Jali: the market, the paper-trading book, the watchlists, each desk's saved layout
 * and the ticket's inbox. Panes read them from context; commands get them when the workspace is made (workspace/).
 */
import { createContext, useContext, type ReactNode } from "react";
import { MarketProvider } from "./market/react";
import type { MarketData } from "./market/types";
import { createLists, type Lists } from "./model/lists";
import { createTicketInbox, type TicketInbox } from "./model/ticket";
import { createTrading, type Trading } from "./model/trading";
import { createSavedLayouts, type SavedLayouts } from "./workspace/savedLayouts";

export interface Services {
  market: MarketData;
  trading: Trading;
  lists: Lists;
  savedLayouts: SavedLayouts;
  /** "Buy LMNA" from a quote or ⌘K, on its way to the blotter's ticket. */
  ticket: TicketInbox;
}

/** `persist: false` keeps nothing on this device (a test). */
export function createServices(market: MarketData, { persist = true } = {}): Services {
  return {
    market,
    trading: createTrading(market, persist),
    lists: createLists(persist),
    savedLayouts: createSavedLayouts(persist),
    ticket: createTicketInbox(),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return (
    <ServicesContext.Provider value={services}>
      <MarketProvider market={services.market}>{children}</MarketProvider>
    </ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices needs a <ServicesProvider> above it");
  return s;
}
