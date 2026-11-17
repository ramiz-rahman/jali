import { useEffect, useState } from "react";
import { useDataLayer } from "./pane-kinds";
import { resolved, titleOf, useUi, allPanes } from "./store";

export function StatusLine() {
  const layout = useUi((s) => s.layout);
  const view = useUi((s) => s.view);
  const resizeMode = useUi((s) => s.resizeMode);
  const showStats = useUi((s) => s.settings.showStats);
  const activity = useUi((s) => s.activity);
  useUi((s) => s.area);
  void layout;
  const r = resolved();
  const shelf = (r as unknown as { shelf?: { paneId: string }[] }).shelf ?? [];
  const busy = Object.entries(activity).filter(([id, a]) => (a === "needs-you" || a === "working" || a === "error") && shelf.some((s) => s.paneId === id));
  const hint = resizeMode
    ? "Resize mode · arrows, ⇧ for 64px · Esc to leave"
    : view.zoomed
      ? "Zoomed · Esc to restore"
      : view.peek
        ? "Peek · Esc to close"
        : "⇧⌘↵ maximise · F6 next pane · ⌘K commands";
  return (
    <footer className="status" aria-label="Status">
      <span className="status-main">
        {allPanes().length} {allPanes().length === 1 ? "pane" : "panes"}
        {shelf.length ? ` · ${shelf.length} tucked` : ""}
        {r.folded.length ? ` · ${r.folded.length} folded` : ""}
        {" · "}Focus: {view.focused ? titleOf(view.focused) : "none"}
      </span>
      {busy.length ? <span className="status-busy">{busy.map(([id, a]) => `${titleOf(id)}: ${a}`).join(" · ")}</span> : null}
      <span className="status-hint" data-mode={resizeMode || view.zoomed || view.peek ? "" : undefined}>{hint}</span>
      {showStats ? <Stats /> : null}
    </footer>
  );
}

function Stats() {
  const data = useDataLayer();
  const [s, setS] = useState(data.stats());
  useEffect(() => {
    const t = setInterval(() => setS(data.stats()), 500);
    return () => clearInterval(t);
  }, [data]);
  return (
    <span className="status-stats" data-testid="fetch-stats">
      fetches <b>{s.fetches}</b> · cache hits <b>{s.cacheHits}</b>
    </span>
  );
}
