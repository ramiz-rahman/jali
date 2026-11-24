/**
 * What the tree's drawings share: which panes sit under a node, the box a node fills now, sizes as text, the node
 * under the reader's pointer, and the panes' rects while a divider is dragged.
 */
import { createContext } from "react";
import type { LayoutNode, Rect, Size } from "jali";
import type { Model as JaliModel } from "jali/adapter";

/** The node the reader points at, and where: at its box or JSON in the tree, or at its pane in the workspace. */
export interface Hover {
  id: string;
  from: "tree" | "ws";
}

export const panesUnder = (n: LayoutNode): string[] =>
  n.type === "pane" ? [n.id] : n.children.flatMap(panesUnder);

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
export const sizeText = (s: Size) =>
  "px" in s ? `${fmt(s.px)} px fixed` : `weight ${fmt(s.weight)}`;

/** Pane rects while a divider is being dragged (Jali moves the panes without a store change until release). */
export const PreviewRects = createContext<Record<string, Rect> | null>(null);

/** The box a node fills on screen: the union of its panes that are showing. */
export function extentOf(
  n: LayoutNode,
  m: JaliModel,
  preview?: Record<string, Rect> | null,
): Rect | null {
  const ids = new Set(panesUnder(n));
  const boxes = m.resolved.panes
    .filter((b) => ids.has(b.id) && !b.hidden)
    .map((b) => preview?.[b.id] ?? b.rect);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((r) => r.x)),
    y = Math.min(...boxes.map((r) => r.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width)),
    btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
}
