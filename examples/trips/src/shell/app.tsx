/**
 * The app: Jali's root with the app's chrome around the panes, the stop being dragged, and the toasts outside the
 * workspace (overlays).
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { runCommand, type Jali } from "jali-layout";
import { JaliRoot, JaliView, useJali } from "jali-layout/react";
import { ServicesProvider, type Services } from "../state/services";
import { useDrag } from "../ui/drag";
import { StatusLine } from "./status-line";
import { Toasts } from "./toasts";
import { TopBar } from "./top-bar";
import "./app.css";

export function App({ jali, services }: { jali: Jali; services: Services }) {
  return (
    <ServicesProvider services={services}>
      <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
        <TopBar />
        <AppKeys />
        <JaliView />
        <StatusLine />
        <DragGhost />
      </JaliRoot>
    </ServicesProvider>
  );
}

const typing = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true], dialog");

/**
 * Two keys that are the app's: "/" finds a place, and ⌘Z (Ctrl+Z) undoes the last change to the plan, except
 * while typing, where they belong to the field. Jali's keymap can't say "not in a text field", so they are bound
 * here rather than in `keymap` (FINDINGS.md). A pane's content sees every key first, so these run only for keys
 * nothing else took.
 */
function AppKeys() {
  const jali = useJali();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "/" && !mod && !e.altKey) {
        e.preventDefault();
        runCommand(jali, "trips.go");
      } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        runCommand(jali, "trips.undo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jali]);
  return null;
}

/** The stop in hand while dragging, under the pointer. */
function DragGhost() {
  const drag = useDrag();
  if (!drag) return null;
  return createPortal(
    <div
      className="drag-ghost"
      style={{ transform: `translate(${drag.x + 12}px, ${drag.y + 8}px)` }}
      aria-hidden
    >
      <span>{drag.label}</span>
      <span className="drag-ghost-to">
        {drag.over ? `to Day ${drag.over.day}` : "Drop on a day"}
      </span>
    </div>,
    document.body,
  );
}
