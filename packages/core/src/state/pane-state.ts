/**
 * A pane's own state (usePaneState), kept through the storage port so it survives a reload, and what a pane keeps
 * about the object it shows (its own state, a list's selection) tied to that object: a pane id alone is reused after
 * a close, comes back with an undo, and names another object after a reload.
 */
import type { Layout, NodeId, ObjectRef } from "../layout/types";
import * as core from "../layout/engine";
import type { PaneKinds } from "../pane-kinds";
import type { StoragePort } from "../ports";
import { own } from "../own";

export type PaneStates = Record<NodeId, Record<string, unknown>>;
/** For each pane id, the object (`objectKey`) its records belong to. */
export type PaneOwners = Record<NodeId, string>;

/**
 * Where pane state is kept: one record per pane, `{ v: 2, panes: { [paneId]: { of, values, at } } }`. The object
 * (`of`, `objectKey`) and the values are one record, so they can never disagree; `at` is when this record was written,
 * for merging and for keeping the newest. A new key name, not only a new shape: a tab of a build from before 22 Nov
 * 2026 writes the old keys, which this one never reads, so an old tab can't attach its values to a newer tab's objects.
 */
export const PANE_STATE_KEY = "pane-state@2";
/** The two keys before 22 Nov 2026 (values, and the objects they belonged to): dropped, never read. */
const OLD_KEYS = ["pane-state", "pane-state-of"];
/** The most records kept: past it the oldest go, so a person's storage never fills with closed panes' state. */
export const PANE_STATE_MAX = 200;

/**
 * The object a ref shows, as text: its kind and identity (`kinds.identityOf`), or for a scratch kind its params.
 * Two refs with the same key are the same object of the same kind, whatever their params' key order.
 */
export function objectKey(kinds: Pick<PaneKinds, "identityOf">, ref: ObjectRef): string {
  let identity: string | undefined;
  try {
    identity = kinds.identityOf(ref);
  } catch {
    identity = undefined;
  }
  const params = Object.keys(ref.params)
    .sort()
    .map((k) => [k, ref.params[k]]);
  return JSON.stringify([ref.kind, identity ?? params]);
}

/** One pane's stored state: the object it belongs to, its values, and when it was written. */
interface PaneRecord {
  of: string;
  values: Record<string, unknown>;
  at: number;
}
type PaneRecords = Record<NodeId, PaneRecord>;

const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** The records stored, each checked: anything that isn't a record of an object, values and a time is left out. */
function readRecords(storage: StoragePort): PaneRecords {
  let v: unknown;
  try {
    v = JSON.parse(storage.get(PANE_STATE_KEY) ?? "null");
  } catch {
    return {};
  }
  if (!plain(v) || v.v !== 2 || !plain(v.panes)) return {};
  // Own entries, defined (never assigned), so a `__proto__` entry is a pane id like any other.
  return Object.fromEntries(
    Object.entries(v.panes).filter(
      ([, r]) =>
        plain(r) &&
        typeof r.of === "string" &&
        plain(r.values) &&
        typeof r.at === "number" &&
        Number.isFinite(r.at),
    ),
  ) as PaneRecords;
}

function writeRecords(storage: StoragePort, records: PaneRecords) {
  // The newest first, at most PANE_STATE_MAX.
  const kept = Object.entries(records)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, PANE_STATE_MAX);
  storage.set(PANE_STATE_KEY, JSON.stringify({ v: 2, panes: Object.fromEntries(kept) }));
}

const valuesOf = (records: PaneRecords): PaneStates =>
  Object.fromEntries(Object.entries(records).map(([id, r]) => [id, r.values]));
const ownersOf = (records: PaneRecords): PaneOwners =>
  Object.fromEntries(Object.entries(records).map(([id, r]) => [id, r.of]));

/** Which object each pane's saved state belongs to. */
export function loadPaneStateOwners(storage: StoragePort): PaneOwners {
  return ownersOf(readRecords(storage));
}

/** Saved pane state: each pane's values, saved in one record with the object they belong to. */
export function loadPaneState(storage: StoragePort): PaneStates {
  return valuesOf(readRecords(storage));
}

/**
 * Save the state of the panes in `state` whose object `owners` names, over what is stored: other panes' records (a
 * second tab's) are kept. State without an object is left out, so it never reattaches to whatever a reused id shows.
 */
export const savePaneState = (storage: StoragePort, state: PaneStates, owners: PaneOwners = {}) => {
  const records = readRecords(storage);
  for (const [id, values] of Object.entries(state)) {
    const of = own(owners, id);
    if (of !== undefined && plain(values)) records[id] = { of, values, at: Date.now() };
  }
  writeRecords(storage, records);
};

/** What `PaneStateSync` works on: the workspace's pane state. */
export interface HeldPaneState {
  paneState: PaneStates;
  paneStateOf: PaneOwners;
}

/**
 * A workspace's pane state and its storage, kept in step. Each tab writes only what it changed (merging over what
 * other tabs wrote since, so a second tab never erases the first one's drafts), never writes when it changed nothing,
 * and takes in what other tabs write for the panes it shows (`merge`, on the storage port's `subscribe`).
 */
export interface PaneStateSync {
  /** Saved pane state, as the workspace starts. The old keys are dropped: never read, so state saved by a build from
   *  before can't attach to the wrong object. A record that isn't one is left out, and goes at the next write. */
  read(): HeldPaneState;
  /** The workspace started with `s`: what of it came from storage is in step with it. */
  adopt(s: HeldPaneState): void;
  /** Write what changed since the last write: new and changed records, and records of panes gone for good that no
   *  other tab has written since. True when something was written. */
  flush(s: HeldPaneState): boolean;
  /**
   * What other tabs wrote: records for an object this workspace shows at that pane id (in `layouts`), where this
   * workspace has no change of its own waiting. `patch` is the new pane state, if any; `resave`: another tab removed a
   * record this one still holds, so it is written again.
   */
  merge(
    s: HeldPaneState,
    kinds: Pick<PaneKinds, "identityOf">,
    layouts: readonly Layout[],
  ): { patch?: HeldPaneState; resave: boolean };
}

export function paneStateSync(storage: StoragePort): PaneStateSync {
  /** The records this workspace and storage agree on, as last read or written. */
  const synced = new Map<NodeId, PaneRecord>();
  let initial: PaneRecords = {};
  let last = 0;
  const inStep = (s: HeldPaneState, id: NodeId, r?: PaneRecord) =>
    !!r && own(s.paneState, id) === r.values && own(s.paneStateOf, id) === r.of;
  return {
    read() {
      for (const key of OLD_KEYS)
        if (storage.get(key) !== null)
          storage.remove ? storage.remove(key) : storage.set(key, "{}");
      initial = readRecords(storage);
      return { paneState: valuesOf(initial), paneStateOf: ownersOf(initial) };
    },
    adopt(s) {
      for (const [id, r] of Object.entries(initial)) if (inStep(s, id, r)) synced.set(id, r);
      initial = {};
    },
    flush(s) {
      let records: PaneRecords | undefined;
      const load = () => (records ??= readRecords(storage));
      for (const [id, values] of Object.entries(s.paneState)) {
        const of = own(s.paneStateOf, id);
        if (of === undefined || inStep(s, id, synced.get(id))) continue;
        const r = { of, values, at: (last = Math.max(Date.now(), last + 1)) };
        load()[id] = r;
        synced.set(id, r);
      }
      for (const [id, was] of synced)
        if (!Object.hasOwn(s.paneState, id)) {
          synced.delete(id);
          // Gone here: removed from storage only if no other tab has written it since.
          if (own(load(), id)?.at === was.at) delete records![id];
        }
      if (records) writeRecords(storage, records);
      return !!records;
    },
    merge(s, kinds, layouts) {
      const records = readRecords(storage);
      const shown = new Set(
        layouts.flatMap((l) =>
          core.tree.panes(l.root).map((p) => p.id + " " + objectKey(kinds, p.ref)),
        ),
      );
      let patch: HeldPaneState | undefined,
        resave = false;
      for (const [id, r] of Object.entries(records)) {
        const was = synced.get(id);
        // Its own, already in step; a change of this workspace's own, still to be written, wins; another object.
        if (was?.at === r.at || (Object.hasOwn(s.paneState, id) && !inStep(s, id, was))) continue;
        if (!shown.has(id + " " + r.of)) continue;
        // Defined, never assigned: a pane id `__proto__` is a key like any other.
        const at = patch ?? s;
        patch = {
          paneState: { ...at.paneState, [id]: r.values },
          paneStateOf: { ...at.paneStateOf, [id]: r.of },
        };
        synced.set(id, r);
      }
      for (const id of synced.keys())
        if (!Object.hasOwn(records, id)) {
          synced.delete(id);
          resave ||= Object.hasOwn(s.paneState, id);
        }
      return { patch, resave };
    },
  };
}

/** Pane `id`'s own state while it shows `ref`, or undefined when what is kept under its id is another object's. */
export function paneStateFor(
  s: { paneState: PaneStates; paneStateOf: PaneOwners },
  kinds: Pick<PaneKinds, "identityOf">,
  id: NodeId,
  ref: ObjectRef,
): Record<string, unknown> | undefined {
  const of = own(s.paneStateOf, id);
  return of !== undefined && of === objectKey(kinds, ref) ? own(s.paneState, id) : undefined;
}

/**
 * Pane state for the panes that can still show it: an entry stays while a pane with its id shows its object in
 * `layouts` (the layout, and the undo stack's, so an undo brings it back). Returns the same objects when nothing goes.
 */
export function ownedPaneState(
  s: { paneState: PaneStates; paneStateOf: PaneOwners },
  kinds: Pick<PaneKinds, "identityOf">,
  layouts: readonly Layout[],
): { paneState: PaneStates; paneStateOf: PaneOwners } {
  const shown = new Map<NodeId, Set<string>>();
  for (const l of layouts)
    for (const p of core.tree.panes(l.root)) {
      let keys = shown.get(p.id);
      if (!keys) shown.set(p.id, (keys = new Set()));
      keys.add(objectKey(kinds, p.ref));
    }
  const keeps = (id: string) => {
    const of = own(s.paneStateOf, id);
    return of !== undefined && !!shown.get(id)?.has(of);
  };
  const ids = Object.keys(s.paneState);
  if (ids.every(keeps) && Object.keys(s.paneStateOf).every((id) => Object.hasOwn(s.paneState, id)))
    return { paneState: s.paneState, paneStateOf: s.paneStateOf };
  const kept = ids.filter(keeps);
  return {
    paneState: Object.fromEntries(kept.map((id) => [id, s.paneState[id]!])),
    paneStateOf: Object.fromEntries(kept.map((id) => [id, s.paneStateOf[id]!])),
  };
}

/**
 * Lists' selections tied to the list they were made in. A new or changed entry belongs to the list showing at its id
 * now, and so does one whose list stayed in the layout while it moved to another object (a list that follows a list).
 * An entry whose id arrives in the layout showing another object than its own (a reused id, a closed list's id) is
 * dropped, so a new list never starts on a closed list's selection. An entry for a list not in `layout` stays with
 * its owner, for an undo or a page that brings the list back. Returns the same objects when nothing changes.
 */
export function ownedSelection<E>(
  prior: { layout: Layout; selection: Record<NodeId, E>; selectionOf: PaneOwners },
  selection: Record<NodeId, E>,
  kinds: Pick<PaneKinds, "identityOf">,
  layout: Layout,
): { selection: Record<NodeId, E>; selectionOf: PaneOwners } {
  const panes = new Map(core.tree.panes(layout.root).map((p) => [p.id, p]));
  const stayed = new Set(core.tree.panes(prior.layout.root).map((p) => p.id));
  const next: Record<NodeId, E> = {};
  const owners: PaneOwners = {};
  let changed = false;
  for (const [id, e] of Object.entries(selection)) {
    const pane = panes.get(id);
    const now = pane ? objectKey(kinds, pane.ref) : undefined;
    const was = own(prior.selectionOf, id);
    const same = own(prior.selection, id) === e;
    const of = !now ? was : !stayed.has(id) && same && was !== undefined ? was : now;
    if (now !== undefined && of !== now) {
      changed = true;
      continue;
    }
    next[id] = e;
    if (of !== undefined) owners[id] = of;
    if (of !== was) changed = true;
  }
  if (!changed && Object.keys(prior.selectionOf).every((id) => Object.hasOwn(selection, id)))
    return { selection, selectionOf: prior.selectionOf };
  return { selection: changed ? next : selection, selectionOf: owners };
}

/** `selection` without the entries made in another list than the one `layout` shows at their id. */
export function selectionFor<E>(
  selection: Record<NodeId, E>,
  selectionOf: PaneOwners,
  kinds: Pick<PaneKinds, "identityOf">,
  layout: Layout,
): Record<NodeId, E> {
  const panes = new Map(core.tree.panes(layout.root).map((p) => [p.id, p]));
  const stale = Object.keys(selection).filter((id) => {
    const of = own(selectionOf, id),
      pane = panes.get(id);
    return of !== undefined && !!pane && objectKey(kinds, pane.ref) !== of;
  });
  return stale.length
    ? Object.fromEntries(Object.entries(selection).filter(([id]) => !stale.includes(id)))
    : selection;
}
