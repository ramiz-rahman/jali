/**
 * `popOut()`: a pane's content in a floating window that stays on top of every other window, as a video call's does,
 * through Document Picture-in-Picture (Chrome and Edge on desktop, 116 and later).
 *
 *   createJali({ panes, layout, features: [...defaultFeatures(), popOut()] });
 *
 * The window is the workspace's own: one per instance, kept by this feature's window (no module state), closed when
 * the workspace stops (its `<JaliRoot>` unmounts, `destroy()`, another workspace takes the root). The pane keeps its
 * place, showing "Popped out into its own window" with Bring back.
 *
 * - **State survives:** each pane's content renders once into an element of its own (pane/content.tsx); popping out
 *   moves that element into the window, and bringing back moves it home. React's portal target never changes, so the
 *   component, its own `useState`, its subscriptions and its DOM stay. (A workspace that hydrated a server's HTML keeps
 *   content in its frames: there the content renders again in the window.) Iframes and media reload when moved.
 * - **Keys:** Jali's keys work in the window: its keyboard is installed there too, and every key pressed in the window
 *   counts as this workspace's, whatever `keyboard.scope`.
 * - **Looks:** the window gets the page's stylesheets, and keeps the workspace's theme, `--jali-*` tokens, direction
 *   and the page's zoom while it is open; its root carries `[data-jali]`.
 *
 * The browser's rules: Chrome keeps one floating window across all its tabs (another one closes this, and the pane
 * comes back), and on macOS the window doesn't appear over a full-screen app's Space.
 */
import type { NodeId } from "@jali/core";
import {
  allows,
  installKeyboard,
  popOutFeature,
  resolveTheme,
  spacingVars,
  trackInput,
  type Feature,
  type JaliStore,
  type PopOutWindow,
} from "@jali/core/adapter";

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

const api = () =>
  (globalThis as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

/** Whether this browser can pop a pane out. */
const can = () => typeof window !== "undefined" && !!api() && window.isSecureContext;

/** React's window: core's `PopOutWindow`, and what the chrome reads to draw a popped-out pane. */
export interface ReactPopOut extends PopOutWindow {
  /** Told whenever a pane pops out or comes back. */
  subscribe(fn: () => void): () => void;
  /** Where pane `pane`'s content renders while popped out of a workspace that renders it in its frame (hydrated);
   *  null otherwise. */
  target(store: JaliStore, pane: NodeId): HTMLElement | null;
}

interface Session {
  pane: NodeId;
  win: Window;
  /** The window's root (`[data-jali]`). */
  root: HTMLElement;
  /** The pane's content element, moved into the window; null when the content renders there instead (hydrated). */
  moved: HTMLElement | null;
  off: () => void;
}

/** Every style the page has, into the floating window's document, so the pane looks the same there. */
function copyStyles(from: Document, to: Document) {
  for (const sheet of from.styleSheets) {
    try {
      const style = to.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      if (sheet.media.mediaText) style.media = sheet.media.mediaText;
      to.head.appendChild(style);
    } catch {
      // A cross-origin sheet: link it instead.
      if (sheet.href) {
        const link = to.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        if (sheet.media.mediaText) link.media = sheet.media.mediaText;
        to.head.appendChild(link);
      }
    }
  }
}

/** A pane's content element (pane/content.tsx marks it), if the workspace renders content apart from its frames. */
const hostOf = (store: JaliStore, pane: NodeId) =>
  store.dom.pane(pane)?.querySelector<HTMLElement>(".jali-pane-content > [data-jali-host]") ??
  null;

/** One window per workspace: the sessions of the workspaces this feature value is given to. */
function createWindow(): ReactPopOut {
  const sessions = new WeakMap<JaliStore, Session>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());
  /** Requests still waiting for the browser, by workspace: a newer one makes an older one stale. */
  const asking = new WeakMap<JaliStore, number>();

  const end = (store: JaliStore, s: Session) => {
    if (sessions.get(store) !== s) return;
    sessions.delete(store);
    s.off();
    // The content comes home now; its frame takes it back on its next render too.
    const home = store.dom.pane(s.pane)?.querySelector(".jali-pane-content");
    if (s.moved && home) home.append(s.moved);
    changed();
  };

  const self: ReactPopOut = {
    can,
    pane: (store) => sessions.get(store)?.pane,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    target: (store, pane) => {
      const s = sessions.get(store);
      return s && s.pane === pane && !s.moved ? s.root : null;
    },
    close(store) {
      const s = sessions.get(store);
      if (!s) return;
      end(store, s);
      s.win.close();
    },
    async open(store, pane) {
      const pip = api();
      if (!pip || !can() || !store.model().pane(pane)) return false;
      if (!allows(store.snapshot(), pane, "popOut")) {
        store.announce(
          store.messages.announcements.notAllowed("popOut", store.model().title(pane)),
        );
        return false;
      }
      const mine = (asking.get(store) ?? 0) + 1;
      asking.set(store, mine);
      let win: Window;
      try {
        // Asked at once, inside the person's gesture; the browser refuses without one.
        win = await pip.requestWindow({ width: 480, height: 360 });
      } catch {
        return false;
      }
      // Stale: a newer request, the pane gone, or the workspace stopped while the browser answered.
      if (asking.get(store) !== mine || !store.model().pane(pane) || !started.has(store)) {
        if (pip.window === win) win.close();
        return false;
      }
      self.close(store);
      return attach(store, pane, win);
    },
  };

  /** The workspaces started with this feature: a request that resolves after its workspace stopped is dropped. */
  const started = new WeakSet<JaliStore>();

  function attach(store: JaliStore, pane: NodeId, win: Window): boolean {
    const doc = win.document;
    copyStyles(document, doc);
    const root = doc.createElement("div");
    root.className = "jali-popout";
    root.setAttribute("data-jali", "");
    root.setAttribute("data-jali-popout", "");
    doc.body.appendChild(root);

    // The workspace's look, kept in step while the window is open: <html>'s attributes (a host's theme class), the
    // root's theme, tokens and direction, and the page's zoom.
    const page = document.documentElement;
    const sync = () => {
      for (const a of Array.from(doc.documentElement.attributes))
        if (a.name !== "style") doc.documentElement.removeAttribute(a.name);
      for (const a of page.attributes)
        if (a.name === "class" || a.name.startsWith("data-") || a.name === "dir" || a.name === "lang")
          doc.documentElement.setAttribute(a.name, a.value);
      const el = store.dom.root();
      const from = el instanceof HTMLElement ? el : null;
      const s = store.get();
      const theme =
        from?.getAttribute("data-theme") ??
        (store.env.pageTheme === false ? null : resolveTheme(s.settings.theme, s.systemDark));
      if (theme) root.setAttribute("data-theme", theme);
      else root.removeAttribute("data-theme");
      root.setAttribute("dir", store.env.dir ?? s.dir);
      root.style.cssText = "";
      for (const [k, v] of Object.entries(spacingVars(store.env.spacing)))
        root.style.setProperty(k, v);
      if (from)
        for (const k of from.style)
          if (k.startsWith("--jali-")) root.style.setProperty(k, from.style.getPropertyValue(k));
      doc.title = store.model().title(pane);
      const ratio = window.devicePixelRatio / (win.devicePixelRatio || 1);
      doc.documentElement.style.zoom = Math.abs(ratio - 1) < 0.01 ? "" : String(ratio);
    };
    sync();
    const watch =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(() => sync());
    watch?.observe(page, { attributes: true });
    const rootEl = store.dom.root();
    if (rootEl instanceof Element)
      watch?.observe(rootEl, { attributes: true, attributeFilter: ["style", "data-theme", "dir"] });
    let media: MediaQueryList | null = null;
    const onZoom = () => {
      sync();
      media?.removeEventListener("change", onZoom);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener("change", onZoom);
    };
    onZoom();
    win.addEventListener("resize", sync);

    // The content: its own element moved here (it keeps its state), else rendered here (`target`).
    const moved = hostOf(store, pane);
    if (moved) root.appendChild(moved);

    // Jali's keys, and a person's input, in the window too: every key there is this workspace's.
    const offKeys = installKeyboard(store, { target: win, root: () => doc.documentElement });
    const offInput = trackInput(doc);

    const session: Session = {
      pane,
      win,
      root,
      moved,
      off: () => {
        offStore();
        offKeys();
        offInput();
        watch?.disconnect();
        media?.removeEventListener("change", onZoom);
        win.removeEventListener("resize", sync);
      },
    };
    // The pane leaving the workspace closes its window; its title, theme and settings follow.
    const offStore = store.subscribe(() => {
      if (sessions.get(store) !== session) return;
      if (!store.model().pane(pane)) self.close(store);
      else sync();
    });
    // The window's own close (its ×, another floating window, the page leaving) brings the pane back.
    win.addEventListener("pagehide", () => end(store, session));
    sessions.set(store, session);
    changed();
    return true;
  }

  return Object.assign(self, {
    started: (store: JaliStore) => {
      started.add(store);
      return () => {
        started.delete(store);
        self.close(store);
      };
    },
  });
}

/** Pop out, for `createJali({ features })`. Off for a kind with `allow: { popOut: false }`, or a workspace with
 *  `allow: { popOut: false }`. */
export function popOut(): Feature {
  const win = createWindow() as ReactPopOut & { started(store: JaliStore): () => void };
  return { ...popOutFeature(win), start: (store) => win.started(store) };
}
