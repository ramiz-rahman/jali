/**
 * The app's own services, beside Jali: the market, the paper-trading book and the watchlists. Panes read them from
 * context; commands get them when the workspace is made (workspace.ts).
 */
import { createContext, useContext, type ReactNode } from "react";
import { createLists, type Lists } from "./lists";
import { MarketProvider } from "./market/react";
import type { MarketData } from "./market/types";
import { createStore, type Store } from "./store";
import { createTrading, type Side, type Trading } from "./trading/trading";

/** "Buy LMNA" from a quote or ⌘K: the blotter's ticket picks it up. `at` tells two requests apart. */
export interface TicketRequest {
  symbol: string;
  side: Side;
  at: number;
}

export interface Services {
  market: MarketData;
  trading: Trading;
  lists: Lists;
  ticket: Store<TicketRequest | null>;
}

export function createServices(market: MarketData, { persist = true } = {}): Services {
  return {
    market,
    trading: createTrading(market, persist),
    lists: createLists(persist),
    ticket: createStore<TicketRequest | null>(null),
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
