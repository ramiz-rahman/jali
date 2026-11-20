/**
 * The market in React. `useTopic(topic, paused)` reads a topic and follows it while the pane is on screen: a pane
 * passes Jali's `paused`, so a pane behind a tab, folded or tucked stops listening and keeps what it showed.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Instrument, MarketData, Quote, Topic, TopicData } from "./types";

const MarketContext = createContext<MarketData | null>(null);

export function MarketProvider({ market, children }: { market: MarketData; children: ReactNode }) {
  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketData {
  const market = useContext(MarketContext);
  if (!market) throw new Error("useMarket needs a <MarketProvider> above it");
  return market;
}

export function useInstrument(symbol: string): Instrument | undefined {
  return useMarket().instrument(symbol);
}

const keyOf = (topic: Topic) => JSON.stringify(topic);

/** A topic's latest value, kept up to date until `paused`. On resuming, it catches up at once. */
export function useTopic<T extends Topic>(topic: T, paused = false): TopicData<T> {
  const market = useMarket();
  const key = keyOf(topic);
  const [state, setState] = useState(() => ({ key, data: market.snapshot(topic) }));

  useEffect(() => {
    if (paused) return; // out of sight: stop listening, keep what is shown
    const t = JSON.parse(key) as T;
    setState({ key, data: market.snapshot(t) });
    return market.subscribe(t, (data) => setState({ key, data }));
  }, [market, key, paused]);

  // A pane that has just been shown another instrument reads it now, rather than showing the last one for a frame.
  return state.key === key ? state.data : market.snapshot(topic);
}

/** `symbol`'s quote as a map entry, or none when there is no such instrument or its price is not known yet. */
function known(market: MarketData, symbol: string): [string, Quote][] {
  if (!market.instrument(symbol)) return [];
  const q = market.snapshot({ channel: "quote", symbol });
  return q.pending ? [] : [[symbol, q]];
}

/**
 * Quotes for several instruments at once (a watchlist, a blotter), in one state update a tick. An instrument whose
 * price is not known yet (`pending`) has no entry, so a caller shows "not known yet" rather than a price of 0.
 */
export function useQuotes(symbols: readonly string[], paused = false): ReadonlyMap<string, Quote> {
  const market = useMarket();
  const key = symbols.join(",");
  const read = () => new Map(symbols.flatMap((s) => known(market, s)));
  const [state, setState] = useState(() => ({ key, quotes: read() }));

  useEffect(() => {
    if (paused) return;
    const list = key ? key.split(",").filter((s) => market.instrument(s)) : [];
    const quotes = new Map(list.flatMap((s) => known(market, s)));
    setState({ key, quotes });
    // Collect a tick's changes and apply them together on the next frame.
    let frame = 0;
    const flush = () => {
      frame = 0;
      setState({ key, quotes: new Map(quotes) });
    };
    const stops = list.map((symbol) =>
      market.subscribe({ channel: "quote", symbol }, (q) => {
        if (q.pending) return;
        quotes.set(symbol, q);
        frame ||= requestAnimationFrame(flush);
      }),
    );
    return () => {
      stops.forEach((stop) => stop());
      cancelAnimationFrame(frame);
    };
  }, [market, key, paused]);

  return state.key === key ? state.quotes : read();
}
