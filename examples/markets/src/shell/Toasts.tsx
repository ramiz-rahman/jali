/** Jali's toasts (a closed pane offers Undo), and the app's own (fills, watchlist changes), with Sonner. */
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { useJali, useJaliEvent, useJaliTheme } from "jali/react";
import { useServices } from "../services";
import * as f from "../ui/format";

export function Toasts() {
  const jali = useJali();
  const theme = useJaliTheme();
  const { trading, market } = useServices();
  useJaliEvent("toast", (t) =>
    t.error
      ? toast.error(t.title, { description: t.description })
      : toast(t.title, {
          description: t.description,
          action: t.undo ? { label: "Undo", onClick: () => jali.actions.undo() } : undefined,
        }),
  );
  useEffect(
    () =>
      trading.onFill((fill) => {
        const inst = market.instrument(fill.symbol);
        if (!inst) return;
        toast(
          `${f.SIDE[fill.side].past} ${f.size(fill.qty)} ${fill.symbol} at ${f.price(inst, fill.price)}`,
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
