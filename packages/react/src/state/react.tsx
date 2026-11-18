/** React access to the store: one provider, and hooks that subscribe to exactly what a component reads. */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Actions, PaneNode, WorkspaceModel, UiState, UiStore } from "@jali/core/adapter";
import type { ReactEnv, Page } from "../define";
import { resolveTheme, titleOf, type Theme } from "@jali/core/adapter";

const StoreContext = createContext<UiStore | null>(null);

export function StoreProvider({ store, children }: { store: UiStore; children?: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** A workspace as React code sees it: its kinds have components, its page a rail and header (define.ts). */
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
export const useProfile = (): Page | null => useEnv().profile;
/** A pane's name: its role's label in a curated page, else its kind's title for what it shows. */
export function useTitleOf(): (node: PaneNode) => string {
  const env = useEnv();
  return (node) => titleOf(env, node);
}

// ---------- the public names ----------

/** Provides a workspace to the hooks below it. `<Jali>` does this; use it to render Jali's parts on their own. */
export const WorkspaceProvider = ({
  workspace,
  children,
}: {
  workspace: UiStore;
  children?: ReactNode;
}) => <StoreProvider store={workspace}>{children}</StoreProvider>;
/** The workspace: its actions (`useWorkspace().actions.openBeside(...)`), keymap, kinds and state. */
export const useWorkspace = useStore;
/** Part of the workspace's state, re-rendering only when it changes: `useWorkspaceState((s) => s.view.focused)`. */
export const useWorkspaceState = useUi;
/** The workspace as it is on screen: its panes, their boxes and titles, the shelf. */
export const useWorkspaceModel = useModel;
/** The theme in use, "light" or "dark": the person's choice, or the system's when they chose "system". */
export const useTheme = (): Theme => useUi((s) => resolveTheme(s.settings.theme, s.systemDark));
