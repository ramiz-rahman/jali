import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { besidePreview } from "@jali/core/adapter";
import { roleOf } from "@jali/core/adapter";
import { PaneSwitcher } from "../chrome/PaneSwitcher";
import { Peek } from "../chrome/Peek";
import { DividerLayer } from "../dividers/DividerLayer";
import { keepPaneFocus } from "@jali/core/adapter";
import { CHROME } from "@jali/core/adapter";
import { PaneFrame } from "../pane/PaneFrame";
import { msg } from "@jali/core/adapter";
import type { WorkspaceModel } from "@jali/core/adapter";
import { useModel, useStore, useUi } from "../state/react";
import type { UiStore } from "@jali/core/adapter";
import { GAP, SWITCHER_H } from "@jali/core/adapter";
import { DropIndicator } from "./DropIndicator";
import { currentPane, frames } from "@jali/core/adapter";
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

/** Says which panes folded into tabs, or unfolded, when the room changed (not in single view, where nothing tiles).
 *  Only a change of room: an action that folds says so itself, in its own words. */
function useFoldAnnouncements(store: UiStore, m: WorkspaceModel, area: { width: number; height: number }) {
  const prev = useRef<{ folded: string[]; room: string } | null>(null);
  useEffect(() => {
    const room = `${area.width}x${area.height}`;
    if (prev.current !== null && area.width > 0 && !m.single && prev.current.room !== room) {
      const was = prev.current.folded, before = new Set(was), now = new Set(m.folded);
      const added = m.folded.filter((id) => !before.has(id)), removed = was.filter((id) => !now.has(id) && m.pane(id));
      if (added.length) store.announce(msg.folded(added.map(m.title)));
      else if (removed.length) store.announce(msg.unfolded(removed.map(m.title)));
    }
    prev.current = { folded: m.folded, room };
  });
}

/** True from the commit that carries a reshape until its slide has played (layout stability, state/apply.ts). The class
 *  lands in the same commit as the new rects, so panes slide from where they were. */
function useReshapeMotion(reshapes: number): boolean {
  const seen = useRef(reshapes);
  const [playing, setPlaying] = useState(false);
  const fresh = reshapes !== seen.current;
  useEffect(() => {
    if (!fresh) return;
    seen.current = reshapes;
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), 220);
    return () => clearTimeout(t);
  }, [reshapes, fresh]);
  return fresh || playing;
}

/** ⌥ over a page tab: a dashed outline where ⌥-click would open that view, and a fainter one for each view it moves.
 *  The preview runs the very placement the click commits (besidePreview), so the two cannot differ. */
function Ghost({ role }: { role: string }) {
  const store = useStore();
  const m = useModel();
  const preview = useMemo(() => besidePreview(store.snapshot(), role), [store, role, m]);
  if (!preview) return null;
  const p = store.env.profile!;
  const name = (id: string) => roleOf(p, id)?.label ?? m.title(id);
  const box = (r: { x: number; y: number; width: number; height: number }) => ({ left: r.x, top: r.y, width: r.width, height: r.height });
  const leaving = preview.leaving.length ? ` · ${preview.leaving.map(name).join(", ")} back to the tabs` : "";
  return (
    <>
      {preview.moved.map((v) => <div key={v.id} className="jali-ghost jali-ghost-moved" data-ghost={v.id} style={box(v.rect)} aria-hidden />)}
      <div className="jali-ghost" data-ghost={role} style={box(preview.incoming)} aria-hidden><span>{name(role)} opens here{leaving}</span></div>
    </>
  );
}

/**
 * The chip that follows the pointer: flipped to the pointer's left when it would pass the viewport's right edge, and
 * moved below the drop label when it would cover it (a centre drop puts the pointer where the label is).
 */
function DragChip({ x, y, label }: { x: number; y: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 });
  useLayoutEffect(() => {
    const chip = el.current;
    const host = chip?.offsetParent as HTMLElement | null;
    if (!chip || !host) return setPos({ left: x + 12, top: y + 12 });
    const o = host.getBoundingClientRect();
    const fits = o.left + x + 12 + chip.offsetWidth <= document.documentElement.clientWidth - 4;
    const left = fits ? x + 12 : Math.max(-o.left + 4, x - 12 - chip.offsetWidth);
    let top = y + 12;
    const lab = host.querySelector(".jali-drop-label")?.getBoundingClientRect();
    if (lab) {
      const c = { l: o.left + left, t: o.top + top, r: o.left + left + chip.offsetWidth, b: o.top + top + chip.offsetHeight };
      if (c.l < lab.right && c.r > lab.left && c.t < lab.bottom && c.b > lab.top) top = lab.bottom - o.top + 8;
    }
    setPos({ left, top });
  }, [x, y, label]);
  return <div ref={el} className="jali-drag-chip" data-testid="drag-chip" style={pos} aria-hidden>{label}</div>;
}

export function Workspace() {
  const store = useStore();
  const m = useModel();
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  const dnd = useUi((s) => s.dnd);
  const ghost = useUi((s) => s.ghost);
  const sliding = useReshapeMotion(useUi((s) => s.reshapes));
  const ref = useMeasure(store);
  const measured = area.width > 0;
  useSingleView(store, m, view, measured);
  useFoldAnnouncements(store, m, area);
  // Keep DOM focus on the focused pane after structural changes (focus is never lost).
  useEffect(() => keepPaneFocus(store.dom, view.focused), [view.focused, m.layout]);

  const single = m.single;
  // A curated page in Single mode shows one view under its tabs: the tabs name it, so the pane has no header.
  const page = useUi((s) => s.page?.mode);
  const mode = single ? "single" : "tiled";
  // On a phone the page tabs already choose the view, so a curated page has no pane switcher under them.
  const switcherH = page ? 0 : SWITCHER_H;
  const inner = single
    ? { left: 0, top: switcherH, width: area.width + GAP * 2, height: Math.max(0, area.height + GAP * 2 - switcherH) }
    : { left: GAP, top: GAP, width: area.width, height: area.height };
  const dropBox = !single && dnd?.target ? m.resolved.panes.find((b) => b.id === dnd.target) : undefined;

  return (
    <main
      className={["jali-workspace", single && "is-single", sliding && !single && "is-reshaping"].filter(Boolean).join(" ")}
      ref={ref}
      aria-label="Panes"
      data-single={single ? "" : undefined}
      data-zoomed={!single && view.zoomed ? "" : undefined}
      data-page={page}
    >
      {single && !page ? <PaneSwitcher panes={m.onScreen} current={currentPane(m, view)} /> : null}
      <div className="jali-workspace-inner" style={inner}>
        {frames(m, view, mode, { width: inner.width, height: inner.height }).map((f) => (
          <PaneFrame key={f.node.id} frame={f} chrome={CHROME[mode]} dropTarget={!single && dnd?.target === f.node.id} />
        ))}
        {single ? null : <DividerLayer />}
        {dropBox && dnd?.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
        {dnd && !single ? (
          <DragChip x={dnd.x} y={dnd.y} label={dnd.label ?? m.title(dnd.dragged)} />
        ) : null}
        {ghost && !single && !dnd ? <Ghost role={ghost} /> : null}
        <Peek presentation={mode} />
      </div>
    </main>
  );
}
