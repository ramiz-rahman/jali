/**
 * The app's one way to hold state outside Jali: a value, a way to change it, and a way to hear about changes.
 * The capture loads, the lit field, the live measurements, the probes, the scans and the course progress are all
 * one of these, so each area's module is only its own rules. It has no React in it: panes read a store through
 * `useStore` (panes/parts/use-store.ts).
 */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(change: (current: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const l of listeners) l();
  };
  return {
    get: () => value,
    set,
    update: (change) => set(change(value)),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A value kept in this browser's localStorage. It is a convenience: storage can be missing, full or refused
 * (private windows, blocked site data), so every access is guarded and a refusal reads as `fallback`.
 */
export interface Stored<T> {
  read(): T;
  /** False when storage refused it: the value lasts for this visit only. */
  write(value: T): boolean;
}

export function stored<T>(key: string, parse: (raw: string | null) => T): Stored<T> {
  return {
    read() {
      try {
        return parse(localStorage.getItem(key));
      } catch {
        return parse(null);
      }
    },
    write(value) {
      try {
        if (value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Data fetched from somewhere, with its loading and failure. */
export type Remote<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; error: string; retryAt?: number };

export const IDLE = { status: "idle" } as const satisfies Remote<never>;
export const LOADING = { status: "loading" } as const satisfies Remote<never>;
