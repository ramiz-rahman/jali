/** The app's own moves, shared by panes and ⌘K commands: on the transport, and on the workspace. */
import type { Jali, NodeId, ObjectRef } from "jali";
import type { Engine } from "./audio/engine";

/**
 * Put `session` in the transport (if it isn't), then go to `time`, and play if asked. Loading is asynchronous, so the
 * seek waits for it.
 */
export function cue(engine: Engine, session: string, time: number, play = false) {
  const go = () => {
    engine.seek(time);
    if (play) engine.play(time);
  };
  if (engine.get().session === session && engine.get().status === "ready") return go();
  engine.load(session);
  if (engine.get().status === "ready") return go();
  const stop = engine.subscribe(() => {
    const s = engine.get();
    if (s.session !== session) return stop();
    if (s.status === "ready") {
      stop();
      go();
    } else if (s.status === "error") stop();
  });
}

/**
 * Show `ref` and bring it into view, without reshaping the layout:
 *  - the pane that already shows it is focused (one object, one pane);
 *  - else it opens as a tab of a pane of the same kind on screen, in one step;
 *  - else beside `from` (default: the focused pane), focused, so it comes to the front even when Jali folds it.
 */
export function show(jali: Jali, ref: ObjectRef, { from }: { from?: NodeId } = {}) {
  const m = jali.model();
  const open = m.paneOf(ref);
  if (open) return jali.actions.focus(open.id).pane;
  const sameKind = m.panes.find((p) => p.ref.kind === ref.kind && p.where === "shown");
  if (sameKind) return jali.actions.addTab(sameKind.id, ref).pane;
  const source = from ?? jali.get().view.focused ?? m.panes[0]?.id;
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
  const follower = jali
    .model()
    .panes.find((p) => p.linkedTo === list && p.follows && p.ref.kind === ref.kind);
  if (follower) {
    if (follower.where !== "shown") jali.actions.focus(follower.id);
    return follower.id;
  }
  return jali.actions.openBeside(list, ref).pane;
}

/** The session the person is working on: what the library's followers show, else the first library row. */
export function sessionInLayout(jali: Jali): string | undefined {
  const m = jali.model();
  const library = m.panes.find((p) => p.ref.kind === "library");
  const follower =
    m.panes.find((p) => library && p.linkedTo === library.id && p.follows) ??
    m.panes.find((p) => typeof p.ref.params.session === "string");
  const s = follower?.ref.params.session;
  return typeof s === "string" ? s : undefined;
}
