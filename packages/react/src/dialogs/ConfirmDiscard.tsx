import { own, type ConfirmState } from "@jali/core/adapter";
import { useRef } from "react";
import { ModalDialog } from "../a11y/ModalDialog";
import { bold, Parts, useEntriesOf, useModelValue, useStore, useUi } from "../state/react";

/**
 * "Discard unsaved changes?": a change would close or replace panes with unsaved work. Keep editing is the default
 * (focused, Esc and a click outside); Discard makes the change that was held, exactly as it was asked for.
 */
export function ConfirmDiscard() {
  const confirm = useUi((s) => s.confirm);
  return confirm ? <DiscardDialog confirm={confirm} /> : null;
}

/** The question while it is open: it hears the panes it lists (their names and unsaved work), and no other. */
function DiscardDialog({ confirm }: { confirm: ConfirmState }) {
  const store = useStore();
  const unsaved = useEntriesOf((s) => s.unsaved, confirm.panes);
  const names = useModelValue((m) => JSON.stringify(confirm.panes.map((id) => m.title(id))));
  const titles = JSON.parse(names) as string[];
  const id = store.dom.id;
  const keep = useRef<HTMLButtonElement>(null);
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
          {confirm.panes.map((id, i) => (
            <li key={id}>
              <Parts of={t.item(titles[i]!, own(unsaved, id) ?? "", bold)} />
            </li>
          ))}
        </ul>
      </div>
      <footer>
        <button
          type="button"
          className="jali-text-btn jali-dialog-button"
          data-role="secondary"
          onClick={() => store.actions.discardAndContinue()}
        >
          {t.discard}
        </button>
        <button
          type="button"
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
