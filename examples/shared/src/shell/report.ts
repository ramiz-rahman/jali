/**
 * A pane that fails shows it in place, with Retry and Close. It is also said in a toast naming the pane, so a failure
 * in a folded or tucked pane, or one scrolled out of view, isn't missed (`createJali({ onPaneError })`).
 */
import { toast } from "sonner";
import type { Jali, PaneErrorInfo } from "jali";

export const reportPaneError =
  (jali: () => Jali) =>
  (error: unknown, { pane }: PaneErrorInfo) => {
    const title =
      jali()
        .model()
        .pane(pane ?? undefined)?.title ?? "A pane";
    toast.error(`${title} failed`, {
      description: `${error instanceof Error ? error.message : String(error)}. Retry it from the pane.`,
    });
  };
