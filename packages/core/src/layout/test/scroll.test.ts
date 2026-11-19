/**
 * A row that scrolls sideways (`row({ scroll: "x" }, …)`, docs/research/scrolling-rows.md): its children keep their
 * own widths and the row scrolls to the rest, instead of sharing its width and folding what doesn't fit.
 */
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { column, pane as paneOf, row, toLayout } from "../build";
import { decode, encode } from "../codec/codec";
import type { KindRegistry, Layout, LayoutContext, ResolvedLayout } from "../types";
import { folded } from "./fixtures";
import { offsetToShow, scrolled } from "../geometry/scroll";

const kinds: KindRegistry = {
  day: {
    kind: "day",
    minWidth: 300,
    minHeight: 200,
    comfortableWidth: 360,
    maxWidth: 480,
    title: () => "Day",
  },
  list: { kind: "list", minWidth: 320, minHeight: 120, title: () => "List" },
  map: { kind: "map", minWidth: 640, minHeight: 240, title: () => "Map" },
};
const ctx = (width = 1440, height = 900, paneCap = 10, dir?: "rtl"): LayoutContext => ({
  fit: { width, height, gap: 6, kinds },
  paneCap,
  ...(dir ? { dir } : {}),
});
const day = (n: number) => paneOf({ kind: "day", params: { n } }, { id: `d${n}` });
const days = (count: number) => Array.from({ length: count }, (_, i) => day(i + 1));
const strip = (count: number) => row({ id: "strip", scroll: "x" }, ...days(count));
const place = (layout: Layout, c = ctx()): ResolvedLayout =>
  core.resolve(core.refit(layout, { focusHistory: [] }, c), { focusHistory: [] }, c);
const rect = (r: ResolvedLayout, id: string) => r.panes.find((p) => p.id === id)!.rect;

describe("a row that scrolls sideways", () => {
  it("the builder marks the row, and only a row", () => {
    const root = toLayout(strip(3)).root;
    expect(root).toMatchObject({ type: "row", scroll: "x" });
    expect(toLayout(row(...days(2))).root).not.toHaveProperty("scroll");
  });

  it("keeps every child at its comfortable width and folds none, however many", () => {
    const r = place(toLayout(strip(7)));
    expect(folded(r)).toEqual([]);
    for (let n = 1; n <= 7; n++) expect(rect(r, `d${n}`).width).toBe(360);
    expect(r.scrollers).toEqual([
      {
        id: "strip",
        rect: { x: 0, y: 0, width: 1440, height: 900 },
        contentWidth: 7 * 360 + 6 * 6,
        paneIds: ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
      },
    ]);
    // Side by side along the content, a gap apart.
    expect(rect(r, "d2").x).toBe(366);
    expect(rect(r, "d7").x).toBe(6 * 366);
  });

  it("is one slot to the pane cap: twelve panes in a strip with a cap of 4 fold none", () => {
    const r = place(toLayout(strip(12)), ctx(1440, 900, 4));
    expect(folded(r)).toEqual([]);
    expect(r.panes.filter((p) => !p.hidden)).toHaveLength(12);
  });

  it("between fixed panes, it takes the room they leave, and they keep theirs", () => {
    const layout = toLayout(
      row(
        paneOf({ kind: "list", params: {} }, { id: "overview" }),
        strip(7),
        paneOf({ kind: "map", params: {} }, { id: "map" }),
      ),
    );
    const r = place(layout);
    expect(folded(r)).toEqual([]);
    const s = r.scrollers[0]!;
    expect(rect(r, "overview").width).toBeGreaterThanOrEqual(320);
    expect(rect(r, "map").width).toBeGreaterThanOrEqual(640);
    expect(s.rect.width).toBeCloseTo(1440 - rect(r, "overview").width - rect(r, "map").width - 12);
    expect(s.rect.x).toBeCloseTo(rect(r, "overview").width + 6);
    // Its days still keep their own width inside it, and start at its left edge.
    expect(rect(r, "d1")).toMatchObject({ x: s.rect.x, width: 360 });
    expect(s.contentWidth).toBe(7 * 360 + 36);
  });

  it("needs one child's room at comfort from its parent, so the panes beside it fold only short of that", () => {
    // 320 + 6 + 360 + 6 + 640 = 1332: one day, whole, is all the strip asks for.
    const layout = toLayout(
      row(
        paneOf({ kind: "list", params: {} }, { id: "overview" }),
        strip(7),
        paneOf({ kind: "map", params: {} }, { id: "map" }),
      ),
    );
    const r = place(layout, ctx(1340));
    expect(folded(r)).toEqual([]);
    expect(r.scrollers[0]!.rect.width).toBeGreaterThanOrEqual(360);
    // Narrower, a neighbour folds: the strip never shows less than one whole day.
    const tight = place(layout, ctx(1200));
    expect(folded(tight).length).toBeGreaterThan(0);
    expect(folded(tight).every((id) => !id.startsWith("d"))).toBe(true);
    expect(tight.scrollers[0]!.rect.width).toBeGreaterThanOrEqual(360);
  });

  it("leaves no void: children that don't fill the strip share out its width", () => {
    const r = place(toLayout(strip(2)));
    expect(rect(r, "d1").width + rect(r, "d2").width + 6).toBeCloseTo(1440);
    expect(r.scrollers[0]!.contentWidth).toBeCloseTo(1440);
  });

  it("a column in a strip is one child: its panes stack down it at the column's width", () => {
    const layout = toLayout(
      row(
        { id: "strip", scroll: "x" },
        day(1),
        column({ id: "c" }, day(2), day(3)),
        day(4),
        day(5),
        day(6),
      ),
    );
    const r = place(layout);
    expect(rect(r, "d2")).toMatchObject({ x: 366, width: 360 });
    expect(rect(r, "d3")).toMatchObject({ x: 366, width: 360 });
    expect(rect(r, "d3").y).toBeGreaterThan(rect(r, "d2").y);
    expect(rect(r, "d4").x).toBe(2 * 366);
  });

  it("a divider in a strip widens one child and lengthens the strip; the next keeps its width", () => {
    const layout = toLayout(strip(7));
    const before = place(layout);
    const divider = before.dividers.find((d) => d.parentId === "strip" && d.index === 0)!;
    expect(divider.max).toBe(Infinity);
    expect(divider.min).toBe(300);
    const wider = core.resizeDivider(layout, "strip", 0, 100, ctx());
    const after = place(wider);
    expect(rect(after, "d1").width).toBe(460);
    expect(rect(after, "d2").width).toBe(360);
    expect(after.scrollers[0]!.contentWidth).toBe(before.scrollers[0]!.contentWidth + 100);
    // Narrower stops at the child's minimum.
    const narrow = place(core.resizeDivider(layout, "strip", 0, -500, ctx()));
    expect(rect(narrow, "d1").width).toBe(300);
  });

  it("a divider beside a strip shares out its window with the pane beside it; the days keep their width", () => {
    const layout = toLayout(
      row(
        { id: "outer" },
        paneOf({ kind: "list", params: {} }, { id: "overview" }),
        strip(7),
        paneOf({ kind: "map", params: {} }, { id: "map" }),
      ),
    );
    const before = place(layout);
    const window0 = before.scrollers[0]!.rect.width;
    const overview0 = rect(before, "overview").width;
    const map0 = rect(before, "map").width;
    const divider = before.dividers.find((d) => d.parentId === "outer" && d.index === 0)!;
    expect(divider.value).toBeCloseTo(overview0);
    // Its max leaves the strip one whole day: the strip's own minimum.
    expect(divider.max).toBeCloseTo(overview0 + window0 - 360);
    const after = place(core.resizeDivider(layout, "outer", 0, 60, ctx()));
    expect(rect(after, "overview").width).toBeCloseTo(overview0 + 60);
    expect(after.scrollers[0]!.rect.width).toBeCloseTo(window0 - 60);
    expect(rect(after, "map").width).toBeCloseTo(map0);
    expect(rect(after, "d1").width).toBe(360);
    // And the other way, on the map's side.
    const wider = place(core.resizeDivider(layout, "outer", 1, -80, ctx()));
    expect(wider.scrollers[0]!.rect.width).toBeCloseTo(window0 - 80);
    expect(rect(wider, "map").width).toBeCloseTo(map0 + 80);
    expect(rect(wider, "overview").width).toBeCloseTo(overview0);
  });

  it("right to left, a strip starts at its right edge", () => {
    const r = place(toLayout(strip(7)), ctx(1440, 900, 10, "rtl"));
    const s = r.scrollers[0]!;
    // The first day is the last in the content, at its right end; the last day is at its left start.
    expect(rect(r, "d1").x + 360).toBeCloseTo(s.rect.x + s.contentWidth);
    expect(rect(r, "d7").x).toBeCloseTo(s.rect.x);
  });

  it("goes through a link and back", () => {
    const layout = toLayout(
      row(paneOf({ kind: "list", params: {} }, { id: "overview" }), strip(3)),
    );
    const again = decode(encode(layout), kinds)!;
    expect(again).not.toBeNull();
    expect((again.root as { children: { scroll?: string }[] }).children[1]!.scroll).toBe("x");
  });

  it("a link with a scrolling column, or an unknown scroll, is refused", () => {
    const bad = toLayout(column({ id: "c" }, day(1), day(2)));
    (bad.root as { scroll?: string }).scroll = "x";
    expect(decode(encode(bad), kinds)).toBeNull();
    const odd = toLayout(strip(2));
    (odd.root as { scroll?: string }).scroll = "y";
    expect(decode(encode(odd), kinds)).toBeNull();
  });
});

describe("a strip at a scroll position", () => {
  const r = place(toLayout(strip(7)));
  const s = r.scrollers[0]!;

  it("moves its panes and dividers by the offset, and cuts them to its window", () => {
    const at = scrolled(r, { strip: 400 });
    expect(rect(at, "d2").x).toBe(366 - 400);
    expect(at.panes.find((p) => p.id === "d2")!.clip).toEqual(s.rect);
    const d = at.dividers.find((x) => x.parentId === "strip" && x.index === 0)!;
    expect(d.rect.x).toBe(360 - 400);
    expect(d.clip).toEqual(s.rect);
  });

  it("keeps the offset within the content", () => {
    expect(rect(scrolled(r, { strip: -50 }), "d1").x).toBe(0);
    const end = s.contentWidth - s.rect.width;
    expect(rect(scrolled(r, { strip: 1e6 }), "d7").x).toBe(6 * 366 - end);
  });

  it("right to left, an offset moves the content right", () => {
    const rtl = place(toLayout(strip(7)), ctx(1440, 900, 10, "rtl"));
    expect(rect(scrolled(rtl, { strip: 100 }, "rtl"), "d1").x).toBe(rect(rtl, "d1").x + 100);
  });

  it("scrolls the least that shows a pane whole, and not at all when it shows", () => {
    expect(offsetToShow(s, rect(r, "d2"), 0)).toBe(0);
    // Day 5 ends at 5 * 366 - 6 = 1824: scroll until its end meets the window's.
    expect(offsetToShow(s, rect(r, "d5"), 0)).toBe(1824 - 1440);
    // Back to day 1 from far along: its start.
    expect(offsetToShow(s, rect(r, "d1"), 900)).toBe(0);
    const rtl = place(toLayout(strip(7)), ctx(1440, 900, 10, "rtl")).scrollers[0]!;
    const rr = place(toLayout(strip(7)), ctx(1440, 900, 10, "rtl"));
    expect(offsetToShow(rtl, rect(rr, "d5"), 0, "rtl")).toBe(1824 - 1440);
  });
});
