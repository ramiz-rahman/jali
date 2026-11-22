/**
 * What the chrome reads of Pop out (features/pop-out.tsx), when the instance has the feature: whether this browser
 * can, and whether a pane is out. Without the feature every answer is "no", and none of Pop out's code is here.
 */
import type { NodeId } from "@jali/core";
import type { JaliStore } from "@jali/core/adapter";
import { useSyncExternalStore } from "react";
import { partOf } from "../features/feature-parts";

const none = () => () => {};

/** The instance's floating window, if it has the `popOut()` feature. */
export const popOutOf = (store: JaliStore) => partOf(store.env, "popOut");

/** Whether panes can pop out here, for rendering: false on a server and while hydrating, so the first render matches
 *  the server's. */
export function useCanPopOut(store: JaliStore): boolean {
  const w = popOutOf(store);
  return useSyncExternalStore(
    none,
    () => !!w?.can(),
    () => false,
  );
}

/** Whether pane `pane` is popped out, and where its content renders meanwhile when it renders there (`target`). */
export function usePoppedOut(
  store: JaliStore,
  pane: NodeId,
): { out: boolean; target: HTMLElement | null } {
  const w = popOutOf(store);
  const out = useSyncExternalStore(
    w?.subscribe ?? none,
    () => w?.pane(store) === pane,
    () => false,
  );
  // Read again whenever `out` changes, which is when it does.
  return { out, target: out ? (w?.target(store, pane) ?? null) : null };
}
