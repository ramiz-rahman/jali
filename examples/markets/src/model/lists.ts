/**
 * Watchlists: named lists of symbols. A watchlist pane shows one (`watchlist({ list: "rates" })`); the lists
 * themselves are the app's state, saved on this device, so "Add to watchlist" in one pane shows in every pane.
 */
import {
  arrayOf,
  createKeptStore,
  isRecord,
  useStore,
  type Kept,
  type Store,
} from "@jali-examples/shared/store";
import { CRYPTO_SYMBOLS } from "../market/kraken";
import { INSTRUMENTS } from "../market/sim/instruments";
import type { AssetClass } from "../market/types";

export interface WatchList {
  id: string;
  name: string;
  symbols: string[];
  /** In list order, its rows sit under their sector's name (a list of shares). */
  bySector?: true;
}

const of = (c: AssetClass) => INSTRUMENTS.filter((i) => i.assetClass === c).map((i) => i.symbol);

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
  { id: "equities", name: "Equities", symbols: of("equity"), bySector: true },
  { id: "rates", name: "Rates", symbols: [...of("govt"), ...of("corp")] },
  { id: "fx", name: "FX", symbols: of("fx") },
  { id: "indices", name: "Indices", symbols: of("index") },
  // Real prices, from Kraken.
  { id: "crypto", name: "Crypto", symbols: [...CRYPTO_SYMBOLS] },
];

/** A list's name from its id, for pane titles (which can't read app state). */
export const listName = (id: string) => DEFAULT_LISTS.find((l) => l.id === id)?.name ?? id;

export type Lists = Store<readonly WatchList[]> & {
  add(listId: string, symbol: string): boolean;
  remove(listId: string, symbol: string): void;
};

const KNOWN = new Set([...INSTRUMENTS.map((i) => i.symbol), ...CRYPTO_SYMBOLS]);

/**
 * The lists as kept on this device (version 1; 0 is the same shape, from before versions). Each list is the default
 * list of its id with the kept symbols: a list we don't know is dropped, so a kept list never hides a new default; a
 * symbol this market doesn't have is dropped, and a list whose symbols aren't a list keeps its default's.
 */
export const KEPT_LISTS: Kept<readonly WatchList[]> = {
  key: "markets:lists",
  version: 1,
  fallback: DEFAULT_LISTS,
  parse(value, version) {
    if (version > 1) return undefined;
    const kept = arrayOf(value, (l) => (isRecord(l) ? l : undefined));
    if (!kept) return undefined;
    return DEFAULT_LISTS.map((d) => {
      const symbols = arrayOf(kept.find((l) => l.id === d.id)?.symbols, (s) =>
        typeof s === "string" && KNOWN.has(s) ? s : undefined,
      );
      return symbols ? { ...d, symbols: [...new Set(symbols)] } : d;
    });
  },
};

export function createLists(persist = true): Lists {
  const store = createKeptStore(KEPT_LISTS, persist);
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
