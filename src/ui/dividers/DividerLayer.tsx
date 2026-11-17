/**
 * Shared divider controller. The pointer drag is ours (`drag.ts`: pointer capture, one rAF per frame, direct DOM
 * writes, one commit on release). APG keys (arrows 16px, Shift 64px, Home/End, Enter collapse/restore) commit per
 * keypress; double-click resets; the URL is written 120ms after the last change (history "debounce").
 * The adapter only renders the separator element.
 */
import { memo, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { DividerBox, NodeId, Rect } from "../../layout-core/types";
import { actions, GAP, resolved, useUi } from "../store";
import { paneDomId } from "../ids";
import { arkAdapter } from "./ark";
import { ownAdapter } from "./own";
import { clampSize, dividerKey, geometryFor, isDividerDragging, setDragOverlay, startDividerDrag } from "./drag";
import type { DividerAdapter } from "./types";

export { clampSize, snap, SNAP_IN, SNAP_OUT } from "./drag";

export const ADAPTERS: Record<"own" | "ark", DividerAdapter> = { own: ownAdapter, ark: arkAdapter };

export const STEP = 16;
export const STEP_BIG = 64;

/** Keyboard resize of one divider to an absolute first-neighbour size, from the committed model. */
function setSizeA(parentId: NodeId, index: number, target: number) {
  if (isDividerDragging()) return;
  const d = resolved().dividers.find((x) => x.parentId === parentId && x.index === index);
  const g = d && geometryFor(d);
  if (!g) return;
  const size = clampSize(target, g.a.min, g.divider.max);
  actions.resizeDivider(parentId, index, Math.round(size - g.a.size));
}

interface DividerProps {
  adapter: DividerAdapter;
  parentId: NodeId;
  index: number;
  axis: "row" | "column";
  rect: Rect;
  pair: Rect;
  sizeA: number;
  minA: number;
  maxA: number;
  total: number;
  labelA: string;
  labelB: string;
  controls: string;
  lastA: NodeId;
}

const rectEq = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Memoised on its geometry and labels: a resize re-renders only the dividers that actually moved. */
const Divider = memo(
  function Divider(p: DividerProps) {
    const row = p.axis === "row";
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const step = e.shiftKey ? STEP_BIG : STEP;
      const dec = row ? "ArrowLeft" : "ArrowUp";
      const inc = row ? "ArrowRight" : "ArrowDown";
      if (e.key === dec || e.key === inc) {
        e.preventDefault();
        setSizeA(p.parentId, p.index, p.sizeA + (e.key === inc ? step : -step));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSizeA(p.parentId, p.index, p.minA);
      } else if (e.key === "End") {
        e.preventDefault();
        setSizeA(p.parentId, p.index, p.maxA);
      }
      // Enter does nothing: the rail-era collapse is gone, and a tuck would remove this divider from under focus (DECISIONS, 17 Nov).
    };
    const A = p.adapter.Divider;
    return (
      <A
        axis={p.axis}
        rect={p.rect}
        pair={p.pair}
        gap={GAP}
        sizeA={p.sizeA}
        minA={p.minA}
        maxA={p.maxA}
        total={p.total}
        labelA={p.labelA}
        labelB={p.labelB}
        controls={p.controls}
        dividerKey={dividerKey(p)}
        className={`divider divider-${p.axis}`}
        onPointerDown={(e: PointerEvent<HTMLElement>) => startDividerDrag(e, p.parentId, p.index)}
        onReset={() => actions.resetDivider(p.parentId, p.index)}
        onKeyDown={onKeyDown}
      />
    );
  },
  (a, b) =>
    a.adapter === b.adapter && a.parentId === b.parentId && a.index === b.index && a.axis === b.axis &&
    rectEq(a.rect, b.rect) && rectEq(a.pair, b.pair) &&
    a.sizeA === b.sizeA && a.minA === b.minA && a.maxA === b.maxA && a.total === b.total &&
    a.labelA === b.labelA && a.labelB === b.labelB && a.controls === b.controls && a.lastA === b.lastA,
);

/** The line shown while dragging: drawn by drag.ts straight onto the DOM, never by React. */
function DragLine() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    setDragOverlay(ref.current);
    return () => setDragOverlay(null);
  }, []);
  return (
    <div ref={ref} className="divider-visual" hidden aria-hidden>
      <span className="divider-line" />
      <span className="divider-tick" hidden />
    </div>
  );
}

export function DividerLayer() {
  const adapterId = useUi((s) => s.settings.adapter);
  const zoomed = useUi((s) => s.view.zoomed);
  useUi((s) => s.layout);
  useUi((s) => s.area);
  if (zoomed) return null;
  const r = resolved();
  const adapter = ADAPTERS[adapterId] ?? ownAdapter;
  return (
    <div className="divider-layer" data-adapter={adapter.id}>
      {r.dividers.map((d: DividerBox) => {
        const g = geometryFor(d, r);
        if (!g) return null;
        return (
          // Key by adapter too, so switching remounts cleanly.
          <Divider
            key={`${adapter.id}:${dividerKey(d)}`}
            adapter={adapter}
            parentId={d.parentId}
            index={d.index}
            axis={g.axis}
            rect={d.rect}
            pair={g.pair}
            sizeA={g.a.size}
            minA={g.a.min}
            maxA={g.divider.max}
            total={g.total}
            labelA={g.a.label}
            labelB={g.b.label}
            controls={g.a.ids.map(paneDomId).join(" ")}
            lastA={g.a.ids[g.a.ids.length - 1]!}
          />
        );
      })}
      <DragLine />
    </div>
  );
}

/** For resize mode: the divider nearest to a pane in a direction, as (parentId, index, sign). */
export function nearestDivider(paneId: string, horizontal: boolean): { d: DividerBox; sign: 1 | -1 } | null {
  const r = resolved();
  const box = r.panes.find((b) => b.id === paneId && !b.hiddenInStack);
  if (!box) return null;
  const pr = box.rect;
  const axis = horizontal ? "row" : "column";
  const cands = r.dividers.filter((d) => d.axis === axis);
  const overlaps = (d: DividerBox) =>
    horizontal ? d.rect.y < pr.y + pr.height && d.rect.y + d.rect.height > pr.y : d.rect.x < pr.x + pr.width && d.rect.x + d.rect.width > pr.x;
  const after = cands.find((d) => overlaps(d) && Math.abs((horizontal ? d.rect.x : d.rect.y) - (horizontal ? pr.x + pr.width : pr.y + pr.height)) <= GAP);
  if (after) return { d: after, sign: 1 };
  const before = cands.find((d) => overlaps(d) && Math.abs((horizontal ? d.rect.x + d.rect.width : d.rect.y + d.rect.height) - (horizontal ? pr.x : pr.y)) <= GAP);
  if (before) return { d: before, sign: -1 };
  return null;
}
