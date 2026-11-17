/**
 * The dividers. The pointer drag is ours (`drag.ts`: pointer capture, one rAF per frame, direct DOM writes, one
 * commit on release); keys commit per keypress; double-click resets; the URL is written 120ms after the last change.
 */
import { useLayoutEffect, useRef } from "react";
import type { DividerBox, NodeId } from "../../layout-core/types";
import { actions, resolved, useUi } from "../store";
import { paneDomId } from "../ids";
import { clampSize, geometryFor, isDividerDragging, setDragOverlay, startDividerDrag } from "./drag";
import { Divider, dividerKey } from "./Divider";

/** Keyboard resize of one divider to an absolute first-neighbour size, from the committed model. */
function setSizeA(parentId: NodeId, index: number, target: number) {
  if (isDividerDragging()) return;
  const d = resolved().dividers.find((x) => x.parentId === parentId && x.index === index);
  const g = d && geometryFor(d);
  if (!g) return;
  const size = clampSize(target, g.a.min, g.divider.max);
  actions.resizeDivider(parentId, index, Math.round(size - g.a.size));
}

/** The line shown while dragging: drawn by drag.ts straight onto the DOM, never by React. */
function DragLine() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    setDragOverlay(ref.current);
    return () => setDragOverlay(null);
  }, []);
  return (
    <div ref={ref} className="divider-visual" data-testid="divider-preview" hidden aria-hidden>
      <span className="divider-line" />
      <span className="divider-tick" hidden />
    </div>
  );
}

export function DividerLayer() {
  const zoomed = useUi((s) => s.view.zoomed);
  useUi((s) => s.layout);
  useUi((s) => s.area);
  if (zoomed) return null;
  const r = resolved();
  return (
    <div className="divider-layer">
      {r.dividers.map((d: DividerBox) => {
        const g = geometryFor(d, r);
        if (!g) return null;
        return (
          <Divider
            key={dividerKey(d)}
            parentId={d.parentId}
            index={d.index}
            axis={g.axis}
            rect={d.rect}
            sizeA={g.a.size}
            minA={g.a.min}
            maxA={g.divider.max}
            total={g.total}
            labelA={g.a.label}
            labelB={g.b.label}
            controls={g.a.ids.map(paneDomId).join(" ")}
            onDragStart={(e) => startDividerDrag(e, d.parentId, d.index)}
            setSizeA={(size) => setSizeA(d.parentId, d.index, size)}
            onReset={() => actions.resetDivider(d.parentId, d.index)}
          />
        );
      })}
      <DragLine />
    </div>
  );
}

/** For resize mode: the divider nearest to a pane in a direction. */
export function nearestDivider(paneId: string, horizontal: boolean): DividerBox | null {
  const r = resolved();
  const box = r.panes.find((b) => b.id === paneId && !b.hidden);
  if (!box) return null;
  const pr = box.rect, gap = 6;
  const cands = r.dividers.filter((d) => d.axis === (horizontal ? "row" : "column"));
  const overlaps = (d: DividerBox) =>
    horizontal ? d.rect.y < pr.y + pr.height && d.rect.y + d.rect.height > pr.y : d.rect.x < pr.x + pr.width && d.rect.x + d.rect.width > pr.x;
  const after = cands.find((d) => overlaps(d) && Math.abs((horizontal ? d.rect.x : d.rect.y) - (horizontal ? pr.x + pr.width : pr.y + pr.height)) <= gap);
  return after ?? cands.find((d) => overlaps(d) && Math.abs((horizontal ? d.rect.x + d.rect.width : d.rect.y + d.rect.height) - (horizontal ? pr.x : pr.y)) <= gap) ?? null;
}

export { STEP, STEP_BIG } from "./Divider";
export { clampSize, snap, SNAP_IN, SNAP_OUT } from "./drag";
