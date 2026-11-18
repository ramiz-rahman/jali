/** React access to the store: one provider, and hooks that subscribe to exactly what a component reads. */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Actions } from "../actions";
import type { ReactEnv, WorkspaceProfile } from "../define";
import type { PaneNode } from "../../layout-core/types";
import { titleOf } from "../profile";
import type { WorkspaceModel } from "./model";
import type { UiState, UiStore } from "./store";

const StoreContext = createContext<UiStore | null>(null);

export function StoreProvider({ store, children }: { store: UiStore; children?: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** A store as React code sees it: its kinds have components, its profile a rail and header (ui/define.ts). */
export type ReactUiStore = UiStore & { env: ReactEnv };

export function useStore(): ReactUiStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore() outside <StoreProvider>");
  return store as ReactUiStore;
}

export function useUi<T>(select: (s: UiState) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

/** The derived workspace model; a new object only when something it depends on changed. */
export function useModel(): WorkspaceModel {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.model);
}

export const useActions = (): Actions => useStore().actions;

/** This workspace's pane kinds and profile. */
export const useEnv = (): ReactEnv => useStore().env;
/** The curated page profile, when the workspace has one. */
export const useProfile = (): WorkspaceProfile | null => useEnv().profile;
/** A pane's name: its role's label in a curated page, else its kind's title for what it shows. */
export function useTitleOf(): (node: PaneNode) => string {
  const env = useEnv();
  return (node) => titleOf(env, node);
}
