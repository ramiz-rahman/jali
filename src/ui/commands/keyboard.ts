/**
 * Keyboard layer (spec §14). Listens on window in the capture phase. ⌘K works everywhere; otherwise dialogs own the
 * keyboard. Three modal handlers come first (resize mode, F6 into the shelf, the Escape chain); every other key is
 * looked up in the command registry. A matched command whose check refuses still takes the key, and says why if
 * the refusal has a reason. Keyboard actions never animate.
 */
import { focusInShelf, focusShelf, shownShelf } from "../dom/focus";
import { msg } from "../state/messages";
import type { UiStore } from "../state/store";
import { isMac, matchChord, PALETTE_CHORD } from "./format";
import { commandForKey } from "./registry";
import { STEP, STEP_BIG } from "../dividers/resize";

const ARROWS: Record<string, "left" | "right" | "top" | "bottom"> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" };

/** Resize mode: arrows resize the nearest divider (Shift for bigger steps); Esc or Enter leaves. */
function resizeMode(store: UiStore, pane: string, e: KeyboardEvent): boolean {
  if ((isMac ? e.metaKey : e.ctrlKey) || e.altKey) return false;
  if (e.key === "Escape" || e.key === "Enter") {
    store.actions.leaveResizeMode();
    return true;
  }
  const dir = ARROWS[e.key];
  if (!dir) return false;
  const step = (e.shiftKey ? STEP_BIG : STEP) * (dir === "right" || dir === "bottom" ? 1 : -1);
  store.actions.nudgeDivider(pane, dir === "left" || dir === "right", step);
  return true;
}

/** F6 visits every pane, then the shelf (when shown), then wraps. */
function f6(store: UiStore, back: boolean): boolean {
  const shelf = shownShelf();
  const { s, m } = store.snapshot();
  if (shelf && focusInShelf(shelf)) {
    store.actions.focusEnd(back);
    return true;
  }
  const at = m.visible.indexOf(s.view.focused ?? "");
  if (shelf && at >= 0 && (back ? at === 0 : at === m.visible.length - 1)) {
    focusShelf(shelf);
    store.announce(msg.shelf);
    return true;
  }
  store.actions.focusCycle(back ? -1 : 1);
  return true;
}

/** Escape closes the innermost thing: a pane drag cancels itself (dnd.ts), then the peek, then zoom. */
function escape(store: UiStore): boolean {
  const s = store.get();
  if (s.dnd) return false;
  if (s.view.peek) store.actions.peek(null);
  else if (s.view.zoomed) store.actions.toggleZoom(s.view.zoomed);
  else return false;
  return true;
}

export function handleKey(store: UiStore, e: KeyboardEvent): boolean {
  const s = store.get();
  if (matchChord(PALETTE_CHORD, e)) {
    store.set({ paletteOpen: !s.paletteOpen, chooser: null });
    return true;
  }
  if (s.paletteOpen || s.settingsOpen || s.chooser) return false;
  if (s.resizeMode && resizeMode(store, s.resizeMode, e)) return true;
  if (e.key === "F6") return f6(store, e.shiftKey);
  if (e.key === "Escape") return escape(store);
  const command = commandForKey(e);
  if (!command) return false;
  const refusal = command.check?.(store.snapshot());
  if (refusal?.msg) store.announce(refusal.msg);
  if (!refusal) command.run(store);
  return true;
}

export function installKeyboard(store: UiStore): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (handleKey(store, e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
