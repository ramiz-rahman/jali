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
    // draws (a sticky top bar of any z-index). Jali's dialogs move inside it meanwhile (JaliRoot). Jali touches the
    // browser's full screen only while it is its own, read from the document now: none, or one of its panes.
    const el = full ? store.dom.pane(full) : null;
    const now = document.fullscreenElement;
    if (now && !m.panes.some((p) => store.dom.pane(p.id) === now)) return;
    if (el && now !== el && el.requestFullscreen) {
      asked.current = true;
      // Refused while another of its panes is on the browser's whole screen (a switch from B to A): it leaves, and so
      // does Jali (`left`), so the two agree. Refused from none, the pane still covers the page, as where the browser
      // can't.
      el.requestFullscreen().catch(() => {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else asked.current = false;
      });
    } else if (!full && now) {
      asked.current = false;
      document.exitFullscreen?.().catch(() => {});
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
