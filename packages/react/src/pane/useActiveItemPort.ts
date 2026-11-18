/** The active-item port (pane/activeItem.ts) for the pane a React component renders in. */
import { useContext, useMemo, useRef } from "react";
import type { ActiveItemPort } from "@jali/core/adapter";
import { useStore, useUi } from "../state/react";
import { activeItemPort, type ActiveItemMapping } from "@jali/core/adapter";
import { PaneIdContext } from "./usePaneState";

/** The port for the pane this content is in. Re-renders when the list's item changes, so `itemId` reads fresh. The
 *  port is the same object for the pane's life, and always uses the mapping of the latest render (an inline object
 *  is fine). */
export function useActiveItemPort(mapping: ActiveItemMapping): ActiveItemPort | null {
  const pane = useContext(PaneIdContext);
  const store = useStore();
  const latest = useRef(mapping);
  latest.current = mapping;
  useUi((s) => (pane ? s.selection[pane]?.ref : undefined));
  return useMemo(
    () => (pane ? activeItemPort(store, pane, { toRef: (id) => latest.current.toRef(id), idOf: (ref) => latest.current.idOf(ref) }) : null),
    [store, pane],
  );
}
