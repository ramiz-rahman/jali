/**
 * `data-pressed` on Jali's controls while they are held down: by the pointer (the primary button), or by Space or Enter
 * while the control has focus. One listener set for the page (and one in each of an instance's surfaces' windows, such
 * as Pop out's), installed while any instance with the feature is started, so every control gets it the same way and
 * none has to know. Only the controls of those instances get it (in their root, their dialogs or a surface): never
 * another instance's, even one nested in their panes, and never the app's outside them. What a pane's content renders is in the root, so Jali's parts used there (an `<IconButton>`) get it too.
 * `:active` covers only the pointer; a theme that draws travel (a key going down) reads `[data-pressed]` and gets the
 * keyboard too.
 *
 * Jali's own styles don't read it, so the default look is unchanged.
 */

import type { Feature, JaliStore } from "@jali/core/adapter";

/** The controls that carry it: public parts (parts.ts lists `data-pressed` on each). */
export const PRESSABLE = [
  ".jali-pane-action",
  ".jali-icon-btn",
  ".jali-tab",
  ".jali-tab-close",
  ".jali-tab-putback",
  ".jali-tab-add",
  ".jali-tab-more",
  ".jali-tab-folded",
  ".jali-shelf-chip-main",
  ".jali-shelf-chip-put",
  ".jali-shelf-more",
  ".jali-shelf-menu-item",
  ".jali-follow-toggle",
  ".jali-switch-item",
  ".jali-page-tab",
  ".jali-dialog-button",
  "[data-menu-item]",
].join(", ");

/** The started instances with the feature, each with its count of starts: a control gets it only in one of theirs. */
const owners = new Map<JaliStore, number>();

/** `el` belongs to an instance with the feature: the nearest instance element around it (a root, a dialog layer or a
 *  surface such as Pop out's window) is one of theirs. Nearest, so an instance without it, inside a pane of one with
 *  it, keeps its controls unmarked. */
function owned(el: Element) {
  const near = el.closest("[data-jali], [data-jali-layer]");
  if (!near) return false;
  for (const store of owners.keys()) if (store.dom.isOwn(near)) return true;
  return false;
}

/** An element, from any window: `instanceof Element` is false for one in a floating window's document. */
const isElement = (t: EventTarget | null): t is Element =>
  !!t && (t as Node).nodeType === 1 && typeof (t as Element).closest === "function";

let held: Element | null = null;
/** What holds it: "pointer", or the key ("Enter", " "). */
let by: string | null = null;

function press(target: EventTarget | null, how: string) {
  const el = isElement(target) ? target.closest(PRESSABLE) : null;
  if (!el || el.matches(":disabled, [aria-disabled='true']") || !owned(el)) return;
  release();
  held = el;
  by = how;
  el.setAttribute("data-pressed", "");
}

function release(how?: string) {
  if (!held || (how !== undefined && how !== by)) return;
  held.removeAttribute("data-pressed");
  held = null;
  by = null;
}

const onPointerDown = (e: PointerEvent) => {
  if (e.button === 0 && e.isPrimary) press(e.target, "pointer");
};
const onPointerUp = () => release("pointer");
const onKeyDown = (e: KeyboardEvent) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat && !e.isComposing) press(e.target, e.key);
};
const onKeyUp = (e: KeyboardEvent) => release(e.key);
/** A key holds the control it was pressed on: focus leaving it lets go. (A pointer holds through focus moving.) */
const onFocusOut = (e: FocusEvent) => {
  if (by !== "pointer" && held && e.target && held.contains(e.target as Node)) release();
};
const onLost = () => release();

/** The windows listened in (the page's, and each surface's), each with how many asked. */
const listening = new Map<Window, number>();
/** Listens in `win` while anyone asks; returns the stop. */
function listen(win: Window): () => void {
  const n = listening.get(win) ?? 0;
  listening.set(win, n + 1);
  if (!n) {
    // Capture, so a control that stops its pointerdown (a tab's close button) is still marked.
    win.addEventListener("pointerdown", onPointerDown, true);
    win.addEventListener("pointerup", onPointerUp, true);
    win.addEventListener("pointercancel", onPointerUp, true);
    win.addEventListener("keydown", onKeyDown, true);
    win.addEventListener("keyup", onKeyUp, true);
    win.addEventListener("focusout", onFocusOut, true);
    win.addEventListener("blur", onLost);
  }
  let on = true;
  return () => {
    if (!on) return;
    on = false;
    const left = listening.get(win)! - 1;
    if (left) return void listening.set(win, left);
    listening.delete(win);
    win.removeEventListener("pointerdown", onPointerDown, true);
    win.removeEventListener("pointerup", onPointerUp, true);
    win.removeEventListener("pointercancel", onPointerUp, true);
    win.removeEventListener("keydown", onKeyDown, true);
    win.removeEventListener("keyup", onKeyUp, true);
    win.removeEventListener("focusout", onFocusOut, true);
    win.removeEventListener("blur", onLost);
  };
}

/** Installs the listeners for `store`: in the page (once, however many instances) and in each of its surfaces'
 *  windows while they are open. Returns the uninstall. */
export function installPressed(store: JaliStore): () => void {
  owners.set(store, (owners.get(store) ?? 0) + 1);
  const offPage = listen(window);
  const offSurfaces = store.dom.eachSurface((el) => {
    const win = el.ownerDocument.defaultView;
    return win && win !== window ? listen(win) : undefined;
  });
  let on = true;
  return () => {
    if (!on) return;
    on = false;
    offSurfaces();
    offPage();
    const n = owners.get(store)! - 1;
    if (n > 0) owners.set(store, n);
    else owners.delete(store);
    if (held && !owned(held)) release();
  };
}

/**
 * `pressed()`: `data-pressed` on Jali's controls while they are held, by pointer or key, for a theme that draws a key
 * going down. Jali's own styles don't read it.
 *
 *   createJali({ panes, layout, features: [pressed()] });
 */
export const pressed = (): Feature => ({ id: "pressed", start: installPressed });
