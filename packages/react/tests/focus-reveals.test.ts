/**
 * `jali.actions.focus(pane)` shows the pane: one behind a tab (a tab group, a fold, a tuck) has its tab chosen, and
 * nothing else on screen moves (a swap, docs/DECISIONS.md "layout stability"). `reveal` is no longer public: focus
 * does its job.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { geometryOf } from "../../core/src/state/apply";
import { stabilityBreaches } from "../../core/tests/fixtures/stability";
import { defaultFeatures, urlSync } from "./features";

const Nothing = () => null;
const list = definePane("orders", { title: "Orders", width: { min: 300 }, Component: Nothing });
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 400 },
  Component: Nothing,
});
const breaches = stabilityBreaches();
const make = (layout: Parameters<typeof createJali>[0]["layout"], width = 1400) => {
  breaches.length = 0;
  const jali = createJali({
    panes: [list, order],
    layout,
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width, height: 800 },
    moveFocus: false,
  });
  return { jali, breaches };
};
const visible = (jali: ReturnType<typeof make>["jali"], id: string) =>
  storeOf(jali)
    .model()
    .resolved.panes.some((b) => b.id === id && !b.hidden);

describe("focus shows the pane", () => {
  it("chooses the tab of a pane behind another tab, and nothing else moves", () => {
    const { jali, breaches } = make(
      row(
        pane(list(), { id: "orders" }),
        tabs(pane(order({ id: 1 }), { id: "a" }), pane(order({ id: 2 }), { id: "b" })),
      ),
    );
    expect(visible(jali, "b")).toBe(false);
    const before = geometryOf(storeOf(jali).model());
    const r = jali.actions.focus("b");
    expect(r).toEqual({ ok: true, pane: "b" });
    expect(visible(jali, "b")).toBe(true);
    expect(jali.get().view.focused).toBe("b");
    expect(geometryOf(storeOf(jali).model())).toBe(before);
    expect(breaches).toEqual([]);
    expect(storeOf(jali).get().announcement.text).toMatch(/Order 2/);
  });

  it("shows a pane folded for want of room", () => {
    const { jali, breaches } = make(
      row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 })),
      900,
    );
    const folded = storeOf(jali).model().folded[0]!;
    expect(folded).toBeTruthy();
    jali.actions.focus(folded);
    expect(visible(jali, folded)).toBe(true);
    expect(jali.get().view.focused).toBe(folded);
    expect(breaches).toEqual([]);
  });

  it("takes a ref, as every action does", () => {
    const { jali } = make(
      row(list(), tabs(pane(order({ id: 1 }), { id: "a" }), pane(order({ id: 2 }), { id: "b" }))),
    );
    expect(jali.actions.focus(order({ id: 2 }))).toEqual({ ok: true, pane: "b" });
    expect(visible(jali, "b")).toBe(true);
  });

  it("while another pane is maximised, maximises this one instead", () => {
    const { jali } = make(row(pane(list(), { id: "orders" }), pane(order({ id: 1 }), { id: "a" })));
    jali.actions.toggleZoom("orders");
    jali.actions.focus("a");
    expect(jali.get().view).toMatchObject({ focused: "a", zoomed: "a" });
  });

  it("focusing a pane on screen is a plain focus: nothing changes but focus", () => {
    const { jali } = make(row(pane(list(), { id: "orders" }), pane(order({ id: 1 }), { id: "a" })));
    const layout = jali.getLayout();
    expect(jali.actions.focus("a")).toEqual({ ok: true, pane: "a" });
    expect(jali.getLayout()).toBe(layout);
    expect(jali.actions.focus("a")).toEqual({ ok: true, pane: "a" });
  });

  it("is the only public way to reveal", () => {
    expect("reveal" in make(row(list(), order({ id: 1 }))).jali.actions).toBe(false);
  });
});
