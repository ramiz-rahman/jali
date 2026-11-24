/**
 * Every toast, with Sonner: the app's own (a plan change says what it did, with its own Undo: `notify`, the
 * services' way to tell the person something) and Jali's (a closed pane offers Undo), in one place, worded alike.
 */
import { toast, Toaster } from "sonner";
import { useJali, useJaliEvent, useJaliTheme } from "jali-layout/react";
import type { Services } from "../state/services";

const undoAction = (onClick: () => void) => ({ label: "Undo", onClick });

/** The app's toast: a short message, with Undo when the change can be undone. */
export const notify: Services["notify"] = (text, options) =>
  toast(text, options?.undo ? { action: undoAction(options.undo) } : undefined);

/** Jali's toasts, and where every toast shows: above the status line, in the theme. */
export function Toasts() {
  const jali = useJali();
  const theme = useJaliTheme();
  useJaliEvent("toast", (t) =>
    t.error
      ? toast.error(t.title, { description: t.description })
      : toast(t.title, {
          description: t.description,
          action: t.undo ? undoAction(() => jali.actions.undo()) : undefined,
        }),
  );
  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      offset={{ bottom: 44 }}
      mobileOffset={{ bottom: 44 }}
      toastOptions={{ className: "toast" }}
    />
  );
}
