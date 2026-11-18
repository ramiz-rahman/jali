import { useEffect, type CSSProperties } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import type { DataLayer } from "../data/types";
import { DataLayerProvider } from "../data/react";
import { TopBar } from "./chrome/TopBar";
import { StatusLine } from "./chrome/StatusLine";
import { Announcer } from "./chrome/Announcer";
import { Workspace } from "./workspace/Workspace";
import { ReviewPage } from "./chrome/ReviewBar";
import { Palette } from "./dialogs/Palette";
import { Chooser } from "./dialogs/Chooser";
import { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
import { SettingsPanel } from "./dialogs/Settings";
import { resolveTheme } from "./state/settings";
import { StoreProvider, useStore, useUi } from "./state/react";
import type { UiStore } from "./state/store";

export const UNDO_MS = 8000;

const undoKeys = (store: UiStore) => {
  const k = store.keymap.label("pane.undo_close");
  return k ? `${k} to undo` : "";
};

/** Shows the store's toasts with Sonner. Undo toasts offer the undo that "Restore last closed pane" (⌘K ⌘Z) runs. */
function Toasts() {
  const store = useStore();
  const theme = useUi((s) => resolveTheme(s.settings.theme, s.systemDark));
  useEffect(
    () =>
      store.onToast((t) => {
        if (t.error) toast.error(t.title, { description: t.description, duration: 8000 });
        else toast(t.title, { description: t.undo ? [t.description, undoKeys(store)].filter(Boolean).join(" · ") : t.description, action: t.undo ? { label: "Undo", onClick: () => store.actions.undo() } : undefined, duration: UNDO_MS });
      }),
    [store],
  );
  // A curated page keeps its toasts over the queue (bottom-left, narrow), never over a view's content.
  const curated = useUi((s) => !!s.review);
  return curated
    ? <Toaster theme={theme} position="bottom-left" offset={{ bottom: 40, left: 10 }} mobileOffset={{ bottom: 40, left: 10 }} style={{ "--width": "250px" } as CSSProperties} toastOptions={{ className: "toast" }} />
    : <Toaster theme={theme} position="bottom-right" offset={{ bottom: 40, right: 12 }} toastOptions={{ className: "toast" }} />;
}

/** Data Studio is all panes; a curated page puts its queue, header and tabs around them. */
function Main() {
  return useUi((s) => !!s.review) ? <ReviewPage /> : <Workspace />;
}

export function App({ store, data }: { store: UiStore; data: DataLayer }) {
  return (
    <StoreProvider store={store}>
      <QueryClientProvider client={data.queryClient}>
        <DataLayerProvider value={data}>
          <div className="app" data-jali="" ref={store.dom.attach}>
            <TopBar />
            <Main />
            <StatusLine />
          </div>
          <Announcer />
          <Palette />
          <SettingsPanel />
          <Chooser />
          <ConfirmDiscard />
          <Toasts />
        </DataLayerProvider>
      </QueryClientProvider>
    </StoreProvider>
  );
}
