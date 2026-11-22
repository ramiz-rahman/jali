/**
 * Pop out (experimental, Chromium desktop): a pane's content in a floating window that stays on top of every other
 * window, as Google Meet's does, through the Document Picture-in-Picture API. The pane keeps its place in the layout,
 * showing "Popped out · Bring back"; its content renders into the floating window through a portal, so it keeps
 * Jali's context (data, hooks, actions). Closing the window brings it back.
 *
 * A prototype: the content remounts when it moves, so its own `useState` starts again (`usePaneState` and the app's
 * data cache carry over); Jali's keys don't work inside the floating window yet; and the window closes when the
 * page it came from navigates away.
 *
 * The browser's rules: Chrome keeps one floating window across all its tabs (another one closes this, and `pagehide`
 * brings the pane back), and on macOS the window doesn't appear over a full-screen app's Space. A bare Document
 * Picture-in-Picture window does the same (21 Nov 2026); a page can't change either.
 */
import type { Jali, NodeId } from "@jali/core";
import { allows, storeOf, type PopOutPort, type JaliStore } from "@jali/core/adapter";
import { useSyncExternalStore } from "react";

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

const api = () =>
  (globalThis as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

/** Whether this browser can pop a pane out (Chrome and Edge on desktop, 116 and later). */
export const canPopOut = () => typeof window !== "undefined" && !!api() && window.isSecureContext;

/** The pane popped out, and its window: one at a time, like the browser's own. Kept outside React state: a Window. */
let current: {
  store: JaliStore;
  pane: NodeId;
  win: Window;
  root: HTMLElement;
  off: () => void;
} | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Every style the page has, into the floating window's document, so the pane looks the same there. */
function copyStyles(from: Document, to: Document) {
  for (const sheet of from.styleSheets) {
    try {
      const css = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      const style = to.createElement("style");
      style.textContent = css;
      to.head.appendChild(style);
    } catch {
      // A cross-origin sheet: link it instead.
      if (sheet.href) {
        const link = to.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        to.head.appendChild(link);
      }
    }
  }
  // The page's theme and direction: data-theme, class, dir, lang on <html>.
  for (const a of from.documentElement.attributes)
    if (a.name === "class" || a.name.startsWith("data-") || a.name === "dir" || a.name === "lang")
      to.documentElement.setAttribute(a.name, a.value);
}

/**
 * Open a pane (default: the focused one) in a floating window that stays on top. Call it from a click or a key: the
 * browser asks for the person's gesture. Resolves `false` where the browser can't.
 */
export async function popOut(
  jali: Jali,
  target?: NodeId,
  size?: { width: number; height: number },
): Promise<boolean> {
  const pip = api();
  const store = storeOf(jali);
  const pane = target ?? store.get().view.focused;
  if (!pip || !pane || !store.model().pane(pane)) return false;
  // Off unless the app turns it on: `createJali({ allow: { popOut: true } })`.
  if (!allows(store.snapshot(), pane, "popOut")) {
    store.announce(store.messages.announcements.notAllowed("popOut", store.model().title(pane)));
    return false;
  }
  if (current) bringBack();
  const win = await pip.requestWindow({ width: size?.width ?? 480, height: size?.height ?? 360 });
  copyStyles(document, win.document);
  // The browser's zoom on the page (⌘+) doesn't carry into the window it opens: match it, and follow changes.
  const zoom = () => {
    const ratio = window.devicePixelRatio / (win.devicePixelRatio || 1);
    win.document.documentElement.style.zoom = Math.abs(ratio - 1) < 0.01 ? "" : String(ratio);
  };
  zoom();
  let media: MediaQueryList | null = null;
  const watchZoom = () => {
    media?.removeEventListener("change", onZoom);
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    media.addEventListener("change", onZoom);
  };
  const onZoom = () => {
    zoom();
    watchZoom();
  };
  watchZoom();
  win.addEventListener("resize", zoom);
  const root = win.document.createElement("div");
  root.className = "jali-popout";
  root.setAttribute("data-jali-popout", "");
  win.document.body.appendChild(root);
  win.document.title = store.model().title(pane);
  // The pane closing in the workspace closes its window.
  const unsubscribe = store.subscribe(() => {
    if (current?.win === win && !store.model().pane(pane)) bringBack();
  });
  const off = () => {
    unsubscribe();
    media?.removeEventListener("change", onZoom);
  };
  current = { store, pane, win, root, off };
  // The window's own close (its ×, or the page leaving) brings the pane back.
  win.addEventListener("pagehide", () => {
    if (current?.win === win) {
      current.off();
      current = null;
      changed();
    }
  });
  changed();
  return true;
}

/** Bring the popped-out pane back into its place, and close its window. */
export function bringBack() {
  const was = current;
  current = null;
  was?.off();
  changed();
  was?.win.close();
}

/** How @jali/react pops a pane out, for the core's "Pop out pane" command (`pane.pop_out`): each workspace gets it
 *  with React's DOM port (dom.ts), not as module state set when this file loads. */
export const reactPopOut: PopOutPort = { can: canPopOut, run: (jali, pane) => popOut(jali, pane) };

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const noSubscribe = () => () => {};

/** `canPopOut()` for rendering: false on a server and while hydrating, so the first render matches the server's. */
export const useCanPopOut = (): boolean =>
  useSyncExternalStore(noSubscribe, canPopOut, () => false);

/** Where pane `pane`'s content renders while popped out from `store`'s workspace, else null. */
export function usePopOutTarget(store: JaliStore, pane: NodeId): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => (current && current.store === store && current.pane === pane ? current.root : null),
    () => null,
  );
}
