/**
 * The status line: Jali's shelf (tucked panes, as chips), what has focus, the keys worth knowing (read from the
 * keymap, so they are right on every platform and after any rebinding), and the credit for the session in the
 * transport, with the way to every credit and licence.
 */
import { Shelf, useJali, useJaliModel, useJaliState } from "@jali/react";
import { show } from "../actions";
import { useTransport } from "../audio/react";
import { credits } from "../panes/credits";
import { catalogueOf } from "../sessions/catalog";

export function StatusLine() {
  const jali = useJali();
  const { keymap } = jali;
  const loaded = useTransport((s) => s.session);
  const cat = catalogueOf(loaded);
  const m = useJaliModel();
  const focused = useJaliState((s) => s.view.focused);
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  const keys = (id: string, what: string) =>
    keymap.label(id) ? `${keymap.label(id)} ${what}` : "";
  const hint = zoomed
    ? "Maximised · Esc to restore"
    : [
        "Space play",
        "/ go to segment",
        keys("palette.toggle", "commands"),
        keys("pane.focus.next", "next pane"),
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <footer className="status" aria-label="Status">
      <Shelf />
      <span className="status-focus">{focused ? m.title(focused) : ""}</span>
      <span className="status-hint">{hint}</span>
      <span className="status-credit" title={cat.notice ? `${cat.credit} ${cat.notice}` : cat.credit}>
        {cat.credit}
        {cat.notice ? ` ${cat.notice}` : ""}
      </span>
      <button
        type="button"
        className="status-credits"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => show(jali, credits())}
      >
        Credits
      </button>
    </footer>
  );
}
