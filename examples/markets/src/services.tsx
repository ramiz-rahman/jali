/**
 * The app's own services, beside Jali: the market, the live feed's state, the paper-trading book, the watchlists and
 * the desks' layouts. Panes read them from context; commands get them when the workspace is made (workspace.ts).
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { createStore, type Store } from "@jali-examples/shared/store";
import { createDesks, type Desks } from "./desks";
import { createLists, type Lists } from "./lists";
import type { FeedState, FeedStatus } from "./market/kraken";
import { MarketProvider } from "./market/react";
import type { MarketData } from "./market/types";
import { createTrading, type Side, type Trading } from "./trading/trading";

/** "Buy LMNA" from a quote or ⌘K: the blotter's ticket picks it up. `at` tells two requests apart. */
export interface TicketRequest {
  symbol: string;
  side: Side;
  at: number;
}

export interface Services {
  market: MarketData;
  /** The live feed's state, when the market has one (Kraken's); a simulated market alone has none. */
  feed?: FeedStatus;
  trading: Trading;
  lists: Lists;
  /** Each desk as the person left it. */
  desks: Desks;
  ticket: Store<TicketRequest | null>;
}

export function createServices(
  market: MarketData,
  { persist = true, feed }: { persist?: boolean; feed?: FeedStatus } = {},
): Services {
  return {
    market,
    ...(feed ? { feed } : {}),
    trading: createTrading(market, persist),
    lists: createLists(persist),
    desks: createDesks(persist),
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

const none = () => () => {};

/** The live feed's state, kept up to date; undefined with no live feed. */
export function useFeed(): FeedState | undefined {
  const { feed } = useServices();
  return useSyncExternalStore(feed?.subscribe ?? none, () => feed?.get());
}
