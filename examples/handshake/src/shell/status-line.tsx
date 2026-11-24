/** The status line: who made it, Jali's shelf (tucked and folded panes), and what has focus. */
import { Shelf, useJaliModel, useJaliState } from "jali-layout/react";
import { BuiltWithJali, Maker } from "@jali-examples/shared/maker/maker";

export function StatusLine() {
  const m = useJaliModel();
  const focused = useJaliState((s) => s.view.focused);
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      <span className="status-focus">{focused ? m.pane(focused)?.title : ""}</span>
      <Maker />
    </footer>
  );
}
