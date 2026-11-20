/** A very small external store, for the app's own state beside Jali's (the edits, the transport), and what it keeps on this device. */
import { useSyncExternalStore } from "react";

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      // A copy: a listener may unsubscribe while being called.
      for (const l of Array.from(listeners)) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T, S>(store: Store<T>, select: (value: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

/** What is kept under `key`, parsed; `undefined` for nothing, text that isn't JSON, or storage that is blocked. */
function stored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * JSON in localStorage, never throwing: a private window or blocked storage simply keeps nothing. What is read is
 * never trusted: `parse` gets the stored value (`undefined` when there is none, or it isn't JSON) and returns the
 * value to use, its default for anything it doesn't recognise (stored.ts).
 */
export const saved = {
  read<T>(key: string, parse: (stored: unknown) => T): T {
    return parse(stored(key));
  },
  /**
   * As `read`, for a store whose key carries its version (`studio:edits:v1`). While nothing is kept under it yet,
   * what an earlier key of the same shape held (`earlier`) is read through the same `parse`, kept under the new key,
   * and forgotten under the old, so nobody loses their work to the change of key.
   */
  readVersioned<T>(key: string, earlier: string, parse: (stored: unknown) => T): T {
    const now = stored(key);
    if (now !== undefined) return parse(now);
    const before = stored(earlier);
    const value = parse(before);
    if (before !== undefined) {
      saved.write(key, value);
      saved.remove(earlier);
    }
    return value;
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing kept, nothing to forget
    }
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // nothing to do: the value lives on in memory for this visit
    }
  },
};
