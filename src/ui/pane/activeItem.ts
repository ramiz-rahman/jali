/**
 * Jali's side of the active-item contract (src/contracts/active-item.ts) for a list inside a pane: the list keeps its
 * current item through this port, and the workspace does what it does for `select` and `peek`, so the list's
 * following detail follows it, Space shows it, and an open sheet steps with it.
 *
 *   const port = useActiveItemPort({ toRef: (id) => ({ kind: "record", params: { table: "orders", id: Number(id) } }),
 *                                    idOf: (ref) => String(ref.params.id) });
 *   <ChakniCollection quickLook={port} … />
 */
import { useContext, useMemo } from "react";
import type { NodeId, ObjectRef } from "../../layout-core/types";
import type { ActiveItemPort } from "../../contracts/active-item";
import { useStore, useUi } from "../state/react";
import type { UiStore } from "../state/store";
import { PaneIdContext } from "./usePaneState";

export interface ActiveItemMapping {
  /** The object an item id shows. */
  toRef(itemId: string): ObjectRef;
  /** The item id of an object, or null when it is not one of this list's items. */
  idOf(ref: ObjectRef): string | null;
}

const ACCEPTED = { status: "accepted" } as const;

export function activeItemPort(store: UiStore, pane: NodeId, { toRef, idOf }: ActiveItemMapping): ActiveItemPort {
  return {
    get itemId() {
      const ref = store.get().selection[pane]?.ref;
      return ref ? idOf(ref) : null;
    },
    write(itemId, action) {
      const { actions } = store;
      if (action === "close") {
        // Only a sheet this list opened; the cursor stays.
        if (store.get().view.peek && store.get().peekSource === pane) actions.peek(null, pane);
        return ACCEPTED;
      }
      const ref = itemId === null ? null : toRef(itemId);
      actions.select(pane, ref);
      if (action === "open" && ref) actions.peek(ref, pane);
      return ACCEPTED;
    },
  };
}

/** The port for the pane this content is in. Re-renders when the list's item changes, so `itemId` reads fresh. */
export function useActiveItemPort(mapping: ActiveItemMapping): ActiveItemPort | null {
  const pane = useContext(PaneIdContext);
  const store = useStore();
  useUi((s) => (pane ? s.selection[pane]?.ref : undefined));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (pane ? activeItemPort(store, pane, mapping) : null), [store, pane]);
}
