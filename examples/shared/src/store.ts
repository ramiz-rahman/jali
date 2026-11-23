/**
 * The examples' own state beside Jali: a very small external store, and what a store keeps on this device.
 *
 * What is kept is checked when it is read back, never trusted: a value from an older build, another tab or a person
 * editing site data goes through the store's `parse`, and anything it can't use falls back to the store's default.
 * Each kept value carries its store's `version`, so a change of shape is a new version and the old one is read by
 * `parse` as what it is, or dropped.
 */
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

/** How a store keeps its value on this device. */
export interface Kept<T> {
  /** The localStorage key. */
  key: string;
  /** The shape's version, written beside the value. Raise it when the shape changes. */
  version: number;
  /** What to use when nothing usable is kept. */
  fallback: T;
  /**
   * The kept value as this build can use it, or undefined to fall back. `version` is the one it was written with, or
   * 0 for a value from before versions were kept. Repair what can be repaired (drop a bad entry, keep the rest).
   */
  parse(value: unknown, version: number): T | undefined;
}

/** What is kept, as `parse` reads it, or the fallback. Never throws: a private window or blocked storage keeps
 *  nothing, and a bad value is as good as none. */
export function readKept<T>(kept: Kept<T>): T {
  try {
    const raw = localStorage.getItem(kept.key);
    if (raw === null) return kept.fallback;
    const value: unknown = JSON.parse(raw);
    // `{ v, data }` as writeKept writes it; anything else is from before versions were kept.
    const parsed =
      isRecord(value) &&
      Object.keys(value).length === 2 &&
      "data" in value &&
      typeof value.v === "number" &&
      Number.isInteger(value.v)
        ? kept.parse(value.data, value.v)
        : kept.parse(value, 0);
    return parsed ?? kept.fallback;
  } catch {
    return kept.fallback;
  }
}

/** Keeps `value` with its store's version. Never throws: the value lives on in memory for this visit. */
export function writeKept<T>(kept: Kept<T>, value: T) {
  try {
    localStorage.setItem(kept.key, JSON.stringify({ v: kept.version, data: value }));
  } catch {
    // nothing to do: storage is full or blocked
  }
}

/** A store that starts from what is kept and keeps every change. */
export function createKeptStore<T>(kept: Kept<T>, persist = true): Store<T> {
  const store = createStore<T>(persist ? readKept(kept) : kept.fallback);
  if (persist) store.subscribe(() => writeKept(kept, store.get()));
  return store;
}

// ---------- small checks for `parse` ----------

/** A plain object (not null, not an array). */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A finite number, or undefined. */
export const finite = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** A finite number above zero (a price, a quantity), or undefined. */
export const positive = (v: unknown): number | undefined => {
  const n = finite(v);
  return n !== undefined && n > 0 ? n : undefined;
};

/** A whole number above zero (an id), or undefined. */
export const positiveInteger = (v: unknown): number | undefined => {
  const n = positive(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
};

/** A reader for one of `values` (a tab, a sort, a side), for `parse`. */
export const oneOf =
  <T extends string | number>(values: readonly T[]) =>
  (v: unknown): T | undefined =>
    values.includes(v as T) ? (v as T) : undefined;

/** A reader for text, for `parse`. */
export const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Text with something in it (a symbol, a name), or undefined. */
export const nonEmpty = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v : undefined;

/** The entries of an array that `item` can read; undefined when `v` is not an array. */
export function arrayOf<T>(v: unknown, item: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.flatMap((x) => {
    const r = item(x);
    return r === undefined ? [] : [r];
  });
}
