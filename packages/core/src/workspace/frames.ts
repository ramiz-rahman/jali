/** What each pane frame shows, in both presentations: one list feeds one render loop. Pure. */
import type { NodeId, PaneNode, Rect, ViewState } from "../layout/types";
import type { JaliModel } from "../state/model";
import type { Presentation } from "../pane/chrome";

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
}

/** The pane single view shows: the focused one, else the first. */
export const currentPane = (m: JaliModel, view: ViewState) =>
  view.focused && m.pane(view.focused) && !m.off.includes(view.focused)
    ? view.focused
    : m.onScreen[0]?.id;

/** Room between the two panes of stacked view: the divider's line sits in it. */
export const STACK_GAP = 6;

export function frames(
  m: JaliModel,
  view: ViewState,
  mode: Presentation,
  size: { width: number; height: number },
  /** Stacked view: the top pane's share of the height (0 to 1), or `false` to show one pane (the keyboard is up). */
  stack: number | false = 0.5,
): Frame[] {
  if (mode === "single" && m.stacked && stack !== false) {
    const { top, bottom } = m.stacked;
    const topH = Math.round((size.height - STACK_GAP) * stack);
    const rects = {
      [top]: { x: 0, y: 0, width: size.width, height: topH },
      [bottom]: {
        x: 0,
        y: topH + STACK_GAP,
        width: size.width,
        height: size.height - topH - STACK_GAP,
      },
    };
    return m.panes.map((node) => ({
      node,
      rect: rects[node.id] ?? { x: 0, y: 0, ...size },
      hidden: !rects[node.id],
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
  return m.resolved.panes.flatMap((box): Frame[] => {
    const node = m.pane(box.id);
    if (!node) return [];
    const zoomed = view.zoomed === box.id;
    const g = box.hidden || !box.stackId ? undefined : m.groups.get(box.stackId);
    return [
      {
        node,
        rect: zoomed ? { x: 0, y: 0, ...size } : box.rect,
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
/** Same pane as far as a frame renders it. Ops make new objects every time, so compare values. */
export const sameNode = (a: PaneNode, b: PaneNode) =>
  a === b ||
  (a.id === b.id &&
    a.linkedTo === b.linkedTo &&
    a.kept === b.kept &&
    a.pinned === b.pinned &&
    JSON.stringify(a.ref) === JSON.stringify(b.ref));
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
  sameNode(a.node, b.node) &&
  sameGroup(a.group, b.group);
