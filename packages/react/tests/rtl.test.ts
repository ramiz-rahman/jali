/**
 * Right to left (DECISIONS.md, 19 Nov 2026): the same layout, mirrored on screen. Every left and right a person says
 * (a key, a command, a drop zone, a message) is the screen's; the tree and the link are the same in both directions.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { nearestDivider } from "../../core/src/dividers/resize";
import { zoneFor, zoneRect } from "../../core/src/workspace/dnd";
import { inlineStep } from "../../core/src/dom/direction";
import { encode } from "../../core/src/layout";
import type { Direction } from "../../core/src/layout/types";
import type { UiStore } from "../../core/src/state/store";
import { createTestStore } from "./workspace";

const area = { width: 1600, height: 900 };
const make = (dir: Direction) => {
  const s = createTestStore({ focusPane: null, initial: { area, dir } });
  s.actions.preset("order-chain");
  return s;
};
let store: UiStore;
beforeEach(() => {
  localStorage.clear();
  store = make("rtl");
});
const rect = (id: string, s = store) => s.model().resolved.panes.find((b) => b.id === id)!.rect;
/** Panes on screen from the screen's left. */
const fromLeft = (s = store) =>
  s
    .model()
    .resolved.panes.filter((b) => !b.hidden)
    .sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y)
    .map((b) => b.id);
const said = () => store.get().announcement.text;

describe("right to left: the workspace", () => {
  it("lays the row out from the right, with the same tree and the same link", () => {
    const ltr = make("ltr");
    expect(fromLeft(ltr)).toEqual(["orders", "order", "customer"]);
    expect(fromLeft()).toEqual(["customer", "order", "orders"]);
    expect(store.model().visible).toEqual(["orders", "order", "customer"]);
    expect(encode(store.get().layout)).toBe(encode(ltr.get().layout));
    const w = area.width;
    expect(rect("orders")).toEqual({
      ...rect("orders", ltr),
      x: w - rect("orders", ltr).x - rect("orders", ltr).width,
    });
  });

  it("follows a change of direction without refitting", () => {
    const layout = store.get().layout;
    store.set({ dir: "ltr" });
    expect(fromLeft()).toEqual(["orders", "order", "customer"]);
    expect(store.get().layout).toBe(layout);
  });

  it("F6 and next pane follow reading order: from the right", () => {
    store.actions.focus("orders");
    store.actions.focusCycle(1);
    expect(store.get().view.focused).toBe("order");
    store.actions.focusIndex(1);
    expect(store.get().view.focused).toBe("orders");
  });

  it("focus left goes to the pane on the screen's left", () => {
    store.actions.focus("order");
    store.actions.focusDirection("left");
    expect(store.get().view.focused).toBe("customer");
    store.actions.focusDirection("right");
    store.actions.focusDirection("right");
    expect(store.get().view.focused).toBe("orders");
  });

  it("move left moves the pane left on screen, and says so", () => {
    store.actions.focus("orders");
    store.actions.moveDirection("left");
    expect(fromLeft()).toEqual(["customer", "orders", "order"]);
    expect(said()).toMatch(/moved left/);
  });
});

describe("right to left: drops", () => {
  it("zones are the screen's: the left quarter of a pane is its left edge", () => {
    const r = rect("order");
    expect(zoneFor(r, r.x + 5, r.y + r.height / 2)).toBe("left");
    expect(zoneRect(r, "left")).toEqual({ ...r, width: r.width / 2 });
  });

  it("a drop on a pane's left edge places the dragged pane on its left", () => {
    store.actions.drop("orders", "customer", "left");
    expect(fromLeft()).toEqual(["orders", "customer", "order"]);
    expect(said()).toMatch(/placed left of/);
    store.actions.drop("orders", "order", "right");
    expect(fromLeft()).toEqual(["customer", "order", "orders"]);
  });

  it("dragging a tucked tab out on the side it came from puts it back", () => {
    store.actions.tuck("customer");
    expect(store.model().tuckOf("customer")).toBeTruthy();
    // customer was left of its home (order) on screen: the left edge is where it came from.
    store.actions.drop("customer", "order", "left");
    expect(store.model().tuckOf("customer")).toBeUndefined();
    expect(said()).toMatch(/put back/);
    expect(fromLeft()).toEqual(["customer", "order", "orders"]);
  });
});

describe("right to left: commands that say a side", () => {
  it("Split right opens the new pane on the screen's right", () => {
    store.actions.focus("order");
    store.actions.split(undefined, "right");
    const opened = store.get().view.focused!;
    const order = rect("order");
    expect(rect(opened).x).toBeGreaterThan(order.x);
    expect(said()).toMatch(/right of/);
  });

  it("Move out of tabs puts the tab on the screen's right, as it says", () => {
    store.actions.mergeInto("customer", "order");
    store.actions.unmerge("customer");
    expect(rect("customer").x).toBeGreaterThan(rect("order").x);
  });
});

describe("right to left: keyboard resize", () => {
  it("→ moves the divider right: the pane on the right shrinks", () => {
    store.actions.focus("orders");
    const w = rect("orders").width;
    store.actions.nudgeDivider("orders", true, 16);
    expect(rect("orders").width).toBeCloseTo(w - 16, 6);
    store.actions.nudgeDivider("orders", true, -16);
    expect(rect("orders").width).toBeCloseTo(w, 6);
  });

  it("resize mode picks the divider on the pane's far side, where its row ends (the left)", () => {
    const d = nearestDivider(store.model(), "order", true, true)!;
    expect(d.rect.x + d.rect.width).toBeLessThanOrEqual(rect("order").x + 1);
    const ltr = make("ltr");
    const l = nearestDivider(ltr.model(), "order", true)!;
    expect(l.rect.x).toBeGreaterThanOrEqual(rect("order", ltr).x + rect("order", ltr).width - 1);
  });

  it("left to right is unchanged", () => {
    const ltr = make("ltr");
    const w = rect("orders", ltr).width;
    ltr.actions.nudgeDivider("orders", true, 16);
    expect(rect("orders", ltr).width).toBeCloseTo(w + 16, 6);
  });
});

describe("right to left: arrows along a row", () => {
  it("← is forward right to left, → left to right", () => {
    expect(inlineStep("ArrowLeft", "rtl")).toBe(1);
    expect(inlineStep("ArrowRight", "rtl")).toBe(-1);
    expect(inlineStep("ArrowRight", "ltr")).toBe(1);
    expect(inlineStep("ArrowUp", "rtl")).toBe(0);
  });
});
