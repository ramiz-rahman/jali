import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import { StoreProvider } from "@jali/react";
import type { DemoLayoutId } from "./demo";
import { demoLayouts } from "./demo";
import { JsonView } from "./JsonView";
import { LayoutTree, PreviewRects, panesUnder, type Hover } from "./LayoutTree";
import { LiveWorkspace, resetLive, useLiveStore } from "./LiveWorkspace";
import { useLitPanes } from "./light";
import { layout as jl, type Rect } from "@jali/core";

/** A live workspace beside its layout tree, kept in step. */
export interface TreeViewProps {
  layout: DemoLayoutId;
  /** Show the JSON toggle. Default true. */
  json?: boolean;
  /** Height of the workspace in px. Default 360. */
  height?: number;
  caption?: string;
  /** Start on the JSON view instead of the tree. */
  showJson?: boolean;
}

export function TreeView({ layout, json = true, height = 360, caption, showJson = false }: TreeViewProps) {
  const store = useLiveStore(layout);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const [hover, setHover] = useState<Hover | null>(null);
  const [mode, setMode] = useState<"tree" | "json">(json && showJson ? "json" : "tree");
  const wrap = useRef<HTMLDivElement | null>(null);

  // A tree node lights the panes under it and dims the rest; a pane under the pointer only marks its tree node.
  const lit = useMemo(() => {
    if (!hover) return null;
    const node = jl.tree.find(m.layout.root, hover.id);
    return node ? panesUnder(node) : null;
  }, [hover, m.layout.root]);
  useLitPanes(wrap, hover?.from === "tree" ? lit : null, true, m);
  const preview = useDragPreview(wrap);

  const fromWs = (e: PointerEvent) => {
    const id = (e.target as Element).closest<HTMLElement>("[data-pane]")?.dataset.pane
      ?? (e.target as Element).closest<HTMLElement>("[data-tab]")?.dataset.tab;
    if (id && (hover?.id !== id || hover.from !== "ws")) setHover({ id, from: "ws" });
    else if (!id && hover?.from === "ws") setHover(null);
  };

  return (
    <figure className="live-figure live-tv" data-live="tree-view" aria-label={caption ?? demoLayouts[layout]}>
      <div className="live-tv-grid">
        <div className="live-stage" onPointerOver={fromWs} onPointerLeave={() => hover?.from === "ws" && setHover(null)}>
          <LiveWorkspace store={store} height={height} wrapRef={wrap} />
        </div>
        <StoreProvider store={store}>
          <PreviewRects.Provider value={preview}>
          <section className="live-panel" aria-label="Layout tree">
            <header className="live-panel-head">
              <span className="live-panel-title">{mode === "tree" ? "Layout tree" : "Layout JSON"}</span>
              <span className="live-panel-tools">
                {json ? (
                  <span className="live-seg" role="group" aria-label="Show the layout as">
                    <button type="button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>Tree</button>
                    <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>JSON</button>
                  </span>
                ) : null}
                <button type="button" className="live-icon-btn" aria-label="Reset the layout" title="Reset the layout" onClick={() => { setHover(null); resetLive(store, layout); }}>
                  <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
                </button>
              </span>
            </header>
            <div className="live-panel-body" style={{ ["--live-ws-h" as string]: `${height}px` }}>
              {mode === "tree"
                ? <LayoutTree hover={hover} setHover={setHover} />
                : <JsonView value={m.layout} hover={hover} setHover={setHover} label="The layout as JSON" />}
            </div>
          </section>
          </PreviewRects.Provider>
        </StoreProvider>
      </div>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * A divider drag moves the panes on the DOM each frame and commits once on release, so the store does not change
 * while it runs. The tree reads the panes' boxes from the DOM meanwhile, so its sizes move with the pointer.
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
