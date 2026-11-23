/**
 * The lab beside a source pane: the panes linked to it that follow its selection. A lesson, the packet list and the
 * Scans pane each select something, and what shows it is whichever follower Jali says can (each kind's `follow`),
 * so no pane keeps its own list of which kinds show what. When nothing on screen can show it, the person is put in
 * front of it anyway, because a source that silently does nothing is worse than one that opens a pane.
 */
import { useCallback } from "react";
import type { Jali, JaliModel, NodeId, ObjectRef } from "jali";
import { storeOf } from "jali/adapter";
import { useJali, useJaliModel, type PaneProps } from "jali/react";

/**
 * The kinds' own rules: which kind follows what (`follow`), what a list selects (`selects`), a ref's title. They are
 * the engine's kind registry, which Jali's read API leaves behind `jali/adapter`.
 */
export const kindsOf = (jali: Jali) => storeOf(jali).env.kinds;

/** The panes linked to `source` that follow its selection. */
const followersOf = (model: JaliModel, source: NodeId) =>
  model.panes.filter((p) => p.linkedTo === source && p.follows);

/** Whether a pane of `kind` shows `ref` when its source selects it: its own kind, or its `follow` reads it. */
export const shows = (jali: Jali, kind: string, ref: ObjectRef) =>
  kindsOf(jali).follow(kind, ref) !== undefined;

/**
 * For a source pane: whether a follower on screen shows a ref, and `show`, which selects it and opens a pane
 * beside the source when none does.
 */
export function useLab({
  node,
  select,
  openBeside,
}: Pick<PaneProps, "node" | "select" | "openBeside">) {
  const jali = useJali();
  // The kinds of the visible followers, as one string so the pane re-renders only when they change.
  const kinds = useJaliModel((m) =>
    followersOf(m, node.id)
      .filter((p) => p.where === "shown")
      .map((p) => p.ref.kind)
      .sort()
      .join(","),
  );
  const showing = useCallback(
    (ref: ObjectRef) => kinds.split(",").some((k) => k && shows(jali, k, ref)),
    [jali, kinds],
  );
  const show = useCallback(
    (ref: ObjectRef) => {
      select(ref);
      if (!showing(ref)) openBeside(ref);
    },
    [select, openBeside, showing],
  );
  return { showing, show };
}

export type Lab = ReturnType<typeof useLab>;

/**
 * Open `ref` from a source as a detail that follows it. If the source already has a follower of that kind, it shows
 * the selection already: bring it to the front if it is folded away. Otherwise open it beside the source.
 */
export function openFollower(jali: Jali, source: NodeId, ref: ObjectRef) {
  const model = jali.model();
  const follower = followersOf(model, source).find((p) => p.ref.kind === ref.kind);
  if (!follower) return jali.actions.openBeside(source, ref);
  if (follower.where !== "shown") jali.actions.focus(follower.id);
  return undefined;
}

/**
 * Select `ref` where it moves the most: on this pane's source when the source is a list of that kind (a ladder
 * following the packet list moves the list's cursor, and everything following the list moves with it), else on
 * this pane, for panes that follow it.
 */
export function selectUpstream(
  jali: Jali,
  { node, select }: Pick<PaneProps, "node" | "select">,
  ref: ObjectRef,
) {
  const source = node.linkedTo ? jali.model().pane(node.linkedTo) : undefined;
  if (source && kindsOf(jali).get(source.ref.kind)?.selects === ref.kind)
    jali.actions.select(source.id, ref);
  else select(ref);
}
