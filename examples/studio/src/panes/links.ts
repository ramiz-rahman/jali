/**
 * How Studio's panes reach each other, shared by the panes, the chrome and ⌘K: which pane shows what, and how to
 * bring it into view.
 *
 * Studio's links between panes: the library selects a session's transcript (`transcript({ session })`) and its
 * followers (transcript, timeline, mixer, markers) show that session; the transcript selects a segment
 * (`clip({ session, segment })`) and the segment detail that follows it shows that segment.
 */
import type { Jali, NodeId, ObjectRef } from "jali";
import type { SessionId } from "../sessions/ids";
import { sessionOf } from "./refs";

const panes = (jali: Jali) => jali.model().panes;

/** The library: one in every layout (presets.ts), though the person may close it or open another. */
export const libraryOf = (jali: Jali) => panes(jali).find((p) => p.ref.kind === "library");

/** The pane that follows `list`, of `kind` when one is named. */
export const followerOf = (jali: Jali, list: NodeId, kind?: string) =>
  panes(jali).find((p) => p.linkedTo === list && p.follows && (!kind || p.ref.kind === kind));

/**
 * Show `ref` and bring it into view, without reshaping the layout:
 *  - the pane that already shows it is focused (one object, one pane);
 *  - else it opens as a tab of a pane of the same kind on screen, in one step;
 *  - else beside `from` (default: the focused pane), focused, so it comes to the front even when Jali folds it.
 */
export function show(jali: Jali, ref: ObjectRef, { from }: { from?: NodeId } = {}) {
  const open = jali.model().paneOf(ref);
  if (open) return jali.actions.focus(open.id).pane;
  const sameKind = panes(jali).find((p) => p.ref.kind === ref.kind && p.where === "shown");
  if (sameKind) return jali.actions.addTab(sameKind.id, ref).pane;
  const source = from ?? jali.get().view.focused ?? panes(jali)[0]?.id;
  const id = source ? jali.actions.openBeside(source, ref).pane : undefined;
  if (id) jali.actions.focus(id);
  return id;
}

/**
 * Open `ref` from a list as a detail that follows it: the segment detail for a transcript line. If the list already
 * has a following detail of that kind, that one is shown (and brought to the front if it was folded). Keep it first
 * to keep it, then open another to compare two segments side by side.
 */
export function openFollowing(jali: Jali, list: NodeId, ref: ObjectRef): NodeId | undefined {
  const follower = followerOf(jali, list, ref.kind);
  if (!follower) return jali.actions.openBeside(list, ref).pane;
  if (follower.where !== "shown") jali.actions.focus(follower.id);
  return follower.id;
}

/** The session the person is working on: what the library's followers show, else what any pane shows. */
export function sessionInLayout(jali: Jali): SessionId | undefined {
  const list = libraryOf(jali);
  const follower = list && followerOf(jali, list.id);
  return (
    sessionOf(follower?.ref) ??
    panes(jali)
      .map((p) => sessionOf(p.ref))
      .find(Boolean)
  );
}
