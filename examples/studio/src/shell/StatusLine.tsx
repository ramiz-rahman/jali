/**
 * The status line: one quiet line of print set straight on the desk. Jali's lockup and a line saying what this is
 * on the left, who made it on the right, and between them only what the moment needs: Jali's shelf (tucked panes,
 * as chips), a word when a pane is maximised, and the way to every credit and licence. The keys are not listed
 * here: ⌘K lists every command with its key.
 */
import { Shelf, useJali, useJaliState } from "@jali/react";
import { BuiltWithJali, Maker } from "@jali-examples/shared/maker/maker";
import { show } from "../actions";
import { useTransport } from "../audio/react";
import { credits } from "../panes/credits";
import { catalogueOf } from "../sessions/catalog";

export function StatusLine() {
  const jali = useJali();
  const loaded = useTransport((s) => s.session);
  const cat = catalogueOf(loaded);
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      {zoomed ? <span className="status-note">Maximised. Esc restores the layout.</span> : null}
      <button
        type="button"
        className="status-credits"
        title={`${cat.short}\nEvery credit and licence.`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => show(jali, credits())}
      >
        Credits
      </button>
      <Maker words />
    </footer>
  );
}
