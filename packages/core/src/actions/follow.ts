/**
 * Linked selection: a detail opened from a list's selected row follows that list (layout/ops/follow.ts).
 *  - The list reports its selection with `select` (actions/peek.ts); its following details show it once the selection
 *    rests for FOLLOW_MS, so holding J doesn't fetch every row it passes.
 *  - One selection moves every follower of the list that can show it: a follower of the selected object's kind shows
 *    that object, and a follower of another kind shows what its kind's `follow` gives for it (a watchlist of quotes
 *    moves its chart, book and news). The others keep what they show. All of them move in one change.
 *  - A follower with unsaved work is held on its object, and the workspace says why; the others still move.
 *  - Following is a swap: same slot, same size; the URL is replaced, so Back skips the rows passed through.
 *  - Keep keeps a detail on its object; releasing makes it the list's follower again (and keeps the previous one).
 */
import * as core from "../layout";
import type { Layout, NodeId, ObjectRef, PaneNode, ViewState } from "../layout/types";
import { refuse, type Change, type Deferred, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import type { UiState } from "../state/store";
import { own as ownOf } from "../own";
import { sameRef } from "../layout/ops/ref";
import { selectionFor } from "../state/pane-state";

export const FOLLOW_MS = 150;

/** Exactly the same object reference (kind and every param, in any key order): defined once, in the layout. */
export { sameRef };

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
 * moves. `only` moves that follower alone (one just released, catching up).
 *
 * A follower with unsaved work keeps its object: it is held, and the rest move in the same change. The workspace
 * says why it stayed ("The detail stays put: …"), as a refusal after the change, so the step's result is that refusal
 * when anything was held.
 */
export function follow(
  { s, ctx, env }: Snapshot,
  source: NodeId,
  selected: ObjectRef,
  only?: NodeId,
): Outcome {
  const moves = followMoves({ s, env }, source, selected, only);
  if (!moves.length) return null;
  const held = moves.filter((m) => Object.hasOwn(s.unsaved, m.id));
  const going = moves.filter((m) => !Object.hasOwn(s.unsaved, m.id));
  const stays = held.length
    ? refuse("unsaved", say(env).keptUnsaved(ownOf(s.unsaved, held[0]!.id)!))
    : null;
  let layout = s.layout;
  for (const { id, ref } of going) layout = core.setRef(layout, s.view, id, ref, ctx);
  if (layout === s.layout) return stays;
  // Polite and short: one detail's new title, nothing about the mechanism. The one of the selected kind if it moved.
  const said = going.find((m) => m.ref.kind === selected.kind) ?? going[0]!;
  const change: Change = {
    op: "follow",
    layout,
    msg: say(env).followed(env.kinds.title(said.ref)),
  };
  return stays ? [change, stays] : change;
}

/**
 * The deferred step that makes `source`'s detail follow `ref`, or a cancellation (`ref` null). When it fires it does
 * nothing if the list's selection has moved on meanwhile: a preset or `setLayout` that reset it (the layout's word
 * wins) must not be undone by a step scheduled before it.
 */
export const followLater = (source: NodeId, ref: ObjectRef | null): Deferred =>
  ref
    ? {
        key: key(source),
        ms: FOLLOW_MS,
        run: (y) =>
          sameRef(ownOf(y.s.selection, source)?.ref, ref) ? follow(y, source, ref) : null,
      }
    : { key: key(source), ms: 0 };

/** `source`'s following detail of `kind`, when it is on screen (not behind a tab, folded, tucked or zoomed past). */
export function followerOnScreen({ s, m }: Snapshot, source: NodeId, kind: string) {
  const f = core.follower(s.layout, source, kind);
  return f && m.resolved.panes.some((b) => b.id === f.id && !b.hidden) ? f : undefined;
}

/**
 * Keep (`true`) a linked pane on its object, or let it go (`false`). A detail of a list (its source reports a
 * selection) follows the selection again, catching up now; a plain link goes back to being replaced by the next link.
 */
export function setKept({ s, m }: Snapshot, id: NodeId, kept: boolean): Outcome {
  const p = m.pane(id);
  if (!p?.linkedTo) return null;
  const list = Object.hasOwn(s.selection, p.linkedTo);
  const layout = core.setKept(s.layout, id, kept, { follow: list });
  if (layout === s.layout) return null;
  const change: Change = {
    op: "keep",
    layout,
    msg: kept
      ? say(m).kept(m.title(id))
      : list
        ? say(m).released(m.title(id), m.title(p.linkedTo))
        : say(m).unkept(m.title(id)),
  };
  // Following again: catch up with the list's selection now.
  const sel = ownOf(s.selection, p.linkedTo);
  return kept || !sel ? change : [change, (y: Snapshot) => follow(y, p.linkedTo!, sel.ref, id)];
}

/**
 * What `list` starts on when it has no selection: what its follower of the kind it selects (its kind's `selects`)
 * shows. Nothing when its kind doesn't say what it selects, or `layout` gives it no follower of that kind: a follower
 * of another kind shows something derived from the selection (`follow`), which can't be turned back into it.
 */
export function startingSelection(
  env: Pick<Snapshot["env"], "kinds">,
  layout: Layout,
  list: PaneNode,
): ObjectRef | undefined {
  const kind = env.kinds.get(list.ref.kind)?.selects;
  const own = kind ? core.follower(layout, list.id, kind) : undefined;
  return own ? structuredClone(own.ref) : undefined;
}

/**
 * A layout that arrives as it is (start-up, a link, a reload, Back) and the lists' selections agree, on the selection's
 * side only: the layout's followers stay exactly as it has them. For each list in `layout`:
 *  - with a selection, when the layout gives it a follower of the selected object's kind that shows something else,
 *    the selection becomes what that follower shows (the layout's word wins, as after a preset);
 *  - with none, it starts on what its follower of the kind it selects shows (`startingSelection`).
 * Kept panes don't follow, so they never drive it. Returns `selection` itself when nothing changes.
 */
export function agreeOnArrival(
  env: Pick<Snapshot["env"], "kinds">,
  layout: Layout,
  selection: UiState["selection"],
  owners?: UiState["selectionOf"],
): UiState["selection"] {
  // A selection made in another list than the one now at its id is not this list's.
  let out = owners ? selectionFor(selection, owners, env.kinds, layout) : selection;
  for (const list of core.tree.panes(layout.root)) {
    const sel = ownOf(out, list.id);
    const own = sel ? core.follower(layout, list.id, sel.ref.kind) : undefined;
    const ref = sel
      ? own && !sameRef(own.ref, sel.ref)
        ? structuredClone(own.ref)
        : undefined
      : startingSelection(env, layout, list);
    if (ref) out = { ...out, [list.id]: { ref, inResults: true } };
  }
  return out;
}

/**
 * A new layout (a preset, `setLayout`) and the lists' selections agree. A list with no selection first starts on
 * what its follower of the kind it selects shows (`startingSelection`). Then, for each list in `layout` with a selection:
 *  - when the layout gives it a follower of the selected object's kind, the layout's word wins: the selection becomes
 *    what that follower shows, and the list's other followers show what their kinds give for it;
 *  - with no follower of that kind, its followers follow the selection, as a follow step would.
 * A follower with unsaved work keeps what the layout gives it (moving it would lose the work). Lists are taken in
 * tree order, so a chain (a list following a list) settles from the top. Returns the layout and the selections.
 */
export function agreeWithSelection(
  { s, ctx, env }: Pick<Snapshot, "s" | "ctx" | "env">,
  layout: Layout,
  view: ViewState,
): { layout: Layout; selection: UiState["selection"] } {
  // A list that stays is the same list: a selection made in another list under the same id is not carried over.
  let selection = selectionFor(s.selection, s.selectionOf, env.kinds, layout);
  for (const list of core.tree.panes(layout.root)) {
    let sel = ownOf(selection, list.id);
    if (!sel) {
      // Taken from the layout as it is now, so a list that follows a list starts on what the first one gave it.
      const ref = startingSelection(env, layout, list);
      if (!ref) continue;
      sel = { ref, inResults: true };
      selection = { ...selection, [list.id]: sel };
    }
    const own = core.follower(layout, list.id, sel.ref.kind);
    const target = own ? own.ref : sel.ref;
    if (own && !sameRef(own.ref, sel.ref))
      selection = { ...selection, [list.id]: { ref: structuredClone(own.ref), inResults: true } };
    for (const f of core.followers(layout, list.id)) {
      if (Object.hasOwn(s.unsaved, f.id)) continue;
      const ref = env.kinds.follow(f.ref.kind, target);
      if (ref && !sameRef(ref, f.ref)) layout = core.setRef(layout, view, f.id, ref, ctx);
    }
  }
  return { layout, selection };
}
