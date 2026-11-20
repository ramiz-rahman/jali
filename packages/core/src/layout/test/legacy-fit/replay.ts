// Frozen copy of fit/replay.ts before the fitting performance work (5948507). fit-equivalence.test.ts checks
// the optimised engine against it. Never edit.
/**
 * Replaying the overlay onto the projection (hides, then tucks, then folds), and where each fold goes. Pure: the
 * canonical tree never changes.
 */
import type { FitOptions, Layout } from "../../types";
import { noFocus } from "../../tree/tree";
import { tooSmall } from "./context";
import {
  allPanes,
  contains,
  foldHomes,
  foldSlot,
  homeOf,
  overlayOf,
  project,
  refresh,
  removeSlot,
  slots,
  type Projected,
} from "./overlay";
import { chooseFold } from "./priority";

/** A copy of the projection, and where each of its slots went, so a fold can be tried without touching it. */
function copy(root: Projected): { root: Projected; of: Map<Projected, Projected> } {
  const of = new Map<Projected, Projected>();
  const walk = (n: Projected): Projected => {
    const c: Projected = { ...n, bounds: { ...n.bounds }, children: n.children.map(walk) };
    of.set(n, c);
    return c;
  };
  return { root: walk(root), of };
}

/** How many slots stay on screen once `root` folds on, by the focus-free rule, until it fits the room. */
function shownWhenFitted(root: Projected, fit: FitOptions, order: Map<string, number>): number {
  while (tooSmall(root, fit)) {
    const choice = chooseFold(root, noFocus(), order);
    if (!choice) break;
    root = foldSlot(root, choice, fit, order);
  }
  return slots(root).length;
}

/**
 * Fold `choice` into its home. A tab group needs the room of its widest (and tallest) tab, so a fold can raise the
 * minimum of the group it joins, and that can fold the next slot too: a wide pane folding behind a narrow list. So
 * when the rule's home (`foldHomes`) still leaves the projection too big for the room, the other places the slot
 * could go are tried as well, each followed through to a fit, and the one that leaves more slots on screen wins.
 * The rule's home wins every tie, and whenever its fold fits, so layouts that fit after it never change.
 */
export function fold(
  root: Projected,
  choice: Projected,
  fit: FitOptions,
  order: Map<string, number>,
): Projected {
  const homes = foldHomes(root, choice);
  if (homes.length < 2) return foldSlot(root, choice, fit, order);
  const tryAt = (home: Projected) => {
    const trial = copy(root);
    return foldSlot(trial.root, trial.of.get(choice)!, fit, order, undefined, trial.of.get(home)!);
  };
  const first = tryAt(homes[0]!);
  if (!tooSmall(first, fit)) return foldSlot(root, choice, fit, order, undefined, homes[0]);
  let best = homes[0]!,
    most = shownWhenFitted(first, fit, order);
  for (const home of homes.slice(1)) {
    const shown = shownWhenFitted(tryAt(home), fit, order);
    if (shown > most) [best, most] = [home, shown];
  }
  return foldSlot(root, choice, fit, order, undefined, best);
}

interface Replayed {
  root: Projected;
  order: Map<string, number>;
  applied: string[];
}
/** Hidden panes leave the projection first: no slot and no tab, and their neighbours absorb the space. */
function withoutHidden(root: Projected, hidden: readonly string[], fit: FitOptions): Projected {
  let removed = false;
  // A row that scrolls is one slot for folding, but its children are on screen in their own right: one of them can be
  // hidden too.
  const shown = (n: Projected): Projected[] =>
    n.type === "row" && n.scroll
      ? n.children.flatMap(shown)
      : slots(n).flatMap((s) => (s === n ? [s] : shown(s)));
  for (const id of hidden) {
    const displayed = shown(root);
    if (displayed.length < 2 || !displayed.some((s) => s.id === id && s.pane)) continue;
    root = removeSlot(root, id)!;
    removed = true;
  }
  // The minimums of what is left: a hidden pane needs no room.
  const remeasure = (n: Projected): void => {
    if (!n.pane) {
      n.children.forEach(remeasure);
      refresh(n, fit);
    }
  };
  if (removed) remeasure(root);
  return root;
}
/** Replay hides, then tucks, then sticky folds, without changing the canonical tree. */
export function replay(layout: Layout, folds: readonly string[], fit: FitOptions): Replayed {
  const projected = project(layout.root, fit);
  const order = new Map(allPanes(projected).map((p, i) => [p.id, i]));
  let root = withoutHidden(projected, layout.overlay?.hidden ?? [], fit);
  const applied: string[] = [];
  const tucks = layout.overlay?.tucks ?? [];
  // A revealed tab names the same stable home as its fold. Resolve this against the canonical fold projection,
  // then replay the tuck before those folds, so no fold record disappears when its shown tab receives a tuck.
  const homes = tucks.length
    ? slots(replay({ ...layout, overlay: { ...overlayOf(layout), tucks: [] } }, folds, fit).root)
    : [];
  for (const tuck of [...tucks].sort((a, b) => a.seq - b.seq)) {
    const displayed = slots(root);
    const choice = displayed.find((s) => s.id === tuck.pane);
    const reference = homes.find((s) => contains(s, tuck.home));
    const home = reference ? homeOf(reference) : tuck.home;
    if (!choice || !displayed.some((s) => s !== choice && contains(s, home))) continue;
    root = foldSlot(root, choice, fit, order, home);
  }
  for (const id of folds) {
    const displayed = slots(root);
    if (displayed.length < 2) break;
    const choice = displayed.find((s) => s.id === id);
    if (!choice) continue; // stale record (closed or moved pane): skip it
    root = fold(root, choice, fit, order);
    applied.push(id);
  }
  return { root, order, applied };
}
