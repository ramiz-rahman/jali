/** What a pane's content reports to the workspace: unsaved work, its ⌘K commands and its own state. */
import type { NodeId } from "../layout/types";
import type { PaneCommand } from "../pane-kinds";
import type { Outcome, Snapshot } from "../state/apply";
import { msg } from "../state/messages";

const without = <T>(r: Record<NodeId, T>, ids: readonly NodeId[]) =>
  Object.fromEntries(Object.entries(r).filter(([id]) => !ids.includes(id)));

export function setUnsaved({ s, m }: Snapshot, id: NodeId, what: string | null): Outcome {
  if (!m.pane(id) || (s.unsaved[id] ?? null) === what) return null;
  return {
    op: "patch",
    patch: { unsaved: what ? { ...s.unsaved, [id]: what } : without(s.unsaved, [id]) },
  };
}

export function setPaneCommands(
  { s, m }: Snapshot,
  id: NodeId,
  commands: PaneCommand[] | null,
): Outcome {
  if (!m.pane(id) || (!commands?.length && !s.paneCommands[id])) return null;
  return {
    op: "patch",
    patch: {
      paneCommands: commands?.length
        ? { ...s.paneCommands, [id]: commands }
        : without(s.paneCommands, [id]),
    },
  };
}

/** The pane's title from its data (useTitle), in place of its kind's; `null` goes back to the kind's. */
export function setTitle({ s, m }: Snapshot, id: NodeId, title: string | null): Outcome {
  if (!m.pane(id) || (s.titles[id] ?? null) === title) return null;
  return {
    op: "patch",
    patch: { titles: title ? { ...s.titles, [id]: title } : without(s.titles, [id]) },
  };
}

/** One value of a pane's own state. JSON only: it is saved with the person's settings. */
export function setPaneState({ s, m }: Snapshot, id: NodeId, key: string, value: unknown): Outcome {
  if (!m.pane(id) || Object.is(s.paneState[id]?.[key], value)) return null;
  return {
    op: "patch",
    patch: { paneState: { ...s.paneState, [id]: { ...s.paneState[id], [key]: value } } },
  };
}

/** "Discard": forget the held panes' unsaved work, then make the change that was held. */
export function discardAndContinue({ s }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    {
      op: "patch",
      patch: { confirm: null, unsaved: without(s.unsaved, c.panes) },
      msg: msg.discarded(c.panes.length),
    },
    c.change,
  ];
}

/** "Keep editing": drop the held change. */
export const keepEditing = ({ s }: Snapshot): Outcome =>
  s.confirm ? { op: "patch", patch: { confirm: null }, msg: msg.keptEditing } : null;
