import { describe, expect, it } from "vitest";
import * as core from "..";
import { chain, chainFit, context, freeze, view } from "./fixtures";
import type { Layout, PaneNode, ResolvedLayout } from "../types";

const ctx = context(chainFit(1600));
const geometry = (r: ResolvedLayout) => r.panes.filter(b => !b.hidden).map(b => `${b.id}:${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`).sort();
const order = (id: number) => ({ kind: "record", params: { table: "orders", id } });
const node = (l: Layout, id: string) => core.tree.find(l.root, id) as PaneNode;
/** orders (table) → order 1 (follows) → customer 1 (a plain link from the record). */
const following = (): Layout => {
  const l = chain();
  return { ...l, root: core.tree.map(l.root, n => n.id === "order" && n.type === "pane" ? { ...n, follows: true } : n) };
};

describe("follow: a linked detail shows its list's selection", () => {
  it("finds the follower by source and kind", () => {
    const l = following();
    expect(core.follower(l, "orders", "record")?.id).toBe("order");
    expect(core.follower(l, "orders", "table")).toBeUndefined();
    // customer is linked to order but was not opened from a selection: it does not follow.
    expect(core.follower(l, "order", "record")).toBeUndefined();
  });

  it("replaces the follower's object in place: same id, same rects, nothing else changes", () => {
    const l = freeze(core.refit(following(), view("orders"), ctx));
    const before = core.resolve(l, view("orders"), ctx);
    const r = core.follow(l, view("orders"), "orders", order(7), ctx);
    expect(r.pane).toBe("order");
    expect(node(r.layout, "order").ref).toEqual(order(7));
    expect(node(r.layout, "order").follows).toBe(true);
    expect(geometry(core.resolve(r.layout, view("orders"), ctx))).toEqual(geometry(before));
  });

  it("is a no-op (same object) with no follower, a pinned detail, or the same object", () => {
    const l = core.refit(following(), view("orders"), ctx);
    expect(core.follow(l, view("orders"), "orders", order(1), ctx).layout).toBe(l);
    expect(core.follow(l, view("orders"), "order", order(3), ctx).layout).toBe(l);
    const pinned = core.setFollows(l, "order", false);
    expect(core.follow(pinned, view("orders"), "orders", order(3), ctx).layout).toBe(pinned);
  });
});

describe("setFollows: the Pin control", () => {
  it("pinning stops following and marks the pane pinned; unpinning resumes", () => {
    const l = following();
    const pinned = core.setFollows(l, "order", false);
    expect(node(pinned, "order")).toMatchObject({ pinned: true });
    expect(node(pinned, "order").follows).toBeUndefined();
    const back = core.setFollows(pinned, "order", true);
    expect(node(back, "order")).toMatchObject({ follows: true });
    expect(node(back, "order").pinned).toBeUndefined();
  });

  it("one follower per source and kind: unpinning one pins the other", () => {
    const l = following();
    const second: PaneNode = { id: "compare", type: "pane", size: { weight: 1 }, ref: order(4), linkedTo: "orders", pinned: true };
    const withCompare: Layout = { ...l, root: { ...l.root, children: [...(l.root as { children: PaneNode[] }).children, second] } as Layout["root"] };
    const r = core.setFollows(withCompare, "compare", true);
    expect(core.follower(r, "orders", "record")?.id).toBe("compare");
    expect(node(r, "order")).toMatchObject({ pinned: true });
    expect(node(r, "order").follows).toBeUndefined();
  });

  it("does nothing for an unlinked pane or an unchanged state", () => {
    const l = following();
    expect(core.setFollows(l, "orders", true)).toBe(l);
    expect(core.setFollows(l, "order", true)).toBe(l);
  });
});

describe("open from a selection", () => {
  it("opens a follower when the source has none", () => {
    const l = core.refit(chain(), view("orders"), ctx);
    const unlinked = { ...l, root: core.tree.map(l.root, n => n.id === "order" && n.type === "pane" ? { ...n, linkedTo: undefined } : n) };
    const r = core.openBeside(unlinked, view("orders"), "orders", order(5), ctx, undefined, { fromSelection: true });
    expect(r.mode).not.toBe("replaced");
    expect(node(r.layout, r.opened)).toMatchObject({ linkedTo: "orders", follows: true });
  });

  it("with a follower on screen, opens a second, pinned detail (compare) and leaves the follower alone", () => {
    const l = core.refit(following(), view("orders"), ctx);
    const r = core.openBeside(l, view("orders"), "orders", order(5), ctx, undefined, { fromSelection: true });
    expect(r.opened).not.toBe("order");
    expect(node(r.layout, r.opened)).toMatchObject({ linkedTo: "orders", pinned: true });
    expect(node(r.layout, r.opened).follows).toBeUndefined();
    expect(node(r.layout, "order").ref).toEqual(order(1));
    expect(core.follower(r.layout, "orders", "record")?.id).toBe("order");
  });

  it("a plain link never replaces a follower (an FK link from the list opens its own pane)", () => {
    const l = core.refit(following(), view("orders"), ctx);
    const customer = { kind: "record", params: { table: "customers", id: 9 } };
    const r = core.openBeside(l, view("orders"), "orders", customer, ctx);
    expect(r.mode).not.toBe("replaced");
    expect(node(r.layout, "order").ref).toEqual(order(1));
    expect(node(r.layout, r.opened).follows).toBeUndefined();
  });
});

describe("closing the list unlinks its detail", () => {
  it("drops linkedTo and follows", () => {
    const l = core.refit(following(), view("orders"), ctx);
    const r = core.close(l, view("orders"), "orders", ctx);
    const o = node(r.layout, "order");
    expect(o.linkedTo).toBeUndefined();
    expect(o.follows).toBeUndefined();
  });
});

describe("codec", () => {
  it("round-trips follows", () => {
    const l = following();
    const back = core.decode(core.encode(l), chainFit(1600).kinds)!;
    expect(node(back, "order").follows).toBe(true);
  });
});
