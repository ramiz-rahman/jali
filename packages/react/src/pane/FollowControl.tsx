/**
 * Linked selection in a detail's header (actions/follow.ts): the Keep toggle, and a note when the list's filter no
 * longer shows the item the detail follows.
 */

import type { PaneNode } from "@jali/core";
import { useJaliIcons } from "../icons/context";
import { sameRef } from "@jali/core/adapter";
import { useMessages, useStore, useUi } from "../state/react";

/**
 * Keep, on any linked pane: a toggle (pressed = kept) that stops a follower following its list, or stops the next link
 * from its source replacing a plain link. A follower also says "Following", beside the toggle: a status, not its name,
 * so the toggle's name and visible word are the same (WCAG 2.5.3).
 */
export function FollowControl({ node, title }: { node: PaneNode; title: string }) {
  const icon = useJaliIcons();
  const store = useStore();
  const t = useMessages().pane;
  const list = useUi(() => (node.linkedTo ? store.model().title(node.linkedTo) : ""));
  if (!node.linkedTo) return node.kept ? <span className="jali-badge">{t.kept}</span> : null;
  const kept = !!node.kept;
  const hint = kept ? t.keptTip(list) : node.follows ? t.followingTip(list) : t.plainTip(list);
  return (
    <>
      {node.follows ? (
        <span className="jali-follow-status" title={t.followingTip(list)}>
          <icon.follow size={12} aria-hidden />
          <span>{t.following}</span>
        </span>
      ) : null}
      <button
        type="button"
        className="jali-follow-toggle"
        data-follow={kept ? "kept" : node.follows ? "following" : "plain"}
        aria-pressed={kept}
        aria-label={t.keep(title)}
        title={hint}
        onClick={() => store.actions.setKept(node.id, !kept)}
      >
        <icon.keep size={12} aria-hidden />
        <span aria-hidden>{t.keepWord}</span>
      </button>
    </>
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
  return (
    <p className="jali-pane-note" role="note">
      {store.messages.announcements.notInResults(store.model().title(node.linkedTo))}
    </p>
  );
}
