/**
 * Linked selection in a detail's header (actions/follow.ts): the Following / Kept toggle, and a note when the list's filter no
 * longer shows the item the detail follows.
 */

import type { PaneNode } from "@jali/core";
import { useJaliIcons } from "../icons/context";
import { sameRef } from "@jali/core/adapter";
import { useMessages, useStore, useUi } from "../state/react";

/**
 * One toggle on any linked pane, naming what the pane does now: **Following** (it changes with its list's selection,
 * or the next link from its source replaces it), or **Kept** (it stays; the next link opens beside). A click switches.
 * Its name starts with its visible word (WCAG 2.5.3), and its description says what a click will do; since the name
 * changes with the state, it isn't also `aria-pressed` (APG: a toggle's name stays put).
 */
export function FollowControl({ node }: { node: PaneNode; title: string }) {
  const icon = useJaliIcons();
  const store = useStore();
  const t = useMessages().pane;
  const list = useUi(() => (node.linkedTo ? store.model().title(node.linkedTo) : ""));
  if (!node.linkedTo)
    return node.kept ? <span className="jali-badge jali-kept-badge">{t.kept}</span> : null;
  const kept = !!node.kept;
  const hint = kept ? t.keptTip(list) : node.follows ? t.followingTip(list) : t.plainTip(list);
  return (
    <button
      type="button"
      className="jali-follow-toggle"
      data-follow={kept ? "kept" : node.follows ? "following" : "plain"}
      aria-label={kept ? t.kept : t.followingName(list)}
      aria-description={hint}
      title={hint}
      onClick={() => store.actions.setKept(node.id, !kept)}
    >
      {kept ? <icon.keep size={12} aria-hidden /> : <icon.follow size={12} aria-hidden />}
      <span className="jali-follow-label" aria-hidden>
        {kept ? t.kept : t.following}
      </span>
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
  return (
    <p className="jali-pane-note" role="note">
      {store.messages.announcements.notInResults(store.model().title(node.linkedTo))}
    </p>
  );
}
