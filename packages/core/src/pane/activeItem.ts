/**
 * Jali's side of the active-item contract (src/contracts/active-item.ts) for a list inside a pane: the list keeps its
 * current item through this port, and the workspace does what it does for `select` and `peek`, so the list's
 * following detail follows it, Space shows it, and an open sheet steps with it.
 *
 * In React, `useActiveItemPort` (@jali/react) makes one for the pane it renders in:
 *
 *   const port = useActiveItemPort({ toRef: (id) => ({ kind: "record", params: { table: "orders", id: Number(id) } }),
 *                                    idOf: (ref) => String(ref.params.id) });
 *   <ChakniCollection quickLook={port} … />
 */
import type { NodeId, ObjectRef } from "../layout/types";
import type { ActiveItemPort } from "../contracts/active-item";
import type { UiStore } from "../state/store";

export interface ActiveItemMapping {
  /** The object an item id shows. */
  toRef(itemId: string): ObjectRef;
  /** The item id of an object, or null when it is not one of this list's items. */
  idOf(ref: ObjectRef): string | null;
}

const ACCEPTED = { status: "accepted" } as const;

export function activeItemPort(
  store: UiStore,
  pane: NodeId,
  { toRef, idOf }: ActiveItemMapping,
): ActiveItemPort {
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
