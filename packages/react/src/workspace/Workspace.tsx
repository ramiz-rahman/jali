import type { JaliModel } from "@jali/core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  keepPaneFocus,
  ALONE_CHROME,
  CHROME,
  SWITCHER_H,
  hingeOf,
  type Hinge,
  sameHinge,
  currentPane,
  directionOf,
  frames,
  stackShare,
  stackGap,
  observeResize,
  watchDirection,
} from "@jali/core/adapter";
import { StackDivider, useKeyboardUp, useStackAnnouncement } from "./Stacked";
import { PaneSwitcher } from "../chrome/PaneSwitcher";
import { Peek } from "../chrome/Peek";
import { DividerLayer } from "../dividers/DividerLayer";
import { PaneFrame } from "../pane/PaneFrame";
import { ContentHosts, PaneContent, useContentHosts } from "../pane/content";
import { Strip, useFocusIntoStrip } from "./Scroller";
import type { UiStore } from "@jali/core/adapter";
import { useGeometry, useModelValue, useStore, useUi } from "../state/react";
import { useHydrated } from "../state/hydrated";
import { paneHydration } from "../state/hydration";
import { DropIndicator } from "./DropIndicator";
import { useSingleView } from "./useSingleView";
import { PAGE_PARTS } from "../define";
import { isDev } from "../dev";
import { useWorkspaceLabel } from "../a11y/landmark";

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

/** The workspace's usable size follows the element (minus the inset), and so does its reading direction (an
 *  ancestor's `dir`, read again when any `dir` on the page changes), unless the workspace was given one.
 *  A workspace that hydrates a server's HTML measures once its panes have hydrated (state/hydration.ts). */
function useMeasure(store: UiStore) {
  const ref = useRef<HTMLElement>(null);
  // Whether this mount hydrates a server's HTML: read on the first render, and kept.
  const hydrated = useHydrated();
  const hydrating = useRef(!hydrated).current;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { inset } = store.env.spacing;
    let held = hydrating;
    const measure = () => {
      if (held) return;
      const width = Math.max(0, Math.floor(el.clientWidth - inset * 2)),
        height = Math.max(0, Math.floor(el.clientHeight - inset * 2));
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
    const cancelHold = held
      ? paneHydration(store).whenSettled(() => {
          held = false;
          measure();
        })
      : undefined;
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
      cancelHold?.();
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

/** The names of the mounted workspaces' landmarks (or the heading ids that name them), to catch two the same. */
const names = new Map<string, number>();

/** Two workspaces on one page with the same name repeat every landmark: a development warning that says how to name
 *  them apart. */
function useUniqueName(name: string) {
  useEffect(() => {
    const n = names.get(name) ?? 0;
    if (n && isDev())
      console.warn(
        `Jali: two workspaces on this page are both named "${name}", so their landmarks repeat. Name each with ` +
          "<JaliRoot aria-label> (or aria-labelledby), or createJali({ label }).",
      );
    names.set(name, n + 1);
    return () => {
      const left = (names.get(name) ?? 1) - 1;
      if (left) names.set(name, left);
      else names.delete(name);
    };
  }, [name]);
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
 * What a pane drag draws over the panes: the drop indicator on the target and the chip at the pointer. The one part
 * that hears every move of the drag (`dnd`); the workspace and its frames hear only where it would land.
 */
function DragLayer({ m }: { m: JaliModel }) {
  const dnd = useUi((s) => s.dnd);
  const rtl = useUi((s) => s.dir === "rtl");
  const name = useModelValue((x) => (dnd ? x.title(dnd.dragged) : ""));
  if (!dnd) return null;
  const dropBox = dnd.target ? m.resolved.panes.find((b) => b.id === dnd.target) : undefined;
  return (
    <>
      {dropBox && dnd.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
      <DragChip x={dnd.x} y={dnd.y} label={dnd.label ?? name} rtl={rtl} />
    </>
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
  // Not for a live title: each frame, tab and the drag chip reads its own.
  const m = useGeometry();
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  // Where a drag would land, not where its pointer is: the pointer is DragLayer's.
  const dropTarget = useUi((s) => s.dnd?.target);
  const dragging = useUi((s) => !!s.dnd);
  const ghost = useUi((s) => s.ghost);
  // A curated page's ⌥ preview, which its parts bring (definePage).
  const Ghost = store.env.profile?.[PAGE_PARTS]?.Ghost;
  const sliding = useReshapeMotion(useUi((s) => s.reshapes));
  const hydrated = useHydrated();
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
  const { inset } = store.env.spacing;
  const inner = single
    ? {
        left: 0,
        top: switcherH,
        width: area.width + inset * 2,
        height: Math.max(0, area.height + inset * 2 - switcherH),
      }
    : { left: inset, top: inset, width: area.width, height: area.height };
  // One pane on screen, tiled: full-bleed and quiet, as a plain tab strip would be (ALONE_CHROME). Not a maximised
  // pane: the others are behind it, and it needs its Restore.
  const alone =
    !single && !page && !view.zoomed && m.resolved.panes.filter((b) => !b.hidden).length === 1;
  const chrome = single ? CHROME.single : alone ? ALONE_CHROME : CHROME.tiled;
  const bleed = alone
    ? { left: 0, top: 0, width: area.width + inset * 2, height: area.height + inset * 2 }
    : inner;
  // Stacked view (a portrait phone, phone.stack): two linked panes, unless the keyboard is up.
  const keyboardUp = useKeyboardUp();
  // The top pane's share once the person moves the divider; until then the kinds' heights decide it.
  const [stackRatio, setStackRatio] = useState<number | undefined>(undefined);
  // Across a fold the two halves stay whatever the keyboard does: they are two screens.
  const stacked = single && !page && !!m.stacked && (!keyboardUp || !!m.stacked.hinge);
  useStackAnnouncement(store, m, stacked);
  const placed = frames(
    m,
    view,
    mode,
    { width: inner.width, height: inner.height },
    stacked ? stackRatio : false,
    { x: inner.left, y: inner.top },
  );
  useFocusIntoStrip(store);
  // Each pane's content, rendered once in this flat list whatever frame shows it (content.tsx). Not while hydrating
  // a server's HTML, which has the content inside the frames.
  const hosts = useContentHosts(store, useRef(hydrated).current);
  useEffect(() => hosts.keep(new Set(placed.map((f) => f.node.id))));

  // A labelled region inside the host's page, or the page's main landmark when the host says Jali is the whole app.
  // Named by <JaliRoot aria-label>, a heading it points at, createJali({ label }), or Jali's own word.
  const Landmark = store.env.landmark === "main" ? "main" : "section";
  const content = hosts.get
    ? placed.map((f) => <PaneContent key={f.node.id} frame={f} at={hosts.get!(f.node.id)} />)
    : null;
  const named = useWorkspaceLabel();
  const name = named.by ? undefined : (named.label ?? store.messages.workspace.label);
  useUniqueName(named.by ?? name!);
  return (
    <ContentHosts.Provider value={hosts.get}>
      <Landmark
        className={["jali-workspace", single && "is-single", sliding && !single && "is-reshaping"]
          .filter(Boolean)
          .join(" ")}
        ref={ref}
        aria-label={name}
        aria-labelledby={named.by}
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
                dropTarget={!single && dropTarget === f.node.id}
              />
            ))}
          {single ? null : <DividerLayer />}
          {/* Rows that scroll sideways: their panes and dividers inside an element the browser scrolls. */}
          {single
            ? null
            : m.content.scrollers.map((s) => (
                <Strip
                  key={s.id}
                  strip={s}
                  zoomed={!!view.zoomed && s.paneIds.includes(view.zoomed)}
                >
                  {placed
                    .filter((f) => f.strip === s.id)
                    .map((f) => (
                      <PaneFrame
                        key={f.node.id}
                        frame={f}
                        chrome={chrome}
                        dropTarget={dropTarget === f.node.id}
                      />
                    ))}
                  <DividerLayer strip={s} />
                </Strip>
              ))}
          {stacked && m.stacked?.hinge ? <FoldLine hinge={m.stacked.hinge} origin={inner} /> : null}
          {stacked && m.stacked && !m.stacked.hinge ? (
            <StackDivider
              m={m}
              ratio={
                stackRatio ??
                stackShare(
                  m.env,
                  m.pane(m.stacked.top),
                  m.pane(m.stacked.bottom),
                  inner.height,
                  stackGap(store.env.spacing.gap),
                )
              }
              setRatio={setStackRatio}
              height={inner.height}
            />
          ) : null}
          {single ? null : <DragLayer m={m} />}
          {Ghost && ghost && !single && !dragging ? <Ghost role={ghost} /> : null}
          <Peek presentation={mode} />
        </div>
        {content}
      </Landmark>
    </ContentHosts.Provider>
  );
}
