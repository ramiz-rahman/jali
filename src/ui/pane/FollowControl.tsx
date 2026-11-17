/**
 * Linked selection in a detail's header (actions/follow.ts): the Pin toggle, and a note when the list's filter no
 * longer shows the item the detail follows.
 */
import { Link2, Pin } from "lucide-react";
import type { PaneNode } from "../../layout-core/types";
import { sameRef } from "../actions/follow";
import { msg } from "../state/messages";
import { useStore, useUi } from "../state/react";

/** Shown on a linked detail that follows its list, or was pinned beside it. Pressed = pinned. */
export function FollowControl({ node, title }: { node: PaneNode; title: string }) {
  const store = useStore();
  const list = useUi(() => (node.linkedTo ? store.model().title(node.linkedTo) : ""));
  if (!node.linkedTo || !(node.follows || node.pinned)) return node.pinned ? <span className="badge">Pinned</span> : null;
  const pinned = !!node.pinned;
  const hint = pinned ? `Pinned: stays on this item. Unpin to follow the selection in ${list}` : `Follows the selection in ${list}. Pin to keep this item`;
  return (
    <button type="button" className="follow-toggle" data-follow={pinned ? "pinned" : "following"} aria-pressed={pinned} aria-label={`Pin ${title}`} title={hint}
      onClick={() => store.actions.setPinned(node.id, !pinned)}>
      {pinned ? <Pin size={12} strokeWidth={1.5} aria-hidden /> : <Link2 size={12} strokeWidth={1.5} aria-hidden />}
      <span aria-hidden>{pinned ? "Pinned" : "Following"}</span>
    </button>
  );
}

/** "Not in the current results of orders": the detail still shows the list's selection, which a filter removed. */
export function NotInResults({ node }: { node: PaneNode }) {
  const store = useStore();
  const out = useUi((s) => {
    const sel = node.follows && node.linkedTo ? s.selection[node.linkedTo] : undefined;
    return !!sel && !sel.inResults && sameRef(sel.ref, node.ref);
  });
  if (!out || !node.linkedTo) return null;
  return <p className="pane-note" role="note">{msg.notInResults(store.model().title(node.linkedTo))}</p>;
}
