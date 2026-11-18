import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { FoldHorizontal, RotateCcw } from "lucide-react";
import { GAP as JALI_GAP, layout as jl, type Layout, type UiStore } from "@jali/core";
import type { DemoLayoutId } from "./demo";
import { demoLayouts } from "./demo";
import { LiveWorkspace, resetLive, useLiveStore } from "./LiveWorkspace";

/** A live workspace in a frame the reader can resize, to watch panes fold and return. */
export interface FrameProps {
  layout: DemoLayoutId;
  /** Starting width in px; the reader can drag between minWidth and the column. */
  width?: number;
  minWidth?: number;
  height?: number;
  caption?: string;
}

const STEP = 16, STEP_BIG = 64;

/** A mark on the ruler: below this frame width, `folds` panes are folded (or one pane shows at a time). */
interface Mark { width: number; folded: string[]; single: boolean }

/**
 * Where folding changes, found by fitting the same layout at each width from widest to narrowest, as a reader
 * narrowing the frame would (refit keeps what it folded before, so each width starts from the one above it).
 */
function foldMarks(store: UiStore, base: Layout, inset: number, min: number, max: number): Mark[] {
  const view = { focusHistory: [] };
  const ctx0 = store.ctx();
  const marks: Mark[] = [];
  let l = base, prev: string | null = null;
  for (let w = max; w >= min; w -= 2) {
    const width = w - inset;
    if (!(width > 0)) break;
    const ctx = { ...ctx0, fit: { ...ctx0.fit, width } };
    l = jl.refit(l, view, ctx);
    const r = jl.resolve(l, view, ctx);
    const folded = r.shelf.filter((e) => e.reason === "folded").map((e) => e.paneId);
    const single = r.panes.some((b) => !b.hidden && b.rect.x + b.rect.width > width + 0.5);
    const key = `${folded.join()}|${single}`;
    if (prev !== null && key !== prev) marks.push({ width: w + 1, folded, single });
    prev = key;
  }
  return marks;
}

export function Frame({ layout, width, minWidth = 260, height = 320, caption }: FrameProps) {
  const store = useLiveStore(layout);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const track = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const [w, setW] = useState<number | null>(width ?? null);
  const [dragging, setDragging] = useState(false);

  // The most the frame can be: the column it sits in.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lo = Math.min(minWidth, max || minWidth);
  const cur = max ? Math.max(lo, Math.min(max, w ?? max)) : (w ?? 0);

  // The workspace's inset (its padding and border) between the frame's width and the room panes get.
  // Jali's inset around the panes plus the frame's own border.
  const main = box.current?.querySelector<HTMLElement>(".jali-workspace");
  const inset = (box.current && main ? box.current.offsetWidth - main.clientWidth : 2) + JALI_GAP * 2;
  const shape = JSON.stringify(m.layout.root);
  const marks = useMemo(() => {
    if (!max) return [];
    try {
      return foldMarks(store, { version: 1, root: m.layout.root }, inset, lo, max);
    } catch {
      return []; // the ruler is a guide; a fit it cannot work out never takes the page down
    }
  }, [store, shape, inset, lo, max]);

  const set = (v: number) => setW(Math.round(Math.max(lo, Math.min(max, v))));
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? STEP_BIG : STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(cur - step);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") set(cur + step);
    else if (e.key === "Home") set(lo);
    else if (e.key === "End") set(max);
    else return;
    e.preventDefault();
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = e.clientX, from = cur;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus({ preventScroll: true });
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => set(from + ev.clientX - start);
    const up = () => {
      setDragging(false);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("live-frame-resizing");
    return () => document.body.classList.remove("live-frame-resizing");
  }, [dragging]);

  const folded = m.folded;
  const ticks = max ? Array.from({ length: Math.floor(max / 100) }, (_, i) => (i + 1) * 100) : [];
  const nextFold = marks.find((k) => k.width <= cur);
  const nextBack = [...marks].reverse().find((k) => k.width > cur);

  return (
    <figure className="live-figure live-frame" data-live="frame" data-dragging={dragging || undefined} aria-label={caption ?? demoLayouts[layout]}>
      <div className="live-frame-bar">
        <div className="live-frame-width" aria-live="off">
          <b>{Math.round(cur)}</b><span>px wide</span>
        </div>
        <div className="live-frame-folds" aria-live="polite">
          {m.single ? (
            <span className="live-frame-note">One pane at a time: even one pane no longer fits beside another</span>
          ) : folded.length ? (
            <>
              <span className="live-frame-label"><FoldHorizontal size={13} strokeWidth={1.75} aria-hidden /> Folded</span>
              {folded.map((id) => <span className="live-frame-chip" key={id}>{m.title(id)}</span>)}
            </>
          ) : (
            <span className="live-frame-note">Everything fits</span>
          )}
        </div>
        <button type="button" className="live-icon-btn" aria-label="Reset the layout and width" title="Reset" onClick={() => { setW(width ?? null); resetLive(store, layout); }}>
          <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="live-frame-track" ref={track}>
        <div className="live-ruler" aria-hidden>
          {ticks.map((t) => <span key={t} className="live-ruler-tick" style={{ left: t }}><i>{t}</i></span>)}
          {marks.map((k) => (
            <span key={k.width} className="live-ruler-mark" data-single={k.single || undefined} data-passed={k.width > cur || undefined} style={{ left: k.width }}
              title={k.single ? `Below ${k.width}px: one pane at a time` : `Below ${k.width}px: ${k.folded.length} folded`} />
          ))}
          <span className="live-ruler-cursor" style={{ left: cur }} />
        </div>
        <div className="live-frame-room">
          <div className="live-frame-box" ref={box} style={{ width: cur || "100%" }}>
            <LiveWorkspace store={store} height={height} />
            <div
              className="live-frame-handle"
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Frame width"
              aria-valuemin={Math.round(lo)}
              aria-valuemax={Math.round(max)}
              aria-valuenow={Math.round(cur)}
              aria-valuetext={`${Math.round(cur)} pixels${folded.length ? `, ${folded.length} folded` : ""}`}
              onKeyDown={onKey}
              onPointerDown={onDown}
            >
              <span aria-hidden />
            </div>
          </div>
        </div>
      </div>
      <p className="live-frame-hint">
        Drag the frame's edge{nextFold && !m.single ? `. Narrower than ${nextFold.width}px, ${nextFold.single ? "one pane shows at a time" : "another pane folds"}` : ""}
        {nextBack ? `${nextFold && !m.single ? "; wider" : ". Wider"} than ${nextBack.width}px, ${folded.length || m.single ? "a pane returns" : "it all fits"}` : ""}.
      </p>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}
