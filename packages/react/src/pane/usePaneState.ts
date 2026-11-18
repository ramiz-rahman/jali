/**
 * A pane's own state, kept by the workspace: it survives the pane being tabbed, folded, tucked or moved, and a reload
 * (saved through the store's storage port). It is dropped when the pane closes for good or shows another object. Values must be JSON.
 *
 *   const [sort, setSort] = usePaneState("sort", { column: "id", dir: "asc" });
 *
 * Use it for what a person would expect back: a scroll position, a sort, a draft. Use React state for the rest.
 */
import { useCallback, useContext, useState } from "react";
import { useStore, useUi } from "../state/react";
import { PaneContext } from "./context";

export function usePaneState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  // The peek sheet (and anything outside a pane) has no pane id: its state is local.
  const id = useContext(PaneContext)?.id ?? null;
  const store = useStore();
  const kept = useUi((s) => (id ? s.paneState[id]?.[key] : undefined)) as T | undefined;
  // In the peek sheet (no pane), state is local and goes when the sheet does.
  const [local, setLocal] = useState(initial);
  const value = id ? (kept === undefined ? initial : kept) : local;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      if (!id) return setLocal(next);
      const prev = (store.get().paneState[id]?.[key] as T | undefined) ?? initial;
      store.actions.setPaneState(
        id,
        key,
        typeof next === "function" ? (next as (p: T) => T)(prev) : next,
      );
      // `initial` is the first value only, as with useState.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [id, key, store],
  );
  return [value, set];
}
