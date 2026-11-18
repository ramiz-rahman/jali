import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { Hand, MousePointerClick, MoveHorizontal, RotateCcw, X } from "lucide-react";
import { layout as jl, type Rect, type WorkspaceModel } from "@jali/core";
import { StoreProvider } from "@jali/react";
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
  /** Show the JSON toggle. Default true. */
  json?: boolean;
  /** Height of the workspace in px. Default 360. */
  height?: number;
  caption?: string;
  /** Start on the JSON view instead of the map. */
  showJson?: boolean;
  /** For pages that teach the model: sizes shown from the start, and the overlay card under the map. Default false. */
  detail?: boolean;
  /** The row of things to try under the figure. Default true. */
  tries?: boolean;
}

/** What a reader can do in the workspace as it is now (a phone shows one pane, so there is no gap to drag). */
function triesFor(m: WorkspaceModel): { icon: ReactNode; text: string }[] {
  const list = m.panes.find((p) => p.ref.kind === "orders" && m.visible.includes(p.id));
  const follows = !!list && m.panes.some((p) => p.linkedTo === list.id && p.follows && m.visible.includes(p.id));
  return [
    ...(follows ? [{ icon: <MousePointerClick size={15} strokeWidth={1.75} aria-hidden />, text: "Click an order, and the detail follows" }] : []),
    ...(m.resolved.dividers.length ? [{ icon: <MoveHorizontal size={15} strokeWidth={1.75} aria-hidden />, text: "Drag the gap between panes" }] : []),
    ...(m.panes.length > 1 ? [{ icon: <X size={15} strokeWidth={1.75} aria-hidden />, text: "Close a pane" }] : []),
    { icon: <Hand size={15} strokeWidth={1.75} aria-hidden />, text: "Point at a box to find its pane" },
  ];
}

export function TreeView({ layout, json = true, height = 360, caption, showJson = false, detail = false, tries = true }: TreeViewProps) {
  const store = useLiveStore(layout);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const [hover, setHover] = useState<Hover | null>(null);
  const [mode, setMode] = useState<"map" | "json">(json && showJson ? "json" : "map");
  const [sizes, setSizes] = useState(detail);
  const wrap = useRef<HTMLDivElement | null>(null);

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

  return (
    <figure className="live-figure live-tv" data-live="tree-view" data-detail={detail || undefined} aria-label={caption ?? demoLayouts[layout]}
      style={{ ["--live-ws-h" as string]: `${height}px` }}>
      <div className="live-tv-grid">
        <div className="live-stage" onPointerOver={fromWs} onPointerLeave={() => hover?.from === "ws" && setHover(null)}>
          <LiveWorkspace store={store} height={height} wrapRef={wrap} />
        </div>
        <StoreProvider store={store}>
          <PreviewRects.Provider value={preview}>
            <section className="live-panel" aria-label="Layout tree">
              <header className="live-panel-head">
                <span className="live-panel-title">
                  <b>Layout tree</b>
                  <span>{mode === "map" ? "drawn as a map of the panes" : "as stored and linked"}</span>
                </span>
                <span className="live-panel-tools">
                  {mode === "map" ? (
                    <button type="button" className="live-toggle" aria-pressed={sizes} onClick={() => setSizes((v) => !v)}>Sizes</button>
                  ) : null}
                  {json ? (
                    <span className="live-seg" role="group" aria-label="Show the layout as">
                      <button type="button" aria-pressed={mode === "map"} onClick={() => setMode("map")}>Map</button>
                      <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>JSON</button>
                    </span>
                  ) : null}
                  <button type="button" className="live-icon-btn" aria-label="Reset the layout" title="Reset the layout" onClick={() => { setHover(null); resetLive(store, layout); }}>
                    <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                </span>
              </header>
              <div className="live-panel-body">
                {mode === "map" ? (
                  <>
                    <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
                    {detail ? <OverlayCard m={m} /> : null}
                  </>
                ) : (
                  <JsonView value={m.layout} hover={hover} setHover={setHover} label="The layout as JSON" />
                )}
              </div>
            </section>
          </PreviewRects.Provider>
        </StoreProvider>
      </div>
      {tries ? (
        <ul className="live-tries" aria-label="Things to try">
          {triesFor(m).map((t) => <li key={t.text}>{t.icon}<span>{t.text}</span></li>)}
        </ul>
      ) : null}
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
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
