/**
 * Live workspaces render in the browser only. The page around them (captions, chrome, the box at its height) is
 * prerendered, so the text is in the HTML and nothing jumps; the workspace itself appears once the page hydrates.
 * Jali measures its box to fit panes, which a server can't do.
 */
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/** False while prerendering and hydrating, true after; true at once for anything mounted later. */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function ClientOnly({ children }: { children: ReactNode }) {
  return useHydrated() ? children : null;
}
