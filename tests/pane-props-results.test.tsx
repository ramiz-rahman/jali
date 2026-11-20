/**
 * A pane's `openBeside`, `openHere`, `peek` and `select` return what `jali.actions` returns (`ActionResult`), in a
 * pane and in the peek sheet.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type ActionResult,
} from "@jali/core";
import { JaliRoot, definePane, type PaneProps } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const props: Record<string, PaneProps> = {};
const keep = (key: string) => (p: PaneProps) => {
  props[key] = p;
  return null;
};
const list = definePane("orders", { title: "Orders", Component: keep("list") });
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: (p) => keep(p.inPeek ? "peek" : `order-${p.params.id}`)(p as PaneProps),
});

function mount() {
  const jali = createJali({
    panes: [list, order],
    layout: row(pane(list(), { id: "orders" }), pane(order({ id: 1 }), { id: "order" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1400, height: 700 },
    moveFocus: false,
  });
  render(<JaliRoot jali={jali} />);
  return jali;
}

describe("a pane's actions return results", () => {
  it("openBeside gives the pane that shows the ref", () => {
    const jali = mount();
    let r: ActionResult | undefined;
    act(() => {
      r = props.list!.openBeside(order({ id: 5 }));
    });
    expect(r?.ok).toBe(true);
    expect(jali.model().pane(r!.pane!)?.ref).toEqual(order({ id: 5 }));
  });

  it("openBeside takes an edge, as jali.actions.openBeside does", () => {
    const jali = mount();
    let r: ActionResult | undefined;
    act(() => {
      r = props["order-1"]!.openBeside(order({ id: 6 }), { edge: "bottom" });
    });
    expect(r?.ok).toBe(true);
    const parent = jali.model().layout.root;
    const column =
      parent.type === "pane" ? undefined : parent.children.find((c) => c.type === "column");
    expect(column?.type === "column" && column.children.map((c) => c.id)).toEqual([
      "order",
      r!.pane,
    ]);
  });

  it("openHere, select and peek give their results too", () => {
    const jali = mount();
    let r: ActionResult | undefined;
    act(() => {
      r = props["order-1"]!.openHere(order({ id: 2 }));
    });
    expect(r).toEqual({ ok: true, pane: "order" });
    act(() => {
      r = props.list!.select(order({ id: 3 }));
    });
    expect(r).toEqual({ ok: true, pane: "orders" });
    act(() => {
      r = props.list!.peek(order({ id: 4 }));
    });
    expect(r?.ok).toBe(true);
    expect(jali.get().view.peek).toEqual(order({ id: 4 }));
    act(() => {
      r = props.list!.peek(null);
    });
    expect(r?.ok).toBe(true);
    expect(jali.get().view.peek).toBeUndefined();
  });

  it("in the peek sheet, openHere has no pane to show it in", () => {
    const jali = mount();
    act(() => {
      jali.actions.peek("orders", order({ id: 7 }));
    });
    let r: ActionResult | undefined;
    act(() => {
      r = props.peek!.openHere(order({ id: 8 }));
    });
    expect(r).toEqual({ ok: false, reason: "unavailable" });
    act(() => {
      r = props.peek!.openBeside(order({ id: 8 }));
    });
    expect(r?.ok).toBe(true);
  });
});
