/**
 * openBeside in a free workspace (19 Nov 2026): a link never copies a pane of its own chain, other chains may show
 * the same object, and Keep works on a plain link too.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";

const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const customer = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const make = (...panes: ReturnType<typeof pane>[]) =>
  createJali({
    panes: [order, customer],
    layout: row(...panes),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 2400, height: 800 },
    moveFocus: false,
  });
const shown = (jali: ReturnType<typeof make>) =>
  jali.model().panes.map((p) => `${p.ref.kind} ${p.ref.params.id}`);
const said = (jali: ReturnType<typeof make>) => storeOf(jali).get().announcement.text;

describe("a link in a chain", () => {
  it("to the pane it is in shows that pane", () => {
    const jali = make(pane(customer({ id: 7 }), { id: "c" }));
    expect(jali.actions.openBeside("c", customer({ id: 7 }))).toEqual({ ok: true, pane: "c" });
    expect(shown(jali)).toEqual(["customer 7"]);
    expect(said(jali)).toBe("Already open: Customer 7");
  });

  it("back to a pane up the chain shows that pane, and focus stays", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o" }));
    const c = jali.actions.openBeside("o", customer({ id: 7 })).pane!;
    jali.actions.focus(c);
    expect(jali.actions.openBeside(c, order({ id: 1 }))).toEqual({ ok: true, pane: "o" });
    expect(shown(jali)).toEqual(["order 1", "customer 7"]);
    expect(jali.get().view.focused).toBe(c);
  });

  it("to what its own link already shows says so, rather than 'opened'", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o" }));
    const first = jali.actions.openBeside("o", customer({ id: 7 })).pane;
    expect(jali.actions.openBeside("o", customer({ id: 7 })).pane).toBe(first);
    expect(said(jali)).toBe("Already open: Customer 7");
    expect(shown(jali)).toEqual(["order 1", "customer 7"]);
  });

  it("from another chain may show the same object again", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o1" }), pane(order({ id: 2 }), { id: "o2" }));
    jali.actions.openBeside("o1", customer({ id: 7 }));
    jali.actions.openBeside("o2", customer({ id: 7 }));
    expect(shown(jali).filter((s) => s === "customer 7")).toHaveLength(2);
  });
});

describe("Keep on a plain link", () => {
  it("stops the next link replacing it: that one opens beside", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o" }));
    const c7 = jali.actions.openBeside("o", customer({ id: 7 })).pane!;
    expect(jali.actions.setKept(c7, true)).toMatchObject({ ok: true });
    expect(said(jali)).toBe("Customer 7 kept: it stays on this item");
    jali.actions.openBeside("o", customer({ id: 8 }));
    expect(shown(jali).sort()).toEqual(["customer 7", "customer 8", "order 1"]);
  });

  it("let go, goes back to being replaced, and does not start following", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o" }));
    const c7 = jali.actions.openBeside("o", customer({ id: 7 })).pane!;
    jali.actions.setKept(c7, true);
    jali.actions.setKept(c7, false);
    expect(said(jali)).toBe("Customer 7 is no longer kept");
    expect(jali.model().pane(c7)).not.toHaveProperty("follows");
    jali.actions.openBeside("o", customer({ id: 8 }));
    expect(shown(jali)).toEqual(["order 1", "customer 8"]);
  });

  it("is refused on a pane with no link", () => {
    const jali = make(pane(order({ id: 1 }), { id: "o" }));
    expect(jali.actions.setKept("o", true)).toMatchObject({ ok: false, reason: "nothing-to-do" });
  });
});
