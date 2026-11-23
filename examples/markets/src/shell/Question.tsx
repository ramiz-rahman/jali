/**
 * The dialog that asks the app's question before work is lost (workspace/unsent.ts): an unsent order that a desk
 * change, Reset, a close or Back would take away. One question at a time; Esc keeps the order, as the focused button
 * does.
 */
import { useEffect, useId, useRef } from "react";
import { useJaliState } from "jali/react";
import { createStore, useStore } from "@jali-examples/shared/store";
import type { Question } from "../workspace/unsent";

type Asked = Question & { answer: (discard: boolean) => void };
/** The question on screen, if any. */
const asked = createStore<Asked | null>(null);

/** Ask `question`: true when the person lets the work go, false when they keep it. A new question keeps the old one's. */
export function ask(question: Question): Promise<boolean> {
  asked.get()?.answer(false);
  return new Promise((done) => {
    const self: Asked = {
      ...question,
      answer: (discard) => {
        if (asked.get() === self) asked.set(null);
        done(discard);
      },
    };
    asked.set(self);
  });
}

/** The question, as a modal dialog over the app (in `<JaliRoot overlays>`), and the page's unload held meanwhile. */
export function QuestionDialog() {
  const q = useStore(asked, (a) => a);
  const last = useRef<Asked | null>(null);
  if (q) last.current = q;
  const shown = q ?? last.current;
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    // Keeping the work is where focus starts. Closing the dialog the browser opened gives focus back to what had it.
    if (q && !d.open) {
      d.showModal();
      keep.current?.focus();
    } else if (!q && d.open) d.close();
  }, [q]);
  useHoldUnload();
  return (
    <dialog
      ref={dialog}
      className="question"
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={(e) => {
        e.preventDefault();
        q?.answer(false);
      }}
    >
      {shown ? (
        <>
          <h2 id={`${id}-title`}>{shown.title}</h2>
          <p id={`${id}-body`}>{shown.body}</p>
          <div className="question-actions">
            <button type="button" className="question-discard" onClick={() => q?.answer(true)}>
              {shown.discard}
            </button>
            <button
              ref={keep}
              type="button"
              className="question-keep"
              onClick={() => q?.answer(false)}
            >
              {shown.keep}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/** While a pane has unsent work, leaving the page asks first (the browser's own question): Jali no longer holds it. */
function useHoldUnload() {
  const unsent = useJaliState((s) => Object.keys(s.unsaved).length > 0);
  useEffect(() => {
    if (!unsent) return;
    const hold = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [unsent]);
}
