import { useJaliShortcut, useJali, useJaliModel, useJaliState } from "jali/react";

// A status line: reads exactly what it shows, so it re-renders only when that changes.
export function StatusLine() {
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  const shown = useJaliModel((m) => m.panes.filter((p) => p.where === "shown").length);
  const focused = useJaliModel((m) => m.panes.find((p) => p.focused)?.title);
  const { actions } = useJali();
  const keys = useJaliShortcut("pane.zoom");
  return (
    <footer>
      {shown} panes on screen · {focused ?? "nothing focused"}
      <button title={keys ? `Maximise · ${keys}` : "Maximise"} onClick={() => actions.toggleZoom()}>
        {zoomed ? "Restore" : "Maximise"}
      </button>
    </footer>
  );
}
