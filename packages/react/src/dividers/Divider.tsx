import type { NodeId, Rect } from "@jali/core";
import { dividerKey, STEP, STEP_BIG } from "@jali/core/adapter";
import { memo, type KeyboardEvent } from "react";
import { useMessages } from "../state/react";

export interface DividerProps {
  parentId: NodeId;
  index: number;
  axis: "row" | "column";
  /** The divider's own gap rect (workspace coords). */
  rect: Rect;
  /** First neighbour's size in px, its clamp range, and the usable length of the pair (gap excluded). */
  sizeA: number;
  minA: number;
  maxA: number;
  total: number;
  labelA: string;
  labelB: string;
  /** DOM ids of the pane regions before the divider, for aria-controls. */
  controls: string;
  /** The first neighbour is on the right (a row read right to left): ← grows it, → shrinks it. */
  rtl?: boolean;
  /** Pointer down starts the drag (drag.ts); `setSizeA` resizes from the keyboard; `onReset` restores sizes. */
  onDragStart(e: React.PointerEvent<HTMLElement>): void;
  setSizeA(size: number): void;
  onReset(): void;
}

const pct = (v: number, total: number) => Math.round((v / Math.max(1, total)) * 100);
const rectEq = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * One APG window splitter, absolutely positioned in the gap. APG keys: arrows 16px, Shift 64px, Home/End; they commit
 * per keypress. Enter does nothing: a tuck would remove this divider from under focus.
 * Memoised on geometry and labels, so a resize re-renders only the dividers that moved.
 */
export const Divider = /* @__PURE__ */ memo(
  function Divider(p: DividerProps) {
    const row = p.axis === "row";
    const t = useMessages().workspace;
    // The arrow that shrinks the first neighbour, and the one that grows it: the divider moves the way it points.
    const [less, more] = !row
      ? ["ArrowUp", "ArrowDown"]
      : p.rtl
        ? ["ArrowRight", "ArrowLeft"]
        : ["ArrowLeft", "ArrowRight"];
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const step = e.shiftKey ? STEP_BIG : STEP;
      const target =
        e.key === less
          ? p.sizeA - step
          : e.key === more
            ? p.sizeA + step
            : e.key === "Home"
              ? p.minA
              : e.key === "End"
                ? p.maxA
                : undefined;
      if (target === undefined) return;
      e.preventDefault();
      p.setSizeA(target);
    };
    const restB = Math.round(p.total - p.sizeA);
    return (
      <div
        className={`jali-divider jali-divider-${p.axis}`}
        data-divider={dividerKey(p)}
        style={{
          position: "absolute",
          left: p.rect.x,
          top: p.rect.y,
          width: p.rect.width,
          height: p.rect.height,
        }}
        onPointerDown={p.onDragStart}
        onDoubleClick={(e) => {
          e.preventDefault();
          p.onReset();
        }}
        onKeyDown={onKeyDown}
        role="separator"
        tabIndex={0}
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-valuenow={pct(p.sizeA, p.total)}
        aria-valuemin={pct(p.minA, p.total)}
        // In a row that scrolls a divider has no upper bound (the content grows): it states none.
        aria-valuemax={Number.isFinite(p.maxA) ? pct(p.maxA, p.total) : undefined}
        aria-valuetext={t.dividerValue(p.labelA, Math.round(p.sizeA), p.labelB, restB)}
        aria-controls={p.controls}
        aria-label={t.divider(p.labelA, p.labelB)}
      >
        {/* Keyboard-focus affordance: an accent capsule and a size label, both CSS-gated on :focus-visible. */}
        <span className="jali-divider-line" aria-hidden />
        <span className="jali-divider-handle" aria-hidden />
        <span className="jali-divider-tip" aria-hidden>
          {t.dividerTip(p.labelA, Math.round(p.sizeA))}
          <i> | </i>
          {t.dividerTip(p.labelB, restB)}
        </span>
      </div>
    );
  },
  (a, b) =>
    a.parentId === b.parentId &&
    a.index === b.index &&
    a.axis === b.axis &&
    rectEq(a.rect, b.rect) &&
    a.sizeA === b.sizeA &&
    a.minA === b.minA &&
    a.maxA === b.maxA &&
    a.total === b.total &&
    a.labelA === b.labelA &&
    a.labelB === b.labelB &&
    a.controls === b.controls &&
    a.rtl === b.rtl,
);
