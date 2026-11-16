import type { ComponentType, KeyboardEvent, PointerEvent } from "react";
import type { Rect } from "../../layout-core/types";

/**
 * What an adapter renders for ONE divider: the separator element and its ARIA plumbing. Nothing else.
 * The pointer drag is ours (`dividers/drag.ts`): the adapter hands the separator's pointerdown to `onPointerDown`
 * and must keep its own library out of the drag. The shared controller owns the model (clamp, snap, APG keys,
 * reset, persist, heavy hold). Real panes are positioned from layout-core's resolve, so they never remount.
 */
export interface AdapterDividerProps {
  axis: "row" | "column";
  /** The divider's own gap rect (workspace coords). */
  rect: Rect;
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
  /** DOM id of the pane region(s) before the divider, for aria-controls. */
  controls: string;
  /** `parentId:index`, written as data-divider on the separator (the drag finds neighbours' dividers by it). */
  dividerKey: string;
  /** Shared class for the separator element. */
  className: string;
  /** Starts our drag. Adapters call it in the capture phase and stop the library from seeing the event. */
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onReset(): void;
  /** Shared APG keyboard. Calls preventDefault when it handled the key; adapters must not also act on it. */
  onKeyDown(e: KeyboardEvent<HTMLElement>): void;
}

export interface DividerAdapter {
  id: "own" | "ark";
  label: string;
  Divider: ComponentType<AdapterDividerProps>;
}

/** APG window-splitter ARIA (values in % of the pair), applied by both adapters. */
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
