/** What a pane's content reports to the workspace: unsaved work, its ⌘K commands and its own state. */
import type { NodeId } from "../layout/types";
import type { PaneAttributes, PaneCommand } from "../pane-kinds";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { follow } from "./follow";
import { say } from "../state/messages";
import { own } from "../own";

const without = <T>(r: Record<NodeId, T>, ids: readonly NodeId[]) =>
  Object.fromEntries(Object.entries(r).filter(([id]) => !ids.includes(id)));

/**
 * The pane's unsaved work (useUnsaved), or `null` once it is saved or discarded. A following detail held on its
 * object by its work (actions/follow.ts) catches up with its list's selection as soon as the work is gone.
 */
export function setUnsaved({ s, m }: Snapshot, id: NodeId, what: string | null): Outcome {
  const p = m.pane(id);
  if (!p || (own(s.unsaved, id) ?? null) === what) return null;
  const change: Change = {
    op: "patch",
    patch: { unsaved: what ? { ...s.unsaved, [id]: what } : without(s.unsaved, [id]) },
  };
  const sel = !what && p.follows && p.linkedTo ? own(s.selection, p.linkedTo) : undefined;
  return sel ? [change, (y: Snapshot) => follow(y, p.linkedTo!, sel.ref, id)] : change;
}

export function setPaneCommands(
  { s, m }: Snapshot,
  id: NodeId,
  commands: PaneCommand[] | null,
): Outcome {
  if (!m.pane(id) || (!commands?.length && !Object.hasOwn(s.paneCommands, id))) return null;
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
  if (!m.pane(id) || (own(s.titles, id) ?? null) === title) return null;
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
  if (!m.pane(id) || sameAttributes(own(s.paneAttributes, id), empty ? undefined : next))
    return null;
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
  if (!m.pane(id) || Object.is(own(own(s.paneState, id), key), value)) return null;
  return {
    op: "patch",
    patch: { paneState: { ...s.paneState, [id]: { ...own(s.paneState, id), [key]: value } } },
  };
}

/**
 * "Discard": the held action runs again against the state now. If it still loses only the work asked about, it is
 * made, and that work is forgotten in the same commit; if it would now lose other work, the question is asked again.
 * Nothing is forgotten when it no longer happens.
 */
export function discardAndContinue({ s }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    { op: "patch", patch: { confirm: null } },
    {
      op: "answer",
      intent: c.intent,
      agreed: { ...c.agreed, discard: [...(c.agreed.discard ?? []), ...c.asked] },
      settle: c.settle,
    },
  ];
}

/** "Keep editing": drop the held action. */
export function keepEditing({ s, env }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    { op: "patch", patch: { confirm: null }, msg: say(env).keptEditing },
    { op: "answer", intent: () => refuse("kept"), agreed: {}, settle: c.settle },
  ];
}
