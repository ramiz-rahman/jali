import { useEffect, useLayoutEffect, useRef } from "react";
import { PaneSwitcher } from "../chrome/PaneSwitcher";
import { Peek } from "../chrome/Peek";
import { DividerLayer } from "../dividers/DividerLayer";
import { keepPaneFocus } from "../dom/focus";
import { CHROME } from "../pane/chrome";
import { PaneFrame } from "../pane/PaneFrame";
import { msg } from "../state/messages";
import type { WorkspaceModel } from "../state/model";
import { useModel, useStore, useUi } from "../state/react";
import type { UiStore } from "../state/store";
import { GAP, SWITCHER_H } from "../tokens";
import { DropIndicator } from "./DropIndicator";
import { currentPane, frames } from "./frames";
import { useSingleView } from "./useSingleView";

/** The workspace's usable size follows the element (minus the inset). */
function useMeasure(store: UiStore) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = Math.max(0, Math.floor(el.clientWidth - GAP * 2)), height = Math.max(0, Math.floor(el.clientHeight - GAP * 2));
      const a = store.get().area;
      if (a.width !== width || a.height !== height) store.set({ area: { width, height } });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);
  return ref;
}

/** Says which panes folded into tabs, or unfolded, when the room changed (not in single view, where nothing tiles). */
function useFoldAnnouncements(store: UiStore, m: WorkspaceModel, measured: boolean) {
  const prev = useRef<string[] | null>(null);
  useEffect(() => {
    if (prev.current !== null && measured && !m.single) {
      const before = new Set(prev.current), now = new Set(m.folded);
      const added = m.folded.filter((id) => !before.has(id)), removed = prev.current.filter((id) => !now.has(id) && m.pane(id));
      if (added.length) store.announce(msg.folded(added.map(m.title)));
      else if (removed.length) store.announce(msg.unfolded(removed.map(m.title)));
    }
    prev.current = m.folded;
  });
}

export function Workspace() {
  const store = useStore();
  const m = useModel();
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  const dnd = useUi((s) => s.dnd);
  const ref = useMeasure(store);
  const measured = area.width > 0;
  useSingleView(store, m, view, measured);
  useFoldAnnouncements(store, m, measured);
  // Keep DOM focus on the focused pane after structural changes (focus is never lost).
  useEffect(() => keepPaneFocus(view.focused), [view.focused, m.layout]);

  const single = m.single;
  const mode = single ? "single" : "tiled";
  const inner = single
    ? { left: 0, top: SWITCHER_H, width: area.width + GAP * 2, height: Math.max(0, area.height + GAP * 2 - SWITCHER_H) }
    : { left: GAP, top: GAP, width: area.width, height: area.height };
  const dropBox = !single && dnd?.target ? m.resolved.panes.find((b) => b.id === dnd.target) : undefined;

  return (
    <main
      className={single ? "workspace is-single" : "workspace"}
      ref={ref}
      aria-label="Panes"
      data-single={single ? "" : undefined}
      data-zoomed={!single && view.zoomed ? "" : undefined}
    >
      {single ? <PaneSwitcher panes={m.onScreen} current={currentPane(m, view)} /> : null}
      <div className="workspace-inner" style={inner}>
        {frames(m, view, mode, { width: inner.width, height: inner.height }).map((f) => (
          <PaneFrame key={f.node.id} frame={f} chrome={CHROME[mode]} dropTarget={!single && dnd?.target === f.node.id} />
        ))}
        {single ? null : <DividerLayer />}
        {dropBox && dnd?.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
        {dnd && !single ? (
          <div className="drag-chip" data-testid="drag-chip" style={{ left: dnd.x + 12, top: dnd.y + 12 }} aria-hidden>
            {m.title(dnd.dragged)}
          </div>
        ) : null}
        <Peek presentation={mode} />
      </div>
    </main>
  );
}
