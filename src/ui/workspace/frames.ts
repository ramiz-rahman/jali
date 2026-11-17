/** What each pane frame shows, in both presentations: one list feeds one render loop. Pure. */
import type { NodeId, PaneNode, Rect, ViewState } from "../../layout-core/types";
import type { WorkspaceModel } from "../state/model";
import type { Presentation } from "../pane/chrome";

export interface Tab { node: PaneNode; tucked: boolean }

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
export const currentPane = (m: WorkspaceModel, view: ViewState) => (view.focused && m.pane(view.focused) && !m.off.includes(view.focused) ? view.focused : m.onScreen[0]?.id);

export function frames(m: WorkspaceModel, view: ViewState, mode: Presentation, size: { width: number; height: number }): Frame[] {
  if (mode === "single") {
    const current = currentPane(m, view);
    const rect = { x: 0, y: 0, ...size };
    return m.panes.map((node) => ({ node, rect, hidden: node.id !== current || m.off.includes(node.id), focused: node.id === current, zoomed: false, covered: false }));
  }
  return m.resolved.panes.flatMap((box): Frame[] => {
    const node = m.pane(box.id);
    if (!node) return [];
    const zoomed = view.zoomed === box.id;
    const g = box.hidden || !box.stackId ? undefined : m.groups.get(box.stackId);
    return [{
      node,
      rect: zoomed ? { x: 0, y: 0, ...size } : box.rect,
      hidden: !!box.hidden,
      focused: view.focused === box.id,
      zoomed,
      covered: !!view.zoomed && !zoomed,
      ...(g ? { group: { id: g.id, active: g.active, tabs: g.tabs.map((t) => ({ node: t, tucked: !!m.tuckOf(t.id) })) } } : {}),
    }];
  });
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
/** Same pane as far as a frame renders it. Ops make new objects every time, so compare values. */
export const sameNode = (a: PaneNode, b: PaneNode) =>
  a === b || (a.id === b.id && a.linkedTo === b.linkedTo && a.pinned === b.pinned && JSON.stringify(a.ref) === JSON.stringify(b.ref));
const sameGroup = (a: Frame["group"], b: Frame["group"]) =>
  a === b || (!!a && !!b && a.id === b.id && a.active === b.active && a.tabs.length === b.tabs.length &&
    a.tabs.every((t, i) => t.tucked === b.tabs[i]!.tucked && sameNode(t.node, b.tabs[i]!.node)));

/** A resize (pointer or keyboard) re-renders only the frames whose rect changed. */
export const sameFrame = (a: Frame, b: Frame) =>
  sameRect(a.rect, b.rect) && a.hidden === b.hidden && a.focused === b.focused && a.zoomed === b.zoomed && a.covered === b.covered &&
  sameNode(a.node, b.node) && sameGroup(a.group, b.group);
