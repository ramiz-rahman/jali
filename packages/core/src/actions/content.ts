/** What a pane's content reports to the workspace: unsaved work, its ⌘K commands and its own state. */
import type { NodeId } from "../layout/types";
import {
  mostPressing,
  type PaneActivity,
  type PaneAttributes,
  type PaneCommand,
} from "../pane-kinds";
import { setActivity } from "./layout";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { follow } from "./follow";
import { say } from "../state/messages";
import { own } from "../own";
import { objectKey, paneStateFor } from "../state/pane-state";

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

/**
 * What one caller of the pane hooks reports (useActivity, useUnsaved, useCommands, useTitle, usePaneAttributes).
 * A pane's content may call each hook from several components; the workspace keeps each caller's report and merges
 * them, so one caller never overwrites or clears another's.
 */
export interface PaneReport {
  /** Order among the pane's callers: render order when each mounted, so a parent before its children and an earlier
   *  mount before a later one. */
  seq: number;
  activity?: PaneActivity;
  unsaved?: string;
  commands?: PaneCommand[];
  title?: string;
  attributes?: PaneAttributes;
}

/** The fields a report can carry; `undefined` (or `null`) takes the caller's value away. */
export type PaneReportPatch = {
  [K in Exclude<keyof PaneReport, "seq">]?: PaneReport[K] | null;
};

type Field = keyof PaneReportPatch;
const FIELDS: readonly Field[] = ["activity", "unsaved", "commands", "title", "attributes"];

/**
 * A pane's callers merged: commands in caller order (an id listed twice keeps its first); unsaved work while any caller
 * has some, every distinct text kept; the most pressing activity; the title and attributes of the last caller in
 * order that gives one (the innermost component on a first mount, else the latest mounted).
 */
export function mergeReports(reports: readonly PaneReport[]) {
  const ordered = [...reports].sort((a, b) => a.seq - b.seq);
  const ids = new Set<string>();
  const commands = ordered
    .flatMap((r) => r.commands ?? [])
    .filter((c) => !ids.has(c.id) && !!ids.add(c.id));
  const texts = [...new Set(ordered.flatMap((r) => (r.unsaved ? [r.unsaved] : [])))];
  const last = <K extends Field>(k: K) => ordered.findLast((r) => r[k] !== undefined)?.[k];
  return {
    activity: mostPressing(ordered.map((r) => r.activity)) ?? ("idle" as PaneActivity),
    unsaved: texts.length ? texts.join(", ") : null,
    commands: commands.length ? commands : null,
    title: last("title") ?? null,
    attributes: last("attributes") ?? null,
  };
}

/**
 * One caller's report for pane `id` (`patch: null` when the caller unmounts): kept per caller, then merged into the
 * pane's activity, unsaved work, commands, title and attributes. Only the fields the report touches are merged again.
 */
export function reportPane(
  x: Snapshot,
  id: NodeId,
  caller: string,
  seq: number,
  patch: PaneReportPatch | null,
): Outcome {
  const { s, m } = x;
  if (!m.pane(id)) return null;
  const all = own(s.paneReports, id) ?? {};
  const mine = own(all, caller);
  if (!mine && !patch) return null;
  const next: PaneReport = { ...mine, seq: mine?.seq ?? seq };
  const touched = patch ? FIELDS.filter((k) => Object.hasOwn(patch, k)) : FIELDS;
  for (const k of touched) {
    const v = patch?.[k];
    if (v === undefined || v === null) delete next[k];
    else (next as unknown as Record<Field, unknown>)[k] = v;
  }
  const keep = FIELDS.some((k) => next[k] !== undefined);
  const pane = Object.fromEntries(Object.entries(all).filter(([c]) => c !== caller));
  if (keep) pane[caller] = next;
  const paneReports = Object.fromEntries(Object.entries(s.paneReports).filter(([p]) => p !== id));
  if (Object.keys(pane).length) paneReports[id] = pane;
  const merged = mergeReports(Object.values(pane));
  const steps: Outcome[] = [{ op: "patch", patch: { paneReports } }];
  for (const k of touched) {
    if (k === "activity") steps.push((y: Snapshot) => setActivity(y, id, merged.activity));
    if (k === "unsaved") steps.push((y: Snapshot) => setUnsaved(y, id, merged.unsaved));
    if (k === "commands") steps.push((y: Snapshot) => setPaneCommands(y, id, merged.commands));
    if (k === "title") steps.push((y: Snapshot) => setTitle(y, id, merged.title));
    if (k === "attributes")
      steps.push((y: Snapshot) => setPaneAttributes(y, id, merged.attributes));
  }
  return steps;
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
const JALI_DATA = /* @__PURE__ */ new Set(
  /* @__PURE__ */ [
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

/** One value of a pane's own state. JSON only: it is saved with the person's settings. It belongs to the object the
 *  pane shows: state kept under the id for another object (one an undo could bring back) is replaced. */
export function setPaneState(
  { s, m, env }: Snapshot,
  id: NodeId,
  key: string,
  value: unknown,
): Outcome {
  const p = m.pane(id);
  if (!p) return null;
  const of = objectKey(env.kinds, p.ref);
  const mine = paneStateFor(s, env.kinds, id, p.ref);
  if (mine && Object.is(own(mine, key), value)) return null;
  return {
    op: "patch",
    patch: {
      paneState: { ...s.paneState, [id]: { ...mine, [key]: value } },
      ...(own(s.paneStateOf, id) === of ? {} : { paneStateOf: { ...s.paneStateOf, [id]: of } }),
    },
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
