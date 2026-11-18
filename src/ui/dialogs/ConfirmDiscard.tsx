import { useEffect, useRef } from "react";
import { useModel, useStore, useUi } from "../state/react";

/**
 * "Discard unsaved changes?": a change would close or replace panes with unsaved work. Keep editing is the default
 * (focused, Esc and a click outside); Discard makes the change that was held, exactly as it was asked for.
 */
export function ConfirmDiscard() {
  const confirm = useUi((s) => s.confirm);
  const unsaved = useUi((s) => s.unsaved);
  const m = useModel();
  const store = useStore();
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirm) keep.current?.focus();
  }, [confirm]);
  if (!confirm) return null;
  const stay = () => store.actions.keepEditing();
  const one = confirm.panes.length === 1;
  return (
    <div className="scrim scrim-light" onPointerDown={(e) => e.target === e.currentTarget && stay()}>
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); stay(); }
        }}
      >
        <h2 id="confirm-title">Discard unsaved changes?</h2>
        <div id="confirm-body">
          <p>{one ? "This pane has work that is not saved. It will be lost." : "These panes have work that is not saved. It will be lost."}</p>
          <ul>
            {confirm.panes.map((id) => (
              <li key={id}><b>{m.title(id)}</b>: {unsaved[id]}</li>
            ))}
          </ul>
        </div>
        <footer>
          <button className="text-btn" onClick={() => store.actions.discardAndContinue()}>Discard</button>
          <button className="text-btn is-primary" ref={keep} onClick={stay}>Keep editing</button>
        </footer>
      </div>
    </div>
  );
}
