/**
 * Keyboard layer (spec §14; docs/DECISIONS.md "Keyboard"). Content first:
 *
 * 1. Modal states claim keys before anyone (capture phase, only while active): the second step of a chord the
 *    person started (⌘K, then ⌘M); resize mode takes the arrows, Enter and Esc; a pointer drag in progress
 *    (workspace/dnd.ts, dividers/drag.ts) takes Esc to cancel itself.
 * 2. The focused content sees the key next. It claims a key with `event.preventDefault()` (or stops propagation),
 *    and the pane layer then leaves it alone. Single character keys, ⌘Z/Ctrl+Z, Enter, Space and the first Esc
 *    are the content's. Content that wants every key (an editor, a terminal) marks itself `data-pane-keys="content"`;
 *    only F6 / ⇧F6 still leave it, so focus is never trapped (WCAG 2.1.2).
 * 3. The pane layer (bubble phase, on window) acts on what is left: the keymap's bindings, then the Esc ladder
 *    (peek, then maximise). ⌘K opens the palette and starts a two-step chord (⌘K ⌘M); the second step keeps Mod
 *    held, so it never types into the palette.
 *
 * A matched command whose check refuses still takes the key and says why, if the refusal has a reason. Keyboard
 * actions never animate.
 */
import type { UiStore } from "../state/store";
import { isModifierKey, matchChord, type Chord } from "./format";
import { PALETTE_ID } from "./keymap";
import { commandById } from "./registry";
import { STEP, STEP_BIG } from "../dividers/resize";

const ARROWS: Record<string, "left" | "right" | "top" | "bottom"> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "top", ArrowDown: "bottom" };

/** Resize mode: arrows resize the nearest divider (Shift for bigger steps); Esc or Enter leaves. */
function resizeMode(store: UiStore, pane: string, e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
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

/** The Esc ladder after content: the peek, then maximise. (Modal states and drags took theirs in step 1.) */
function escape(store: UiStore): boolean {
  const s = store.get();
  if (s.dnd) return false;
  if (s.view.peek) store.actions.peek(null);
  else if (s.view.zoomed) store.actions.toggleZoom(s.view.zoomed);
  else return false;
  return true;
}

const dialogOpen = (store: UiStore) => {
  const s = store.get();
  return s.paletteOpen || s.settingsOpen || !!s.chooser;
};

const contentOwnsKeys = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('[data-pane-keys="content"]');

function run(store: UiStore, id: string): boolean {
  if (id === PALETTE_ID) {
    const s = store.get();
    store.set({ paletteOpen: !s.paletteOpen, chooser: null });
    return true;
  }
  const command = commandById(id);
  if (!command) return false;
  const refusal = command.check?.(store.snapshot());
  if (refusal?.msg) store.announce(refusal.msg);
  if (!refusal) command.run(store);
  return true;
}

export interface KeyHandler {
  /** Step 1: a chord's second step and modal states, before content (capture phase). Returns whether the key was taken. */
  capture(e: KeyboardEvent): boolean;
  /** Step 3: what content left (bubble phase). Returns whether the key was taken. */
  bubble(e: KeyboardEvent): boolean;
  /** The prefix chord waiting for its second step, if any. */
  pending(): Chord | null;
}

/** One handler per store: it holds the chord in progress, nothing global. */
export function createKeyHandler(store: UiStore): KeyHandler {
  let pending: Chord | null = null;
  const km = () => store.keymap;
  const matches = (e: KeyboardEvent) => (c: Chord) => matchChord(c, e, km().platform);

  return {
    pending: () => pending,
    capture(e) {
      if (isModifierKey(e)) return false;
      // The second step of a chord the person started on purpose: it comes before content (the palette the prefix
      // opened has focus). Any other key ends the wait and goes on as usual.
      const prefix = pending;
      pending = null;
      if (prefix) {
        const id = km().find(matches(e), prefix);
        if (id) {
          if (store.get().paletteOpen) store.set({ paletteOpen: false });
          run(store, id);
          return true;
        }
      }
      if (dialogOpen(store)) return false;
      const s = store.get();
      return !!s.resizeMode && resizeMode(store, s.resizeMode, e);
    },
    bubble(e) {
      if (isModifierKey(e) || e.defaultPrevented) return false;
      const m = matches(e);
      if (contentOwnsKeys(e.target)) {
        const id = km().find(m);
        return id === "pane.focus.next" || id === "pane.focus.previous" ? run(store, id) : false;
      }
      const id = km().find(m);
      // The palette chord works everywhere, dialogs included; otherwise an open dialog owns the keyboard.
      if (id === PALETTE_ID) {
        run(store, id);
        // Closing the palette with ⌘K ends the chord too.
        pending = store.get().paletteOpen ? km().isPrefix(m) ?? null : null;
        return true;
      }
      if (dialogOpen(store)) return false;
      if (e.key === "Escape" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) return escape(store);
      if (id) {
        run(store, id);
        pending = km().isPrefix(m) ?? null;
        return true;
      }
      const prefixOnly = km().isPrefix(m);
      if (prefixOnly) {
        pending = prefixOnly;
        return true;
      }
      return false;
    },
  };
}

export interface KeyboardScope {
  /** Where the listeners go. Default: window. */
  target?: Window;
  /**
   * The workspace's root element. Given, this workspace takes only keys from inside it, and keys with nothing focused
   * (the page body) while it was the last place focus was: two workspaces on one page never both act on a key.
   * Omitted, it takes every key on the page (one workspace per page).
   */
  root?: () => Element | null;
}

export function installKeyboard(store: UiStore, { target = window, root }: KeyboardScope = {}): () => void {
  const keys = createKeyHandler(store);
  let active = false;
  const mine = (e: KeyboardEvent) => {
    if (!root) return true;
    const el = root(), t = e.target as Node | null;
    if (!el) return false;
    if (t && el.contains(t)) return true;
    return active && (!t || t === target.document.body || t === target.document.documentElement);
  };
  // A click on something unfocusable inside the workspace counts as being there, as focus moving in does.
  const onFocus = (e: Event) => {
    const el = root?.();
    if (el) active = el.contains(e.target as Node);
  };
  const take = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onCapture = (e: KeyboardEvent) => {
    if (mine(e) && keys.capture(e)) take(e);
  };
  const onBubble = (e: KeyboardEvent) => {
    if (mine(e) && keys.bubble(e)) take(e);
  };
  target.addEventListener("keydown", onCapture, true);
  target.addEventListener("keydown", onBubble);
  if (root) {
    target.addEventListener("focusin", onFocus, true);
    target.addEventListener("pointerdown", onFocus, true);
  }
  return () => {
    target.removeEventListener("keydown", onCapture, true);
    target.removeEventListener("keydown", onBubble);
    target.removeEventListener("focusin", onFocus, true);
    target.removeEventListener("pointerdown", onFocus, true);
  };
}
