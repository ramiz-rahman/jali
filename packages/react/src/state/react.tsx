/** React access to the store: one provider, and hooks that subscribe to exactly what a component reads. */
import { createContext, Fragment, useContext, useSyncExternalStore, type ReactNode } from "react";
import type {
  Actions,
  Jali,
  JaliState,
  PaneNode,
  JaliModel,
  UiState,
  UiStore,
} from "@jali/core/adapter";
import type { ReactEnv, Page } from "../define";
import { resolveTheme, titleOf, type Messages, type Theme } from "@jali/core/adapter";

const StoreContext = /* @__PURE__ */ createContext<UiStore | null>(null);

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
export function useModel(): JaliModel {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.model);
}

export const useActions = (): Actions => useStore().actions;

/** This workspace's words (`createJali({ messages })`, English by default). */
export const useMessages = (): Messages => useStore().messages;

/** Emphasis inside a message (`messages.chooser.heading(title, bold)`). */
export const bold = (text: string) => <b>{text}</b>;

/** A message's parts, in the order the message gives them. */
export const Parts = ({ of }: { of: ReactNode[] }) => (
  <>
    {of.map((part, i) => (
      <Fragment key={i}>{part}</Fragment>
    ))}
  </>
);

/** This workspace's pane kinds and profile. */
export const useEnv = (): ReactEnv => useStore().env;
/** The curated page profile, when the workspace has one. */
export const useProfile = (): Page | null => useEnv().profile;
/** A pane's name: its role's label in a curated page, else its kind's title for what it shows. */
export function useTitleOf(): (node: PaneNode) => string {
  const env = useEnv();
  const titles = useUi((s) => s.titles);
  return (node) => titleOf(env, node, titles);
}

// ---------- the public names ----------

/** The workspace: its actions (`useJali().actions.openBeside(pane, ref)`), events, layout, keymap and kinds. */
export const useJali = (): Jali => useStore().jali;
/** Part of the workspace's state, re-rendering only when it changes: `useJaliState((s) => s.view.focused)`. */
export const useJaliState = <T,>(select: (s: JaliState) => T): T => useUi(select);
/** The workspace as it is on screen: its panes, their boxes and titles, the shelf. */
export const useJaliModel = useModel;
/** The theme in use, "light" or "dark": the person's choice, or the system's when they chose "system". */
export const useTheme = (): Theme => useUi((s) => resolveTheme(s.settings.theme, s.systemDark));
