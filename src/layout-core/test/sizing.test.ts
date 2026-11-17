/**
 * Pane sizing: minimum (fold threshold), comfortable (spare space goes here first), max (soft: past it, siblings that
 * can use the room get it). docs/DECISIONS.md, "Pane sizing: minimum, comfortable, max".
 */
import { describe, expect, it } from "vitest";
import * as core from "../index";
import { find } from "../tree/tree";
import type { FitOptions, KindRegistry, Layout, LayoutNode, PaneNode, ResolvedLayout } from "../types";
import { context, folded, freeze, view } from "./fixtures";

const kinds: KindRegistry = {
  table: { kind: "table", title: () => "table", minWidth: 400, minHeight: 240, comfortableWidth: 560 },
  record: { kind: "record", title: () => "record", minWidth: 360, minHeight: 240, comfortableWidth: 440, maxWidth: 600 },
  plain: { kind: "plain", title: () => "plain", minWidth: 320, minHeight: 200 },
};
const fit = (width: number): FitOptions => ({ width, height: 900, gap: 6, kinds });
const ctx = (width: number) => context(fit(width));
const pane = (id: string, kind: string, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref: { kind, params: { id } }, ...extra });
const row = (...children: LayoutNode[]): Layout => ({ version: 1, root: { id: "root", type: "row", size: { weight: 1 }, children } });
const widths = (r: ResolvedLayout) => r.panes.filter(b => !b.hidden).map(b => b.rect.width);
const rects = (r: ResolvedLayout) => r.panes.filter(b => !b.hidden).map(b => `${b.rect.x},${b.rect.width}`).sort().join(" ");
const place = (l: Layout, width: number) => core.resolve(l, view("t"), ctx(width));
const chain = () => freeze(row(pane("t", "table"), pane("r1", "record", { linkedTo: "t" }), pane("r2", "record", { linkedTo: "r1" })));

describe("pane sizing", () => {
  it("fits table + record + record at 1440 with the records at comfortable and the table taking the rest", () => {
    const r = place(chain(), 1440);
    expect(folded(r)).toEqual([]);
    expect(widths(r)).toEqual([548, 440, 440]);
  });
  it("stops records at their max at 1920 and gives the table everything past it", () => {
    expect(widths(place(chain(), 1920))).toEqual([708, 600, 600]);
  });
  it("folds only below the sum of minimums", () => {
    const minimum = 400 + 360 + 360 + 2 * 6;
    expect(folded(place(chain(), minimum))).toEqual([]);
    expect(widths(place(chain(), minimum))).toEqual([400, 360, 360]);
    expect(folded(place(chain(), minimum - 1))).toHaveLength(1);
  });
  it("lets records grow past their max when nothing beside them can use the room", () => {
    expect(widths(place(row(pane("a", "record"), pane("b", "record")), 1606))).toEqual([800, 800]);
  });
  it("treats a column as able to use what any of its panes can", () => {
    const tree = row(pane("r", "record"), { id: "col", type: "column", size: { weight: 1 }, children: [pane("q", "record"), pane("t", "table")] });
    // The column holds a table, so it is not capped: the lone record stops at 600 and the column takes the rest.
    expect(widths(place(tree, 1806))).toEqual([600, 1200, 1200]);
  });
  it("keeps the sizes the person dragged, at any window width (weights mode)", () => {
    const dragged = core.resizeDivider(chain(), "root", 0, -100, ctx(1440));
    expect(find(dragged.root, "t")).toMatchObject({ userSized: true });
    const at1440 = widths(place(dragged, 1440));
    expect(at1440[0]).toBeCloseTo(448, 6);
    // Exact proportions on a wider window: the share rule would have capped the records at 600.
    const wide = widths(place(dragged, 1920));
    expect(wide[0]! / wide[1]!).toBeCloseTo(at1440[0]! / at1440[1]!, 6);
    expect(wide[1]).toBeGreaterThan(600);
  });
  it("hands a split back to the share rule when its divider is reset", () => {
    const dragged = core.resizeDivider(chain(), "root", 0, -100, ctx(1440));
    expect(widths(place(core.resetDivider(dragged, "root", 0, ctx(1440)), 1440))).toEqual([548, 440, 440]);
  });
  it("never moves a slot when a tab is chosen: a tab group is measured as its home (a stack's first tab)", () => {
    const stack = (active: string): Layout => row(pane("t", "table"), { id: "tabs", type: "stack", origin: "user", active, size: { weight: 1 }, children: [pane("a", "record"), pane("b", "plain")] });
    expect(rects(place(stack("a"), 1440))).toBe(rects(place(stack("b"), 1440)));
    // The home is a record, so the slot stops at the record's max even while the plain tab (no max) is shown.
    expect(place(stack("b"), 1920).panes.find(p => p.id === "b")!.rect.width).toBe(600);
  });
  it("measures a fold as the slot it folded into, so folded tables do not turn a record's slot into a table's", () => {
    // 1000px: the table, its record and a second table cannot all fit; the second table folds into the record's slot.
    const tree = row(pane("t", "table"), pane("r", "record", { linkedTo: "t" }), pane("u", "table", { linkedTo: "r" }));
    const r = place(tree, 1000);
    expect(folded(r)).toEqual(["u"]);
    expect(widths(r)).toEqual([554, 440]);
  });
  it("holds every rect when two panes of different needs swap places", () => {
    const before = chain();
    const swapped = core.swap(before, "t", "r1", ctx(1440));
    expect(rects(place(swapped, 1440))).toBe(rects(place(before, 1440)));
    // The held split now keeps exact proportions, with the reset size remembered.
    expect(find(swapped.root, "r1")).toMatchObject({ userSized: true, base: { weight: 1 } });
    // A divider reset returns it to the share rule: the table again takes the room the records do not use.
    const reset = core.resetDivider(swapped, "root", 0, ctx(1440));
    const r = place(reset, 1440);
    expect(r.panes.find(b => b.id === "t")!.rect.width).toBe(548);
  });
  it("holds the slot when a pane shows an object of another kind in place (setRef is a swap)", () => {
    const before = freeze(row(pane("t", "table"), pane("p", "plain")));
    const after = core.setRef(before, view("p"), "p", { kind: "record", params: { id: 1 } }, ctx(1440));
    expect(rects(place(after, 1440))).toBe(rects(place(before, 1440)));
    // Same needs, nothing to hold: the layout carries no sizing marks.
    const same = core.setRef(before, view("p"), "p", { kind: "plain", params: { id: 2 } }, ctx(1440));
    expect(find(same.root, "p")!.userSized).toBeUndefined();
  });
  it("gives a pane opened into a sized split a fair share, not a weight of 1 beside lengths", () => {
    const wide = freeze(row(pane("t", "table"), pane("r1", "record", { linkedTo: "t" })));
    const dragged = core.resizeDivider(wide, "root", 0, -80, ctx(1920));
    const opened = core.openBeside(dragged, view("r1"), "r1", { kind: "plain", params: { id: "p" } }, ctx(1920));
    const r = core.resolve(opened.layout, opened.view, ctx(1920));
    expect(folded(r)).toEqual([]);
    const w = r.panes.find(b => b.id === opened.opened)!.rect.width;
    expect(w).toBeGreaterThan(400);
  });
  it("is a pure function of layout and size", () => {
    const tree = chain();
    expect(place(tree, 1440)).toEqual(place(tree, 1440));
    expect(place(tree, 1440)).toEqual(place(structuredClone(tree), 1440));
  });
});
