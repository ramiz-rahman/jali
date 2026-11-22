/**
 * `popOut()`: a pane's content in a floating window that stays on top of every other window, as a video call's does,
 * through Document Picture-in-Picture (Chrome and Edge on desktop, 116 and later).
 *
 *   createJali({ panes, layout, features: [...defaultFeatures(), popOut()] });
 *
 * The window is the instance's own: one per instance, kept by this feature's window (no module state), closed when
 * the instance stops (its `<JaliRoot>` unmounts, `destroy()`, another instance takes the root). The pane keeps its
 * place, showing "Popped out into its own window" with Bring back.
 *
 * - **State survives:** each pane's content renders once into an element of its own (pane/content.tsx); popping out
 *   moves that element into the window, and bringing back moves it home. React's portal target never changes, so the
 *   component, its own `useState`, its subscriptions and its DOM stay. (An instance that hydrated a server's HTML keeps
 *   content in its frames: there the content renders again in the window.) Iframes and media reload when moved.
 * - **Keys:** Jali's keys work in the window: its keyboard is installed there too, and every key pressed in the window
 *   counts as this instance's, whatever `keyboard.scope`.
 * - **Looks:** the window gets the page's stylesheets, and keeps the instance's theme, `--jali-*` tokens, direction
 *   and the page's zoom while it is open; its root carries `[data-jali]`.
 *
 * The browser's rules: Chrome keeps one floating window across all its tabs (another one closes this, and the pane
 * comes back), and on macOS the window doesn't appear over a full-screen app's Space.
 */
import type { NodeId } from "@jali/core";
import type { ReactParts } from "./feature-parts";
import {
  allows,
  installKeyboard,
  popOutFeature,
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
  /** Where pane `pane`'s content renders while popped out of an instance that renders it in its frame (hydrated);
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

/** An instance's place in this feature: started (a request that resolves after its instance stopped is dropped),
 *  its latest request (a newer one, or the instance stopping, makes an older one stale), and its window, if one is
 *  open. */
interface Slot {
  on: boolean;
  asked: number;
  s?: Session;
}

/** Every style the page has, into the floating window's document, so the pane looks the same there: each sheet's
 *  rules, or a link to it when it is cross-origin. */
function copyStyles(from: Document, to: Document) {
  for (const sheet of from.styleSheets) {
    let el: HTMLStyleElement | HTMLLinkElement;
    try {
      el = to.createElement("style");
      el.textContent = Array.from(sheet.cssRules, (r) => r.cssText).join("\n");
    } catch {
      if (!sheet.href) continue;
      el = Object.assign(to.createElement("link"), { rel: "stylesheet", href: sheet.href });
    }
    el.media = sheet.media.mediaText;
    to.head.append(el);
  }
}

/** One window per instance: the slots of the instances this feature value is given to. */
function createWindow(): ReactPopOut & { started(store: JaliStore): () => void } {
  const slots = new WeakMap<JaliStore, Slot>();
  const slot = (store: JaliStore) => {
    let x = slots.get(store);
    if (!x) slots.set(store, (x = { on: false, asked: 0 }));
    return x;
  };
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());

  /** The window is gone (closed by us, its own ×, another floating window): the content comes home now, and its
   *  frame takes it back on its next render too. */
  const end = (store: JaliStore, s: Session) => {
    const x = slot(store);
    if (x.s !== s) return;
    x.s = undefined;
    s.off();
    if (s.moved) store.dom.pane(s.pane)?.querySelector(".jali-pane-content")?.append(s.moved);
    changed();
  };

  const self = {
    can,
    pane: (store: JaliStore) => slot(store).s?.pane,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    target: (store: JaliStore, pane: NodeId) => {
      const s = slot(store).s;
      return s?.pane === pane && !s.moved ? s.root : null;
    },
    close(store: JaliStore) {
      const s = slot(store).s;
      if (!s) return;
      end(store, s);
      s.win.close();
    },
    started(store: JaliStore) {
      slot(store).on = true;
      return () => {
        const x = slot(store);
        x.on = false;
        // A request still waiting on the browser is stale, even if the instance starts again before it answers.
        x.asked++;
        self.close(store);
      };
    },
    async open(store: JaliStore, pane: NodeId) {
      const pip = api();
      if (!pip || !can() || !store.model().pane(pane)) return false;
      if (!allows(store.snapshot(), pane, "popOut")) {
        store.announce(
          store.messages.announcements.notAllowed("popOut", store.model().title(pane)),
        );
        return false;
      }
      const x = slot(store);
      const mine = ++x.asked;
      let win: Window;
      try {
        // Asked at once, inside the person's gesture; the browser refuses without one.
        win = await pip.requestWindow({ width: 480, height: 360 });
      } catch {
        return false;
      }
      // Stale: a newer request, the pane gone, or the instance stopped while the browser answered.
      if (x.asked !== mine || !x.on || !store.model().pane(pane)) {
        win.close();
        return false;
      }
      self.close(store);
      x.s = attach(store, pane, win);
      changed();
      return true;
    },
  };

  function attach(store: JaliStore, pane: NodeId, win: Window): Session {
    const doc = win.document;
    const html = doc.documentElement;
    copyStyles(document, doc);
    const root = doc.createElement("div");
    root.className = "jali-popout";
    root.setAttribute("data-jali", "");
    root.setAttribute("data-jali-popout", "");
    doc.body.append(root);

    // The instance's look, kept in step while the window is open: <html>'s attributes (a host's theme class), the
    // root's theme, tokens and direction, its title, and the page's zoom (the browser's ⌘+ doesn't carry over).
    const page = document.documentElement;
    const sync = () => {
      for (const a of Array.from(html.attributes))
        if (a.name !== "style") html.removeAttribute(a.name);
      for (const a of page.attributes)
        if (/^(class|dir|lang|data-.*)$/.test(a.name)) html.setAttribute(a.name, a.value);
      // The root's data-theme is Jali's resolved theme (or the app's own), and none with `pageTheme: false`.
      const el = store.dom.root() as HTMLElement;
      const theme = el.getAttribute?.("data-theme");
      if (theme) root.setAttribute("data-theme", theme);
      else root.removeAttribute("data-theme");
      root.dir = store.env.dir ?? store.get().dir;
      root.style.cssText = "";
      const vars: Record<string, string> = { ...spacingVars(store.env.spacing) };
      for (const k of el.style ?? [])
        if (k.startsWith("--jali-")) vars[k] = el.style.getPropertyValue(k);
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      doc.title = store.model().title(pane);
      const ratio = window.devicePixelRatio / (win.devicePixelRatio || 1);
      html.style.zoom = Math.abs(ratio - 1) < 0.01 ? "" : String(ratio);
    };
    sync();
    const watch = new MutationObserver(sync);
    watch.observe(page, { attributes: true });
    const rootEl = store.dom.root();
    if (rootEl instanceof Element)
      watch.observe(rootEl, { attributes: true, attributeFilter: ["style", "data-theme", "dir"] });
    let media: MediaQueryList | undefined;
    const onZoom = () => {
      sync();
      media?.removeEventListener("change", onZoom);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      media.addEventListener("change", onZoom);
    };
    onZoom();
    win.addEventListener("resize", sync);

    // The content: its own element moved here, so it keeps its state (pane/content.tsx marks it); else rendered here
    // (`target`), in an instance that hydrated a server's HTML.
    const moved =
      store.dom.pane(pane)?.querySelector<HTMLElement>(".jali-pane-content > [data-jali-host]") ??
      null;
    if (moved) root.append(moved);

    // Jali's keys, and a person's input, in the window too: every key pressed there is this instance's.
    const offKeys = installKeyboard(store, { target: win, root: () => html });
    const offInput = trackInput(doc);
    // The window is one of the instance's surfaces: what is in it is the instance's, and features that listen on each
    // surface's window (pressed()) listen there too.
    const offSurface = store.dom.addSurface(root);
    // The pane leaving the instance closes its window; its title, theme and settings follow.
    const offStore = store.subscribe(() => (store.model().pane(pane) ? sync() : self.close(store)));
    const s: Session = {
      pane,
      win,
      root,
      moved,
      off: () => {
        offSurface();
        offStore();
        offKeys();
        offInput();
        watch.disconnect();
        media?.removeEventListener("change", onZoom);
      },
    };
    // The window's own close (its ×, another floating window, the page leaving) brings the pane back.
    win.addEventListener("pagehide", () => end(store, s));
    return s;
  }

  return self;
}

/** Pop out, for `createJali({ features })`. Off for a kind with `allow: { popOut: false }`, or an instance with
 *  `allow: { popOut: false }`. */
export function popOut(): Feature {
  const win = createWindow();
  return {
    ...popOutFeature(win, { popOut: win } satisfies Pick<ReactParts, "popOut">),
    start: win.started,
  };
}
