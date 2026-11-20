import type { Layout, LayoutContext, ViewState } from "../types";
import {
  allPanes,
  autos,
  choose,
  contains,
  overlayOf,
  slots,
  withOverlay,
  type Projected,
} from "./overlay";
import { extend, replay, run, type Run } from "./replay";
import { chooseFold } from "./priority";
import { checkContext, misfit, tooSmall } from "./context";

/** Internal operation policy. External events always use full refit. `yields: false`: no supporting pane gives way to
 *  make room (a curated page's views stay where the person put them; only the fresh pane folds). */
interface FitPolicy {
  mode?: "full" | "fold";
  fresh?: string;
  keep?: readonly string[];
  yields?: boolean;
}

/** The shortest prefix of the folds that fits, without tucks (one replay, carried forward fold by fold). */
function unfoldPrefix(layout: Layout, current: string[], ctx: LayoutContext): string[] {
  const probe = { ...layout, overlay: { ...overlayOf(layout), tucks: [] } };
  let r = run(probe, ctx.fit);
  for (let k = 0; k < current.length; k++) {
    if (!misfit(r.full.root, ctx.fit, ctx.paneCap)) return current.slice(0, k);
    r = extend(r, current[k]!, true);
  }
  return current;
}
/**
 * Where fitting starts: the recorded folds that took effect, or (`unfold`) the shortest prefix of them that fits, as
 * a replay to fold on from. Without tucks that is one replay, stopped at the first prefix that fits. A tuck's home
 * depends on every fold, so with tucks the prefix is found without them and replayed again.
 */
function startFrom(layout: Layout, ctx: LayoutContext, unfold: boolean): Run {
  const o = overlayOf(layout);
  if (o.tucks.length) {
    const replayed = replay(layout, o.folds, ctx.fit).applied;
    return run(layout, ctx.fit, unfold ? unfoldPrefix(layout, replayed, ctx) : replayed);
  }
  let r = run(layout, ctx.fit);
  for (const id of o.folds) {
    // A stale record leaves the replay as it was, so checking again changes nothing.
    if (unfold && !misfit(r.full.root, ctx.fit, ctx.paneCap)) break;
    r = extend(r, id, true);
  }
  return { ...r, folds: [...r.full.applied] };
}

/** How far the projection overflows the room, in px along both axes. */
const overflow = (root: Projected, fit: LayoutContext["fit"]) =>
  Math.max(0, root.bounds.width - fit.width) + Math.max(0, root.bounds.height - fit.height);

/** Fold on from `start` until the layout fits. Returns the replay of the folds it settles on. */
function foldUntilFit(
  view: ViewState,
  start: Run,
  ctx: LayoutContext,
  policy: FitPolicy,
  yields = policy.yields ?? true,
): Run {
  const { fit, paneCap } = ctx;
  const keep = new Set(policy.keep ?? []);
  let current = start,
    owned = false,
    yielded = false;
  // `start` is kept for a second pass; every later replay is this pass's own, so it folds on in place.
  const add = (id: string) => {
    current = extend(current, id, owned);
    owned = true;
  };
  for (;;) {
    const { root, order } = current.full;
    if (!misfit(root, fit, paneCap)) break;
    const displayed = slots(root);
    if (displayed.length < 2) break;
    const fresh = policy.fresh ? displayed.find((s) => s.pane && s.id === policy.fresh) : undefined;
    if (tooSmall(root, fit) && yields) {
      // No room: a supporting pane of a designed arrangement gives way, but only one whose fold makes room.
      const now = overflow(root, fit);
      const helps = displayed
        .filter(
          (s) =>
            allPanes(s).every((p) => p.pane!.priority === "supporting") &&
            !keep.has(s.id) &&
            !allPanes(s).some((p) => p.id === view.focused),
        )
        .map((s) => ({ s, after: overflow(extend(current, s.id).full.root, fit) }))
        .filter((c) => c.after < now - 1e-7)
        .sort(
          (a, b) => a.after - b.after || (order.get(b.s.id) ?? 0) - (order.get(a.s.id) ?? 0),
        )[0];
      if (helps) {
        add(helps.s.id);
        yielded = true;
        continue;
      }
    }
    // Over the cap alone, prefer the oldest eligible pane. No room: the fresh pane becomes a tab of its source.
    const ages = new Map(
      allPanes(root).map((p) => [p.id, p.pane!.born ?? order.get(p.id) ?? Infinity]),
    );
    const oldest = displayed
      .filter(
        (s) =>
          s.pane &&
          !keep.has(s.id) &&
          s.id !== view.focused &&
          !s.pane.kept &&
          s.pane.priority !== "primary",
      )
      .sort((a, b) => ages.get(a.id)! - ages.get(b.id)!)[0];
    const choice =
      (tooSmall(root, fit) ? fresh : (oldest ?? fresh)) ?? chooseFold(root, view, order);
    if (!choice) break;
    add(choice.id);
  }
  // Supporting panes that gave way for nothing (the fresh pane folded anyway) stay where they were.
  if (yielded && policy.fresh && current.folds.includes(policy.fresh))
    return foldUntilFit(view, start, ctx, policy, false);
  return current;
}

/** `root`: the fitted projection (its groups' shown tabs are chosen on it). */
function shownTabs(
  layout: Layout,
  view: ViewState,
  root: Projected,
  newlyFolded: boolean,
): Record<string, string> {
  const present = new Set(allPanes(root).map((p) => p.id));
  // Retain choices while both panes exist, including while their group is absorbed or unfolded.
  const shown = Object.fromEntries(
    Object.entries(layout.overlay?.shown ?? {}).filter(
      ([home, pane]) => present.has(home) && present.has(pane),
    ),
  );
  if (newlyFolded && view.focused) {
    const group = autos(root).find((g) => contains(g, view.focused));
    if (group) {
      choose(group, shown);
      if (
        !contains(
          group.children.find((c) => c.id === group.active)!,
          view.focused,
        )
      )
        shown[group.home!] = view.focused;
    }
  }
  return shown;
}

export function fitLayout(
  layout: Layout,
  view: ViewState,
  ctx: LayoutContext,
  policy: FitPolicy = {},
): Layout {
  ctx = checkContext(ctx);
  const o = overlayOf(layout);
  const start = startFrom(layout, ctx, policy.mode !== "fold");
  const prefix = start.folds.length;
  const fitted = foldUntilFit(view, start, ctx, policy);
  const folds = fitted.folds;
  const shown = shownTabs(layout, view, fitted.full.root, folds.length > prefix);
  const sameFolds = folds.length === o.folds.length && folds.every((id, i) => id === o.folds[i]);
  const sameShown =
    Object.keys(shown).length === Object.keys(o.shown).length &&
    Object.entries(shown).every(([k, v]) => o.shown[k] === v);
  return sameFolds && sameShown ? layout : withOverlay(layout, { ...o, folds, shown });
}

/** Only external events (resize, cap change, URL arrival) call this public full refit. */
export function refit(layout: Layout, view: ViewState, ctx: LayoutContext): Layout {
  return fitLayout(layout, view, ctx);
}
