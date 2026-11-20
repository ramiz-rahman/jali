import * as core from "../layout";
import type { Layout, NodeId, ObjectRef, ViewState } from "../layout/types";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { openBeside, withRecent } from "./open";
import { follow, followerOnScreen, followLater, sameRef } from "./follow";
import { own } from "../own";

export const checkPeek = ({ s }: Snapshot) => (s.view.peek ? undefined : refuse("nothing-to-do"));

/**
 * Open (or move) the peek sheet; `null` closes it. It acts for the pane it came from. When that pane's following
 * detail of the same kind is on screen, the detail shows `ref` instead: peek and the detail would answer the same
 * question twice. With no detail, or none with room on screen, the sheet opens.
 */
export function peek(x: Snapshot, ref: ObjectRef | null, source?: NodeId): Outcome {
  if (ref && source && followerOnScreen(x, source, ref.kind))
    return [
      { op: "select", defer: followLater(source, null) },
      (y: Snapshot) => follow(y, source, ref),
    ];
  return peekSheet(x, ref, source);
}

/** The peek sheet itself: open (or move) it to `ref`, or close it (`null`). */
export function peekSheet({ s, env }: Snapshot, ref: ObjectRef | null, source?: NodeId): Change {
  const view = { ...s.view };
  if (ref) view.peek = ref;
  else delete view.peek;
  return {
    op: "peek",
    view,
    patch: { peekSource: ref ? (source ?? s.peekSource ?? s.view.focused) : undefined },
    msg: ref ? say(env).peek(env.kinds.title(ref)) : say(env).peekClosed,
  };
}

/** Keep: close the peek, then open its object beside the pane it came from. */
export function openPeekBeside(x: Snapshot): Outcome {
  const ref = x.s.view.peek,
    source = x.s.peekSource ?? x.s.view.focused;
  if (!ref || !source) return null;
  return [peek(x, null), (y: Snapshot) => openBeside(y, source, ref)];
}

export function openPeekFull({ s, ctx, env }: Snapshot): Outcome {
  const ref = s.view.peek;
  if (!ref) return null;
  const layout: Layout = {
    version: 1,
    root: { id: "full", type: "pane", size: { weight: 1 }, ref },
  };
  const view: ViewState = { focused: "full", focusHistory: ["full"] };
  return {
    op: "openFull",
    layout: core.refit(layout, view, ctx),
    view,
    msg: say(env).openedFull(env.kinds.title(ref)),
    patch: { peekSource: undefined, recent: withRecent(env.kinds, s.recent, [ref]) },
  };
}

/**
 * The pane's selection moved. An open peek from that pane follows it at once (Linear); its following detail follows
 * once the selection rests (actions/follow.ts). `inResults: false`: the list's filter no longer shows `ref`, and the
 * detail keeps showing it with a note. `null`: no item is selected; the detail keeps what it shows.
 */
export function select(
  { s }: Snapshot,
  source: NodeId,
  ref: ObjectRef | null,
  opts: { inResults?: boolean } = {},
): Outcome {
  if (!ref) {
    if (!Object.hasOwn(s.selection, source)) return null;
    const { [source]: _gone, ...selection } = s.selection;
    return { op: "select", patch: { selection }, defer: followLater(source, null) };
  }
  const inResults = opts.inResults ?? true,
    prev = own(s.selection, source);
  const moved = !prev || !sameRef(prev.ref, ref);
  const patch =
    moved || prev.inResults !== inResults
      ? { selection: { ...s.selection, [source]: { ref, inResults } } }
      : undefined;
  const peekFollows = s.view.peek && s.peekSource === source && !sameRef(s.view.peek, ref);
  if (!patch && !peekFollows) return null;
  return {
    op: "select",
    ...(peekFollows ? { view: { ...s.view, peek: ref } } : {}),
    ...(patch ? { patch } : {}),
    // Any follower: a later selection also replaces a follow still waiting for an earlier one.
    ...(moved && core.followers(s.layout, source).length
      ? { defer: followLater(source, ref) }
      : {}),
  };
}
