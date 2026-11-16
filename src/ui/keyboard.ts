/**
 * Keyboard layer (spec §14). Listens on window in the capture phase and matches on `code` (⌥ changes `key` on Mac).
 * ⌘ on Mac is Ctrl elsewhere. Keyboard actions never animate.
 */
import type { Edge } from "../layout-core/types";
import { actions, getState, hooks, setState } from "./store";
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

  if (e.key === "F6") {
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

  // ⌘Z restores the last closed pane (text fields keep their own undo).
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
    if (e.code === "KeyM" && !e.shiftKey) return runCommand("pane.minimise") || true;
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
