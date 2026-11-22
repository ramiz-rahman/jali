/**
 * `data-pressed` on Jali's controls while they are held down: by the pointer (the primary button), or by Space or Enter
 * while the control has focus. One listener set for the page, installed while any instance with the feature is started, so every
 * control gets it the same way and none has to know; only the controls of those instances get it (in their root or
 * their dialogs), never another instance's or the app's own. `:active` covers only the pointer; a theme that draws travel
 * (a key going down) reads `[data-pressed]` and gets the keyboard too.
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

/** `el` is in an instance's root (once one is attached) or its dialogs. */
function owned(el: Element) {
  for (const store of owners.keys()) {
    const root = store.dom.root();
    if ((root instanceof Element && root.contains(el)) || store.dom.layer()?.contains(el))
      return true;
  }
  return false;
}

let held: Element | null = null;
/** What holds it: "pointer", or the key ("Enter", " "). */
let by: string | null = null;

function press(target: EventTarget | null, how: string) {
  const el = target instanceof Element ? target.closest(PRESSABLE) : null;
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
  if (by !== "pointer" && held && e.target instanceof Node && held.contains(e.target)) release();
};
const onLost = () => release();

/** Installs the listeners for `store` (once for the page, however many instances); returns the uninstall. */
export function installPressed(store: JaliStore): () => void {
  owners.set(store, (owners.get(store) ?? 0) + 1);
  if (owners.size === 1 && owners.get(store) === 1) {
    // Capture, so a control that stops its pointerdown (a tab's close button) is still marked.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("blur", onLost);
  }
  let on = true;
  return () => {
    if (!on) return;
    on = false;
    const n = owners.get(store)! - 1;
    if (n > 0) return void owners.set(store, n);
    owners.delete(store);
    if (held && !owned(held)) release();
    if (owners.size > 0) return;
    release();
    window.removeEventListener("pointerdown", onPointerDown, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("focusout", onFocusOut, true);
    window.removeEventListener("blur", onLost);
  };
}

/**
 * `pressed()`: `data-pressed` on Jali's controls while they are held, by pointer or key, for a theme that draws a key
 * going down. Jali's own styles don't read it.
 *
 *   createJali({ panes, layout, features: [pressed()] });
 */
export const pressed = (): Feature => ({ id: "pressed", start: installPressed });
