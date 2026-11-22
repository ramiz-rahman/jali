import type { NodeId } from "@jali/core";
import { useLayoutEffect, useRef, useState } from "react";
import { cssString, paneDomId } from "@jali/core/adapter";
import { useStore } from "../state/react";

/**
 * The rename field, in place of a tab or a lone pane's title. It starts with the title, selected. Enter saves through
 * the app's `rename.run`, as does leaving the field; Esc keeps the old name. An empty or unchanged name saves nothing.
 * While the app saves it is busy; if the app says no, it stays open with the text and says so. Focus goes back to the
 * tab, or the pane, when it closes from the keyboard.
 */
export function RenameField({ pane, title }: { pane: NodeId; title: string }) {
  const store = useStore();
  const t = store.messages.pane;
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const closed = useRef(false);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const close = (refocus: boolean) => {
    if (closed.current) return;
    closed.current = true;
    store.actions.endRename();
    if (!refocus) return;
    requestAnimationFrame(() => {
      const root = store.dom.root();
      (
        root.querySelector<HTMLElement>(`[role="tab"][data-tab=${cssString(pane)}]`) ??
        document.getElementById(paneDomId(store.dom.id, pane))
      )?.focus({ preventScroll: true });
    });
  };
  const save = async (refocus: boolean) => {
    if (busy || closed.current) return;
    const text = value.trim();
    const node = store.model().pane(pane);
    if (!text || text === title || !node || !store.env.rename) return close(refocus);
    setBusy(true);
    try {
      if ((await store.env.rename.run({ id: pane, ref: node.ref }, text)) === false)
        throw new Error("declined");
      close(refocus);
    } catch {
      setBusy(false);
      setFailed(true);
      store.announce(t.renameFailed);
      input.current?.focus();
    }
  };

  return (
    <input
      ref={input}
      className="jali-rename"
      value={value}
      aria-label={t.renameField(title)}
      aria-invalid={failed || undefined}
      aria-description={failed ? t.renameFailed : undefined}
      aria-busy={busy || undefined}
      readOnly={busy}
      spellCheck={false}
      onChange={(e) => {
        setValue(e.target.value);
        setFailed(false);
      }}
      onKeyDown={(e) => {
        // The field's keys are its own: Delete, arrows and the rest never reach the tab or the instance.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          void save(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          close(true);
        }
      }}
      onBlur={() => void save(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
