/** What each pane frame shows, in both presentations: one list feeds one render loop. Pure. */
import type { NodeId, PaneNode, Rect, ViewState } from "../layout/types";
import type { Model } from "../state/model";
import type { Presentation } from "../pane/chrome";
import { stackShare, type Hinge } from "./stack";
import { sameRef } from "../layout/ops/ref";

/**
 * Why a pane is a tab. Made by the person: a tab they merged or opened (neither flag), or one they tucked (`tucked`).
 * Made by the layout: `folded`, which returns by itself when there is room. Never both.
 */
export interface Tab {
  node: PaneNode;
  tucked: boolean;
  folded: boolean;
}

export interface Frame {
  node: PaneNode;
  rect: Rect;
  /** Behind another tab, tucked, folded, or not the current pane in single view. */
  hidden: boolean;
  focused: boolean;
  zoomed: boolean;
  /** Behind a zoomed pane: hidden from assistive tech and inert. */
  covered: boolean;
  /** The tab strip of the group this pane shows for, when it is in one and on screen. */
  group?: { id: NodeId; tabs: Tab[]; active: NodeId };
  /**
   * In a row that scrolls: the row's id. The frame is drawn inside the row's scrolling element, which the browser
   * scrolls, so its `rect` is its place along the row's content (unscrolled), in the layout's coordinates.
   */
  strip?: NodeId;
  /** In a row that scrolls, and scrolled out of its window: mounted and in the focus order, but paused. */
  outOfView?: boolean;
}

/** The pane single view shows: the focused one, else the first. */
export const currentPane = (m: Model, view: ViewState) =>
  view.focused && m.pane(view.focused) && !m.off.includes(view.focused)
    ? view.focused
    : m.onScreen[0]?.id;

/** The two halves either side of a fold, in the box's coordinates: start first. */
function acrossFold(
  hinge: Hinge,
  size: { width: number; height: number },
  origin: { x: number; y: number },
): readonly [Rect, Rect] {
  if (hinge.axis === "row") {
    const a = Math.max(0, Math.min(size.width, Math.round(hinge.start - origin.x)));
    const b = Math.max(a, Math.min(size.width, Math.round(hinge.start + hinge.size - origin.x)));
    return [
      { x: 0, y: 0, width: a, height: size.height },
      { x: b, y: 0, width: size.width - b, height: size.height },
    ];
  }
  const a = Math.max(0, Math.min(size.height, Math.round(hinge.start - origin.y)));
  const b = Math.max(a, Math.min(size.height, Math.round(hinge.start + hinge.size - origin.y)));
  return [
    { x: 0, y: 0, width: size.width, height: a },
    { x: 0, y: b, width: size.width, height: size.height - b },
  ];
}

/** The least room between the two panes of stacked view, in px. The divider's whole touch target is this room, so it
 *  never covers a row or a control of either pane, and is still 24px tall (WCAG 2.5.8). */
export const STACK_GAP = 24;
/** The room between stacked view's two panes in an instance with this gap: the gap, or STACK_GAP if that is more. */
export const stackGap = (gap: number) => Math.max(gap, STACK_GAP);

/**
 * Stacked view's split of a height (no fold): the band between the two panes, which the divider fills. The top pane
 * ends where it starts (`y`), and the bottom one begins where it ends. `share` is the top pane's share of the rest.
 */
export function stackSplit(
  height: number,
  share: number,
  gap: number,
): { y: number; height: number } {
  const room = stackGap(gap);
  return { y: Math.round((height - room) * share), height: room };
}

export function frames(
  m: Model,
  view: ViewState,
  mode: Presentation,
  size: { width: number; height: number },
  /** Stacked view: the top pane's share of the height (0 to 1), or `false` to show one pane (the keyboard is up).
   *  Left out, the kinds' heights decide it (`stackShare`): a half unless one gives a comfortable or max height. */
  stack?: number | false,
  /** Where this box sits in the layout, which a fold's hinge is measured in. */
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Frame[] {
  if (mode === "single" && m.stacked && (stack !== false || m.stacked.hinge)) {
    const { top, bottom, hinge } = m.stacked;
    const { gap } = m.env.spacing;
    const ratio =
      stack === false
        ? 0.5
        : (stack ?? stackShare(m.env, m.pane(top), m.pane(bottom), size.height, stackGap(gap)));
    const rects = hinge
      ? acrossFold(hinge, size, origin)
      : (() => {
          const band = stackSplit(size.height, ratio, gap);
          return [
            { x: 0, y: 0, width: size.width, height: band.y },
            {
              x: 0,
              y: band.y + band.height,
              width: size.width,
              height: size.height - band.y - band.height,
            },
          ] as const;
        })();
    const byId = { [top]: rects[0], [bottom]: rects[1] };
    return m.panes.map((node) => ({
      node,
      rect: byId[node.id] ?? { x: 0, y: 0, ...size },
      hidden: !byId[node.id],
      focused: node.id === view.focused,
      zoomed: false,
      covered: false,
    }));
  }
  if (mode === "single") {
    const current = currentPane(m, view);
    const rect = { x: 0, y: 0, ...size };
    return m.panes.map((node) => ({
      node,
      rect,
      hidden: node.id !== current || m.off.includes(node.id),
      focused: node.id === current,
      zoomed: false,
      covered: false,
    }));
  }
  const stripOf = new Map(
    m.content.scrollers.flatMap((s) => s.paneIds.map((id) => [id, s.id] as const)),
  );
  const along = new Map(m.content.panes.map((b) => [b.id, b.rect]));
  return m.resolved.panes.flatMap((box): Frame[] => {
    const node = m.pane(box.id);
    if (!node) return [];
    const zoomed = view.zoomed === box.id;
    const g = box.hidden || !box.stackId ? undefined : m.groups.get(box.stackId);
    return [
      {
        node,
        rect: zoomed
          ? { x: 0, y: 0, ...size }
          : stripOf.has(box.id)
            ? along.get(box.id)!
            : box.rect,
        ...(stripOf.has(box.id)
          ? { strip: stripOf.get(box.id)!, outOfView: m.outOfView.has(box.id) }
          : {}),
        hidden: !!box.hidden,
        focused: view.focused === box.id,
        zoomed,
        covered: !!view.zoomed && !zoomed,
        ...(g
          ? {
              group: {
                id: g.id,
                active: g.active,
                tabs: g.tabs.map((t) => {
                  const tucked = !!m.tuckOf(t.id);
                  return { node: t, tucked, folded: !tucked && m.folded.includes(t.id) };
                }),
              },
            }
          : {}),
      },
    ];
  });
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
/** Fields of a pane node that are its size in its split: the frame's rect says that, so they don't count. */
const SIZE_FIELDS = new Set(["size", "base", "userSized"]);
/**
 * Same pane as far as a frame and its body render it: every field of the node (its ref by `sameRef`), but its size,
 * which the rect carries. Ops make new objects every time, so compare values. Every field counts, not a list of them:
 * a pane's `role` or `follows` changed by `setLayout`, with the same geometry, reaches its component.
 */
export const sameNode = (a: PaneNode, b: PaneNode) => {
  if (a === b) return true;
  if (!sameRef(a.ref, b.ref)) return false;
  const keys = (n: PaneNode) =>
    Object.keys(n).filter(
      (k) => k !== "ref" && !SIZE_FIELDS.has(k) && n[k as keyof PaneNode] !== undefined,
    );
  const ka = keys(a);
  return (
    ka.length === keys(b).length &&
    ka.every((k) => a[k as keyof PaneNode] === b[k as keyof PaneNode])
  );
};
const sameGroup = (a: Frame["group"], b: Frame["group"]) =>
  a === b ||
  (!!a &&
    !!b &&
    a.id === b.id &&
    a.active === b.active &&
    a.tabs.length === b.tabs.length &&
    a.tabs.every(
      (t, i) =>
        t.tucked === b.tabs[i]!.tucked &&
        t.folded === b.tabs[i]!.folded &&
        sameNode(t.node, b.tabs[i]!.node),
    ));

/** A resize (pointer or keyboard) re-renders only the frames whose rect changed. */
export const sameFrame = (a: Frame, b: Frame) =>
  sameRect(a.rect, b.rect) &&
  a.hidden === b.hidden &&
  a.focused === b.focused &&
  a.zoomed === b.zoomed &&
  a.covered === b.covered &&
  a.outOfView === b.outOfView &&
  a.strip === b.strip &&
  sameNode(a.node, b.node) &&
  sameGroup(a.group, b.group);
