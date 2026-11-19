/** What a pane's content reports to the workspace: unsaved work, its ⌘K commands and its own state. */
import type { NodeId } from "../layout/types";
import type { PaneAttributes, PaneCommand } from "../pane-kinds";
import type { Outcome, Snapshot } from "../state/apply";
import { say } from "../state/messages";

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

/** The data-* names Jali's own parts carry or look for: a pane's attributes never take them. */
const JALI_DATA = new Set(
  [
    "activity",
    "autofocus",
    "boundary",
    "chip",
    "command-id",
    "divider",
    "drag-ok",
    "drop-zone",
    "fade-l",
    "fade-r",
    "focused",
    "folded",
    "follow",
    "ghost",
    "hidden-count",
    "item",
    "kind",
    "no-drag",
    "origin",
    "page",
    "pane",
    "pane-keys",
    "pane-region",
    "reason",
    "role",
    "shape",
    "shelf",
    "single",
    "state",
    "summary",
    "tab",
    "testid",
    "theme",
    "tucked",
    "zoomed",
  ].map((n) => `data-${n}`),
);
const ownName = (name: string) =>
  name.startsWith("data-") && !name.startsWith("data-jali") && !JALI_DATA.has(name);

/** The pane's `data-*` attributes from its data (usePaneAttributes); `null` or none clears them. A name that is not
 *  `data-*`, or that Jali's own parts use (`data-pane`, `data-tab`, `data-jali-*`, …), is dropped. */
export function setPaneAttributes(
  { s, m }: Snapshot,
  id: NodeId,
  attributes: PaneAttributes | null,
): Outcome {
  const next = Object.fromEntries(
    Object.entries(attributes ?? {}).filter(([k, v]) => ownName(k) && typeof v === "string"),
  ) as PaneAttributes;
  const empty = !Object.keys(next).length;
  if (!m.pane(id) || sameAttributes(s.paneAttributes[id], empty ? undefined : next)) return null;
  return {
    op: "patch",
    patch: {
      paneAttributes: empty ? without(s.paneAttributes, [id]) : { ...s.paneAttributes, [id]: next },
    },
  };
}

const sameAttributes = (a: PaneAttributes | undefined, b: PaneAttributes | undefined) =>
  a === b ||
  (!!a &&
    !!b &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([k, v]) => b[k as keyof PaneAttributes] === v));

/** One value of a pane's own state. JSON only: it is saved with the person's settings. */
export function setPaneState({ s, m }: Snapshot, id: NodeId, key: string, value: unknown): Outcome {
  if (!m.pane(id) || Object.is(s.paneState[id]?.[key], value)) return null;
  return {
    op: "patch",
    patch: { paneState: { ...s.paneState, [id]: { ...s.paneState[id], [key]: value } } },
  };
}

/** "Discard": forget the held panes' unsaved work, then make the change that was held. */
export function discardAndContinue({ s, env }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    {
      op: "patch",
      patch: { confirm: null, unsaved: without(s.unsaved, c.panes) },
      msg: say(env).discarded(c.panes.length),
    },
    c.change,
  ];
}

/** "Keep editing": drop the held change. */
export const keepEditing = ({ s, env }: Snapshot): Outcome =>
  s.confirm ? { op: "patch", patch: { confirm: null }, msg: say(env).keptEditing } : null;
