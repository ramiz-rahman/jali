/**
 * Linked selection: a detail opened from a list's selected row follows that list (layout/ops/follow.ts).
 *  - The list reports its selection with `select` (actions/peek.ts); the following detail shows it once the selection
 *    rests for FOLLOW_MS, so holding J doesn't fetch every row it passes.
 *  - Following is a swap: same slot, same size; the URL is replaced, so Back skips the rows passed through.
 *  - Pin keeps a detail on its object; unpinning makes it the list's follower again (and pins the previous one).
 */
import * as core from "../layout";
import type { NodeId, ObjectRef } from "../layout/types";
import type { Change, Deferred, Outcome, Snapshot } from "../state/apply";
import { say } from "../state/messages";

export const FOLLOW_MS = 150;

/** Exactly the same object reference (kind and every param). */
export const sameRef = (a: ObjectRef | undefined, b: ObjectRef | undefined) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  Object.keys(a.params).length === Object.keys(b.params).length &&
  Object.entries(a.params).every(([k, v]) => b.params[k] === v);

const key = (source: NodeId) => `follow:${source}`;

/** Show `ref` in `source`'s following detail now. Nothing when there is none or it already shows `ref`. */
export function follow({ s, ctx, env }: Snapshot, source: NodeId, ref: ObjectRef): Outcome {
  const r = core.follow(s.layout, s.view, source, ref, ctx);
  if (!r.pane || r.layout === s.layout) return null;
  // Polite and short: the detail's new title, nothing about the mechanism.
  return { op: "follow", layout: r.layout, msg: say(env).followed(env.kinds.title(ref)) };
}

/** The deferred step that makes `source`'s detail follow `ref`, or a cancellation (`ref` null). */
export const followLater = (source: NodeId, ref: ObjectRef | null): Deferred =>
  ref
    ? { key: key(source), ms: FOLLOW_MS, run: (y) => follow(y, source, ref) }
    : { key: key(source), ms: 0 };

/** `source`'s following detail of `kind`, when it is on screen (not behind a tab, folded, tucked or zoomed past). */
export function followerOnScreen({ s, m }: Snapshot, source: NodeId, kind: string) {
  const f = core.follower(s.layout, source, kind);
  return f && m.resolved.panes.some((b) => b.id === f.id && !b.hidden) ? f : undefined;
}

/** Pin (`true`) or unpin (`false`) a linked detail. */
export function setPinned({ s, m }: Snapshot, id: NodeId, pinned: boolean): Outcome {
  const p = m.pane(id);
  if (!p?.linkedTo) return null;
  const layout = core.setFollows(s.layout, id, !pinned);
  if (layout === s.layout) return null;
  const change: Change = {
    op: "pin",
    layout,
    msg: pinned ? say(m).pinned(m.title(id)) : say(m).unpinned(m.title(id), m.title(p.linkedTo)),
  };
  // Unpinned: catch up with the list's selection now.
  const sel = s.selection[p.linkedTo];
  return pinned || !sel ? change : [change, (y: Snapshot) => follow(y, p.linkedTo!, sel.ref)];
}
