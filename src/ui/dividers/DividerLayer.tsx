/**
 * Shared divider controller: clamp at both minimums, centre snap (enter 10px, leave 16px), APG keys
 * (arrows 16px, Shift 64px, Home/End, Enter collapse/restore), double-click reset, persist 120ms after the
 * last move (via history "debounce"), heavy-pane hold (dividerDrag flag). The adapter only renders.
 */
import { memo, useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { DividerBox, SplitNode } from "../../layout-core/types";
import { actions, findNode, fit, GAP, hooks, resolved, setState, titleOf, useUi } from "../store";
import { pairGeometry, type PairGeometry } from "../geometry";
import { paneDomId } from "../ids";
import { arkAdapter } from "./ark";
import { rrpAdapter } from "./rrp";
import type { DividerAdapter } from "./types";

export const ADAPTERS: Record<"rrp" | "ark", DividerAdapter> = { rrp: rrpAdapter, ark: arkAdapter };

export const SNAP_IN = 10;
export const SNAP_OUT = 16;
export const STEP = 16;
export const STEP_BIG = 64;

/** Pure snap with hysteresis, exported for tests. */
export function snap(size: number, centre: number, wasSnapped: boolean): { size: number; snapped: boolean } {
  const d = Math.abs(size - centre);
  const snapped = wasSnapped ? d <= SNAP_OUT : d <= SNAP_IN;
  return { size: snapped ? centre : size, snapped };
}

export function clampSize(size: number, min: number, max: number) {
  return Math.max(min, Math.min(max, size));
}

function label(ids: string[]) {
  return ids.length === 1 ? titleOf(ids[0]) : `${titleOf(ids[0])} and ${ids.length - 1} more`;
}

function geometryFor(d: DividerBox): PairGeometry | null {
  const parent = findNode(d.parentId);
  const split = parent && (parent.type === "row" || parent.type === "column") ? (parent as SplitNode) : undefined;
  return pairGeometry(d, split, resolved().panes, fit().kinds, GAP, label);
}

const Divider = memo(function Divider({ d, adapter }: { d: DividerBox; adapter: DividerAdapter }) {
  useUi((s) => s.layout); // re-render with the model
  const g = geometryFor(d);
  const [snapped, setSnapped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const snappedRef = useRef(false);

  const current = () => geometryFor(d);

  const setA = useCallback(
    (target: number, opts: { snap: boolean }) => {
      const cg = current();
      if (!cg) return;
      const max = cg.divider.max;
      let size = clampSize(target, cg.a.min, max);
      if (opts.snap) {
        const s = snap(size, cg.total / 2, snappedRef.current);
        if (s.snapped && cg.total / 2 >= cg.a.min && cg.total / 2 <= max) size = s.size;
        if (s.snapped !== snappedRef.current) {
          snappedRef.current = s.snapped;
          setSnapped(s.snapped);
        }
      }
      actions.resizeDivider(d.parentId, d.index, Math.round(size - cg.a.size));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.parentId, d.index],
  );

  if (!g) return null;
  const maxA = g.divider.max;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const row = g.axis === "row";
    const step = e.shiftKey ? STEP_BIG : STEP;
    const dec = row ? "ArrowLeft" : "ArrowUp";
    const inc = row ? "ArrowRight" : "ArrowDown";
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === dec || e.key === inc) {
      e.preventDefault();
      setA(g.a.size + (e.key === inc ? step : -step), { snap: false });
    } else if (e.key === "Home") {
      e.preventDefault();
      setA(g.a.min, { snap: false });
    } else if (e.key === "End") {
      e.preventDefault();
      setA(maxA, { snap: false });
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter collapses the pane before the divider, or restores it.
      const id = g.a.ids[g.a.ids.length - 1]!;
      actions.setCollapsed(id);
    }
  };

  const A = adapter.Divider;
  const vr = d.rect;
  return (
    <>
    {dragging ? (
      // During a drag the visible line follows the model (clamped, snapped), not the library's pointer position.
      <div className={`divider-visual divider-${g.axis}${snapped ? " is-snapped" : ""}`} style={{ left: vr.x, top: vr.y, width: vr.width, height: vr.height }} aria-hidden>
        <span className="divider-line" />
        {snapped ? <span className="divider-tick" /> : null}
      </div>
    ) : null}
    <A
      axis={g.axis}
      pair={g.pair}
      gap={GAP}
      sizeA={g.a.size}
      minA={g.a.min}
      maxA={maxA}
      total={g.total}
      labelA={g.a.label}
      labelB={g.b.label}
      controls={g.a.ids.map(paneDomId).join(" ")}
      snapped={snapped}
      dragging={dragging}
      className={`divider divider-${g.axis}${dragging ? " is-dragging" : ""}${snapped && dragging ? " is-snapped" : ""}`}
      onDragStart={() => {
        snappedRef.current = false;
        setSnapped(false);
        setDragging(true);
        setState({ dividerDrag: true });
      }}
      onDrag={(size) => setA(size, { snap: true })}
      onDragEnd={() => {
        setDragging(false);
        setState({ dividerDrag: false });
        hooks.writeUrl("debounce");
      }}
      onReset={() => actions.resetDivider(d.parentId, d.index)}
      onKeyDown={onKeyDown}
    />
    </>
  );
});

export function DividerLayer() {
  const adapterId = useUi((s) => s.settings.adapter);
  const zoomed = useUi((s) => s.view.zoomed);
  useUi((s) => s.layout);
  useUi((s) => s.area);
  if (zoomed) return null;
  const r = resolved();
  const adapter = ADAPTERS[adapterId];
  return (
    <div className="divider-layer" data-adapter={adapterId}>
      {r.dividers.map((d) => (
        // Key by adapter too, so switching remounts cleanly.
        <Divider key={`${adapterId}:${d.parentId}:${d.index}`} d={d} adapter={adapter} />
      ))}
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

