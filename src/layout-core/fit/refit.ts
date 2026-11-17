import type { Layout, LayoutContext, ViewState } from "../types";
import { allPanes, autos, choose, contains, overlayOf, replay, slots, withOverlay } from "./overlay";
import { chooseFold } from "./priority";
import { checkContext, misfit, tooSmall } from "./context";

/** Internal operation policy. External events always use full refit. */
interface FitPolicy { mode?: "full" | "fold"; fresh?: string; keep?: readonly string[] }

function unfoldPrefix(layout: Layout, current: string[], ctx: LayoutContext): string[] {
  const probe = { ...layout, overlay: { ...overlayOf(layout), tucks: [] } };
  for (let k = 0; k < current.length; k++) {
    if (!misfit(replay(probe, current.slice(0, k), ctx.fit).root, ctx.fit, ctx.paneCap)) return current.slice(0, k);
  }
  return current;
}

function foldUntilFit(layout: Layout, view: ViewState, current: string[], ctx: LayoutContext, policy: FitPolicy): string[] {
  const { fit, paneCap } = ctx;
  const keep = new Set(policy.keep ?? []);
  for (;;) {
    const { root, order } = replay(layout, current, fit);
    if (!misfit(root, fit, paneCap)) return current;
    const displayed = slots(root);
    if (displayed.length < 2) return current;
    const fresh = policy.fresh ? displayed.find(s => s.pane && s.id === policy.fresh) : undefined;
    // Over the cap alone, prefer the oldest eligible pane. No room: the fresh pane becomes a tab of its source.
    const ages = new Map(allPanes(root).map(p => [p.id, p.pane!.born ?? order.get(p.id) ?? Infinity]));
    const oldest = displayed.filter(s => s.pane && !keep.has(s.id) && s.id !== view.focused && !s.pane.pinned).sort((a, b) => ages.get(a.id)! - ages.get(b.id)!)[0];
    const choice = (tooSmall(root, fit) ? fresh : oldest ?? fresh) ?? chooseFold(root, view, order);
    if (!choice) return current;
    current = [...current, choice.id];
  }
}

function shownTabs(layout: Layout, view: ViewState, current: string[], newlyFolded: boolean, ctx: LayoutContext): Record<string, string> {
  const { root } = replay(layout, current, ctx.fit);
  const present = new Set(allPanes(root).map(p => p.id));
  // Retain choices while both panes exist, including while their group is absorbed or unfolded.
  const shown = Object.fromEntries(Object.entries(layout.overlay?.shown ?? {}).filter(([home, pane]) => present.has(home) && present.has(pane)));
  if (newlyFolded && view.focused) {
    const group = autos(root).find(g => contains(g, view.focused));
    if (group) {
      choose(group, shown);
      if (!contains(group.children.find(c => c.id === group.active)!, view.focused)) shown[group.home!] = view.focused;
    }
  }
  return shown;
}

export function fitLayout(layout: Layout, view: ViewState, ctx: LayoutContext, policy: FitPolicy = {}): Layout {
  checkContext(ctx);
  const o = overlayOf(layout);
  const replayed = replay(layout, o.folds, ctx.fit).applied;
  const prefix = policy.mode === "fold" ? replayed : unfoldPrefix(layout, replayed, ctx);
  const folds = foldUntilFit(layout, view, prefix, ctx, policy);
  const shown = shownTabs(layout, view, folds, folds.length > prefix.length, ctx);
  const sameFolds = folds.length === o.folds.length && folds.every((id, i) => id === o.folds[i]);
  const sameShown = Object.keys(shown).length === Object.keys(o.shown).length && Object.entries(shown).every(([k, v]) => o.shown[k] === v);
  return sameFolds && sameShown ? layout : withOverlay(layout, { ...o, folds, shown });
}

/** Only external events (resize, cap change, URL arrival) call this public full refit. */
export function refit(layout: Layout, view: ViewState, ctx: LayoutContext): Layout {
  return fitLayout(layout, view, ctx);
}
