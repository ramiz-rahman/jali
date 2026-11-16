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
  const tabs = r.panes.filter((b) => b.stackId && b.hiddenInStack).length;
  const rails = allPanes().filter((p) => p.collapsed).length;
  const busy = Object.entries(activity).filter(([id, a]) => (a === "needs-you" || a === "working" || a === "error") && allPanes().some((p) => p.id === id && p.collapsed));
  const hint = resizeMode
    ? "Resize mode · arrows, ⇧ for 64px · Esc to leave"
    : view.zoomed
      ? "Zoomed · Esc to restore"
      : view.peek
        ? "Peek · Esc to close"
        : "⇧⌘↵ maximise · F6 next pane · ⌘K commands";
  return (
    <footer className="status" aria-label="Status">
      <span>
        {r.panes.length} {r.panes.length === 1 ? "pane" : "panes"}
        {tabs ? ` · ${tabs} in tabs` : ""}
        {rails ? ` · ${rails} minimised` : ""}
        {r.folded.length ? ` · ${r.folded.length} folded` : ""}
      </span>
      <span className="status-sep" />
      <span>Focus: {view.focused ? titleOf(view.focused) : "none"}</span>
      {busy.length ? <span className="status-busy">{busy.map(([id, a]) => `${titleOf(id)}: ${a}`).join(" · ")}</span> : null}
      <span className="status-hint">{hint}</span>
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
