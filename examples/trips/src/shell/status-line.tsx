/**
 * The status line: Jali's shelf (tucked and folded panes, as chips), the keys worth knowing, read from the keymap,
 * and a plain note that the businesses and prices are made up.
 */
import { Shelf, useJali, useJaliState } from "jali-layout/react";
import { BuiltWithJali, Maker } from "@jali-examples/shared/maker/maker";
import "./status-line.css";

export function StatusLine() {
  const { keymap } = useJali();
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  const keys = (id: string, what: string) =>
    keymap.label(id) ? `${keymap.label(id)} ${what}` : "";
  const hint = zoomed
    ? "Maximised. Esc to restore."
    : ["/ find a place", keys("palette.toggle", "commands"), keys("pane.focus.next", "next pane")]
        .filter(Boolean)
        .join(", ");
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      <span className="status-hint" data-zoomed={zoomed || undefined}>
        {hint}
      </span>
      {/* The long note where there is room; a phone gets the same fact in a line that fits. */}
      <span className="status-note">
        <span className="status-note-long">
          Hotels, restaurants and every price (in US dollars) are made up
        </span>
        <span className="status-note-short">Every business and price is made up</span>
      </span>
      <Maker />
    </footer>
  );
}
