/**
 * The toasts, drawn by Sonner outside the workspace: Jali's own (a closed pane offers Undo), the app's (`notify`),
 * and the one that says the audio didn't load.
 */
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { useJali, useJaliEvent, useJaliTheme } from "jali-layout/react";
import type { Engine } from "../audio/engine";
import { useServices, type Notify } from "../services";

/** The app's `notify`, as a toast. */
export const toastNotify: Notify = (text, { undo } = {}) =>
  toast(text, { action: undo ? { label: "Undo", onClick: undo } : undefined });

/** The toasts' gap from what stands along the bottom edge (`--bottom-edge`, shell.css), and from the right edge. */
const GAP = 12;

export function Toasts() {
  const jali = useJali();
  const theme = useJaliTheme();
  const { engine } = useServices();
  useJaliEvent("toast", (t) =>
    t.error
      ? toast.error(t.title, { description: t.description })
      : toast(t.title, {
          description: t.description,
          action: t.undo ? { label: "Undo", onClick: () => jali.actions.undo() } : undefined,
        }),
  );
  useAudioErrorToast(engine);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={{ bottom: `calc(var(--bottom-edge) + ${GAP}px)`, right: GAP }}
      toastOptions={{ className: "toast" }}
    />
  );
}

/** Audio that did not load: say which session and track, once a session, and offer the one thing that helps. */
function useAudioErrorToast(engine: Engine) {
  useEffect(() => {
    let told: string | undefined;
    return engine.subscribe(() => {
      const t = engine.get();
      if (t.status !== "error") return void (told = undefined);
      if (told === t.session) return;
      told = t.session;
      toast.error(`The audio for “${engine.session().title}” didn't load`, {
        description: `${t.missing ?? "A track"} did not arrive. Check the connection, then try again.`,
        duration: Infinity,
        action: { label: "Try again", onClick: () => engine.load(t.session) },
      });
    });
  }, [engine]);
}
