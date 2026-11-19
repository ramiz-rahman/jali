/**
 * The app's own moves on the workspace, shared by panes, the map and ⌘K.
 *
 * One place is "the place" at any time: the map's selection. Jali keeps a selection per list pane, and a detail
 * follows one list. Here the map is that list: every place pane follows the map (`linkedTo: "map"`). A day plan or
 * an Explore list reports its own selection as usual (Space, peek) and also hands it to the map with
 * `jali.actions.select`, so the place pane and the map's pins move whichever list the person used. See FINDINGS.md.
 */
import type { Jali, NodeId, ObjectRef, PaneNode } from "@jali/core";
import { day } from "./panes/day";
import { place } from "./panes/place";

export const isMap = (p: PaneNode) => p.ref.kind === "map";

/** The map panes in the layout, the first one being the hub the place panes follow. */
export const maps = (jali: Jali) => jali.model().panes.filter(isMap);

/** The place selected on the map (the hub), if any. */
export function currentPlace(jali: Jali): string | null {
  const hub = maps(jali)[0];
  const ref = hub ? jali.get().selection[hub.id]?.ref : undefined;
  return ref?.kind === "place" ? String(ref.params.id) : null;
}

const onScreen = (jali: Jali, id: NodeId) =>
  jali.model().resolved.panes.some((b) => b.id === id && !b.hidden);

/**
 * Select a place everywhere: in the list it came from (`from`), on every map, and so in the place pane that
 * follows the map. With `open`, the place pane comes to the front (folded or behind a tab on a phone), or opens
 * beside the map if there is none. While the person compares (a place pane is kept), a new place opens a following
 * pane beside the kept one, as Jali does for a list.
 */
export function selectPlace(
  jali: Jali,
  id: string,
  { from, open = false }: { from?: NodeId; open?: boolean } = {},
): NodeId | undefined {
  const ref = place({ id });
  const all = maps(jali);
  if (from && !all.some((m) => m.id === from)) jali.actions.select(from, ref);
  for (const m of all) jali.actions.select(m.id, ref);
  const hub = all[0];
  if (!hub) {
    // No map on screen (a layout the person built): show the place as any detail.
    return open ? show(jali, ref) : undefined;
  }
  const panes = jali.model().panes;
  const follower = panes.find((p) => p.linkedTo === hub.id && p.follows && p.ref.kind === "place");
  const comparing = panes.some((p) => p.linkedTo === hub.id && p.kept && p.ref.kind === "place");
  if (follower) {
    if (open && !onScreen(jali, follower.id)) jali.actions.focus(follower.id);
    return follower.id;
  }
  if (!open && !comparing) return undefined;
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
  const open = m.panes.find((p) => jali.env.kinds.sameObject(p.ref, ref));
  if (open) return jali.actions.focus(open.id).pane;
  const source = jali.get().view.focused ?? m.panes[0]?.id;
  const id = source ? jali.actions.openBeside(source, ref).pane : undefined;
  if (id) jali.actions.focus(id);
  return id;
}

/** Bring day `n` into view: the day pane showing it, else the overview's following day, else a new pane. */
export function showDay(jali: Jali, n: number): NodeId | undefined {
  const panes = jali.model().panes;
  const exact = panes.find((p) => p.ref.kind === "day" && Number(p.ref.params.n) === n);
  if (exact) return jali.actions.focus(exact.id).pane;
  const overview = panes.find((p) => p.ref.kind === "trip");
  if (overview) {
    jali.actions.select(overview.id, day({ n }));
    const follower = panes.find(
      (p) => p.linkedTo === overview.id && p.follows && p.ref.kind === "day",
    );
    if (follower) {
      // Shown at once rather than after the selection rests: the person asked for this day.
      jali.actions.openHere(follower.id, day({ n }));
      return jali.actions.focus(follower.id).pane;
    }
  }
  return show(jali, day({ n }));
}
