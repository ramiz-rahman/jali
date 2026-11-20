/**
 * Replaying the overlay onto the projection (hides, then tucks, then folds), and where each fold goes. Pure: the
 * canonical tree never changes.
 */
import type { FitOptions, Layout, TuckRecord } from "../types";
import { noFocus } from "../tree/tree";
import { tooSmall } from "./context";
import {
  allPanes,
  contains,
  foldHomes,
  foldSlot,
  homeOf,
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

/**
 * What the search for a better home (`fold`) may still spend, in slots: each trial copied or folded on costs the slots
 * it has. One budget serves a whole replay, the recorded folds and every fold after them, so the same folds always
 * spend it the same way: deterministic, and the same on every machine.
 */
export interface Lookahead {
  left: number;
}
/** A replay's lookahead budget. Every layout in the tests and in the generated corpus of `fit-equivalence.test.ts`
 *  (up to 17 panes) fits exactly as it did with no limit; a quarter of this already changes one of them. A workspace
 *  of hundreds of panes searches its first folds and then folds by the rule alone. */
export const LOOKAHEAD = 8192;

/** Done folding on: the projection fits the room, or a single slot is left. */
const settled = (root: Projected, fit: FitOptions) =>
  !tooSmall(root, fit) || slots(root).length < 2;

/**
 * Fold `choice` into its home. A tab group needs the room of its widest (and tallest) tab, so a fold can raise the
 * minimum of the group it joins, and that can fold the next slot too: a wide pane folding behind a narrow list. So
 * when the rule's home (`foldHomes`) still leaves the projection too big for the room, the other places the slot
 * could go are tried as well, each followed through to a fit by the focus-free rule, and the one that leaves more
 * slots on screen wins. The rule's home wins every tie, and whenever its fold fits, so layouts that fit after it never
 * change.
 *
 * Every fold takes exactly one slot off screen, so the trial that leaves the most slots is the one that fits after
 * the fewest further folds. The trials therefore advance together, one fold each per round, and the first to settle
 * wins (the earliest in `homes` among those settling in the same round): no trial is followed further than the winner.
 *
 * The search spends from `budget`. When a round would cost more than is left, the slot goes to the rule's home, as it
 * did before the search existed.
 */
export function fold(
  root: Projected,
  choice: Projected,
  fit: FitOptions,
  order: Map<string, number>,
  budget: Lookahead,
): Projected {
  const homes = foldHomes(root, choice);
  const count = slots(root).length;
  if (homes.length < 2 || homes.length * count > budget.left)
    return foldSlot(root, choice, fit, order, undefined, homes[0]);
  const tryAt = (home: Projected) => {
    const trial = copy(root);
    return foldSlot(trial.root, trial.of.get(choice)!, fit, order, undefined, trial.of.get(home)!);
  };
  const first = tryAt(homes[0]!);
  budget.left -= count;
  if (!tooSmall(first, fit)) return first;
  const trials = [first, ...homes.slice(1).map(tryAt)];
  budget.left -= (homes.length - 1) * count;
  for (;;) {
    const best = trials.findIndex((t) => settled(t, fit));
    if (best >= 0) return foldSlot(root, choice, fit, order, undefined, homes[best]);
    const cost = trials.length * slots(trials[0]!).length;
    if (cost > budget.left) return foldSlot(root, choice, fit, order, undefined, homes[0]);
    budget.left -= cost;
    for (let i = 0; i < trials.length; i++) {
      const t = trials[i]!;
      trials[i] = foldSlot(t, chooseFold(t, noFocus(), order)!, fit, order);
    }
  }
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
/** A projection with fold records replayed onto it. `applied`: the records that took effect. */
export interface Replayed {
  root: Projected;
  order: Map<string, number>;
  applied: string[];
  budget: Lookahead;
}
/** The projection before any tuck or fold, hidden panes already gone. */
function start(layout: Layout, fit: FitOptions): Replayed {
  const projected = project(layout.root, fit);
  const order = new Map(allPanes(projected).map((p, i) => [p.id, i]));
  return {
    root: withoutHidden(projected, layout.overlay?.hidden ?? [], fit),
    order,
    applied: [],
    budget: { left: LOOKAHEAD },
  };
}
/** A copy to fold on without touching `r`. */
function fork(r: Replayed): Replayed {
  return {
    root: copy(r.root).root,
    order: r.order,
    applied: [...r.applied],
    budget: { ...r.budget },
  };
}
/** Replay one fold record onto `r` (in place). A stale record (a closed or moved pane) is skipped, and so is every
 *  record once a single slot is left. */
function foldOn(r: Replayed, id: string, fit: FitOptions): void {
  const displayed = slots(r.root);
  if (displayed.length < 2) return;
  const choice = displayed.find((s) => s.id === id);
  if (!choice) return;
  r.root = fold(r.root, choice, fit, r.order, r.budget);
  r.applied.push(id);
}
/** A revealed tab names the same stable home as its fold: each tuck's home, resolved against the projection with the
 *  same folds and no tucks, so no fold record disappears when its shown tab receives a tuck. */
function tuckHomes(tucks: readonly TuckRecord[], plain: Projected): string[] {
  const homes = slots(plain);
  return tucks.map((tuck) => {
    const reference = homes.find((s) => contains(s, tuck.home));
    return reference ? homeOf(reference) : tuck.home;
  });
}
/** The projection with its tucks replayed, before any fold. */
function tucked(
  layout: Layout,
  fit: FitOptions,
  tucks: readonly TuckRecord[],
  homes: readonly string[],
): Replayed {
  const r = start(layout, fit);
  tucks.forEach((tuck, i) => {
    const displayed = slots(r.root);
    const choice = displayed.find((s) => s.id === tuck.pane);
    const home = homes[i]!;
    if (!choice || !displayed.some((s) => s !== choice && contains(s, home))) return;
    r.root = foldSlot(r.root, choice, fit, r.order, home);
  });
  return r;
}

/**
 * A replay that grows one fold record at a time. Replaying `[...folds, id]` is replaying `folds` and then `id`, so a
 * fit carries the projection forward instead of replaying every earlier fold for each new one. `full` is the replay
 * (hides, tucks, folds); `plain` the same folds without tucks, which places the tucks. Only when a new fold moves a
 * tuck's home is `full` replayed from the start.
 */
export interface Run {
  layout: Layout;
  fit: FitOptions;
  folds: string[];
  tucks: readonly TuckRecord[];
  homes: string[];
  plain: Replayed;
  full: Replayed;
}
export function run(layout: Layout, fit: FitOptions, folds: readonly string[] = []): Run {
  const tucks = [...(layout.overlay?.tucks ?? [])].sort((a, b) => a.seq - b.seq);
  const plain = start(layout, fit);
  for (const id of folds) foldOn(plain, id, fit);
  if (!tucks.length)
    return { layout, fit, folds: [...folds], tucks, homes: [], plain, full: plain };
  const homes = tuckHomes(tucks, plain.root);
  const full = tucked(layout, fit, tucks, homes);
  for (const id of folds) foldOn(full, id, fit);
  return { layout, fit, folds: [...folds], tucks, homes, plain, full };
}
/** `r` with one more fold record. `inPlace`: `r` is not needed again, so its projections are folded on directly. */
export function extend(r: Run, id: string, inPlace = false): Run {
  const folds = [...r.folds, id];
  const plain = inPlace ? r.plain : fork(r.plain);
  foldOn(plain, id, r.fit);
  if (!r.tucks.length) return { ...r, folds, plain, full: plain };
  const homes = tuckHomes(r.tucks, plain.root);
  let full: Replayed;
  if (homes.every((home, i) => home === r.homes[i])) {
    full = inPlace ? r.full : fork(r.full);
    foldOn(full, id, r.fit);
  } else {
    full = tucked(r.layout, r.fit, r.tucks, homes);
    for (const f of folds) foldOn(full, f, r.fit);
  }
  return { ...r, folds, homes, plain, full };
}
/** Replay hides, then tucks, then sticky folds, without changing the canonical tree. */
export function replay(layout: Layout, folds: readonly string[], fit: FitOptions): Replayed {
  return run(layout, fit, folds).full;
}
