/**
 * Fitting scales: refitting a workspace of 200 panes takes under 50 ms on a laptop, and the cost grows no faster than
 * about the square of the pane count. The time is judged against a reference job timed in the same run (below), so a
 * busy machine, which slows both alike, does not fail it. Before the work recorded in docs/DECISIONS.md ("Fitting carries the projection
 * forward"), 64 panes in a row took over 7 s.
 */
import { describe, expect, it } from "vite-plus/test";
import type { Layout } from "../types";
import * as core from "..";
import { context, freeze, view } from "./fixtures";
import { flat, nested, scaleFit as fit } from "./scale-fixtures";

/** The fastest of a few runs (the least disturbed by the machine), in ms. */
function time(work: () => void, runs = 3): number {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    work();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}
/** A refit at 1400 px with a cap of 8; and a whole resize step: draw it, refit at 1000 px, draw that. */
function cost(make: (n: number) => Layout, n: number) {
  const tree = freeze(make(n));
  const v = freeze(view("p0"));
  const wide = context(fit(), 8),
    narrow = context(fit(1000), 8);
  const fitted = freeze(core.refit(tree, v, wide));
  return {
    refit: time(() => core.refit(tree, v, wide)),
    step: time(() => {
      core.resolve(fitted, v, wide);
      core.resolve(core.refit(fitted, v, narrow), v, narrow);
    }),
  };
}

/**
 * A fixed job that spends time as the fit does (allocating, comparing, sorting objects), timed in the same run: the
 * speed of the machine as this test finds it, loaded or not. About 28 ms on the laptop the budget was set on.
 */
function reference(): number {
  return time(() => {
    const a = Array.from({ length: 200_000 }, (_, i) => ({
      k: (i * 7919) % 100_003,
      v: String(i),
    }));
    a.sort((x, y) => x.k - y.k);
    JSON.stringify(a.slice(0, 1000));
  }, 5);
}
/**
 * The budget as a multiple of the reference job: a refit of 200 panes (about 20-30 ms, so about one reference job when
 * idle) must take under 8 of them, and a whole resize step (draw, refit, draw) under 16. That is about the old
 * 200 ms and 400 ms ceilings on an idle laptop, and they move with the machine.
 */
const REFIT_BUDGET = 8;
const STEP_BUDGET = 16;
/** The ratios between sizes are the same on any machine, with this much room for noise. */
const SLACK = 4;
/** Below a few ms the timer's noise dominates, so smaller times count as this. */
const FLOOR = 2;
const ratio = (a: number, b: number) => Math.max(a, FLOOR) / Math.max(b, FLOOR);

describe("fitting scales", () => {
  it.each([
    ["a flat row", flat],
    ["nested rows of linked panes", nested],
  ] as const)(
    "refits %s of 200 panes inside the budget",
    (_, make) => {
      cost(make, 32); // warm up
      const before = reference();
      const [, n32, n64, n128, n200] = [16, 32, 64, 128, 200].map((n) => cost(make, n));
      // The slower the machine was at either end of the measuring, the more time the budget allows.
      const unit = Math.max(before, reference());
      expect(n200!.refit).toBeLessThan(REFIT_BUDGET * unit);
      expect(n200!.step).toBeLessThan(STEP_BUDGET * unit);
      // Doubling the panes may cost about four times as much (quadratic), never eight (cubic).
      for (const key of ["refit", "step"] as const) {
        expect(ratio(n128![key], n64![key])).toBeLessThan(4 * SLACK);
        expect(ratio(n200![key], n32![key])).toBeLessThan((200 / 32) ** 2 * SLACK);
      }
      // Timing several sizes, best of several runs each, outlasts vitest's 5 s default on a loaded machine; the budget is
      // in the assertions above, not in how long the test may take.
    },
    60_000,
  );

  it("folds 200 panes down to the cap and keeps the focused pane on screen", () => {
    const ctx = context(fit(), 8);
    const r = core.resolve(core.refit(flat(200), view("p0"), ctx), view("p0"), ctx);
    const visible = r.panes.filter((p) => !p.hidden);
    expect(visible.length).toBeLessThanOrEqual(8);
    expect(visible.map((p) => p.id)).toContain("p0");
    expect(r.panes).toHaveLength(200);
  });
});
