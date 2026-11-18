import { useCallback, useEffect, useRef } from "react";
import type { ObjectRef, Row } from "../../data/types";
import type { PaneProps } from "@jali/react";
import { sameRef } from "@jali/core";

interface Results { q: { data?: unknown }; rows: Row[]; offset: number; total: number }

/**
 * Keep a list's selection on the same item when its results change (filter or sort), not on the same index.
 *  - The item is still in the results: it is selected at its new place.
 *  - The whole result set is loaded and the item is not in it: nothing is selected, and the workspace is told the item
 *    is out of the results (`select(ref, { inResults: false })`), so a following detail keeps it with a note.
 *  - Otherwise (the item may be past the loaded window) nothing is selected and nothing is claimed.
 * Returns the `select` to hand the grid: it remembers the item reported.
 */
export function useSelectionAcrossResults(key: string, w: Results, refFor: ((row: Row) => ObjectRef | null) | null,
  setSelected: (i: number | null) => void, select: PaneProps["select"]) {
  const last = useRef<ObjectRef | null>(null);
  const seen = useRef(key);
  const report = useCallback((ref: ObjectRef | null) => { last.current = ref; select(ref); }, [select]);
  useEffect(() => {
    if (seen.current === key || !w.q.data || !refFor) return;
    seen.current = key;
    const target = last.current;
    if (!target) return;
    const i = w.rows.findIndex((r) => sameRef(refFor(r) ?? undefined, target));
    if (i >= 0) { setSelected(w.offset + i); select(target); return; }
    setSelected(null);
    if (w.offset === 0 && w.rows.length >= w.total) select(target, { inResults: false });
  });
  return report;
}
