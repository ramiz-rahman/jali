/**
 * Heights: minimum, comfortable and max down a column, with the same rules as widths along a row. docs/DECISIONS.md,
 * "Heights have a comfortable and a max height".
 */
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { combineBounds, bounds } from "../geometry/bounds";
import { find } from "../tree/tree";
import type {
  FitOptions,
  KindRegistry,
  Layout,
  LayoutNode,
  PaneNode,
  ResolvedLayout,
} from "../types";
import { context, view } from "./fixtures";

const kinds: KindRegistry = {
  // A short, wide pane: about 200 high, never usefully more than 260.
  band: {
    kind: "band",
    title: () => "band",
    minWidth: 200,
    minHeight: 100,
    comfortableHeight: 200,
    maxHeight: 260,
  },
  // Wants 300 before anything shares by weight; no max.
  comfy: {
    kind: "comfy",
    title: () => "comfy",
    minWidth: 200,
    minHeight: 100,
    comfortableHeight: 300,
  },
  plain: { kind: "plain", title: () => "plain", minWidth: 200, minHeight: 100 },
  // The same as plain, with the defaults written out.
  spelled: {
    kind: "spelled",
    title: () => "spelled",
    minWidth: 200,
    minHeight: 100,
    comfortableHeight: 100,
  },
  deep: { kind: "deep", title: () => "deep", minWidth: 200, minHeight: 300 },
};
const fit = (height: number, width = 1000): FitOptions => ({ width, height, gap: 6, kinds });
const ctx = (height: number, width?: number) => context(fit(height, width));
const pane = (id: string, kind: string, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref: { kind, params: { id } },
  ...extra,
});
const column = (id: string, children: LayoutNode[], extra: Partial<LayoutNode> = {}): LayoutNode =>
  ({ id, type: "column", size: { weight: 1 }, children, ...extra }) as LayoutNode;
const rowNode = (id: string, children: LayoutNode[], extra: Partial<LayoutNode> = {}): LayoutNode =>
  ({ id, type: "row", size: { weight: 1 }, children, ...extra }) as LayoutNode;
const of = (root: LayoutNode): Layout => ({ version: 1, root });
const heights = (r: ResolvedLayout) =>
  Object.fromEntries(
    r.panes.filter((b) => !b.hidden).map((b) => [b.id, Math.round(b.rect.height)]),
  );
const place = (l: Layout, height: number, width?: number) =>
  core.resolve(l, view("a"), ctx(height, width));

describe("heights down a column", () => {
  it("max: spare height past it goes to the neighbour", () => {
    expect(heights(place(of(column("c", [pane("a", "band"), pane("b", "plain")])), 906))).toEqual({
      a: 260,
      b: 640,
    });
  });

  it("comfortable: spare height brings the pane there first, then everything shares by weight", () => {
    const l = of(column("c", [pane("a", "comfy"), pane("b", "plain")]));
    expect(heights(place(l, 506))).toEqual({ a: 300, b: 200 });
    expect(heights(place(l, 906))).toEqual({ a: 450, b: 450 });
  });

  it("every pane at its max: they grow on, so no void opens", () => {
    expect(heights(place(of(column("c", [pane("a", "band"), pane("b", "band")])), 906))).toEqual({
      a: 450,
      b: 450,
    });
  });

  it("off: a kind with neither shares exactly as before", () => {
    const plain = place(
      of(column("c", [pane("a", "plain"), pane("b", "plain", { size: { weight: 2 } })])),
      906,
    );
    const spelled = place(
      of(column("c", [pane("a", "spelled"), pane("b", "plain", { size: { weight: 2 } })])),
      906,
    );
    expect(heights(plain)).toEqual({ a: 300, b: 600 });
    expect(heights(spelled)).toEqual(heights(plain));
  });

  it("a split the person sized keeps its proportions; comfortable and max no longer apply", () => {
    const l = of(
      column("c", [
        pane("a", "band", { size: { weight: 600 }, userSized: true }),
        pane("b", "plain", { size: { weight: 300 }, userSized: true }),
      ]),
    );
    expect(heights(place(l, 906))).toEqual({ a: 600, b: 300 });
  });

  it("a divider drag may take a pane past its max: the person's size wins", () => {
    const l = of(column("c", [pane("a", "band"), pane("b", "plain")]));
    const divider = place(l, 906).dividers[0]!;
    expect(divider.max).toBe(800);
    const dragged = core.resizeDivider(l, "c", 0, 10000, ctx(906));
    expect(find(dragged.root, "a")!.userSized).toBe(true);
    expect(heights(place(dragged, 906))).toEqual({ a: 800, b: 100 });
  });

  it("does not decide folding: only the minimum does", () => {
    const l = of(column("c", [pane("a", "comfy"), pane("b", "comfy")]));
    // 206 holds both minimums (100 + 6 + 100) though neither is at comfort.
    const r = core.resolve(core.refit(l, view("a"), ctx(206)), view("a"), ctx(206));
    expect(r.shelf).toEqual([]);
    expect(heights(r)).toEqual({ a: 100, b: 100 });
  });
});

describe("heights across a row, in tab groups and in rows that scroll", () => {
  it("a row in a column takes the most its children can use", () => {
    const capped = of(
      column("c", [rowNode("r", [pane("a", "band"), pane("a2", "band")]), pane("b", "plain")]),
    );
    expect(heights(place(capped, 906))).toEqual({ a: 260, a2: 260, b: 640 });
    // One child can use any height, so the row can too: it shares by weight.
    const open = of(
      column("c", [rowNode("r", [pane("a", "band"), pane("a2", "plain")]), pane("b", "plain")]),
    );
    expect(heights(place(open, 906))).toEqual({ a: 450, a2: 450, b: 450 });
  });

  it("a tab group's minimum is its tallest tab's; it is measured by all its tabs alike, whatever their order", () => {
    const group = (first: string, second: string): LayoutNode => ({
      id: "g",
      type: "stack",
      size: { weight: 1 },
      active: "a",
      children: [pane("a", first), pane("x", second)],
    });
    expect(
      heights(place(of(column("c", [group("band", "plain"), pane("b", "plain")])), 906)),
    ).toEqual({
      a: 260,
      b: 640,
    });
    // The same group with its tabs the other way round: the same heights (22 Nov 2026; before, its first tab's).
    expect(
      heights(place(of(column("c", [group("plain", "band"), pane("b", "plain")])), 906)),
    ).toEqual({
      a: 260,
      b: 640,
    });
    const b = (k: string) => bounds(pane("p", k), kinds, 6);
    expect(combineBounds("stack", [b("band"), b("deep")], 6)).toMatchObject({
      height: 300,
      comfortableHeight: 300,
      maxHeight: 300,
    });
    // A fold measured as its home: the band's own comfort and max, whatever folded into it.
    expect(combineBounds("auto", [b("plain"), b("band")], 6, 1)).toMatchObject({
      height: 100,
      comfortableHeight: 200,
      maxHeight: 260,
    });
    expect(combineBounds("auto", [b("plain"), b("band")], 6, 0)).toMatchObject({
      comfortableHeight: 100,
      maxHeight: Infinity,
    });
  });

  it("a row that scrolls combines heights as a plain row does, and a column inside it shares as any column", () => {
    const strip = of(
      column("c", [
        rowNode("s", [pane("a", "band"), pane("a2", "band")], {
          scroll: "x",
        } as Partial<LayoutNode>),
        pane("b", "plain"),
      ]),
    );
    expect(heights(place(strip, 906))).toEqual({ a: 260, a2: 260, b: 640 });
    const inside = of(
      rowNode("s", [column("c", [pane("a", "band"), pane("b", "plain")]), pane("z", "plain")], {
        scroll: "x",
      } as Partial<LayoutNode>),
    );
    expect(heights(place(inside, 906))).toMatchObject({ a: 260, b: 640, z: 906 });
  });

  it("a link carries no heights: they come from the kinds, so a decoded layout resolves the same", () => {
    const l = of(column("c", [pane("a", "band", { size: { px: 220 } }), pane("b", "comfy")]));
    const back = core.decode(core.encode(l), kinds)!;
    expect(back).toEqual(l);
    expect(heights(place(back, 906))).toEqual(heights(place(l, 906)));
  });
});
