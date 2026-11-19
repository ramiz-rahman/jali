/**
 * The app: Jali's root with the app's chrome around the panes, and the toasts outside the workspace (overlays). The
 * instrument search is Jali's own chooser, opened by the app's commands (workspace.ts).
 */
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { runCommand, type Jali } from "@jali/core";
import { JaliRoot, JaliView, useJali, useTheme } from "@jali/react";
import { ServicesProvider, useServices, type Services } from "../services";
import * as f from "../ui/format";
import { StatusLine } from "./StatusLine";
import { TopBar } from "./TopBar";

export function App({ jali, services }: { jali: Jali; services: Services }) {
  return (
    <ServicesProvider services={services}>
      <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
        <TopBar />
        <SearchKey />
        <JaliView />
        <StatusLine />
      </JaliRoot>
    </ServicesProvider>
  );
}

/**
 * Jali's toasts (a closed pane offers Undo), and the app's own (fills, watchlist changes), with Sonner.
 */
function Toasts() {
  const jali = useJali();
  const theme = useTheme();
  const { trading, market } = useServices();
  useEffect(
    () =>
      jali.onToast((t) =>
        t.error
          ? toast.error(t.title, { description: t.description })
          : toast(t.title, {
              description: t.description,
              action: t.undo ? { label: "Undo", onClick: () => jali.actions.undo() } : undefined,
            }),
      ),
    [jali],
  );
  useEffect(
    () =>
      trading.onFill((fill) => {
        const inst = market.instrument(fill.symbol)!;
        toast(
          `${fill.side === "buy" ? "Bought" : "Sold"} ${f.size(fill.qty)} ${fill.symbol} at ${f.price(inst, fill.price)}`,
        );
      }),
    [trading, market],
  );
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={{ bottom: 36, right: 12 }}
      toastOptions={{ className: "toast" }}
    />
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
