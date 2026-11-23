/**
 * The map is the hub: one place is "the place" at any time, and it is the map's selection.
 *
 * Jali keeps a selection per list pane, and a detail follows one list. Here the map is that list: every place pane
 * follows the map (`linkedTo: "map"`). A day plan or an Explore list reports its own selection as usual (Space,
 * peek) and also hands it to the map with `jali.actions.select`, so the place pane and the map's pins move whichever
 * list the person used. See FINDINGS.md, finding 1.
 *
 * This module is the only one that knows the convention: what the hub is, what it has selected, which panes follow
 * it, and the moves that keep them agreeing. Panes read it through use-hub.ts.
 *
 * A place the person picks is also a request to see it (`services.reveal`): the maps bring it into view. A layout,
 * a link or Back changes the selection without asking, so the maps keep their framing then.
 */
import type { Jali, JaliModel, JaliState, NodeId, ObjectRef, PaneOf } from "jali";
import type { Services } from "../state/services";
import { dayNumberOf, dayRef, KIND, placeOf, placeRef } from "./refs";

type Model = JaliModel;

const isMap = (p: PaneOf) => p.ref.kind === KIND.map;

/** The map panes in the layout. */
const mapsOf = (m: Model) => m.panes.filter(isMap);

/** The hub: the first map pane in the layout, if any. */
export const hubOf = (m: Model): PaneOf | undefined => m.panes.find(isMap);

/** The place selected on the hub, if any. */
export function selectedPlace(state: Pick<JaliState, "selection">, m: Model): string | null {
  const hub = hubOf(m);
  return hub ? placeOf(state.selection[hub.id]?.ref) : null;
}

/** The place selected on the map, read now (for commands and tests; components use `useSelectedPlace`). */
export const currentPlace = (jali: Jali) => selectedPlace(jali.get(), jali.model());

/** The pane of `kind` that follows `source` (shows whatever it selects), if there is one. */
export const followerOf = (m: Model, source: NodeId, kind: string): PaneOf | undefined =>
  m.panes.find((p) => p.linkedTo === source && p.follows && p.ref.kind === kind);

/** The place panes linked to the map `map`: those following it, and those kept (Keep, to compare). */
function placePanesOf(m: Model, map: NodeId) {
  const linked = m.panes.filter((p) => p.linkedTo === map && p.ref.kind === KIND.place);
  return { following: linked.filter((p) => p.follows), kept: linked.filter((p) => p.kept) };
}

/** The place the pane following `source` shows, if one does. */
export const followerPlace = (m: Model, source: NodeId) =>
  placeOf(followerOf(m, source, KIND.place)?.ref);

/** The places kept in view (Keep, to compare), other than in pane `except`. */
export const keptPlaces = (m: Model, except?: NodeId): string[] =>
  m.panes
    .filter((p) => p.id !== except && p.kept && p.where === "shown")
    .flatMap((p) => placeOf(p.ref) ?? []);

/** Whether pane `id` is on screen: not folded, tucked or behind a tab. */
export const isShown = (m: Model, id: NodeId) => m.pane(id)?.where === "shown";

/** Whether a place pane that follows the map is on screen, saying everything a card on the map would. */
export const placeShownBeside = (m: Model, map: NodeId) =>
  placePanesOf(m, map).following.some((p) => p.where === "shown");

/** Whether the layout has one day pane only (several are open in Days). */
export const onlyDayPane = (m: Model) =>
  m.panes.filter((p) => p.ref.kind === KIND.day).length === 1;

/**
 * Select a place everywhere: in the list it came from (`from`), on every map, and so in the place pane that
 * follows the map. With `open`, the place pane comes to the front (folded or behind a tab on a phone), or opens
 * beside the map if there is none. While the person compares (a place pane is kept), a new place opens a following
 * pane beside the kept one, as Jali does for a list.
 */
export function selectPlace(
  jali: Jali,
  services: Services,
  id: string,
  { from, open = false }: { from?: NodeId; open?: boolean } = {},
): NodeId | undefined {
  const ref = placeRef(id);
  const maps = mapsOf(jali.model());
  if (from && !maps.some((m) => m.id === from)) jali.actions.select(from, ref);
  for (const m of maps) jali.actions.select(m.id, ref);
  services.reveal.set({ id });
  const hub = maps[0];
  if (!hub) {
    // No map on screen (a layout the person built): show the place as any detail.
    return open ? show(jali, ref) : undefined;
  }
  const m = jali.model();
  const {
    following: [following],
    kept,
  } = placePanesOf(m, hub.id);
  if (following) {
    if (open && !isShown(m, following.id)) jali.actions.focus(following.id);
    return following.id;
  }
  if (!open && !kept.length) return undefined;
  // Opening beside the map moves focus to it; give focus back to where the person was.
  const was = jali.get().view.focused;
  const opened = jali.actions.openBeside(hub.id, ref).pane;
  if (open && opened) jali.actions.focus(opened);
  else if (was && jali.model().pane(was)) jali.actions.focus(was);
  return opened;
}

/**
 * Show `ref` and bring it into view without reshaping the workspace: the pane that already shows it is focused;
 * else it opens beside the focused pane.
 */
export function show(jali: Jali, ref: ObjectRef): NodeId | undefined {
  const m = jali.model();
  const open = m.paneOf(ref);
  if (open) return jali.actions.focus(open.id).pane;
  const source = jali.get().view.focused ?? m.panes[0]?.id;
  const id = source ? jali.actions.openBeside(source, ref).pane : undefined;
  if (id) jali.actions.focus(id);
  return id;
}

/** The panes that list the days, and so can lead a day plan and a map: the overview and the budget. */
const DAY_LISTS: readonly string[] = [KIND.trip, KIND.budget];

/**
 * Bring day `n` into view: the day pane showing it, else the following day of a list of days (the focused one
 * first), else a new pane.
 */
export function showDay(jali: Jali, n: number): NodeId | undefined {
  const m = jali.model();
  const ref = dayRef(n);
  const exact = m.panes.find((p) => dayNumberOf(p.ref) === n);
  if (exact) return jali.actions.focus(exact.id).pane;
  const focused = jali.get().view.focused;
  const lists = m.panes.filter((p) => DAY_LISTS.includes(p.ref.kind));
  const source =
    lists.find((p) => p.id === focused && followerOf(m, p.id, KIND.day)) ??
    lists.find((p) => followerOf(m, p.id, KIND.day));
  if (source) {
    jali.actions.select(source.id, ref);
    const follower = followerOf(jali.model(), source.id, KIND.day);
    if (follower) {
      // Shown at once rather than after the selection rests: the person asked for this day.
      jali.actions.openHere(follower.id, ref);
      return jali.actions.focus(follower.id).pane;
    }
  }
  return show(jali, ref);
}
