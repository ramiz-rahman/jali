/**
 * The app: Jali's root with the app's chrome around the panes; outside the workspace (overlays), the toasts and the
 * app's question before an unsent order is lost. The instrument search is Jali's own chooser, opened by the app's
 * commands (workspace/commands.ts).
 */
import { useEffect } from "react";
import { runCommand, type Jali } from "jali-layout";
import { JaliRoot, JaliView, useJali } from "jali-layout/react";
import { ServicesProvider, type Services } from "../services";
import { QuestionDialog } from "./Question";
import { StatusLine } from "./StatusLine";
import { Toasts } from "./Toasts";
import { TopBar } from "./TopBar";

export function App({ jali, services }: { jali: Jali; services: Services }) {
  return (
    <ServicesProvider services={services}>
      <JaliRoot
        jali={jali}
        className="app"
        overlays={
          <>
            <Toasts />
            <QuestionDialog />
          </>
        }
      >
        <TopBar />
        <SearchKey />
        <JaliView />
        <StatusLine />
      </JaliRoot>
    </ServicesProvider>
  );
}

/**
 * "/" opens the instrument search from anywhere, except while typing. A single key like this is the app's to take:
 * Jali's keymap leaves unmodified keys to the page, and a pane's content sees every key before it bubbles here.
 */
function SearchKey() {
  const jali = useJali();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      e.preventDefault();
      runCommand(jali, "markets.chart");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jali]);
  return null;
}
