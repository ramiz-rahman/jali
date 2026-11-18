import { describe, expect, it } from "vitest";
import * as core from "..";
import { context, fit, pane, view } from "./fixtures";
import type { Layout, LayoutNode, ResolvedLayout } from "../types";

const row = (...children: LayoutNode[]): Layout => ({ version: 1, root: { id: "root", type: "row", size: { weight: 1 }, children } });
const col = (id: string, ...children: LayoutNode[]): LayoutNode => ({ id, type: "column", size: { weight: 1 }, children });
/** What is on screen, by position: the set of rects, whoever fills them. */
const geometry = (r: ResolvedLayout) => r.panes.filter(b => !b.hidden).map(b => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`).sort();
const at = (r: ResolvedLayout, id: string) => r.panes.find(b => b.id === id && !b.hidden)?.rect;

describe("replace", () => {
  it("a hidden pane takes the current pane's exact slot and size; the current pane goes off screen; nothing else moves", () => {
    const ctx = context(fit(1600, 900));
    const l = core.refit({ ...row(pane("a", "record", { size: { weight: 2 } }), col("side", pane("b", "inspector"), pane("c", "inspector")), pane("x", "inspector")), overlay: { tucks: [], folds: [], shown: {}, hidden: ["x"] } }, view("b"), ctx);
    const before = core.resolve(l, view("b"), ctx);
    const r = core.replace(l, view("b"), "b", "x", ctx);
    const after = core.resolve(r.layout, r.view, ctx);
    expect(r.reshaped).toBe(false);
    expect(geometry(after)).toEqual(geometry(before));
    expect(at(after, "x")).toEqual(at(before, "b"));
    expect(at(after, "a")).toEqual(at(before, "a"));
    expect(r.layout.overlay?.hidden).toEqual(["b"]);
    expect(r.view.focused).toBe("x");
    // And back: the original layout's geometry again, with b in its place.
    const back = core.replace(r.layout, r.view, "x", "b", ctx);
    expect(at(core.resolve(back.layout, back.view, ctx), "b")).toEqual(at(before, "b"));
  });

  it("works for a tab of a stack: the incoming pane becomes that tab, shown", () => {
    const ctx = context(fit(1600, 900));
    const stacked: Layout = { ...row(pane("a", "record"), { id: "s", type: "stack", size: { weight: 1 }, origin: "user", active: "y", children: [pane("y", "record"), pane("z", "record")] }, pane("x", "record")), overlay: { tucks: [], folds: [], shown: {}, hidden: ["x"] } };
    const l = core.refit(stacked, view("y"), ctx);
    const before = core.resolve(l, view("y"), ctx);
    const r = core.replace(l, view("y"), "y", "x", ctx);
    const after = core.resolve(r.layout, r.view, ctx);
    expect(geometry(after)).toEqual(geometry(before));
    expect(core.tree.stackOf(r.layout.root, "x")?.active).toBe("x");
    expect(r.layout.overlay?.hidden).toEqual(["y"]);
  });

  it("works inside an automatic fold group: the fold record follows the position", () => {
    const ctx = context(fit(1100, 900));
    const l = core.refit({ ...row(pane("a", "record"), pane("b", "record"), pane("c", "record"), pane("x", "record")), overlay: { tucks: [], folds: [], shown: {}, hidden: ["x"] } }, view("a"), ctx);
    const before = core.resolve(l, view("a"), ctx);
    const folded = before.shelf.filter(e => e.reason === "folded").map(e => e.paneId);
    expect(folded.length).toBeGreaterThan(0);
    const r = core.replace(l, view("a"), folded[0]!, "x", ctx);
    expect(geometry(core.resolve(r.layout, r.view, ctx))).toEqual(geometry(before));
  });

  it("says when the incoming pane could not fit the slot and the layout had to refit", () => {
    const ctx = context(fit(1100, 900));
    const l = core.refit({ ...row(pane("a", "record"), pane("b", "inspector"), pane("w", "wide")), overlay: { tucks: [], folds: [], shown: {}, hidden: ["w"] } }, view("b"), ctx);
    const r = core.replace(l, view("b"), "b", "w", ctx);
    expect(r.reshaped).toBe(true);
  });
});
