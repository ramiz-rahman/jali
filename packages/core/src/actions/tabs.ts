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
