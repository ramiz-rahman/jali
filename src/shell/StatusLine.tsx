import { useEffect, useState } from "react";
import { useDataLayer } from "../data/react";
import { useJali, useJaliModel, useJaliState, Shelf } from "@jali/react";
import { useShowStats } from "./stats-pref";

export function StatusLine() {
  const m = useJaliModel();
  const { keymap } = useJali();
  const keys = (id: string, what: string) =>
    keymap.label(id) ? `${keymap.label(id)} ${what}` : "";
  const view = useJaliState((s) => s.view);
  const resizeMode = useJaliState((s) => s.resizeMode);
  const curated = useJaliState((s) => !!s.page);
  const single = useJaliState((s) => s.page?.mode === "single");
  // Fetch and cache telemetry is for Data Studio; a curated page speaks in views.
  const showStats = useShowStats() && !curated;
  const activity = useJaliState((s) => s.activity);
  // Every tucked pane, shown or not (the shelf lists them all); folded panes are counted separately.
  const tucked = m.shelf.length;
  const busy = Object.entries(activity).filter(
    ([id, a]) => (a === "needs-you" || a === "working" || a === "error") && m.tuckOf(id),
  );
  const hint = resizeMode
    ? "Resize mode · arrows, ⇧ for 64px · Esc to leave"
    : view.zoomed
      ? "Zoomed · Esc to restore"
      : view.peek
        ? "Peek · Esc to close"
        : curated && single
          ? keys("palette.toggle", "commands")
          : [
              keys("pane.zoom", "maximise"),
              keys("pane.focus.next", `next ${curated ? "view" : "pane"}`),
              keys("palette.toggle", "commands"),
            ]
              .filter(Boolean)
              .join(" · ");
  const n = m.onScreen.length;
  return (
    <footer className="status" aria-label="Status" data-shelf-on={tucked ? "" : undefined}>
      {/* Hidden panes live here, on the left, so the workspace height never changes. The count and focus step right. */}
      <Shelf />
      <span className="status-main" data-testid="status-main">
        {curated
          ? `${n} ${n === 1 ? "view" : "views"} on screen`
          : `${n} ${n === 1 ? "pane" : "panes"}`}
        {!curated && m.off.length ? ` · ${m.off.length} hidden` : ""}
        {tucked ? ` · ${tucked} tucked` : ""}
        {m.folded.length ? ` · ${m.folded.length} folded` : ""}
        {" · "}Focus: {view.focused ? m.title(view.focused) : "none"}
      </span>
      {busy.length ? (
        <span className="status-busy">
          {busy.map(([id, a]) => `${m.title(id)}: ${a}`).join(" · ")}
        </span>
      ) : null}
      <span
        className="status-hint"
        data-mode={resizeMode || view.zoomed || view.peek ? "" : undefined}
      >
        {hint}
      </span>
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
