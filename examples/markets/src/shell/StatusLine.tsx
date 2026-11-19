/**
 * The status line: Jali's shelf (tucked and folded panes, as chips), what has focus, and the keys worth knowing,
 * read from the keymap so they are right on every platform and after any rebinding.
 */
import { Shelf, useJali, useJaliModel, useJaliState } from "@jali/react";
import { BuiltWithJali, Maker } from "../../../shared/src/maker/maker";

export function StatusLine() {
  const { keymap } = useJali();
  const m = useJaliModel();
  const focused = useJaliState((s) => s.view.focused);
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  const keys = (id: string, what: string) =>
    keymap.label(id) ? `${keymap.label(id)} ${what}` : "";
  const hint = zoomed
    ? "Maximised · Esc to restore"
    : [
        "/ search",
        keys("palette.toggle", "commands"),
        keys("pane.focus.next", "next pane"),
        keys("pane.zoom", "maximise"),
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      <span className="status-focus">{focused ? m.title(focused) : ""}</span>
      <span className="status-hint">{hint}</span>
      <span className="status-note">
        <span className="live-dot" aria-hidden /> Crypto live from Kraken · everything else
        simulated
      </span>
      <Maker />
    </footer>
  );
}
