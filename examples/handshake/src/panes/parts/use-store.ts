/** A store's value in a component, re-rendering when it changes (store.ts). */
import { useSyncExternalStore } from "react";
import type { Store } from "#src/store.ts";

/** The store's value, or the part `select` picks. `select` must return the same value for the same state. */
export function useStore<T, S = T>(store: Store<T>, select?: (value: T) => S): S {
  const read = () => (select ? select(store.get()) : (store.get() as unknown as S));
  return useSyncExternalStore(store.subscribe, read, read);
}
