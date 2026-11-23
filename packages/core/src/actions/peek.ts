import * as core from "../layout/engine";
import type { NodeId, ObjectRef } from "../layout/types";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import { openBeside } from "./open";
import { follow, followerOnScreen, followLater, sameRef } from "./follow";
import { own } from "../own";
import type { Step } from "./step";

/** Close the peek sheet. */
export const closePeek: Step<[]> = {
  check: ({ s }) => (s.view.peek ? undefined : refuse("nothing-to-do")),
  run: (x) => peekSheet(x, null),
};

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

/** The pane a peek acts for: the one it came from, else the focused one. */
const peekSource = ({ s }: Snapshot) => s.peekSource ?? s.view.focused;

/** Keep: close the peek, then open its object beside the pane it came from, which must allow `open`. A curated page
 *  in Single view has no layout to open it in: there, a link peeks. */
export const openPeekBeside: Step<[]> = {
  check: (x) =>
    !x.s.view.peek || !peekSource(x)
      ? refuse("nothing-to-do")
      : x.s.page?.mode === "single"
        ? refuse("single-view", say(x).singleNoLayout)
        : undefined,
  control: (x) => [["open", peekSource(x)]],
  run(x) {
    const ref = x.s.view.peek!,
      source = peekSource(x)!;
    return [peek(x, null), (y: Snapshot) => openBeside(y, source, ref)];
  },
};

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
