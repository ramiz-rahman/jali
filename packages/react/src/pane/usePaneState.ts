import { own } from "@jali/core/adapter";
/**
 * A pane's own state, kept by the workspace: it survives the pane being tabbed, folded, tucked or moved, and a reload
 * (saved through the store's storage port). It is dropped when the pane closes for good or shows another object. Values must be JSON.
 *
 *   const [sort, setSort] = usePaneState("sort", { column: "id", dir: "asc" });
 *
 * Use it for what a person would expect back: a scroll position, a sort, a draft. Use React state for the rest.
 *
 * `initial` is read once, as with `useState`: a new object each render doesn't change the value, and an update
 * function's `prev` is that first value until something is stored. What comes back from storage was written by an
 * earlier version of the app, or by hand: give `parse` to check it. It gets the stored value and returns the value to
 * use, or `undefined` to start from `initial` (a value it rejects stays stored until the pane writes its own).
 *
 *   const [sort] = usePaneState("sort", { column: "id", dir: "asc" }, { parse: (v) => (isSort(v) ? v : undefined) });
 */
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { useStore, useUi } from "../state/react";
import { PaneContext } from "./context";

/** How `usePaneState` reads what was stored. */
export interface PaneStateOptions<T> {
  /** The stored value as `T`, or `undefined` to use `initial` instead. Called with what storage held (any JSON). */
  parse?: (stored: unknown) => T | undefined;
}

export function usePaneState<T>(
  key: string,
  initial: T,
  options?: PaneStateOptions<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  // The peek sheet (and anything outside a pane) has no pane id: its state is local.
  const id = useContext(PaneContext)?.id ?? null;
  const store = useStore();
  // The first `initial`, for the read and the write alike (useState's rule).
  const first = useRef(initial).current;
  const parse = useRef(options?.parse);
  parse.current = options?.parse;
  const read = useCallback(
    (raw: unknown): T => {
      if (raw === undefined) return first;
      if (!parse.current) return raw as T;
      try {
        return parse.current(raw) ?? first;
      } catch {
        return first;
      }
    },
    [first],
  );
  const kept = useUi((s) => own(own(s.paneState, id), key));
  // In the peek sheet (no pane), state is local and goes when the sheet does.
  const [local, setLocal] = useState(initial);
  // Parsed once per stored value, so a parse that builds a new object doesn't change the value every render.
  const stored = useMemo(() => read(kept), [read, kept]);
  const value = id ? stored : local;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      if (!id) return setLocal(next);
      const prev = read(own(own(store.get().paneState, id), key));
      store.actions.setPaneState(
        id,
        key,
        typeof next === "function" ? (next as (p: T) => T)(prev) : next,
      );
    },
    [id, key, store, read],
  );
  return [value, set];
}
