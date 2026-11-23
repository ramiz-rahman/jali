/**
 * A list pane's cursor that is also its selection in Jali, so the panes that follow the list show the row it is on,
 * and a command ("Open session…", "Go to segment…") can move it from outside.
 *
 * Jali keeps a list's selection only while the page is open, so the cursor is also kept in pane state: a reload
 * comes back to the same row. Where the two differ, Jali's selection wins (it is what a command just set). On first
 * show (and again whenever `scope` changes: the transcript's session) the cursor starts on Jali's selection when it
 * names one of these rows (the app set it as it started: Studio works on the transport's session), else its row as
 * kept, else the row the list's follower already shows (a link), else `fallback()`. A kept row from an earlier visit
 * never moves a layout a link has just opened onto another session.
 */
import { useEffect } from "react";
import type { ObjectRef } from "jali";
import { useJali, useJaliState, usePaneState, type PaneProps } from "jali/react";
import { stringOrNull } from "../storage";
import { followerOf } from "./links";

export function useSelectionCursor<Id extends string>({
  node,
  ids,
  idOf,
  choose,
  fallback,
  scope,
}: Pick<PaneProps, "node"> & {
  /** The rows' ids, in order. */
  ids: readonly Id[];
  /** The row a ref (a selection, a follower's object) names, if it is one of this list's. */
  idOf(ref: ObjectRef | undefined): Id | undefined;
  /** Select row `id` in Jali: `select(ref)`, and whatever else choosing it means. */
  choose(id: Id): void;
  fallback(): Id;
  /** What the cursor belongs to: a new scope starts it again. */
  scope?: string;
}) {
  const jali = useJali();
  const [kept, keep] = usePaneState<string | null>("cursor", null, { parse: stringOrNull });
  const selected = useJaliState((s) => idOf(s.selection[node.id]?.ref));
  const known = (id: string | null | undefined): id is Id => !!id && ids.includes(id as Id);
  const current = selected ?? (known(kept) ? kept : undefined);

  const moveTo = (id: Id) => {
    keep(id);
    choose(id);
  };

  useEffect(() => {
    const start =
      selected && ids.includes(selected)
        ? selected
        : known(kept)
          ? kept
          : (idOf(followerOf(jali, node.id)?.ref) ?? fallback());
    moveTo(start);
    // Once a scope: later moves come from the person, the playhead and the commands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return { at: current ? ids.indexOf(current) : -1, current, moveTo };
}
