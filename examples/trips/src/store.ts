/**
 * The app's own state beside Jali: the plan (saved on this device, with undo) and the places an Explore pane is
 * showing, which the map draws. Panes read them from context (services.tsx); commands get them when the workspace
 * is made (workspace.ts).
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_PLAN, readPlan, type Plan } from "./trip/plan";

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

/** JSON in localStorage, never throwing: a private window or blocked storage keeps nothing. */
export const saved = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  write(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // the plan lives on in memory for this visit
    }
  },
};

export interface PlanStore extends Store<Plan> {
  /** Make a change the person can undo. `label` says what it was ("Optimised Day 1"). */
  change(label: string, fn: (plan: Plan) => Plan): void;
  /** Undo the last change; returns what it was, or null when there is nothing to undo. */
  undo(): string | null;
  /** What Undo would undo, if anything. */
  undoLabel(): string | null;
  /** Back to the bundled plan (undoable). */
  reset(): void;
}

// Versioned: a plan saved by an older version of the example (the Lisbon trip) is never read back as this one.
const KEY = "trips:plan:v2";
const HISTORY = 40;

export function createPlanStore(persist = true, initial?: Plan): PlanStore {
  const store = createStore<Plan>(initial ?? (persist ? readPlan(saved.read(KEY, null)) : DEFAULT_PLAN));
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const history: { label: string; plan: Plan }[] = [];

  const change = (label: string, fn: (plan: Plan) => Plan) => {
    const before = store.get();
    const after = fn(before);
    if (after === before || JSON.stringify(after) === JSON.stringify(before)) return;
    history.push({ label, plan: before });
    if (history.length > HISTORY) history.shift();
    store.set(after);
  };
  return {
    ...store,
    change,
    undo() {
      const last = history.pop();
      if (!last) return null;
      store.set(last.plan);
      return last.label;
    },
    undoLabel: () => history[history.length - 1]?.label ?? null,
    reset: () => change("Reset the trip", () => DEFAULT_PLAN),
  };
}

/** What an Explore pane shows, for the map to draw: the pane's id and its result ids. */
export interface Results {
  pane: string;
  ids: readonly string[];
}
