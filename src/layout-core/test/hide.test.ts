import { describe, expect, it } from "vitest";
import * as core from "../index";
import { context, fit, freeze, pane, view } from "./fixtures";
import type { Layout, LayoutNode, ResolvedLayout } from "../types";

const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(`refused: ${JSON.stringify(r)}`); return r as Extract<T, { ok: true }>; };
const shown = (r: ResolvedLayout) => r.panes.filter(b => !b.hidden).map(b => b.id);
const rect = (r: ResolvedLayout, id: string) => r.panes.find(b => b.id === id)!.rect;
const row = (...children: LayoutNode[]): Layout => ({ version: 1, root: { id: "root", type: "row", size: { weight: 1 }, children } });
const col = (id: string, ...children: LayoutNode[]): LayoutNode => ({ id, type: "column", size: { weight: 1 }, children });

/** A designed review arrangement: queue, application (primary), and a supporting column. */
const review = (): Layout => row(
  pane("queue", "list", { size: { px: 320 }, role: "queue", priority: "supporting" }),
  pane("app", "record", { role: "application", priority: "primary" }),
  col("side", pane("borrower", "inspector", { role: "borrower", priority: "supporting" }), pane("history", "inspector", { role: "history", priority: "supporting" })),
);

describe("hide and show", () => {
  it("hide takes a pane off screen with no tab; the tree is untouched; neighbours absorb the space", () => {
    const ctx = context(fit(1920, 900)), tree = freeze(core.refit(review(), view("app"), ctx));
    const before = core.resolve(tree, view("app"), ctx);
    const h = ok(core.hide(tree, view("app"), "queue", ctx));
    expect(h.layout.root).toBe(tree.root);
    expect(h.layout.overlay?.hidden).toEqual(["queue"]);
    const after = core.resolve(h.layout, h.view, ctx);
    expect(shown(after)).toEqual(["app", "borrower", "history"]);
    expect(after.panes.find(b => b.id === "queue")).toMatchObject({ hidden: "off", rect: { width: 0, height: 0 } });
    expect(after.shelf).toEqual([]);
    expect(after.stacks).toEqual([]);
    expect(rect(after, "app").x).toBe(0);
    expect(rect(after, "app").width + rect(after, "borrower").width).toBeGreaterThan(rect(before, "app").width + rect(before, "borrower").width);
  });

  it("hiding both panes of a column removes the column; showing one brings back only that one", () => {
    const ctx = context(fit(1920, 900));
    let l = core.refit(review(), view("app"), ctx);
    l = ok(core.hide(l, view("app"), "borrower", ctx)).layout;
    l = ok(core.hide(l, view("app"), "history", ctx)).layout;
    expect(shown(core.resolve(l, view("app"), ctx))).toEqual(["queue", "app"]);
    const s = ok(core.show(l, view("app"), "history", ctx));
    expect(s.view.focused).toBe("history");
    expect(shown(core.resolve(s.layout, s.view, ctx))).toEqual(["queue", "app", "history"]);
    expect(s.layout.overlay?.hidden).toEqual(["borrower"]);
  });

  it("show after hide restores the exact geometry", () => {
    const ctx = context(fit(1920, 900)), tree = core.refit(review(), view("app"), ctx);
    const before = core.resolve(tree, view("app"), ctx);
    const h = ok(core.hide(tree, view("app"), "borrower", ctx));
    const s = ok(core.show(h.layout, h.view, "borrower", ctx));
    expect(s.layout.overlay).toBeUndefined();
    const after = core.resolve(s.layout, s.view, ctx);
    for (const b of before.panes) expect(rect(after, b.id)).toEqual(b.rect);
  });

  it("refuses the last pane on screen, a tab of a stack, and a pane already hidden; focus leaves a hidden pane", () => {
    const ctx = context(fit(1920, 900));
    const one = row(pane("a", "record"), pane("b", "record"));
    const h = ok(core.hide(one, view("a"), "a", ctx));
    expect(h.view.focused).toBe("b");
    expect(core.hide(h.layout, h.view, "b", ctx)).toEqual({ ok: false, reason: "last" });
    expect(core.hide(h.layout, h.view, "a", ctx)).toEqual({ ok: false, reason: "hidden" });
    const stacked: Layout = row(pane("x", "record"), { id: "s", type: "stack", size: { weight: 1 }, origin: "user", active: "y", children: [pane("y", "record"), pane("z", "record")] });
    expect(core.hide(stacked, view("x"), "y", ctx)).toEqual({ ok: false, reason: "tab" });
  });

  it("round-trips through the codec with roles, priority and hidden", () => {
    const ctx = context(fit(1920, 900));
    const l = ok(core.hide(core.refit(review(), view("app"), ctx), view("app"), "history", ctx)).layout;
    const decoded = core.decode(core.encode(l), fit().kinds);
    expect(decoded).toEqual(l);
    const bad = structuredClone(l); bad.overlay!.hidden = ["history", "history"];
    expect(core.validate(bad, fit().kinds).ok).toBe(false);
    const badRole = structuredClone(l); (core.tree.find(badRole.root, "app") as { priority?: string }).priority = "vip";
    expect(core.validate(badRole, fit().kinds).ok).toBe(false);
  });
});

describe("arrangement priority", () => {
  it("with no room for an opened pane, supporting panes fold first and the opened pane stays on screen", () => {
    const ctx = context(fit(1440, 900));
    const tree = core.refit(review(), view("borrower"), ctx);
    expect(shown(core.resolve(tree, view("borrower"), ctx))).toEqual(["queue", "app", "borrower", "history"]);
    const r = core.openBeside(tree, view("borrower"), "borrower", { kind: "record", params: { id: 9 } }, ctx, { target: "side", edge: "right" });
    expect(r.mode).toBe("beside");
    const after = core.resolve(r.layout, r.view, ctx);
    const visible = shown(after);
    // Only the queue gives way (it frees width); history in the column would not, so it stays.
    expect(visible).toEqual(["app", "borrower", "history", r.opened]);
    expect(after.shelf.map(e => [e.paneId, e.reason])).toEqual([["queue", "folded"]]);
    // Placed after the arrangement, not beside its source.
    expect(rect(after, r.opened).x).toBeGreaterThan(rect(after, "borrower").x);
    expect(core.tree.find(r.layout.root, r.opened)).toMatchObject({ linkedTo: "borrower" });
  });

  it("when giving way cannot make room, nothing yields and the opened pane becomes a tab as before", () => {
    const ctx = context(fit(1100, 900));
    const tree = core.refit(row(pane("q", "small", { priority: "supporting" }), pane("app", "record", { priority: "primary" }), pane("src", "record")), view("src"), ctx);
    const r = core.openBeside(tree, view("src"), "src", { kind: "record", params: { id: 1 } }, ctx);
    expect(r.mode).toBe("tab");
    expect(r.layout.overlay?.folds).toEqual([r.opened]);
  });

  it("the primary pane is the last to fold, after supporting and ordinary panes", () => {
    const ctx = context(fit(1000, 900));
    const tree = core.refit(row(pane("q", "list", { priority: "supporting" }), pane("app", "record", { priority: "primary" }), pane("other", "record")), view("q"), ctx);
    const visible = shown(core.resolve(tree, view("q"), ctx));
    expect(visible).toContain("app");
    expect(visible).not.toContain("other");
  });

  it("panes without priority fold exactly as before", () => {
    const ctx = context(fit(1000, 900));
    const plain = core.refit(row(pane("a", "record"), pane("b", "record"), pane("c", "record")), view("a"), ctx);
    expect(plain.overlay?.hidden).toBeUndefined();
    expect(shown(core.resolve(plain, view("a"), ctx))).toHaveLength(2);
  });
});
