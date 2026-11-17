import * as core from "../../layout-core";
import type { Layout, NodeId, ObjectRef, ViewState } from "../../layout-core/types";
import { paneTitle } from "../pane-kinds";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import { openBeside, withRecent } from "./open";

export const checkPeek = ({ s }: Snapshot) => (s.view.peek ? undefined : refuse());

/** Open (or move) the peek sheet; `null` closes it. It acts for the pane it came from. */
export function peek({ s }: Snapshot, ref: ObjectRef | null, source?: NodeId): Outcome {
  const view = { ...s.view };
  if (ref) view.peek = ref;
  else delete view.peek;
  return { op: "peek", view, patch: { peekSource: ref ? (source ?? s.peekSource ?? s.view.focused) : undefined }, msg: ref ? msg.peek(paneTitle(ref)) : msg.peekClosed };
}

/** Pin: close the peek, then open its object beside the pane it came from. */
export function pinPeek(x: Snapshot): Outcome {
  const ref = x.s.view.peek, source = x.s.peekSource ?? x.s.view.focused;
  if (!ref || !source) return null;
  return [peek(x, null), (y: Snapshot) => openBeside(y, source, ref)];
}

export function openPeekFull({ s, ctx }: Snapshot): Outcome {
  const ref = s.view.peek;
  if (!ref) return null;
  const layout: Layout = { version: 1, root: { id: "full", type: "pane", size: { weight: 1 }, ref } };
  const view: ViewState = { focused: "full", focusHistory: ["full"] };
  return { op: "openFull", layout: core.refit(layout, view, ctx), view, msg: msg.openedFull(paneTitle(ref)), patch: { peekSource: undefined, recent: withRecent(s.recent, [ref]) } };
}

/** The pane's selection moved; an open peek from that pane follows it (Linear). */
export function select({ s }: Snapshot, source: NodeId, ref: ObjectRef | null): Outcome {
  if (!ref || !s.view.peek || s.peekSource !== source) return null;
  return { op: "select", view: { ...s.view, peek: ref } };
}
