/**
 * The app: Jali's root with the app's chrome around the panes (a top bar with the layouts and the transport, and a
 * status line with Jali's shelf), and the toasts outside the workspace.
 */
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { runCommand, type Jali } from "@jali/core";
import { JaliRoot, JaliView, useJali, useTheme } from "@jali/react";
import { ServicesProvider, useServices, type Services } from "../services";
import { useControlsPlace } from "../ui/controlsPlace";
import { slashForSearch, spaceForTransport } from "./keys";
import { StatusLine } from "./StatusLine";
import { TopBar } from "./TopBar";

export function App({ jali, services }: { jali: Jali; services: Services }) {
  return (
    <ServicesProvider services={services}>
      <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
        <TopBar />
        <AppKeys />
        <JaliView />
        <StatusLine />
      </JaliRoot>
    </ServicesProvider>
  );
}

/** Jali's toasts (a closed pane offers Undo) and the app's own, with Sonner. */
function Toasts() {
  const jali = useJali();
  const theme = useTheme();
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
  // Clear of whatever stands along the bottom: the status line (40px), or the control slab (104px).
  const bottom = useControlsPlace() === "bottom" ? 116 : 52;
  // Audio that did not load: say which session and track, and offer the one thing that helps.
  const { engine } = useServices();
  useEffect(() => {
    let told: string | undefined;
    return engine.subscribe(() => {
      const t = engine.get();
      if (t.status !== "error") return void (told = undefined);
      if (told === t.session) return;
      told = t.session;
      toast.error(`The audio for “${engine.session().title}” didn't load`, {
        description: `${(t.error ?? "").replace(/^Error: /, "")} did not arrive. Check the connection, then try again.`,
        duration: Infinity,
        action: { label: "Try again", onClick: () => engine.load(t.session) },
      });
    });
  }, [engine]);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={{ bottom, right: 12 }}
      toastOptions={{ className: "toast" }}
    />
  );
}

/**
 * Space plays and pauses; "/" goes to a segment. On the window, in the bubble phase: the focused content has had the
 * key first, and keeps it if it called `preventDefault()` (shell/keys.ts has the rest of the rule).
 */
function AppKeys() {
  const jali = useJali();
  const { engine } = useServices();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (spaceForTransport(e)) {
        e.preventDefault();
        engine.toggle();
      } else if (slashForSearch(e)) {
        e.preventDefault();
        runCommand(jali, "studio.segment");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jali, engine]);
  return null;
}
