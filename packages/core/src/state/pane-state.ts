/**
 * A pane's own state (usePaneState), kept through the storage port so it survives a reload, and what a pane keeps
 * about the object it shows (its own state, a list's selection) tied to that object: a pane id alone is reused after
 * a close, comes back with an undo, and names another object after a reload.
 */
import type { Layout, NodeId, ObjectRef } from "../layout/types";
import * as core from "../layout";
import type { PaneKinds } from "../pane-kinds";
import type { StoragePort } from "../ports";
import { own } from "../own";

export type PaneStates = Record<NodeId, Record<string, unknown>>;
/** For each pane id, the object (`objectKey`) its records belong to. */
export type PaneOwners = Record<NodeId, string>;

const PANE_STATE_KEY = "pane-state";
const PANE_STATE_OF_KEY = "pane-state-of";

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

const records = (raw: string | null): Record<string, unknown> => {
  try {
    const v = JSON.parse(raw ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const ownersFrom = (raw: string | null): PaneOwners =>
  Object.fromEntries(
    Object.entries(records(raw)).filter(([, of]) => typeof of === "string"),
  ) as PaneOwners;

// Only a pane's own record of values, for a pane whose object was saved with it: anything else is left out.
const statesFrom = (raw: string | null, owners: PaneOwners): PaneStates =>
  Object.fromEntries(
    Object.entries(records(raw)).filter(
      ([id, s]) => Object.hasOwn(owners, id) && !!s && typeof s === "object" && !Array.isArray(s),
    ),
  ) as PaneStates;

/** Which object each pane's saved state belongs to. */
export function loadPaneStateOwners(storage: StoragePort): PaneOwners {
  return ownersFrom(storage.get(PANE_STATE_OF_KEY));
}

/** Saved pane state, only for panes whose object was saved with it: state that can't say what it was about is
 *  left out, so it never reattaches to whatever a reused id shows now. */
export function loadPaneState(storage: StoragePort): PaneStates {
  return statesFrom(storage.get(PANE_STATE_KEY), loadPaneStateOwners(storage));
}

/**
 * Saved pane state and the objects it belongs to, as a workspace starts. What `loadPaneState` leaves out is taken out
 * of storage too, at once, so it is gone after one read: state saved before 20 Nov 2026 under a pane id alone (it
 * says nothing of the object it was about, so it can't be tied to one safely: DECISIONS, 21 Nov 2026), and anything
 * stored that isn't a pane's record of values. Nothing is written when storage holds nothing else.
 */
export function readPaneState(storage: StoragePort): {
  paneState: PaneStates;
  paneStateOf: PaneOwners;
} {
  const rawState = storage.get(PANE_STATE_KEY),
    rawOwners = storage.get(PANE_STATE_OF_KEY);
  const owners = ownersFrom(rawOwners);
  const paneState = statesFrom(rawState, owners);
  const paneStateOf = Object.fromEntries(
    Object.entries(owners).filter(([id]) => Object.hasOwn(paneState, id)),
  ) as PaneOwners;
  // Written back as savePaneState writes it, so what it wrote reads as unchanged.
  if (
    (rawState !== null && rawState !== JSON.stringify(paneState)) ||
    (rawOwners !== null && rawOwners !== JSON.stringify(paneStateOf))
  )
    savePaneState(storage, paneState, paneStateOf);
  return { paneState, paneStateOf };
}

export const savePaneState = (storage: StoragePort, state: PaneStates, owners: PaneOwners = {}) => {
  storage.set(PANE_STATE_KEY, JSON.stringify(state));
  storage.set(
    PANE_STATE_OF_KEY,
    JSON.stringify(
      Object.fromEntries(Object.entries(owners).filter(([id]) => Object.hasOwn(state, id))),
    ),
  );
};

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
