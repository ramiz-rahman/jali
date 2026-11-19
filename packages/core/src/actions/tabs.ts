import * as core from "../layout";
import { treeSide } from "../layout/geometry/direction";
import type { NodeId } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { messagesOf, say } from "../state/messages";

const unzoomed = core.tree.unzoom;

/** A pane or stack the focused pane can join as a tab, by title. */
export interface MergeTarget {
  id: NodeId;
  label: string;
  hint: string;
}

/** Panes and stacks on screen that `source` can join. Excludes itself and its own stack. */
export function mergeTargets({ s, m }: Snapshot, source = s.view.focused): MergeTarget[] {
  if (!source) return [];
  const own = m.stackOf(source);
  return m.flat.panes.flatMap((b): MergeTarget[] => {
    if (b.hidden || b.id === source || own?.children.some((c) => c.id === b.id)) return [];
    const st = m.stackOf(b.id);
    if (st)
      return [
        {
          id: b.id,
          label: st.children.map((c) => m.env.kinds.title(c.ref)).join(" · "),
          hint: messagesOf(m).chooser.stackHint(st.children.length),
        },
      ];
    const p = m.pane(b.id);
    return p
      ? [
          {
            id: b.id,
            label: m.env.kinds.title(p.ref),
            hint: m.env.kinds.isTransient(p.ref) ? messagesOf(m).chooser.newPaneHint : p.ref.kind,
          },
        ]
      : [];
  });
}

export const checkMerge = (x: Snapshot) =>
  mergeTargets(x).length ? undefined : refuse("nothing-to-do");

/** Merge without dragging (WCAG 2.5.7): the pane joins `target`'s stack as a tab. Same op as a centre drop in tab mode. */
export function mergeInto({ s, m, ctx }: Snapshot, source: NodeId, target: NodeId): Outcome {
  if (!m.pane(source) || !m.pane(target) || source === target) return null;
  const r = core.drop(s.layout, unzoomed(s.view), source, target, "centre", "tab", ctx);
  const text = m.stackOf(target)
    ? say(m).addedToTabsOf(m.title(source), m.title(target))
    : say(m).addedToTabsWith(m.title(source), m.title(target));
  return { op: "merge", layout: r.layout, view: core.focus(r.view, source, ctx), msg: text };
}

export const checkUnmerge = ({ s, m }: Snapshot) =>
  m.stackOf(s.view.focused) ? undefined : refuse("nothing-to-do");

/** Move a tab out of its stack, to the right of the stack. Same op as dragging the tab to the right edge. */
export function unmerge({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  const st = m.stackOf(id);
  if (!id || !st) return refuse("nothing-to-do", say(m).notInTabs(m.title(id)));
  const other = st.children.find((c) => c.id !== id)!;
  // To the right on screen, as the message says, in either reading direction.
  const r = core.drop(
    s.layout,
    unzoomed(s.view),
    id,
    other.id,
    treeSide("right", ctx.dir),
    "swap",
    ctx,
  );
  return {
    op: "unmerge",
    layout: r.layout,
    view: core.focus(r.view, id, ctx),
    msg: say(m).movedOutOfTabs(m.title(id), m.title(st.active === id ? other.id : st.active)),
  };
}

/** Selects the tab (deliberate or automatic stack) and focuses it. Nothing else moves: no refit. */
export function setActiveTab({ s, m, ctx }: Snapshot, stack: NodeId, pane: NodeId): Outcome {
  return {
    op: "tab",
    layout: core.setActiveTab(s.layout, stack, pane, ctx),
    view: core.focus(s.view, pane, ctx),
    msg: say(m).tabShown(m.title(pane)),
  };
}

/** Move a tab to position `index` (from 0) in its group: same op from a drag between tabs, a key or the app. */
export function moveTab({ s, m }: Snapshot, id: NodeId, index: number): Outcome {
  const st = m.stackOf(id);
  if (!st) return refuse("nothing-to-do", say(m).notInTabs(m.title(id)));
  const layout = core.moveTab(s.layout, id, index);
  if (layout === s.layout) return null;
  const at = core.tree.stackOf(layout.root, id)!.children.findIndex((c) => c.id === id);
  return { op: "moveTab", layout, msg: say(m).tabMoved(m.title(id), at + 1, st.children.length) };
}

/** Where a tab moves one place towards a screen side: in a right-to-left strip, left is later. */
function stepToward({ m, ctx }: Snapshot, side: "left" | "right", id: NodeId | undefined) {
  const st = m.stackOf(id);
  if (!id || !st) return undefined;
  const from = st.children.findIndex((c) => c.id === id);
  const to = from + ((side === "right") === (ctx.dir !== "rtl") ? 1 : -1);
  // A tab moves within its part of the group: the pinned tabs, or the rest.
  const [lo, hi] = tabBounds(st.children, from);
  return {
    id,
    to,
    edge: to < lo ? ("first" as const) : to > hi ? ("last" as const) : undefined,
  };
}

/** The first and last index tab `at` may move to: among the pinned tabs if it is one, else after them. */
export function tabBounds(tabs: readonly { pinned?: boolean }[], at: number): [number, number] {
  const pinned = tabs.filter((t) => t.pinned).length;
  return tabs[at]?.pinned ? [0, pinned - 1] : [pinned, tabs.length - 1];
}

/** Move a tab one place towards `side` (default: the focused pane). At the group's end, says so. */
export function moveTabToward(x: Snapshot, side: "left" | "right", id = x.s.view.focused): Outcome {
  const step = stepToward(x, side, id);
  if (!step) return refuse("nothing-to-do");
  return step.edge
    ? refuse("nothing-to-do", say(x.m).tabAtEdge(x.m.title(step.id), step.edge))
    : moveTab(x, step.id, step.to);
}

/** Silent unless the focused pane is a tab in a group (at the group's end, running it says so, as moving a pane does). */
export const checkMoveTab = ({ s, m }: Snapshot) =>
  m.stackOf(s.view.focused) ? undefined : refuse("nothing-to-do");

/** Pin a tab (`true`) or unpin it: pinned tabs come first in their group and stay when others are closed together. */
export function setPinned({ s, m }: Snapshot, id: NodeId, pinned: boolean): Outcome {
  if (!m.pane(id)) return refuse("not-found");
  const layout = core.setPinned(s.layout, id, pinned);
  if (layout === s.layout) return null;
  return {
    op: "pinTab",
    layout,
    msg: pinned ? say(m).tabPinned(m.title(id)) : say(m).tabUnpinned(m.title(id)),
  };
}
