import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import type { DataLayer } from "../data/types";
import { DataLayerProvider } from "../data/react";
import { TopBar } from "./chrome/TopBar";
import { StatusLine } from "./chrome/StatusLine";
import { Announcer } from "./chrome/Announcer";
import { Workspace } from "./workspace/Workspace";
import { Palette } from "./dialogs/Palette";
import { Chooser } from "./dialogs/Chooser";
import { SettingsPanel } from "./dialogs/Settings";
import { resolveTheme } from "./state/settings";
import { StoreProvider, useStore, useUi } from "./state/react";
import type { UiStore } from "./state/store";

export const UNDO_MS = 8000;

/** Shows the store's toasts with Sonner. Undo toasts offer ⌘Z's undo. */
function Toasts() {
  const store = useStore();
  const theme = useUi((s) => resolveTheme(s.settings.theme, s.systemDark));
  useEffect(
    () =>
      store.onToast((t) => {
        if (t.error) toast.error(t.title, { description: t.description, duration: 8000 });
        else toast(t.title, { description: t.description, action: t.undo ? { label: "Undo", onClick: () => store.actions.undo() } : undefined, duration: UNDO_MS });
      }),
    [store],
  );
  return <Toaster theme={theme} position="bottom-right" offset={{ bottom: 40, right: 12 }} toastOptions={{ className: "toast" }} />;
}

export function App({ store, data }: { store: UiStore; data: DataLayer }) {
  return (
    <StoreProvider store={store}>
      <QueryClientProvider client={data.queryClient}>
        <DataLayerProvider value={data}>
          <div className="app">
            <TopBar />
            <Workspace />
            <StatusLine />
          </div>
          <Announcer />
          <Palette />
          <SettingsPanel />
          <Chooser />
          <Toasts />
        </DataLayerProvider>
      </QueryClientProvider>
    </StoreProvider>
  );
}
