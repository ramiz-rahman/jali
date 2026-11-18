import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { Braces, Hand, MousePointerClick, MoveHorizontal, Network, RotateCcw, X } from "lucide-react";
import { layout as jl, type Rect, type WorkspaceModel } from "@jali/core/adapter";
import { WorkspaceProvider } from "@jali/react";
import type { DemoLayoutId } from "./demo";
import { demoLayouts } from "./demo";
import { colourOf } from "./colours";
import { JsonView } from "./JsonView";
import { LayoutMap } from "./LayoutMap";
import { OverlayCard, PreviewRects, panesUnder, type Hover } from "./LayoutTree";
import { LiveWorkspace, resetLive, useLiveStore } from "./LiveWorkspace";
import { useLitPanes, usePaneColours } from "./light";

/** A live workspace beside its layout tree, kept in step. */
export interface TreeViewProps {
  layout: DemoLayoutId;
  /** Show the JSON toggle. Default true. `false` is `panels="map"`. */
  json?: boolean;
  /** Height of the workspace: px, or any CSS length such as "min(76vh, 760px)". Default 360. */
  height?: number | string;
  caption?: string;
  /** Start on the JSON view instead of the map. */
  showJson?: boolean;
  /** For pages that teach the model: sizes shown from the start, and the overlay card under the map. Default false. */
  detail?: boolean;
  /** The row of things to try under the figure. Default true. */
  tries?: boolean;
  /**
   * What sits beside the workspace. "auto" (default): the map and the JSON side by side when the figure is about
   * 1200px wide or more, else one of them with a Map | JSON toggle. "map" or "json": only that one.
   * "map+json": both, side by side when there is room, else one above the other.
   * "collapsed": the workspace takes the whole figure; the map and the JSON slide in over it from a toggle, closed
   * at first (for a hero, where the workspace is the showcase).
   */
  panels?: "auto" | "map" | "json" | "map+json" | "collapsed";
}

/** Wide enough (px) for the workspace, the map and the JSON side by side. */
const THREE_UP = 1200;

/** What a reader can do in the workspace as it is now (a phone shows one pane, so there is no gap to drag). */
function triesFor(m: WorkspaceModel, json: boolean, tree = true): { icon: ReactNode; text: string }[] {
  const list = m.panes.find((p) => p.ref.kind === "orders" && m.visible.includes(p.id));
  const follows = !!list && m.panes.some((p) => p.linkedTo === list.id && p.follows && m.visible.includes(p.id));
  return [
    ...(follows ? [{ icon: <MousePointerClick size={15} strokeWidth={1.75} aria-hidden />, text: "Click an order, and the detail follows" }] : []),
    ...(m.resolved.dividers.length ? [{ icon: <MoveHorizontal size={15} strokeWidth={1.75} aria-hidden />, text: "Drag the divider between panes" }] : []),
    ...(m.panes.length > 1 ? [{ icon: <X size={15} strokeWidth={1.75} aria-hidden />, text: "Close a pane" }] : []),
    tree
      ? { icon: <Hand size={15} strokeWidth={1.75} aria-hidden />, text: json ? "Point at a box or a JSON block to find its pane" : "Point at a box to find its pane" }
      : { icon: <Network size={15} strokeWidth={1.75} aria-hidden />, text: "Show the layout tree to see how it is built" },
  ];
}

export function TreeView({ layout, json = true, height = 360, caption, showJson = false, detail = false, tries = true, panels }: TreeViewProps) {
  const store = useLiveStore(layout);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const [hover, setHover] = useState<Hover | null>(null);
  const [mode, setMode] = useState<"map" | "json">(showJson ? "json" : "map");
  const [sizes, setSizes] = useState(detail);
  const wrap = useRef<HTMLDivElement | null>(null);
  const fig = useRef<HTMLElement | null>(null);
  const width = useWidth(fig);

  const want = panels ?? (json ? "auto" : "map");
  const collapsed = want === "collapsed";
  const [open, setOpen] = useState(false);
  const three = (want === "auto" && width >= THREE_UP) || (want === "map+json" && width >= 56 * 16);
  const both = want === "map+json" || three;
  const toggle = !both && (want === "auto" || collapsed);
  const showMap = both || want === "map" || (toggle && mode === "map");
  const showJsonPanel = both || want === "json" || (toggle && mode === "json");

  // A box in the map lights the panes under it and dims the rest; a pane under the pointer lights its box.
  const lit = useMemo(() => {
    if (!hover) return null;
    const node = jl.tree.find(m.layout.root, hover.id);
    return node ? panesUnder(node) : null;
  }, [hover, m.layout.root]);
  useLitPanes(wrap, hover?.from === "tree" ? lit : null, true, m);
  usePaneColours(wrap, colourOf, m);
  const preview = useDragPreview(wrap);

  const fromWs = (e: PointerEvent) => {
    const t = e.target as Element;
    const id = t.closest<HTMLElement>("[data-tab]")?.dataset.tab ?? t.closest<HTMLElement>("[data-pane]")?.dataset.pane;
    if (id && (hover?.id !== id || hover.from !== "ws")) setHover({ id, from: "ws" });
    else if (!id && hover?.from === "ws") setHover(null);
  };
  const reset = (
    <button type="button" className="live-icon-btn" aria-label="Reset the layout" title="Reset the layout" onClick={() => { setHover(null); resetLive(store, layout); }}>
      <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
    </button>
  );
  const switcher = toggle ? (
    <span className="live-seg" role="group" aria-label="Show the layout as">
      <button type="button" aria-pressed={mode === "map"} onClick={() => setMode("map")}>Map</button>
      <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>JSON</button>
    </span>
  ) : null;
  const h = typeof height === "number" ? `${height}px` : height;
  const drawerId = `${store.dom.id}-drawer`;
  const show = (which: "map" | "json") => {
    if (open && mode === which) setOpen(false);
    else { setMode(which); setOpen(true); }
  };
  const close = collapsed ? (
    <button type="button" className="live-icon-btn" aria-label="Close the layout tree" title="Close" onClick={() => { setOpen(false); setHover(null); }}>
      <X size={15} strokeWidth={1.75} aria-hidden />
    </button>
  ) : null;

  const mapPanel = (
    <section className="live-panel" data-panel="map" aria-label="Layout tree, drawn as a map">
      <header className="live-panel-head">
        <span className="live-panel-title"><b>Layout tree</b><span>drawn as a map of the panes</span></span>
        <span className="live-panel-tools">
          <button type="button" className="live-toggle" aria-pressed={sizes} onClick={() => setSizes((v) => !v)}>Sizes</button>
          {switcher}
          {collapsed ? null : reset}
          {close}
        </span>
      </header>
      <div className="live-panel-body">
        <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
        {detail ? <OverlayCard m={m} /> : null}
      </div>
    </section>
  );
  const jsonPanel = (
    <section className="live-panel" data-panel="json" aria-label="Layout tree, as JSON">
      <header className="live-panel-head">
        <span className="live-panel-title"><b>{both ? "JSON" : "Layout tree"}</b><span>{both ? "the same tree, as data" : "as JSON, the same tree as data"}</span></span>
        <span className="live-panel-tools">
          {switcher}
          {showMap || collapsed ? null : reset}
          {close}
        </span>
      </header>
      <div className="live-panel-body is-json">
        <JsonView value={m.layout} hover={hover} setHover={setHover} label="The layout as JSON" compact={three && width < 1560} />
      </div>
    </section>
  );

  if (collapsed) {
    return (
      <figure className="live-figure live-tv" ref={fig} data-live="tree-view" data-parts="1" data-open={open || undefined}
        aria-label={caption ?? demoLayouts[layout]} style={{ ["--live-ws-h" as string]: h }}>
        {tries ? (
          <ul className="live-tries" aria-label="Things to try">
            {triesFor(m, open && mode === "json", open).map((t) => <li key={t.text}>{t.icon}<span>{t.text}</span></li>)}
          </ul>
        ) : null}
        <div className="live-tv-grid">
          <div className="live-tv-bar">
            <span className="live-tv-bar-label"><span className="live-tv-live" aria-hidden />Live workspace</span>
            <span className="live-tv-bar-tools">
              <button type="button" className="live-reveal" aria-expanded={open && mode === "map"} aria-controls={drawerId} onClick={() => show("map")}>
                <Network size={15} strokeWidth={1.75} aria-hidden />{open && mode === "map" ? "Hide the layout tree" : "Show the layout tree"}
              </button>
              <button type="button" className="live-reveal" aria-expanded={open && mode === "json"} aria-controls={drawerId} onClick={() => show("json")}>
                <Braces size={15} strokeWidth={1.75} aria-hidden />JSON
              </button>
              {reset}
            </span>
          </div>
          <div className="live-stage" onPointerOver={fromWs} onPointerLeave={() => hover?.from === "ws" && setHover(null)}>
            <LiveWorkspace store={store} height={h} wrapRef={wrap} />
            <WorkspaceProvider workspace={store}>
              <PreviewRects.Provider value={preview}>
                <div className="live-drawer" id={drawerId} data-open={open || undefined} inert={!open || undefined}
                  onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }}>
                  {mode === "map" ? mapPanel : jsonPanel}
                </div>
              </PreviewRects.Provider>
            </WorkspaceProvider>
          </div>
        </div>
        {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure className="live-figure live-tv" ref={fig} data-live="tree-view" data-detail={detail || undefined} data-parts={three ? "3" : both ? "2+" : "2"}
      aria-label={caption ?? demoLayouts[layout]} style={{ ["--live-ws-h" as string]: h }}>
      {tries ? (
        <ul className="live-tries" aria-label="Things to try">
          {triesFor(m, showJsonPanel).map((t) => <li key={t.text}>{t.icon}<span>{t.text}</span></li>)}
        </ul>
        ) : null}
        <div className="live-tv-grid">
        <div className="live-stage" onPointerOver={fromWs} onPointerLeave={() => hover?.from === "ws" && setHover(null)}>
          <LiveWorkspace store={store} height={h} wrapRef={wrap} />
        </div>
        <WorkspaceProvider workspace={store}>
          <PreviewRects.Provider value={preview}>
            {both ? (
              three ? <>{mapPanel}{jsonPanel}</> : <div className="live-panels">{mapPanel}{jsonPanel}</div>
            ) : showMap ? mapPanel : showJsonPanel ? jsonPanel : null}
          </PreviewRects.Provider>
        </WorkspaceProvider>
      </div>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/** The figure's width, measured (0 before the first measure, as on the server). */
function useWidth(ref: { current: HTMLElement | null }): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * A divider drag moves the panes on the DOM each frame and commits once on release, so the store does not change
 * while it runs. The map reads the panes' boxes from the DOM meanwhile, so its shares move with the pointer.
 */
function useDragPreview(wrap: { current: HTMLElement | null }): Record<string, Rect> | null {
  const [rects, setRects] = useState<Record<string, Rect> | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      if (!el.querySelector(".jali-divider.is-dragging")) {
        setRects(null);
        raf = 0;
        return;
      }
      const next: Record<string, Rect> = {};
      el.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => {
        if (p.style.display === "none") return;
        next[p.dataset.pane!] = { x: parseFloat(p.style.left), y: parseFloat(p.style.top), width: parseFloat(p.style.width), height: parseFloat(p.style.height) };
      });
      setRects((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = requestAnimationFrame(read);
    };
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".jali-divider")) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    el.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("pointerdown", onDown); cancelAnimationFrame(raf); };
  }, [wrap]);
  return rects;
}
