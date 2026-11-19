/**
 * Watchlists: named lists of symbols. A watchlist pane shows one (`watchlist({ list: "rates" })`); the lists
 * themselves are the app's state, saved on this device, so "Add to watchlist" in one pane shows in every pane.
 */
import { INSTRUMENTS } from "./market/instruments";
import { createStore, saved, useStore, type Store } from "./store";

export interface WatchList {
  id: string;
  name: string;
  symbols: string[];
}

const of = (c: string) => INSTRUMENTS.filter((i) => i.assetClass === c).map((i) => i.symbol);

export const DEFAULT_LISTS: readonly WatchList[] = [
  {
    id: "core",
    name: "Core",
    symbols: [
      "MX40",
      "MXTEC",
      "LMNA",
      "ORBD",
      "HLXS",
      "HRBK",
      "FNCH",
      "PTRX",
      "KSTR",
      "GOV10Y",
      "EURUSD",
      "USDJPY",
    ],
  },
  { id: "equities", name: "Equities", symbols: of("equity") },
  { id: "rates", name: "Rates", symbols: [...of("govt"), ...of("corp")] },
  { id: "fx", name: "FX", symbols: of("fx") },
  { id: "indices", name: "Indices", symbols: of("index") },
];

/** A list's name from its id, for pane titles (which can't read app state). */
export const listName = (id: string) => DEFAULT_LISTS.find((l) => l.id === id)?.name ?? id;

export type Lists = Store<readonly WatchList[]> & {
  add(listId: string, symbol: string): boolean;
  remove(listId: string, symbol: string): void;
};

const KEY = "markets:lists";

export function createLists(persist = true): Lists {
  // Keep only lists we know, so a stored list never hides a new default.
  const stored = persist ? saved.read<WatchList[]>(KEY, []) : [];
  const store = createStore<readonly WatchList[]>(
    DEFAULT_LISTS.map((d) => stored.find((s) => s.id === d.id) ?? d),
  );
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const change = (listId: string, fn: (symbols: string[]) => string[]) =>
    store.set((lists) =>
      lists.map((l) => (l.id === listId ? { ...l, symbols: fn(l.symbols) } : l)),
    );
  return {
    ...store,
    add(listId, symbol) {
      const list = store.get().find((l) => l.id === listId);
      if (!list || list.symbols.includes(symbol)) return false;
      change(listId, (s) => [...s, symbol]);
      return true;
    },
    remove: (listId, symbol) => change(listId, (s) => s.filter((x) => x !== symbol)),
  };
}

export const useList = (lists: Lists, id: string) =>
  useStore(lists, (all) => all.find((l) => l.id === id));
