import { useEffect, useState } from "react";
import { useDataLayer } from "../data/react";
import { Activity, useJali, useJaliModel, useJaliState, Shelf } from "jali/react";
import { BuiltWithJali, Maker } from "../maker/maker";
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
  const tucks = useJaliState((s) => s.layout.overlay?.tucks);
  const tucked = tucks?.length ?? 0;
  // Panes a curated page hides: no slot and no tab.
  const off = useJaliState((s) => s.layout.overlay?.hidden?.length ?? 0);
  const busy = Object.entries(activity).filter(
    ([id, a]) =>
      (a === "needs-you" || a === "working" || a === "error") && tucks?.some((t) => t.pane === id),
  );
  const folded = m.panes.filter((p) => p.where === "folded").length;
  const title = (id: string) => m.pane(id)?.title ?? "pane";
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
  const n = m.panes.length - off;
  return (
    <footer className="status" aria-label="Status" data-shelf-on={tucked ? "" : undefined}>
      <BuiltWithJali />
      {/* Hidden panes live here, on the left, so the workspace height never changes. The count and focus step right. */}
      <Shelf />
      <span className="status-main" data-testid="status-main">
        {curated
          ? `${n} ${n === 1 ? "view" : "views"} on screen`
          : `${n} ${n === 1 ? "pane" : "panes"}`}
        {!curated && off ? ` · ${off} hidden` : ""}
        {tucked ? ` · ${tucked} tucked` : ""}
        {folded ? ` · ${folded} folded` : ""}
        {" · "}Focus: {view.focused ? title(view.focused) : "none"}
      </span>
      {/* A tucked pane that is working, needs the person or failed, with Jali's own mark for it, as its tab has. */}
      {busy.length ? (
        <span className="status-busy">
          {busy.map(([id, a]) => (
            <span key={id} className="status-busy-pane">
              <Activity activity={a} />
              {title(id)}
            </span>
          ))}
        </span>
      ) : null}
      <span
        className="status-hint"
        data-mode={resizeMode || view.zoomed || view.peek ? "" : undefined}
      >
        {hint}
      </span>
      {showStats ? <Stats /> : null}
      <Maker />
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
