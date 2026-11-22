import type { NodeId } from "@jali/core";
import { useLayoutEffect, useRef } from "react";
import { useStore } from "../state/react";
import { useRenameSession } from "./rename-session";

/**
 * The rename field, in place of a tab or a lone pane's title. It starts with the title, selected. Enter saves through
 * the app's `rename.run`, as does leaving the field; Esc keeps the old name. An empty or unchanged name saves nothing.
 * While the app saves it is busy; if the app says no, it stays open with the text and says so. Focus goes back to the
 * tab, or the pane, when it closes from the keyboard. The session is rename-session.ts's; this draws it.
 */
export function RenameField({ pane, title }: { pane: NodeId; title: string }) {
  const t = useStore().messages.pane;
  const session = useRenameSession(pane, title);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <input
      ref={input}
      className="jali-rename"
      value={session.value}
      aria-label={t.renameField(title)}
      aria-invalid={session.failed || undefined}
      aria-description={session.failed ? t.renameFailed : undefined}
      aria-busy={session.busy || undefined}
      readOnly={session.busy}
      spellCheck={false}
      onChange={(e) => session.setValue(e.target.value)}
      onKeyDown={(e) => {
        // The field's keys are its own: Delete, arrows and the rest never reach the tab or the instance.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          void session.save(true, input.current);
        } else if (e.key === "Escape") {
          e.preventDefault();
          session.end(true);
        }
      }}
      onBlur={() => void session.save(false, input.current)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
