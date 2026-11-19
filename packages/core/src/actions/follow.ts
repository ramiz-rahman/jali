/**
 * Linked selection: a detail opened from a list's selected row follows that list (layout/ops/follow.ts).
 *  - The list reports its selection with `select` (actions/peek.ts); its following details show it once the selection
 *    rests for FOLLOW_MS, so holding J doesn't fetch every row it passes.
 *  - One selection moves every follower of the list that can show it: a follower of the selected object's kind shows
 *    that object, and a follower of another kind shows what its kind's `follow` gives for it (a watchlist of quotes
 *    moves its chart, book and news). The others keep what they show. All of them move in one change.
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

/** What each of `source`'s followers would show for `selected` (`only`: that follower alone), when it changes. */
export function followMoves(
  { s, env }: Pick<Snapshot, "s" | "env">,
  source: NodeId,
  selected: ObjectRef,
  only?: NodeId,
): { id: NodeId; ref: ObjectRef }[] {
  const out: { id: NodeId; ref: ObjectRef }[] = [];
  for (const f of core.followers(s.layout, source)) {
    if (only && f.id !== only) continue;
    const ref = env.kinds.follow(f.ref.kind, selected);
    if (ref && !sameRef(ref, f.ref)) out.push({ id: f.id, ref });
  }
  return out;
}

/**
 * Show `selected` in `source`'s following details now: each one that can show it (followMoves). Nothing when none
 * moves. `only` moves that follower alone (one just unpinned, catching up).
 */
export function follow(
  { s, ctx, env }: Snapshot,
  source: NodeId,
  selected: ObjectRef,
  only?: NodeId,
): Outcome {
  const moves = followMoves({ s, env }, source, selected, only);
  if (!moves.length) return null;
  let layout = s.layout;
  for (const { id, ref } of moves) layout = core.setRef(layout, s.view, id, ref, ctx);
  if (layout === s.layout) return null;
  // Polite and short: one detail's new title, nothing about the mechanism. The one of the selected kind if it moved.
  const said = moves.find((m) => m.ref.kind === selected.kind) ?? moves[0]!;
  return { op: "follow", layout, msg: say(env).followed(env.kinds.title(said.ref)) };
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
  return pinned || !sel ? change : [change, (y: Snapshot) => follow(y, p.linkedTo!, sel.ref, id)];
}
