/**
 * The keys that belong to the app, not to a pane or to Jali: Space plays and pauses, and "/" goes to a segment.
 *
 * Who gets Space, in order:
 *  1. The focused content, first (Jali's rule). A pane that wants Space claims it with `preventDefault()`; none of
 *     Studio's do, so a key pressed in the transcript, the library or a fader comes here.
 *  2. A text field keeps it (it types a space), and so does a control that Space presses for a keyboard user: a
 *     button, a tab, a checkbox, a menu item. Jali's tabs and header buttons are such controls. Studio's own toolbar
 *     buttons don't take focus on a click (ui/atoms/Key.tsx), so after a click Space still plays.
 *  3. Jali's dialogs (⌘K, the chooser, "Discard unsaved changes?") keep it.
 *  4. Everything else: the transport.
 *
 * Jali binds no single keys, so nothing of Jali's has to move; `keyboard: { reserved: ["Space"] }`
 * (workspace/createStudioJali.ts) keeps it so.
 * The peek, which Jali's lists put on Space by convention, moved to Shift+Space in Studio's lists.
 */
import { useEffect } from "react";
import { keyBelongsToContent, runCommand, type Jali } from "jali-layout";
import type { Engine } from "../audio/engine";
import { plain } from "../ui/lib/input";

const TYPING =
  'input:not([type="range"]), textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"]';
const DIALOG = 'dialog, [role="dialog"], [role="alertdialog"]';

/** Whether this keydown should play or pause the transport. */
export function spaceForTransport(e: KeyboardEvent): boolean {
  if (e.key !== " " || e.defaultPrevented || !plain(e) || e.shiftKey || e.repeat) return false;
  return !keyBelongsToContent(e);
}

/** Whether this keydown should open "Go to segment…". */
export function slashForSearch(e: KeyboardEvent): boolean {
  if (e.key !== "/" || e.defaultPrevented || !plain(e)) return false;
  const t = e.target instanceof Element ? e.target : null;
  return !t?.closest(`${TYPING}, ${DIALOG}`);
}

/** Listens for the app's keys on the window, in the bubble phase: the focused content has had each key first. */
export function useAppKeys(jali: Jali, engine: Engine) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (spaceForTransport(e)) {
        e.preventDefault();
        engine.toggle();
      } else if (slashForSearch(e)) {
        e.preventDefault();
        runCommand(jali, "studio.segment");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jali, engine]);
}
