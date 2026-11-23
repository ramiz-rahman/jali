/**
 * One rename session: the field's text, whether the app is saving it, and the two ways it ends (saved, or kept as it
 * was). The session is the field's own. A field is on screen only while its pane is the one being renamed, so once it
 * unmounts its session is over: a save that settles after that ends nothing, focuses nothing and marks nothing.
 * The field only draws it (RenameField.tsx). Only the field imports this, so an instance without `rename()` ships none.
 */
import type { NodeId } from "@jali/core";
import { cssString, paneDomId } from "@jali/core/adapter";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/react";

export function useRenameSession(pane: NodeId, title: string) {
  const store = useStore();
  const [value, setText] = useState(title);
  // The object this session began on: the core ends it when the pane shows another, and a save goes to this one.
  const [began] = useState(() => store.model().pane(pane)?.ref);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Live from mount to end: ended by Enter, Esc or a save, or by the field leaving the screen.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      // Still live as the field goes: the core ended it (its object changed), so focus returns to the pane.
      if (live.current) refocus();
      live.current = false;
    };
  }, []);

  /** Puts focus back on the tab (or the pane), into the gap the field left. */
  const refocus = () =>
    requestAnimationFrame(() => {
      // Only into the gap the field left: focus the person (or a field opened since) put elsewhere stays there.
      const at = document.activeElement;
      if (store.ended() || (at && at !== document.body)) return;
      (
        store.dom.root().querySelector<HTMLElement>(`[role="tab"][data-tab=${cssString(pane)}]`) ??
        document.getElementById(paneDomId(store.dom.id, pane))
      )?.focus({ preventScroll: true });
    });

  /** Ends the session, focusing the tab (or the pane) again when it ended from the keyboard. */
  const end = (focus: boolean) => {
    if (!live.current) return;
    live.current = false;
    store.actions.endRename(pane);
    if (focus) refocus();
  };

  /** Saves the text through the app's `rename.run`; an empty or unchanged name ends the session saving nothing. */
  const save = async (refocus: boolean, input: HTMLInputElement | null) => {
    if (busy || !live.current) return;
    const text = value.trim();
    if (!text || text === title || !began || !store.env.rename) return end(refocus);
    setBusy(true);
    let saved: boolean;
    try {
      saved = (await store.env.rename.run({ id: pane, ref: began }, text)) !== false;
    } catch {
      saved = false;
    }
    // The field left the screen while the app saved: the session it belonged to is over.
    if (!live.current) return;
    if (saved) return end(refocus);
    setBusy(false);
    setFailed(true);
    store.announce(store.messages.pane.renameFailed);
    input?.focus();
  };

  const setValue = (text: string) => {
    setText(text);
    setFailed(false);
  };

  return { value, setValue, busy, failed, save, end };
}
