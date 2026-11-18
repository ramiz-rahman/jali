import type {
  Edge,
  Layout,
  LayoutContext,
  LayoutNode,
  PaneBox,
  PaneNode,
  PutBackResult,
  TuckCheck,
  TuckResult,
  ViewState,
} from "../types";
import { clone, find, isSplit, noFocus, panes, parent, unzoom } from "../tree/tree";
import { overlayOf, withOverlay } from "../fit/overlay";
import { resolve } from "../fit/resolve";
import { fitLayout } from "../fit/refit";
import { focus } from "./focus";
const holds = (n: LayoutNode, id: string) => n.id === id || panes(n).some((p) => p.id === id);

interface Geometry {
  boxes: Map<string, PaneBox>;
  shown: Set<string>;
}
function geometry(layout: Layout, ctx: LayoutContext): Geometry {
  const resolved = resolve(layout, noFocus(), ctx);
  const boxes = resolved.panes;
  return {
    boxes: new Map(boxes.map((b) => [b.id, b])),
    shown: new Set(boxes.filter((b) => !b.hidden).map((b) => b.id)),
  };
}
/** The pane on screen where `id` lives: itself, or the shown tab of its displayed group. */
function shownFor(id: string, g: Geometry): string | undefined {
  const box = g.boxes.get(id);
  if (!box) return undefined;
  if (!box.hidden) return id;
  if (!box.stackId) return undefined;
  return [...g.boxes.values()].find((b) => b.stackId === box.stackId && !b.hidden)?.id;
}
const centre = (b: PaneBox) => [b.rect.x + b.rect.width / 2, b.rect.y + b.rect.height / 2] as const;

interface Home {
  shown: string;
}
/**
 * The home: the pane's source if it is on screen in an adjacent sibling slot; otherwise the nearest previous sibling
 * slot with something on screen; otherwise the nearest next one. Within a slot, the source, else the pane on screen
 * nearest the tucked pane. A slot that only shows the tucked pane's own group does not count. If no sibling qualifies,
 * the search moves out one split level.
 */
function chooseHome(layout: Layout, pane: PaneNode, g: Geometry): Home | undefined {
  const own = shownFor(pane.id, g);
  const ownGroup = g.boxes.get(pane.id)?.stackId;
  const me = g.boxes.get(pane.id);
  const candidates = (slot: LayoutNode) => {
    const ids = panes(slot)
      .map((p) => p.id)
      .filter((id) => id !== pane.id);
    const shown = [
      ...new Set(ids.map((id) => shownFor(id, g)).filter((s): s is string => !!s && s !== own)),
    ].filter((s) => !ownGroup || g.boxes.get(s)?.stackId !== ownGroup);
    if (!shown.length) return undefined;
    if (pane.linkedTo && shown.includes(pane.linkedTo)) return pane.linkedTo;
    if (me) {
      const [mx, my] = centre(me);
      return shown.sort((a, b) => {
        const [ax, ay] = centre(g.boxes.get(a)!),
          [bx, by] = centre(g.boxes.get(b)!);
        return Math.hypot(ax - mx, ay - my) - Math.hypot(bx - mx, by - my);
      })[0];
    }
    return shown[0];
  };
  let child: LayoutNode = pane;
  let level = parent(layout.root, pane.id);
  while (level && isSplit(level)) {
    const at = level.children.findIndex((c) => c.id === child.id);
    const prev = level.children.slice(0, at).reverse(),
      next = level.children.slice(at + 1);
    let found: { shown: string; slot: LayoutNode } | undefined;
    if (pane.linkedTo)
      for (const slot of [prev[0], next[0]]) {
        if (
          !found &&
          slot &&
          holds(slot, pane.linkedTo) &&
          shownFor(pane.linkedTo, g) === pane.linkedTo
        )
          found = { shown: pane.linkedTo, slot };
      }
    for (const slot of prev) {
      if (found) break;
      const s = candidates(slot);
      if (s) found = { shown: s, slot };
    }
    for (const slot of next) {
      if (found) break;
      const s = candidates(slot);
      if (s) found = { shown: s, slot };
    }
    if (found) {
      return { shown: found.shown };
    }
    child = level;
    level = parent(layout.root, level.id);
  }
  return undefined;
}

/** One resolve and home search serves both the guard and the operation. */
function check(layout: Layout, paneId: string, ctx: LayoutContext): TuckCheck {
  const node = find(layout.root, paneId);
  if (node?.type !== "pane") return { ok: false, reason: "missing" };
  const container = parent(layout.root, paneId);
  if (!container) return { ok: false, reason: "last" };
  if (container.type === "stack") return { ok: false, reason: "tab" };
  const g = geometry(layout, ctx);
  if (layout.overlay?.tucks.some((t) => t.pane === paneId || t.home === paneId))
    return { ok: false, reason: "tab" };
  if (!g.shown.has(paneId)) return { ok: false, reason: "hidden" };
  if (g.shown.size <= 1) return { ok: false, reason: "last" };
  const home = chooseHome(layout, node, g);
  return home ? { ok: true, home: home.shown } : { ok: false, reason: "last" };
}
export function canTuck(layout: Layout, pane: string, ctx: LayoutContext): TuckCheck {
  return check(layout, pane, ctx);
}
export function tuck(
  layout: Layout,
  view: ViewState,
  pane: string,
  ctx: LayoutContext,
): TuckResult {
  const result = check(layout, pane, ctx);
  if (!result.ok) return result;
  const o = overlayOf(layout);
  const next = withOverlay(layout, {
    ...o,
    tucks: [
      ...o.tucks,
      { pane, home: result.home, seq: 1 + Math.max(0, ...o.tucks.map((t) => t.seq)) },
    ],
  });
  return {
    ok: true,
    layout: next,
    view: focus(unzoom(view), result.home, ctx),
    home: result.home,
    undo: { kind: "tuck", tucked: pane, before: { layout: clone(layout), view: clone(view) } },
  };
}
export function putBack(
  layout: Layout,
  view: ViewState,
  pane: string,
  ctx: LayoutContext,
): PutBackResult {
  if (find(layout.root, pane)?.type !== "pane") return { ok: false, reason: "missing" };
  const o = overlayOf(layout),
    record = o.tucks.find((t) => t.pane === pane);
  if (!record) return { ok: false, reason: "not-tucked" };
  const tucks = o.tucks.filter((t) => t !== record);
  const shown = Object.fromEntries(
    Object.entries(o.shown).filter(
      ([home, active]) =>
        active !== pane &&
        (home !== record.home || tucks.some((t) => t.home === home) || o.folds.length),
    ),
  );
  const nextView = focus(unzoom(view), pane, ctx);
  const next = withOverlay(layout, { ...o, tucks, shown });
  return {
    ok: true,
    layout: fitLayout(next, nextView, ctx, { mode: "fold" }),
    view: nextView,
    home: record.home,
  };
}
/** The original side is read from the canonical tree, so drag-to-put-back needs no origin snapshot. */
export function putBackEdge(layout: Layout, pane: string): Edge | undefined {
  const t = layout.overlay?.tucks.find((t) => t.pane === pane);
  const owner = t && parent(layout.root, pane);
  if (!t || !owner || !isSplit(owner)) return undefined;
  const at = owner.children.findIndex((c) => c.id === pane);
  const home = owner.children.findIndex((c) => holds(c, t.home));
  return owner.type === "row" ? (home < at ? "right" : "left") : home < at ? "bottom" : "top";
}
