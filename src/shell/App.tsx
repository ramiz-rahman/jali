import { useEffect, type CSSProperties } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import type { DataLayer } from "../data/types";
import { DataLayerProvider } from "../data/react";
import { TopBar } from "./TopBar";
import { StatusLine } from "./StatusLine";
import { Jali, JaliView, useTheme, useWorkspace, useWorkspaceState } from "@jali/react";
import type { Workspace } from "@jali/core";

export const UNDO_MS = 8000;

const undoKeys = (store: Workspace) => {
  const k = store.keymap.label("pane.undo_close");
  return k ? `${k} to undo` : "";
};

/** Shows the store's toasts with Sonner. Undo toasts offer the undo that "Restore last closed pane" (⌘K ⌘Z) runs. */
function Toasts() {
  const store = useWorkspace();
  const theme = useTheme();
  useEffect(
    () =>
      store.onToast((t) => {
        if (t.error) toast.error(t.title, { description: t.description, duration: 8000 });
        else
          toast(t.title, {
            description: t.undo
              ? [t.description, undoKeys(store)].filter(Boolean).join(" · ")
              : t.description,
            action: t.undo ? { label: "Undo", onClick: () => store.actions.undo() } : undefined,
            duration: UNDO_MS,
          });
      }),
    [store],
  );
  // A curated page keeps its toasts over the queue (bottom-left, narrow), never over a view's content.
  const curated = useWorkspaceState((s) => !!s.page);
  return curated ? (
    <Toaster
      theme={theme}
      position="bottom-left"
      offset={{ bottom: 40, left: 10 }}
      mobileOffset={{ bottom: 40, left: 10 }}
      style={{ "--width": "250px" } as CSSProperties}
      toastOptions={{ className: "toast" }}
    />
  ) : (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={{ bottom: 40, right: 12 }}
      toastOptions={{ className: "toast" }}
    />
  );
}

export function App({ workspace, data }: { workspace: Workspace; data: DataLayer }) {
  return (
    <QueryClientProvider client={data.queryClient}>
      <DataLayerProvider value={data}>
        <Jali workspace={workspace} className="app" overlays={<Toasts />}>
          <TopBar />
          <JaliView />
          <StatusLine />
        </Jali>
      </DataLayerProvider>
    </QueryClientProvider>
  );
}
