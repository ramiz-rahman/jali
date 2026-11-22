import { useEffect, useRef } from "react";
import type { JaliStore, ModelGeometry } from "@jali/core/adapter";
import { useUi } from "../state/react";

/**
 * Full screen: while a pane is on the whole screen (`actions.toggleFullScreen`), the page is in the browser's full
 * screen, so the pane (fixed over the window) covers the display. Leaving the browser's full screen (Escape, the
 * browser's own controls) leaves Jali's too. Where the browser can't (an iPhone), the pane still covers the page.
 */
export function useFullScreen(store: JaliStore, m: ModelGeometry) {
  const full = useUi((s) => s.fullScreen);
  const asked = useRef(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    // The pane itself is the browser's full-screen element: the browser then shows only it, over anything the host
    // draws (a sticky top bar of any z-index). Jali's dialogs move inside it meanwhile (JaliRoot).
    const el = full ? store.dom.pane(full) : null;
    if (el && !document.fullscreenElement && el.requestFullscreen) {
      asked.current = true;
      el.requestFullscreen().catch(() => (asked.current = false));
    } else if (!full && asked.current) {
      asked.current = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [full]);
  useEffect(() => {
    const left = () => {
      if (!document.fullscreenElement && asked.current && store.get().fullScreen) {
        asked.current = false;
        store.actions.toggleFullScreen();
      }
    };
    document.addEventListener("fullscreenchange", left);
    return () => document.removeEventListener("fullscreenchange", left);
  }, [store]);
  // The pane closed while on the whole screen.
  useEffect(() => {
    if (full && !m.pane(full)) store.set({ fullScreen: undefined });
  });
}
