/**
 * The fitting engine is optimised without changing a single result: across a generated corpus of layouts, overlays,
 * rooms, caps, views and fit policies, `fitLayout` and `resolve` give exactly what the frozen engine
 * (`legacy-fit/`, the code before the performance work) gives. docs/DECISIONS.md, "Fitting carries the projection
 * forward".
 */
import { describe, expect, it } from "vite-plus/test";
import type {
  KindRegistry,
  Layout,
  LayoutContext,
  LayoutNode,
  PaneNode,
  TuckRecord,
  ViewState,
} from "../types";
import { fitLayout } from "../fit/refit";
import { resolve } from "../fit/resolve";
import { fitLayout as legacyFit } from "./legacy-fit/refit";
import { resolve as legacyResolve } from "./legacy-fit/resolve";
import { freeze } from "./fixtures";

const kinds: KindRegistry = Object.fromEntries(
  (
    [
      ["list", 240, 120, 320, 480],
      ["record", 380, 200, 480, 900],
      ["card", 300, 150, undefined, undefined],
      ["wide", 440, 240, 640, undefined],
      ["small", 100, 80, undefined, 300],
      ["table", 480, 240, undefined, undefined],
    ] as const
  ).map(([kind, minWidth, minHeight, comfortableWidth, maxWidth]) => [
    kind,
    { kind, minWidth, minHeight, comfortableWidth, maxWidth, title: () => kind },
  ]),
) as KindRegistry;
const kindNames = Object.keys(kinds);
/** The frozen engine is slow (that is the point), so a test run checks a sample: parts 0 to 3. JALI_FIT_CORPUS=full
 *  checks all twelve, with layouts of up to 17 panes (about a minute). */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const FULL = env?.JALI_FIT_CORPUS === "full";
const PARTS = FULL ? 12 : 4,
  LAYOUTS = FULL ? 15 : 6;

/** A small seeded generator (mulberry32), so the corpus is the same on every run. */
function random(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]!;
  const chance = (p: number) => next() < p;
  return { int, pick, chance };
}
type Random = ReturnType<typeof random>;

function generate(r: Random, target: number): Layout {
  const ids: string[] = [];
  let splits = 0;
  const size = () =>
    r.chance(0.15) ? { px: 200 + r.int(400) } : { weight: r.pick([1, 1, 1, 2, 0.5]) };
  const leaf = (): PaneNode => {
    const id = `p${ids.length}`;
    const p: PaneNode = {
      id,
      type: "pane",
      ref: { kind: r.pick(kindNames), params: { id } },
      size: size(),
    };
    if (ids.length && r.chance(0.5)) p.linkedTo = r.pick(ids);
    if (r.chance(0.15)) p.priority = r.pick(["primary", "supporting", "supporting"] as const);
    if (r.chance(0.1)) p.kept = true;
    if (r.chance(0.3)) p.born = r.int(100);
    if (r.chance(0.1)) p.userSized = true;
    ids.push(id);
    return p;
  };
  const node = (depth: number, left: () => number): LayoutNode => {
    const roll = r.int(10);
    if (depth > 3 || left() <= 1 || roll < 4) return leaf();
    if (roll < 5) {
      const children = Array.from({ length: 2 + r.int(2) }, leaf);
      return {
        id: `t${splits++}`,
        type: "stack",
        origin: "user",
        size: size(),
        active: r.pick(children).id,
        children,
      };
    }
    const type = r.chance(0.6) ? "row" : "column";
    const n = Math.min(left(), 2 + r.int(5));
    const children: LayoutNode[] = [];
    for (let i = 0; i < n && left() > 0; i++) children.push(node(depth + 1, left));
    return {
      id: `s${splits++}`,
      type,
      size: size(),
      ...(type === "row" && depth > 0 && r.chance(0.15) ? { scroll: "x" as const } : {}),
      ...(r.chance(0.1) ? { userSized: true } : {}),
      children,
    };
  };
  const left = () => target - ids.length;
  const children: LayoutNode[] = [];
  while (left() > 0) children.push(node(1, left));
  const root: LayoutNode =
    children.length === 1
      ? children[0]!
      : { id: "root", type: r.chance(0.8) ? "row" : "column", size: { weight: 1 }, children };
  const layout: Layout = { version: 1, root };
  // An overlay the person (or an earlier fit) could have left: folds in any order, some stale, a hide, tucks.
  if (r.chance(0.6)) {
    const any = () => (r.chance(0.1) ? `gone${r.int(5)}` : r.pick(ids));
    const folds = [...new Set(Array.from({ length: r.int(ids.length + 1) }, any))];
    const tucks: TuckRecord[] = r.chance(0.3)
      ? Array.from({ length: 1 + r.int(2) }, (_, seq) => ({ pane: any(), home: any(), seq }))
      : [];
    const shown: Record<string, string> = r.chance(0.3) ? { [r.pick(ids)]: r.pick(ids) } : {};
    layout.overlay = {
      tucks: tucks.filter((t) => t.pane !== t.home),
      folds,
      shown,
      ...(r.chance(0.2) ? { hidden: [r.pick(ids)] } : {}),
    };
  }
  return layout;
}

const panesOf = (n: LayoutNode): string[] =>
  n.type === "pane" ? [n.id] : n.children.flatMap(panesOf);

describe("fitting gives the frozen engine's results", () => {
  const rooms = [
    [320, 600],
    [700, 500],
    [1000, 900],
    [1440, 900],
    [2400, 700],
  ] as const;
  it.each(Array.from({ length: PARTS }, (_, i) => i))(
    "corpus part %i",
    (part) => {
      let compared = 0;
      for (let k = 0; k < LAYOUTS; k++) {
        const r = random(part * 1000 + k + 1);
        const tree = freeze(generate(r, 2 + r.int(part < 8 ? 10 : 16)));
        const ids = panesOf(tree.root);
        const v: ViewState = freeze(
          r.chance(0.8)
            ? {
                focused: r.pick(ids),
                focusHistory: Array.from({ length: r.int(4) }, () => r.pick(ids)),
              }
            : { focusHistory: [] },
        );
        for (const [width, height] of rooms) {
          const ctx: LayoutContext = freeze({
            fit: { width, height, gap: r.pick([0, 6, 8]), kinds },
            paneCap: r.pick([2, 4, 8, 10, 99]),
            ...(r.chance(0.2) ? { dir: "rtl" as const } : {}),
          });
          const policies = [
            {},
            { mode: "fold" as const },
            { fresh: r.pick(ids) },
            { fresh: r.pick(ids), keep: [r.pick(ids)], yields: r.chance(0.5) },
          ];
          for (const policy of policies) {
            const was = legacyFit(tree, v, ctx, policy),
              now = fitLayout(tree, v, ctx, policy);
            expect(now).toEqual(was);
            expect(now === tree).toBe(was === tree);
            // Zoom shows a pane on screen; hiding a pane ends its zoom (`hide`).
            const shown = ids.filter((id) => !now.overlay?.hidden?.includes(id));
            const view = r.chance(0.2) ? { ...v, zoomed: r.pick(shown) } : v;
            expect(resolve(now, view, ctx)).toEqual(legacyResolve(was, view, ctx));
            // Widening or narrowing from the fitted overlay: the recorded folds replay, then unfold or fold more.
            const [w2, h2] = r.pick(rooms);
            const next = freeze({ ...ctx, fit: { ...ctx.fit, width: w2, height: h2 } });
            const again = fitLayout(now, v, next);
            expect(again).toEqual(legacyFit(was, v, next));
            expect(resolve(again, v, next)).toEqual(legacyResolve(again, v, next));
            compared++;
          }
        }
      }
      expect(compared).toBe(LAYOUTS * rooms.length * 4);
    },
    120_000,
  );
});
