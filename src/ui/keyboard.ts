/**
 * Keyboard layer (spec §14). Listens on window in the capture phase and matches on `code` (⌥ changes `key` on Mac).
 * ⌘ on Mac is Ctrl elsewhere. Keyboard actions never animate.
 */
import type { Edge } from "../layout-core/types";
import { context, actions, getState, hooks, setState, visiblePaneIds } from "./store";
import { core } from "./core";
import { runCommand } from "./commands";
import { cancelActiveDrag } from "./dnd";
import { nearestDivider, STEP, STEP_BIG } from "./dividers/DividerLayer";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const ARROWS: Record<string, Edge> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" };
const WORD: Record<Edge, string> = { left: "left", right: "right", top: "up", bottom: "down" };

function editable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function handleKey(e: KeyboardEvent): boolean {
  const s = getState();
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const alt = e.altKey;

  // ⌘K palette works everywhere.
  if (mod && !alt && !e.shiftKey && e.code === "KeyK") {
    setState({ paletteOpen: !s.paletteOpen, chooser: null });
    return true;
  }
  if (s.paletteOpen || s.settingsOpen || s.chooser) return false; // dialogs own the keyboard

  // Resize mode: arrows resize the nearest divider; Esc or Enter leaves.
  if (s.resizeMode && !mod && !alt) {
    if (e.key === "Escape" || e.key === "Enter") {
      setState({ resizeMode: null });
      hooks.announce("Resize mode off");
      return true;
    }
    const dir = ARROWS[e.key];
    if (dir) {
      const horizontal = dir === "left" || dir === "right";
      const nd = nearestDivider(s.resizeMode, horizontal);
      if (nd) {
        const step = e.shiftKey ? STEP_BIG : STEP;
        const sign = dir === "right" || dir === "bottom" ? 1 : -1;
        actions.resizeDivider(nd.d.parentId, nd.d.index, sign * step);
      }
      return true;
    }
  }

  // F6 visits every pane, then the shelf (when shown), then wraps.
  if (e.key === "F6") {
    const shelf = typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-shelf]") : null;
    const shelfShown = !!shelf && shelf.getClientRects().length > 0; // folded away on a phone
    const order = visiblePaneIds();
    const inShelf = shelfShown && !!shelf && !!(document.activeElement && shelf.contains(document.activeElement));
    if (shelf && shelfShown && inShelf) {
      const id = e.shiftKey ? order.at(-1) : order[0];
      if (id) actions.afterFocusMove(core.focus(s.view, id, context()));
      return true;
    }
    const at = order.indexOf(s.view.focused ?? "");
    if (shelf && shelfShown && at >= 0 && (e.shiftKey ? at === 0 : at === order.length - 1)) {
      (shelf.querySelector<HTMLElement>('.shelf-chip-main[tabindex="0"]') ?? shelf).focus();
      hooks.announce("Shelf");
      return true;
    }
    actions.focusCycle(e.shiftKey ? -1 : 1);
    return true;
  }

  if (e.key === "Escape") {
    if (cancelActiveDrag()) return true;
    if (s.view.peek) {
      actions.peek(null);
      return true;
    }
    if (s.view.zoomed) {
      actions.toggleZoom(s.view.zoomed);
      return true;
    }
    return false;
  }

  // ⇧⌘↵ maximise / restore
  if (mod && e.shiftKey && !alt && e.key === "Enter") return runCommand("pane.zoom") || true;

  // ⌘Z undoes the last close or tuck (text fields keep their own undo).
  if (mod && !alt && !e.shiftKey && e.code === "KeyZ" && !editable(e.target)) {
    actions.undoClose();
    return true;
  }

  if (alt && !mod && !e.ctrlKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
    actions.focusIndex(Number(e.code.slice(5)));
    return true;
  }

  if (alt && mod) {
    const dir = ARROWS[e.key];
    if (dir) {
      if (e.shiftKey) runCommand(`pane.move.${WORD[dir]}`);
      else actions.focusDirection(dir);
      return true;
    }
    if (e.code === "Backslash") return runCommand(e.shiftKey ? "pane.split.down" : "pane.split.right") || true;
    // ⌥⌘M tucks the focused pane into its home (focus follows); ⌥⇧⌘M puts back the focused tucked tab, else the latest.
    if (e.code === "KeyM") {
      if (e.shiftKey) actions.putBack();
      else actions.tuck();
      return true;
    }
    if (e.code === "KeyR" && !e.shiftKey) return runCommand("pane.resize_mode") || true;
    if (e.code === "KeyW" && !e.shiftKey) return runCommand("pane.close") || true;
    // ⌥⌘T adds the pane to another pane's tabs (a chooser); ⌥⇧⌘T moves a tab out of its stack.
    if (e.code === "KeyT") return runCommand(e.shiftKey ? "pane.unmerge" : "pane.merge") || true;
  }
  return false;
}

export function installKeyboard() {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (handleKey(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
}
