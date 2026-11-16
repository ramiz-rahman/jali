import type { ComponentType, KeyboardEvent } from "react";
import type { Rect } from "../../layout-core/types";

/**
 * What an adapter renders for ONE divider. The adapter owns pointer capture, the separator element and its ARIA
 * plumbing; the shared controller owns the model (clamp, snap, APG keys, reset, persist, heavy hold).
 * Each adapter renders a "ghost" two-panel group over the divider's two neighbours: the library computes the drag,
 * layout-core owns the sizes, and real panes are positioned from layout-core's resolve (so they never remount).
 */
export interface AdapterDividerProps {
  axis: "row" | "column";
  /** Rect over both neighbours (workspace coords). */
  pair: Rect;
  gap: number;
  /** Size of the first neighbour in px, its clamp range, and the usable length of the pair (gap excluded). */
  sizeA: number;
  minA: number;
  maxA: number;
  total: number;
  labelA: string;
  labelB: string;
  /** DOM id of the pane region before the divider, for aria-controls. */
  controls: string;
  snapped: boolean;
  dragging: boolean;
  /** Shared class + data attributes for the separator element. */
  className: string;
  onDragStart(): void;
  /** Requested size of the first neighbour in px (unclamped; the controller clamps and snaps). */
  onDrag(sizeA: number): void;
  onDragEnd(): void;
  onReset(): void;
  /** Shared APG keyboard. Calls preventDefault when it handled the key; adapters must not also act on it. */
  onKeyDown(e: KeyboardEvent<HTMLElement>): void;
}

export interface DividerAdapter {
  id: "rrp" | "ark";
  label: string;
  Divider: ComponentType<AdapterDividerProps>;
}

/** ARIA that both adapters apply on top of the library's own (APG window splitter, values in % of the pair). */
export function splitterAria(p: AdapterDividerProps) {
  const pct = (v: number) => Math.round((v / Math.max(1, p.total)) * 100);
  return {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": p.axis === "row" ? ("vertical" as const) : ("horizontal" as const),
    "aria-valuenow": pct(p.sizeA),
    "aria-valuemin": pct(p.minA),
    "aria-valuemax": pct(p.maxA),
    "aria-valuetext": `${p.labelA} ${Math.round(p.sizeA)} pixels, ${p.labelB} ${Math.round(p.total - p.sizeA)} pixels`,
    "aria-controls": p.controls,
    "aria-label": `Resize ${p.labelA} and ${p.labelB}`,
  };
}
