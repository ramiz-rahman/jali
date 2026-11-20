import { own } from "@jali/core/adapter";
import { useRef } from "react";
import { ModalDialog } from "../a11y/ModalDialog";
import { bold, Parts, useModel, useStore, useUi } from "../state/react";

/**
 * "Discard unsaved changes?": a change would close or replace panes with unsaved work. Keep editing is the default
 * (focused, Esc and a click outside); Discard makes the change that was held, exactly as it was asked for.
 */
export function ConfirmDiscard() {
  const confirm = useUi((s) => s.confirm);
  const unsaved = useUi((s) => s.unsaved);
  const m = useModel();
  const store = useStore();
  const id = store.dom.id;
  const keep = useRef<HTMLButtonElement>(null);
  if (!confirm) return null;
  const stay = () => store.actions.keepEditing();
  const t = store.messages.confirmDiscard;
  return (
    <ModalDialog
      scrim="jali-scrim jali-scrim-light"
      onClose={stay}
      initialFocus={keep}
      className="jali-dialog jali-confirm"
      data-dialog="confirm"
      role="alertdialog"
      aria-labelledby={`${id}-confirm-title`}
      aria-describedby={`${id}-confirm-body`}
    >
      <h2 id={`${id}-confirm-title`}>{t.title}</h2>
      <div id={`${id}-confirm-body`}>
        <p>{t.body(confirm.panes.length)}</p>
        <ul>
          {confirm.panes.map((id) => (
            <li key={id}>
              <Parts of={t.item(m.title(id), own(unsaved, id) ?? "", bold)} />
            </li>
          ))}
        </ul>
      </div>
      <footer>
        <button
          className="jali-text-btn jali-dialog-button"
          data-role="secondary"
          onClick={() => store.actions.discardAndContinue()}
        >
          {t.discard}
        </button>
        <button
          className="jali-text-btn is-primary jali-dialog-button"
          data-role="primary"
          ref={keep}
          onClick={stay}
        >
          {t.keepEditing}
        </button>
      </footer>
    </ModalDialog>
  );
}
