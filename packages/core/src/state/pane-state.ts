/**
 * A pane's own state (usePaneState), kept through the storage port so it survives a reload, and what a pane keeps
 * about the object it shows (its own state, a list's selection) tied to that object: a pane id alone is reused after
 * a close, comes back with an undo, and names another object after a reload.
 */
import type { Layout, NodeId, ObjectRef, PaneNode } from "../layout/types";
import * as core from "../layout/engine";
import type { PaneKinds } from "../pane-kinds";
import type { StoragePort } from "../ports";
import { own } from "../own";

export type PaneStates = Record<NodeId, Record<string, unknown>>;
/** For each pane id, the object (`objectKey`) its records belong to. */
export type PaneOwners = Record<NodeId, string>;
/** Pane state kept for an undo, by pane id, then object. */
export type HeldStates = Record<NodeId, Record<string, Record<string, unknown>>>;

/**
 * Where pane state is kept: one record per pane, `{ v: 2, panes: { [paneId]: { of, values, at } } }`. The object
 * (`of`, `objectKey`) and the values are one record, so they can never disagree; `at` is when this record was written,
 * for keeping the newest when there are more than the cap. A new key name, not only a new shape: a tab of a build from before 22 Nov
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

/**
 * A clock for records' `at`: it never stands still or goes back, so of records written in one millisecond the later is
 * still the newer when the newest PANE_STATE_MAX are kept. `at` decides only that; it is not a revision.
 */
const clock = () => {
  let last = 0;
  return () => (last = Math.max(Date.now(), last + 1));
};

/** One pane's stored state: the object it belongs to, its values, when it was written, and by which instance (`by`, a
 *  token of its own: what lets an instance remove only its own records). */
interface PaneRecord {
  of: string;
  values: Record<string, unknown>;
  at: number;
  by?: string;
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
  const now = clock();
  for (const [id, values] of Object.entries(state)) {
    const of = own(owners, id);
    if (of !== undefined && plain(values)) records[id] = { of, values, at: now() };
  }
  writeRecords(storage, records);
};

/** What `PaneStateSync` works on: the instance's pane state. */
export interface HeldPaneState {
  paneState: PaneStates;
  paneStateOf: PaneOwners;
}

/**
 * An instance's pane state and its storage, kept in step. Each write reads storage fresh and puts only this instance's
 * changed records over it, so a second tab never erases the first one's drafts; it writes nothing when nothing
 * changed. The last write wins per pane. What another tab writes is read when an instance starts, not while it runs.
 */
export interface PaneStateSync {
  /** Saved pane state, as the instance starts. The old keys are dropped: never read, so state saved by a build from
   *  before can't attach to the wrong object. A record that isn't one is left out, and goes at the next write. */
  read(): HeldPaneState;
  /** The instance started with `s`: what of it came from storage is in step with it. */
  adopt(s: HeldPaneState): void;
  /** Write what changed since the last write: new and changed records, and the records of panes gone for good that
   *  still belong to the object this instance held. True when something was written. */
  flush(s: HeldPaneState): boolean;
}

export function paneStateSync(storage: StoragePort): PaneStateSync {
  /** The records this instance and storage agree on, as last read or written. */
  const synced = new Map<NodeId, PaneRecord>();
  /** This instance, in the records it writes: it removes only records that still say so (another tab's, or one read
   *  from storage at the start, are never its to erase). */
  const by = Math.random().toString(36).slice(2);
  let initial: PaneRecords = {};
  const now = clock();
  const inStep = (s: HeldPaneState, id: NodeId, r?: PaneRecord) =>
    !!r && own(s.paneState, id) === r.values && own(s.paneStateOf, id) === r.of;
  return {
    read() {
      for (const key of OLD_KEYS)
        if (storage.get(key) !== null) {
          if (storage.remove) storage.remove(key);
          else storage.set(key, "{}");
        }
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
        const r = { of, values, at: now(), by };
        load()[id] = r;
        synced.set(id, r);
      }
      for (const [id, was] of synced)
        if (!Object.hasOwn(s.paneState, id)) {
          synced.delete(id);
          // Gone here: removed from storage while it is still the record this instance wrote there.
          const stored = own(load(), id);
          if (stored?.by === by && stored.at === was.at) delete records![id];
        }
      if (records) writeRecords(storage, records);
      return !!records;
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
 * `layout`, or in `closed` (the closed panes the undo stack could bring back). Returns the same objects when nothing
 * goes.
 */
export function ownedPaneState(
  s: { paneState: PaneStates; paneStateOf: PaneOwners; paneStateHeld?: HeldStates },
  kinds: Pick<PaneKinds, "identityOf">,
  layout: Layout,
  closed: readonly PaneNode[] = [],
): { paneState: PaneStates; paneStateOf: PaneOwners; paneStateHeld: HeldStates } {
  const held = s.paneStateHeld ?? {};
  const shown = new Map<NodeId, Set<string>>();
  const live = core.tree.panes(layout.root);
  for (const p of [...live, ...closed]) {
    let keys = shown.get(p.id);
    if (!keys) shown.set(p.id, (keys = new Set()));
    keys.add(objectKey(kinds, p.ref));
  }
  // A pane back on screen with an object whose state was held for it (an undo) has that state again; the state it
  // replaces is held in turn, while an undo could bring its object back.
  let paneState = s.paneState,
    paneStateOf = s.paneStateOf,
    nextHeld = held;
  for (const p of live) {
    const of = objectKey(kinds, p.ref),
      back = own(own(nextHeld, p.id), of);
    if (!back || own(paneStateOf, p.id) === of) continue;
    const { [of]: _back, ...rest } = own(nextHeld, p.id)!;
    const was = own(paneStateOf, p.id),
      values = own(paneState, p.id);
    nextHeld = { ...nextHeld, [p.id]: was && values ? { ...rest, [was]: values } : rest };
    paneState = { ...paneState, [p.id]: back };
    paneStateOf = { ...paneStateOf, [p.id]: of };
  }
  const keeps = (id: string) => {
    const of = own(paneStateOf, id);
    return of !== undefined && !!shown.get(id)?.has(of);
  };
  // Held state goes once no closed pane an undo could bring back shows its object under its id.
  const heldKept: HeldStates = {};
  let dropped = false;
  for (const [id, byObject] of Object.entries(nextHeld)) {
    const kept = Object.entries(byObject).filter(([of]) => shown.get(id)?.has(of));
    if (kept.length !== Object.keys(byObject).length) dropped = true;
    if (kept.length) heldKept[id] = Object.fromEntries(kept);
  }
  if (dropped) nextHeld = heldKept;
  const ids = Object.keys(paneState);
  if (ids.every(keeps) && Object.keys(paneStateOf).every((id) => Object.hasOwn(paneState, id)))
    return { paneState, paneStateOf, paneStateHeld: nextHeld };
  const kept = ids.filter(keeps);
  return {
    paneState: Object.fromEntries(kept.map((id) => [id, paneState[id]!])),
    paneStateOf: Object.fromEntries(kept.map((id) => [id, paneStateOf[id]!])),
    paneStateHeld: nextHeld,
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
