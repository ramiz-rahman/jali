/**
 * What panes report about themselves, with one owner. Each caller of the pane hooks (useActivity, useUnsaved,
 * useCommands, useTitle, usePaneAttributes) keeps its own report in `paneReports`; the five maps the rest of the
 * instance reads (`activity`, `unsaved`, `paneCommands`, `titles`, `paneAttributes`) are made from those reports here,
 * and nowhere else. A report changed, a pane closed, a pane showing another object, work discarded: each changes the
 * reports, and the maps follow from them (`withMaps`). A map, and each pane's entry in it, keeps its object while what
 * it says is unchanged, so a part that reads one pane's title doesn't render for another pane's activity.
 *
 * Two lifetimes: a title and attributes describe the object a pane shows, so they go when the pane shows another
 * (`OF_OBJECT`); activity, unsaved work and commands belong to the content mounted in the pane, which stays mounted
 * when its object changes, so they go only with the pane.
 */
import type { NodeId } from "../layout/types";
import {
  mostPressing,
  type PaneActivity,
  type PaneAttributes,
  type PaneCommand,
} from "../pane-kinds";
import type { UiState } from "./store";

/**
 * What one caller of the pane hooks reports. A pane's content may call each hook from several components; the
 * instance keeps each caller's report and merges them, so one caller never overwrites or clears another's.
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
/** The fields about the object a pane shows: they go when it shows another. */
const OF_OBJECT: readonly Field[] = ["title", "attributes"];

/** Every pane's reports, by caller. */
export type Reports = UiState["paneReports"];
/** The maps made from the reports. */
export type ReportMaps = Pick<
  UiState,
  "activity" | "unsaved" | "paneCommands" | "titles" | "paneAttributes"
>;

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

/** `reports` with one caller's report for pane `id` changed by `patch` (`null`: the caller is gone). The same object
 *  when nothing changes. */
export function withReport(
  reports: Reports,
  id: NodeId,
  caller: string,
  seq: number,
  patch: PaneReportPatch | null,
): Reports {
  const all = reports[id] ?? {};
  const mine = Object.hasOwn(all, caller) ? all[caller] : undefined;
  if (!mine && !patch) return reports;
  const next: PaneReport = { ...mine, seq: mine?.seq ?? seq };
  for (const k of patch ? FIELDS.filter((f) => Object.hasOwn(patch, f)) : FIELDS) {
    const v = patch?.[k];
    if (v === undefined || v === null) delete next[k];
    else (next as unknown as Record<Field, unknown>)[k] = v;
  }
  const pane = Object.fromEntries(Object.entries(all).filter(([c]) => c !== caller));
  if (FIELDS.some((k) => next[k] !== undefined)) pane[caller] = next;
  const out = Object.fromEntries(Object.entries(reports).filter(([p]) => p !== id));
  if (Object.keys(pane).length) out[id] = pane;
  return out;
}

/** Each caller's report without `fields`; a caller left with nothing goes, as does a pane left with no caller. */
function withoutFields(reports: Record<string, PaneReport>, fields: readonly Field[]) {
  const out: Record<string, PaneReport> = {};
  for (const [caller, report] of Object.entries(reports)) {
    const rest = { ...report };
    for (const f of fields) delete rest[f];
    if (FIELDS.some((k) => rest[k] !== undefined)) out[caller] = rest;
  }
  return out;
}

/**
 * The reports that outlive a layout change: a pane's go with it (`live` lacks it), and a pane that shows another
 * object (`moved`) keeps only what belongs to its content, not what described the object it showed.
 */
export function prunedReports(
  reports: Reports,
  live: ReadonlySet<NodeId>,
  moved: ReadonlySet<NodeId>,
): Reports {
  const entries = Object.entries(reports);
  if (entries.every(([id]) => live.has(id) && !moved.has(id))) return reports;
  const out: Reports = {};
  for (const [id, r] of entries) {
    if (!live.has(id)) continue;
    const kept = moved.has(id) ? withoutFields(r, OF_OBJECT) : r;
    if (Object.keys(kept).length) out[id] = kept;
  }
  return out;
}

/** The reports with the unsaved work of `panes` gone: the person discarded it. */
export function discardedReports(reports: Reports, panes: readonly NodeId[]): Reports {
  const out: Reports = {};
  for (const [id, r] of Object.entries(reports)) {
    const kept = panes.includes(id) ? withoutFields(r, ["unsaved"]) : r;
    if (Object.keys(kept).length) out[id] = kept;
  }
  return out;
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

/** A pane's `data-*` attributes as Jali puts them on its parts: a name that is not `data-*`, or that Jali's own parts
 *  use (`data-pane`, `data-tab`, `data-jali-*`, …), is dropped, as is a value that isn't text. Undefined when none
 *  is left. */
function ownAttributes(attributes: PaneAttributes | null): PaneAttributes | undefined {
  const kept = Object.entries(attributes ?? {}).filter(
    ([k, v]) => ownName(k) && typeof v === "string",
  );
  return kept.length ? (Object.fromEntries(kept) as PaneAttributes) : undefined;
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const sameRecord = (a: object, b: object) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([k, v]) => (b as Record<string, unknown>)[k] === v);

/** One map: each pane's value from `of` (undefined: no entry), keeping `prev`, and each entry of it, when equal. */
function mapOf<T>(
  ids: readonly NodeId[],
  of: (id: NodeId) => T | undefined,
  prev: Record<NodeId, T>,
  same: (a: T, b: T) => boolean,
): Record<NodeId, T> {
  const next: Record<NodeId, T> = {};
  let changed = Object.keys(prev).some((id) => !ids.includes(id));
  for (const id of ids) {
    const v = of(id);
    const was = Object.hasOwn(prev, id) ? prev[id] : undefined;
    if (v === undefined) {
      changed ||= was !== undefined;
      continue;
    }
    const keep = was !== undefined && same(was, v);
    next[id] = keep ? was : v;
    changed ||= !keep;
  }
  return changed ? next : prev;
}

/** The five maps `reports` make, each keeping its object (and each entry its own) from `prev` while unchanged. */
export function reportMaps(reports: Reports, prev: ReportMaps): ReportMaps {
  const ids = Object.keys(reports);
  const merged = new Map(ids.map((id) => [id, mergeReports(Object.values(reports[id]!))]));
  const gave = (id: NodeId, f: Field) =>
    Object.values(reports[id]!).some((r) => r[f] !== undefined);
  const is = <T>(a: T, b: T) => a === b;
  return {
    // Only a pane some caller reports an activity for has one; "idle" then is what it said.
    activity: mapOf(
      ids,
      (id) => (gave(id, "activity") ? merged.get(id)!.activity : undefined),
      prev.activity,
      is,
    ),
    unsaved: mapOf(ids, (id) => merged.get(id)!.unsaved ?? undefined, prev.unsaved, is),
    paneCommands: mapOf(
      ids,
      (id) => merged.get(id)!.commands ?? undefined,
      prev.paneCommands,
      sameList,
    ),
    titles: mapOf(ids, (id) => merged.get(id)!.title ?? undefined, prev.titles, is),
    paneAttributes: mapOf(
      ids,
      (id) => ownAttributes(merged.get(id)!.attributes),
      prev.paneAttributes,
      sameRecord,
    ),
  };
}

/** A patch that puts `reports` in place with the maps made from them: only what changed. */
export function withMaps(s: ReportMaps & { paneReports: Reports }, reports: Reports) {
  const maps = reportMaps(reports, s);
  const patch: Partial<UiState> = {};
  if (reports !== s.paneReports) patch.paneReports = reports;
  for (const k of Object.keys(maps) as (keyof ReportMaps)[])
    if (maps[k] !== s[k]) (patch as Record<string, unknown>)[k] = maps[k];
  return patch;
}

/** The caller a direct report (`store.actions.setUnsaved`, `setTitle`, … from an adapter or a test) is kept under:
 *  last in order, so what it says wins where one caller's value wins (a title). */
export const DIRECT = "jali:direct";
export const DIRECT_SEQ = Number.MAX_SAFE_INTEGER;
