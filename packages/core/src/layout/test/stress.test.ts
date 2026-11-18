import {
  context as ctx,
  stress,
  stressFit as fit,
  stressKinds as kinds,
  folded,
  freeze,
  view,
} from "./fixtures";
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import type { FitOptions, Layout, LayoutNode, PaneNode, ViewState } from "../types";

describe("stress preset fitting", () => {
  // What the screen shows: folds are decided by refit (at a structural or size change), then resolved.
  const place = (tree: Layout, v: ViewState, f: FitOptions) =>
    core.resolve(core.refit(tree, v, ctx(f)), v, ctx(f));
  it.each([
    [1920, 3],
    [1600, 3],
    [1440, 2],
    [1280, 2],
    [1024, 2],
    [390, 1],
  ])("keeps %i px at %i visible panes", (width, count) => {
    const tree = freeze(stress());
    const result = place(tree, view("s1"), fit(width));
    const visible = result.panes.filter((p) => !p.hidden);
    expect(result.panes).toHaveLength(10);
    expect(visible).toHaveLength(count);
    expect(folded(result)).toHaveLength(10 - count);
    expect(visible.some((p) => p.id === "s1")).toBe(true);
    for (const p of visible) {
      expect(p.rect.width).toBeGreaterThanOrEqual(
        kinds[p.id === "s9" ? "structure" : "record"]!.minWidth,
      );
      if (width >= 480) expect(p.rect.x + p.rect.width).toBeLessThanOrEqual(width + 1e-7);
    }
    if (width === 1600)
      expect(
        new Set(result.panes.flatMap((p) => (p.stackId ? [p.stackId] : []))).size,
      ).toBeLessThanOrEqual(2);
  });

  // Link chains in the stress preset: s1-s2-s3-s4 and s5-s6. s7-s10 are unlinked.
  const chains: Record<string, string> = { s1: "A", s2: "A", s3: "A", s4: "A", s5: "B", s6: "B" };
  it.each([1920, 1440, 1280, 1024, 390])(
    "never groups unrelated link chains in one auto stack at %i px",
    (width) => {
      const result = place(freeze(stress()), view("s1", ["s1"]), fit(width));
      const layout = stress();
      const panes = (function walk(n: LayoutNode): PaneNode[] {
        return n.type === "pane" ? [n] : n.children.flatMap(walk);
      })(layout.root);
      for (const stack of result.stacks) {
        expect(stack.paneIds).toContain(stack.homeId);
        expect(stack.paneIds.filter((id) => id !== stack.homeId).length).toBeGreaterThan(0);
      }
      // A folded pane that has a source shares that source's stack, whichever chain it belongs to.
      for (const p of panes) {
        const box = result.panes.find((b) => b.id === p.id)!;
        if (!p.linkedTo || !folded(result).includes(p.id)) continue;
        expect(result.panes.find((b) => b.id === p.linkedTo)!.stackId).toBe(box.stackId);
      }
      expect(Object.keys(chains).length).toBe(6);
    },
  );

  it("does not mix chains below the point where every chain must share a stack", () => {
    const result = place(freeze(stress()), view("s1", ["s1"]), fit(1920));
    const homeOf = (id: string) => result.stacks.find((s) => s.paneIds.includes(id))!;
    // s2's folded detail s3 stays in s2's group at 1440, never in a separate chain's group.
    const narrow = place(freeze(stress()), view("s1", ["s1"]), fit(1440));
    expect(narrow.panes.find((p) => p.id === "s3")!.stackId).toBe(
      narrow.panes.find((p) => p.id === "s2")!.stackId,
    );
    expect(homeOf("s3").paneIds).toContain("s4");
  });

  it("folds the far end of a chain first and protects the focused pane's neighbours", () => {
    const result = place(freeze(stress()), view("s1", ["s1"]), fit(1440));
    expect(result.panes.filter((p) => !p.hidden).map((p) => p.id)).toEqual(["s1", "s2"]);
    const other = place(freeze(stress()), view("s5", ["s5"]), fit(1440));
    expect(other.panes.filter((p) => !p.hidden).map((p) => p.id)).toEqual(["s5", "s6"]);
  });

  it("reverses folds progressively and deterministically as room returns", () => {
    const tree = freeze(stress());
    const widths = [390, 966, 1452, 1938, 2324, 2424, 2910, 3356, 3742];
    const counts = [1, 2, 3, 4, 5, 6, 7, 8, 10];
    const shrinking = [...widths].reverse().map((width) => place(tree, view("s1"), fit(width)));
    let previousFolds = new Set<string>(Array.from({ length: 9 }, (_, i) => `s${i + 2}`));
    for (const [i, width] of widths.entries()) {
      const result = place(tree, view("s1"), fit(width));
      expect(result).toEqual(shrinking[widths.length - i - 1]);
      expect(result.panes.filter((p) => !p.hidden)).toHaveLength(counts[i]!);
      expect(folded(result).every((id) => previousFolds.has(id))).toBe(true);
      previousFolds = new Set(folded(result));
    }
    expect(previousFolds.size).toBe(0);
  });

  it.each([1920, 1600, 1440, 1280, 1024])(
    "keeps focused context and source visible at %i px",
    (width) => {
      const result = place(freeze(stress()), view("s3"), fit(width));
      expect(result.panes.find((p) => p.id === "s3")!.hidden).toBeUndefined();
      expect(result.panes.find((p) => p.id === "s2")!.hidden).toBeUndefined();
    },
  );
});

describe("sticky folding on the stress preset", () => {
  const shape = (r: ReturnType<typeof core.resolve>) =>
    r.panes.map((p) => ({ id: p.id, rect: p.rect, stackId: p.stackId }));
  const members = (r: ReturnType<typeof core.resolve>) => r.stacks.map((s) => s.paneIds);
  const visible = (r: ReturnType<typeof core.resolve>) =>
    r.panes.filter((p) => !p.hidden).map((p) => p.id);

  it.each([1920, 1440])(
    "at %i px, activating every tab and focusing every pane moves nothing",
    (width) => {
      const f = fit(width);
      let layout = core.refit(freeze(stress()), view("s1"), ctx(f));
      const base = core.resolve(layout, view("s1"), ctx(f));
      expect(base.stacks.length).toBeGreaterThan(0);
      for (const stack of base.stacks)
        for (const id of stack.paneIds) {
          layout = core.setActiveTab(layout, stack.id, id, ctx(f));
          const v = view(id);
          // A tab click focuses its pane; neither the click nor the focus refits.
          const after = core.resolve(layout, v, ctx(f));
          expect(shape(after)).toEqual(shape(base));
          expect(members(after)).toEqual(members(base));
          expect(after.panes.find((p) => p.id === id)!.hidden).toBeUndefined();
          expect(
            after.panes.filter((p) => p.stackId === stack.id && !p.hidden).map((p) => p.id),
          ).toEqual([id]);
        }
      for (const id of base.panes.map((p) => p.id)) {
        const after = core.resolve(layout, view(id, [id, "s1"]), ctx(f));
        expect(shape(after)).toEqual(shape(base));
        expect(members(after)).toEqual(members(base));
        // Even a refit at the same size, with focus elsewhere, keeps the arrangement.
        expect(core.refit(layout, view(id, [id, "s1"]), ctx(f))).toBe(layout);
      }
    },
  );

  it("folds and unfolds deterministically as the window resizes, and the same width restores the same arrangement", () => {
    const widths = [1920, 1600, 1440, 1280, 1024, 390];
    let layout = core.refit(freeze(stress()), view("s1"), ctx(fit(1920)));
    const seen = new Map<number, ReturnType<typeof core.resolve>>();
    for (const width of widths) {
      layout = core.refit(layout, view("s1"), ctx(fit(width)));
      seen.set(width, core.resolve(layout, view("s1"), ctx(fit(width))));
    }
    expect(visible(seen.get(390)!)).toHaveLength(1);
    // Grow back with focus moved around: each width shows exactly what it showed on the way down.
    for (const [i, width] of [...widths].reverse().entries()) {
      const v = view(`s${(i % 10) + 1}`);
      layout = core.refit(layout, v, ctx(fit(width)));
      expect(core.resolve(layout, v, ctx(fit(width)))).toEqual(seen.get(width));
    }
    expect(core.refit(layout, view("s1"), ctx(fit(4000))).overlay).toBeUndefined();
    // Jumping straight to a width gives the same arrangement as getting there step by step.
    expect(
      core.resolve(
        core.refit(freeze(stress()), view("s1"), ctx(fit(1024))),
        view("s1"),
        ctx(fit(1024)),
      ),
    ).toEqual(seen.get(1024));
  });

  it("tucking frees space to the home only and never unfolds; putting back restores every rect", () => {
    const f = fit(1440);
    const layout = core.refit(freeze(stress()), view("s1"), ctx(f));
    const base = core.resolve(layout, view("s1"), ctx(f));
    const first = visible(base)[0]!;
    const t = core.tuck(layout, view(first), first, ctx(f));
    if (!t.ok) throw new Error("expected a tuck");
    expect(t.layout.overlay?.folds).toEqual(layout.overlay?.folds);
    const after = core.resolve(t.layout, t.view, ctx(f));
    expect(folded(after)).toEqual(folded(base));
    const back = core.putBack(t.layout, t.view, first, ctx(f));
    if (!back.ok) throw new Error("expected put back");
    expect(core.resolve(core.refit(back.layout, back.view, ctx(f)), back.view, ctx(f))).toEqual(
      base,
    );
  });

  it("a reloaded, linked or resized layout never unfolds into space a tuck freed", () => {
    const f = fit(1440);
    const layout = core.refit(freeze(stress()), view("s1"), ctx(f));
    const t = core.tuck(layout, view("s1"), "s1", ctx(f));
    if (!t.ok) throw new Error("expected a tuck");
    const reloaded = core.decode(core.encode(t.layout), kinds)!;
    expect(reloaded).toEqual(t.layout);
    expect(core.refit(reloaded, view("s2"), ctx(f)).overlay?.folds).toEqual(
      t.layout.overlay?.folds,
    );
    expect(core.refit(reloaded, view("s2"), ctx(f)).overlay?.folds).toEqual(
      t.layout.overlay?.folds,
    );
    // A bigger screen still unfolds.
    expect(core.refit(reloaded, view("s2"), ctx(fit(4000))).overlay?.folds).toEqual([]);
  });

  it("carries recorded folds and tab choices through the link codec", () => {
    const f = fit(1440);
    let layout = core.refit(freeze(stress()), view("s1"), ctx(f));
    const stack = core.resolve(layout, view("s1"), ctx(f)).stacks[0]!;
    layout = core.setActiveTab(layout, stack.id, stack.paneIds.at(-1)!, ctx(f));
    const decoded = core.decode(core.encode(layout), kinds)!;
    expect(decoded.overlay).toEqual(layout.overlay);
    expect(core.resolve(decoded, view("s1"), ctx(f))).toEqual(
      core.resolve(layout, view("s1"), ctx(f)),
    );
  });
});
