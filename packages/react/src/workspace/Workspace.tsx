import type { JaliModel } from "@jali/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  besidePreview,
  roleOf,
  keepPaneFocus,
  ALONE_CHROME,
  CHROME,
  GAP,
  SWITCHER_H,
  hingeOf,
  type Hinge,
  sameHinge,
  currentPane,
  directionOf,
  frames,
  observeResize,
  watchDirection,
} from "@jali/core/adapter";
import { StackDivider, useKeyboardUp, useStackAnnouncement } from "./Stacked";
import { PaneSwitcher } from "../chrome/PaneSwitcher";
import { Peek } from "../chrome/Peek";
import { DividerLayer } from "../dividers/DividerLayer";
import { PaneFrame } from "../pane/PaneFrame";
import { Strip, useFocusIntoStrip } from "./Scroller";
import type { UiStore } from "@jali/core/adapter";
import { useModel, useStore, useUi } from "../state/react";
import { DropIndicator } from "./DropIndicator";
import { useSingleView } from "./useSingleView";

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

/** The workspace's usable size follows the element (minus the inset), and so does its reading direction (an
 *  ancestor's `dir`, read again when any `dir` on the page changes), unless the workspace was given one. */
function useMeasure(store: UiStore) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = Math.max(0, Math.floor(el.clientWidth - GAP * 2)),
        height = Math.max(0, Math.floor(el.clientHeight - GAP * 2));
      const s = store.get();
      const dir = directionOf(store.env.dir, el);
      // A fold across the workspace, from the browser's viewport segments (Chrome and Edge 138+; none elsewhere).
      const segments = (window as { viewport?: { segments?: DOMRect[] | null } }).viewport
        ?.segments;
      const hinge = hingeOf(segments ?? undefined, el.getBoundingClientRect());
      if (
        s.area.width !== width ||
        s.area.height !== height ||
        s.dir !== dir ||
        !sameHinge(s.hinge, hinge)
      )
        store.set({ area: { width, height }, dir, hinge });
    };
    measure();
    if (DEV && el.clientWidth > 0 && el.clientHeight === 0)
      console.warn(
        "Jali: the workspace measures 0 pixels high, so every pane is collapsed. Give <JaliRoot> (or the element " +
          "around <JaliView />) a height, or make it a flex or grid cell that has one.",
        el,
      );
    const unobserve = observeResize(el, measure);
    const unwatch = watchDirection(measure);
    // Folding and unfolding changes the segments, sometimes without changing the element's size.
    window.addEventListener("resize", measure);
    const posture = (navigator as { devicePosture?: EventTarget }).devicePosture;
    posture?.addEventListener("change", measure);
    // A fold that turns from book to tabletop changes the segments alone: their media queries say so.
    const folds = ["(horizontal-viewport-segments: 2)", "(vertical-viewport-segments: 2)"].map(
      (q) => window.matchMedia?.(q),
    );
    folds.forEach((q) => q?.addEventListener?.("change", measure));
    return () => {
      unobserve();
      unwatch();
      window.removeEventListener("resize", measure);
      posture?.removeEventListener("change", measure);
      folds.forEach((q) => q?.removeEventListener?.("change", measure));
    };
  }, [store]);
  return ref;
}

/** Whether the person was last in this workspace (focus or a press inside its root or its dialogs), not elsewhere on
 *  the page. Starts false: mounting a workspace is not the person going there. */
function useEngaged(store: UiStore) {
  const engaged = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      const t = e.target as Node | null;
      const root = store.dom.root();
      engaged.current =
        !!t && ((root !== document && root.contains(t)) || !!store.dom.layer()?.contains(t));
    };
    document.addEventListener("focusin", on, true);
    document.addEventListener("pointerdown", on, true);
    return () => {
      document.removeEventListener("focusin", on, true);
      document.removeEventListener("pointerdown", on, true);
    };
  }, [store]);
  return engaged;
}

/** Says which panes folded into tabs, or unfolded, when the room changed (not in single view, where nothing tiles).
 *  Only a change of room: an action that folds says so itself, in its own words. */
function useFoldAnnouncements(
  store: UiStore,
  m: JaliModel,
  area: { width: number; height: number },
) {
  const prev = useRef<{ folded: string[]; room: string } | null>(null);
  useEffect(() => {
    const room = `${area.width}x${area.height}`;
    if (prev.current !== null && area.width > 0 && !m.single && prev.current.room !== room) {
      const was = prev.current.folded,
        before = new Set(was),
        now = new Set(m.folded);
      const added = m.folded.filter((id) => !before.has(id)),
        removed = was.filter((id) => !now.has(id) && m.pane(id));
      const said = store.messages.announcements;
      if (added.length) store.announce(said.folded(added.map(m.title)));
      else if (removed.length) store.announce(said.unfolded(removed.map(m.title)));
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
  const box = (r: { x: number; y: number; width: number; height: number }) => ({
    left: r.x,
    top: r.y,
    width: r.width,
    height: r.height,
  });

  return (
    <>
      {preview.moved.map((v) => (
        <div
          key={v.id}
          className="jali-ghost jali-ghost-moved"
          data-ghost={v.id}
          style={box(v.rect)}
          aria-hidden
        />
      ))}
      <div className="jali-ghost" data-ghost={role} style={box(preview.incoming)} aria-hidden>
        <span>{store.messages.page.ghost(name(role), preview.leaving.map(name))}</span>
      </div>
    </>
  );
}

/**
 * The chip that follows the pointer: on the pointer's right (its left, right to left), flipped to the other side when
 * it would pass the viewport's edge, and moved below the drop label when it would cover it (a centre drop puts the
 * pointer where the label is).
 */
function DragChip({ x, y, label, rtl }: { x: number; y: number; label: string; rtl: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 });
  useLayoutEffect(() => {
    const chip = el.current;
    const host = chip?.offsetParent as HTMLElement | null;
    if (!chip || !host) return setPos({ left: x + 12, top: y + 12 });
    const o = host.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const before = x - 12 - chip.offsetWidth;
    const left = rtl
      ? o.left + before >= 4
        ? before
        : Math.min(viewport - o.left - 4 - chip.offsetWidth, x + 12)
      : o.left + x + 12 + chip.offsetWidth <= viewport - 4
        ? x + 12
        : Math.max(-o.left + 4, before);
    let top = y + 12;
    const lab = host.querySelector(".jali-drop-label")?.getBoundingClientRect();
    if (lab) {
      const c = {
        l: o.left + left,
        t: o.top + top,
        r: o.left + left + chip.offsetWidth,
        b: o.top + top + chip.offsetHeight,
      };
      if (c.l < lab.right && c.r > lab.left && c.t < lab.bottom && c.b > lab.top)
        top = lab.bottom - o.top + 8;
    }
    setPos({ left, top });
  }, [x, y, label, rtl]);
  return (
    <div ref={el} className="jali-drag-chip" data-testid="drag-chip" style={pos} aria-hidden>
      {label}
    </div>
  );
}

/**
 * Full screen: while a pane is on the whole screen (`actions.toggleFullScreen`), the page is in the browser's full
 * screen, so the pane (fixed over the window) covers the display. Leaving the browser's full screen (Escape, the
 * browser's own controls) leaves Jali's too. Where the browser can't (an iPhone), the pane still covers the page.
 */
function useFullScreen(store: UiStore, m: JaliModel) {
  const full = useUi((s) => s.fullScreen);
  const asked = useRef(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    // The pane itself is the browser's full-screen element: the browser then shows only it, over anything the host
    // draws (a sticky top bar of any z-index). Jali's dialogs move inside it meanwhile (JaliRoot).
    const el = full ? store.dom.pane(full) : null;
    if (el && !document.fullscreenElement && el.requestFullscreen) {
      asked.current = true;
      el.requestFullscreen().catch(() => (asked.current = false));
    } else if (!full && asked.current) {
      asked.current = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [full]);
  useEffect(() => {
    const left = () => {
      if (!document.fullscreenElement && asked.current && store.get().fullScreen) {
        asked.current = false;
        store.actions.toggleFullScreen();
      }
    };
    document.addEventListener("fullscreenchange", left);
    return () => document.removeEventListener("fullscreenchange", left);
  }, [store]);
  // The pane closed while on the whole screen.
  useEffect(() => {
    if (full && !m.pane(full)) store.set({ fullScreen: undefined });
  });
}

/** A fold's hinge, drawn as a hairline where the halves meet (a seamless fold has no gap of its own). */
function FoldLine({ hinge, origin }: { hinge: Hinge; origin: { left: number; top: number } }) {
  const row = hinge.axis === "row";
  const at = hinge.start + hinge.size / 2 - (row ? origin.left : origin.top);
  return (
    <div
      className="jali-fold-line"
      aria-hidden
      style={
        row ? { left: at, top: 0, bottom: 0, width: 1 } : { top: at, left: 0, right: 0, height: 1 }
      }
    />
  );
}

/** The panes: the layout, its dividers, tabs, the shelf, the peek sheet and drop previews. */
export function Panes() {
  const store = useStore();
  const m = useModel();
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  const dnd = useUi((s) => s.dnd);
  const ghost = useUi((s) => s.ghost);
  const dir = useUi((s) => s.dir);
  const sliding = useReshapeMotion(useUi((s) => s.reshapes));
  const ref = useMeasure(store);
  const measured = area.width > 0;
  useSingleView(store, m, view, measured);
  useFullScreen(store, m);
  const fullScreen = useUi((s) => !!s.fullScreen && !!m.pane(s.fullScreen));
  useFoldAnnouncements(store, m, area);
  // Keep DOM focus on the focused pane after structural changes (focus is never lost), but only once the person has
  // been in this workspace: mounting one, or a change while they are elsewhere on the page, leaves their place alone.
  const engaged = useEngaged(store);
  useEffect(() => {
    if (!store.focusHeld) keepPaneFocus(store.dom, view.focused, { fromBody: engaged.current });
  }, [view.focused, m.layout]);

  const single = m.single;
  // A curated page in Single mode shows one view under its tabs: the tabs name it, so the pane has no header.
  const page = useUi((s) => s.page?.mode);
  const mode = single ? "single" : "tiled";
  // On a phone the page tabs already choose the view, so a curated page has no pane switcher under them.
  const switcherH = page ? 0 : SWITCHER_H;
  const inner = single
    ? {
        left: 0,
        top: switcherH,
        width: area.width + GAP * 2,
        height: Math.max(0, area.height + GAP * 2 - switcherH),
      }
    : { left: GAP, top: GAP, width: area.width, height: area.height };
  // One pane on screen, tiled: full-bleed and quiet, as a plain tab strip would be (ALONE_CHROME). Not a maximised
  // pane: the others are behind it, and it needs its Restore.
  const alone =
    !single && !page && !view.zoomed && m.resolved.panes.filter((b) => !b.hidden).length === 1;
  const chrome = single ? CHROME.single : alone ? ALONE_CHROME : CHROME.tiled;
  const bleed = alone
    ? { left: 0, top: 0, width: area.width + GAP * 2, height: area.height + GAP * 2 }
    : inner;
  // Stacked view (a portrait phone, phone.stack): two linked panes, unless the keyboard is up.
  const keyboardUp = useKeyboardUp();
  const [stackRatio, setStackRatio] = useState(0.5);
  // Across a fold the two halves stay whatever the keyboard does: they are two screens.
  const stacked = single && !page && !!m.stacked && (!keyboardUp || !!m.stacked.hinge);
  useStackAnnouncement(store, m, stacked);
  const dropBox =
    !single && dnd?.target ? m.resolved.panes.find((b) => b.id === dnd.target) : undefined;
  const placed = frames(
    m,
    view,
    mode,
    { width: inner.width, height: inner.height },
    stacked ? stackRatio : false,
    { x: inner.left, y: inner.top },
  );
  useFocusIntoStrip(store);

  // A labelled region inside the host's page, or the page's main landmark when the host says Jali is the whole app.
  const Landmark = store.env.landmark === "main" ? "main" : "section";
  return (
    <Landmark
      className={["jali-workspace", single && "is-single", sliding && !single && "is-reshaping"]
        .filter(Boolean)
        .join(" ")}
      ref={ref}
      aria-label={store.messages.workspace.label}
      data-single={single ? "" : undefined}
      data-stacked={stacked ? "" : undefined}
      data-fold={stacked ? m.stacked?.hinge?.axis : undefined}
      data-full-screen={fullScreen ? "" : undefined}
      data-alone={alone ? "" : undefined}
      data-zoomed={!single && view.zoomed ? "" : undefined}
      data-page={page}
    >
      {single && !page ? (
        <PaneSwitcher
          panes={m.onScreen}
          current={currentPane(m, view)}
          inView={stacked && m.stacked ? [m.stacked.top, m.stacked.bottom] : undefined}
        />
      ) : null}
      <div className="jali-workspace-inner" style={bleed}>
        {placed
          .filter((f) => !f.strip)
          .map((f) => (
            <PaneFrame
              key={f.node.id}
              frame={
                alone && !f.hidden
                  ? { ...f, rect: { x: 0, y: 0, width: bleed.width, height: bleed.height } }
                  : f
              }
              chrome={chrome}
              dropTarget={!single && dnd?.target === f.node.id}
            />
          ))}
        {single ? null : <DividerLayer />}
        {/* Rows that scroll sideways: their panes and dividers inside an element the browser scrolls. */}
        {single
          ? null
          : m.content.scrollers.map((s) => (
              <Strip key={s.id} strip={s} zoomed={!!view.zoomed && s.paneIds.includes(view.zoomed)}>
                {placed
                  .filter((f) => f.strip === s.id)
                  .map((f) => (
                    <PaneFrame
                      key={f.node.id}
                      frame={f}
                      chrome={chrome}
                      dropTarget={dnd?.target === f.node.id}
                    />
                  ))}
                <DividerLayer strip={s} />
              </Strip>
            ))}
        {stacked && m.stacked?.hinge ? <FoldLine hinge={m.stacked.hinge} origin={inner} /> : null}
        {stacked && !m.stacked?.hinge ? (
          <StackDivider m={m} ratio={stackRatio} setRatio={setStackRatio} height={inner.height} />
        ) : null}
        {dropBox && dnd?.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
        {dnd && !single ? (
          <DragChip
            x={dnd.x}
            y={dnd.y}
            label={dnd.label ?? m.title(dnd.dragged)}
            rtl={dir === "rtl"}
          />
        ) : null}
        {ghost && !single && !dnd ? <Ghost role={ghost} /> : null}
        <Peek presentation={mode} />
      </div>
    </Landmark>
  );
}
