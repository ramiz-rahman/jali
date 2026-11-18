/** The active-item port (pane/activeItem.ts) for the pane a React component renders in. */
import { useContext, useMemo } from "react";
import type { ActiveItemPort } from "@jali/core";
import { useStore, useUi } from "../state/react";
import { activeItemPort, type ActiveItemMapping } from "@jali/core";
import { PaneIdContext } from "./usePaneState";

/** The port for the pane this content is in. Re-renders when the list's item changes, so `itemId` reads fresh. */
export function useActiveItemPort(mapping: ActiveItemMapping): ActiveItemPort | null {
  const pane = useContext(PaneIdContext);
  const store = useStore();
  useUi((s) => (pane ? s.selection[pane]?.ref : undefined));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (pane ? activeItemPort(store, pane, mapping) : null), [store, pane]);
}
