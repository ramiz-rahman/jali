import * as store from "../store";
import type { PaneNode } from "../../layout-core/types";

/** Uses the store's `canMinimise(paneId)` once it exists; until then, a pane can minimise if another pane stays expanded. */
export function useCanMinimise(paneId: string): boolean {
  const layout = store.useUi((s) => s.layout);
  const real = (store as unknown as { canMinimise?: (id: string) => boolean }).canMinimise;
  if (typeof real === "function") return real(paneId);
  const open = store.allPanes(layout.root).filter((p: PaneNode) => !p.collapsed);
  return open.length > 1 || !open.some((p) => p.id === paneId);
}
