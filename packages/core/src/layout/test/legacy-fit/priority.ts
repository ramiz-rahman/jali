// Frozen copy of fit/priority.ts before the fitting performance work (5948507). fit-equivalence.test.ts checks
// the optimised engine against it. Never edit.
import type { ViewState } from "../../types";
import { allPanes, links, orderOf, slots, type Projected } from "./overlay";
const cmp = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);
/**
 * Which displayed slot to fold next. Runs only when a fold is needed (structural or size change), never on focus.
 * Protected: the focused pane, its source and its direct details.
 * Order: supporting slots, unprotected released, unprotected kept, protected released, protected kept, primary
 * slots and rows that scroll (a strip holds a whole sequence: folding it hides the most), the focused slot. Priority comes from the pane (a designed arrangement says which panes give way first).
 * Within a tier: unlinked panes, then the far end of link chains (deepest from focus), then least recently
 * focused, then narrowest, then reading order. With no focused pane, the first pane in reading order stands in.
 */
export function chooseFold(
  root: Projected,
  view: ViewState,
  order: Map<string, number>,
): Projected | undefined {
  const displayed = slots(root);
  if (displayed.length < 2) return undefined;
  const panes = allPanes(root);
  const ids = new Set(panes.map((p) => p.id));
  const linkOf = links(root);
  // With no focus yet (boot, a shared link), the first pane in reading order counts as focused: apps focus it first.
  const focused =
    view.focused && ids.has(view.focused)
      ? view.focused
      : [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
  const protectedIds = new Set<string>();
  if (focused) {
    protectedIds.add(focused);
    const source = linkOf(panes.find((p) => p.id === focused)!);
    if (source) protectedIds.add(source);
    for (const p of panes) if (linkOf(p) === focused) protectedIds.add(p.id);
  }
  // Undirected link distance from the focused pane; unreachable chains are infinitely far.
  const distance = new Map<string, number>();
  if (focused) {
    distance.set(focused, 0);
    for (let queue = [focused]; queue.length;) {
      const id = queue.shift()!;
      for (const p of panes) {
        const near = linkOf(p) === id ? p.id : p.id === id ? linkOf(p) : undefined;
        if (near && !distance.has(near)) {
          distance.set(near, distance.get(id)! + 1);
          queue.push(near);
        }
      }
    }
  }
  const linkedIds = new Set(panes.flatMap((p) => (linkOf(p) ? [p.id, linkOf(p)!] : [])));
  const rank = (id: string) => {
    const i = view.focusHistory.indexOf(id);
    return i < 0 ? Infinity : i;
  };
  const score = (slot: Projected) => {
    const members = allPanes(slot);
    const kept = members.some((p) => p.pane!.kept);
    const supporting = members.every((p) => p.pane!.priority === "supporting");
    const primary = members.some((p) => p.pane!.priority === "primary");
    const tier = members.some((p) => p.id === focused)
      ? 4
      : supporting
        ? -1
        : primary || slot.scroll
          ? 3.5
          : members.some((p) => protectedIds.has(p.id))
            ? 2 + Number(kept)
            : Number(kept);
    return {
      slot,
      tier,
      linked: Number(members.some((p) => linkedIds.has(p.id))),
      depth: Math.max(...members.map((p) => distance.get(p.id) ?? Infinity)),
      recent: Math.min(...members.map((p) => rank(p.id))),
      width: slot.bounds.width,
      order: orderOf(slot, order),
    };
  };
  const ranked = displayed
    .map(score)
    .sort(
      (a, b) =>
        cmp(a.tier, b.tier) ||
        cmp(a.linked, b.linked) ||
        cmp(b.depth, a.depth) ||
        cmp(b.recent, a.recent) ||
        cmp(a.width, b.width) ||
        cmp(a.order, b.order),
    );
  return ranked[0]!.slot;
}
