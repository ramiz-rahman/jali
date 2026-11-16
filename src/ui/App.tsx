import { useEffect, useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import type { DataLayer } from "../data/types";
import { DataLayerProvider } from "./pane-kinds";
import { TopBar } from "./TopBar";
import { Workspace } from "./Workspace";
import { StatusLine } from "./StatusLine";
import { Announcer } from "./Announcer";
import { Palette } from "./Palette";
import { SettingsPanel, useResolvedTheme } from "./Settings";
import { Chooser } from "./Chooser";
import { installKeyboard } from "./keyboard";
import { applyUrl, installUrlSync, writeUrl } from "./url";
import { actions, allPanes, getState, hooks, setState } from "./store";
import { presetById } from "./presets";

export const UNDO_MS = 8000;

function brokenToast() {
  toast.error("This link’s layout couldn’t be read", {
    description: `Opened “${presetById(getState().presetId).label}” instead. A copy of the link was kept.`,
    duration: 8000,
  });
  hooks.announce("The layout in this link couldn't be read. Opened the default layout instead.");
}

/** Read the URL before the first render so the first paint is the shared layout. */
let initialBroken: string | undefined;
let booted = false;
export function bootFromUrl() {
  if (booted) return;
  booted = true;
  initialBroken = applyUrl();
  actions.noteOpen(allPanes().map((p) => p.ref));
  const s = getState();
  if (!s.view.focused) {
    const first = allPanes()[0]?.id;
    if (first) setState({ view: { ...s.view, focused: first, focusHistory: [first] } });
  }
}

export function App({ data }: { data: DataLayer }) {
  const theme = useResolvedTheme();
  useMemo(bootFromUrl, []);
  useEffect(() => {
    hooks.toastClosed = (title: string) => {
      toast(`${title === "Other panes" ? "Other panes closed" : "Pane closed"}`, {
        description: title === "Other panes" ? undefined : title,
        action: { label: "Undo", onClick: () => actions.undoClose() },
        duration: UNDO_MS,
      });
    };
    const offUrl = installUrlSync(brokenToast);
    const offKeys = installKeyboard();
    writeUrl("replace");
    if (initialBroken) {
      setTimeout(brokenToast, 50);
      initialBroken = undefined;
    }
    return () => {
      offUrl();
      offKeys();
    };
  }, []);
  return (
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
        <Toaster theme={theme} position="bottom-right" offset={{ bottom: 40, right: 12 }} toastOptions={{ className: "toast" }} />
      </DataLayerProvider>
    </QueryClientProvider>
  );
}
