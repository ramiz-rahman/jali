/**
 * Questions that hold a change (docs/QUALITY-REVIEW.md C8, docs/DECISIONS.md 20 Nov 2026): "Discard unsaved
 * changes?" and the host's `beforeClose` hold the action, not the change it computed. The answer runs it again against
 * the state of the moment: made if it still removes or replaces only what was asked about, asked again otherwise.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type JaliOptions } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { close } from "../packages/core/src/actions/close";

const list = definePane("orders", { title: "Orders", Component: () => null });
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 300 },
  Component: () => null,
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [list, order],
    layout: row(list(), order({ id: 1 }), order({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...options,
  });

type J = ReturnType<typeof make>;
const ids = (jali: J) => jali.model().panes.map((p) => p.id);
const shows = (jali: J, pane: string) =>
  jali.model().panes.find((p) => p.id === pane)?.ref.params.id;

describe("Discard unsaved changes?: the answer meets the state of the moment", () => {
  it("keeps what changed elsewhere while the question was open", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setUnsaved("order", "a draft");
    expect(jali.actions.close("order").reason).toBe("unsaved");
    // While the dialog is open, another pane shows another object.
    expect(jali.actions.openHere("order-2", order({ id: 9 })).ok).toBe(true);
    store.actions.discardAndContinue();
    expect(ids(jali)).toEqual(["orders", "order-2"]);
    expect(shows(jali, "order-2")).toBe(9);
    expect(store.get().unsaved).toEqual({});
    expect(store.get().confirm).toBeNull();
  });

  it("asks again when more work is at stake by the answer, and forgets nothing until then", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setUnsaved("order", "a draft");
    expect(jali.actions.closeOthers("orders").reason).toBe("unsaved");
    expect(store.get().confirm?.panes).toEqual(["order"]);
    store.actions.setUnsaved("order-2", "another draft");
    store.actions.discardAndContinue();
    expect(ids(jali)).toEqual(["orders", "order", "order-2"]);
    expect(store.get().confirm?.panes).toEqual(["order", "order-2"]);
    expect(store.get().unsaved).toEqual({ order: "a draft", "order-2": "another draft" });
    store.actions.discardAndContinue();
    expect(ids(jali)).toEqual(["orders"]);
    expect(store.get().unsaved).toEqual({});
  });

  it("does nothing when what it held is gone by the answer", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setUnsaved("order", "a draft");
    expect(jali.actions.openHere("order", order({ id: 5 })).reason).toBe("unsaved");
    // The host closes the object elsewhere meanwhile.
    jali.actions.remove("order");
    const before = jali.getLayout();
    store.actions.discardAndContinue();
    expect(jali.getLayout()).toBe(before);
    expect(jali.model().panes.some((p) => p.ref.params.id === 5)).toBe(false);
    expect(store.get().confirm).toBeNull();
  });

  it("says Discard and what happened, as before", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setUnsaved("order", "a draft");
    jali.actions.close("order");
    const said: string[] = [];
    let seq = store.get().announcement.seq;
    store.subscribe(() => {
      const a = store.get().announcement;
      if (a.seq !== seq) said.push(a.text);
      seq = a.seq;
    });
    store.actions.discardAndContinue();
    expect(said[0]).toMatch(/discarded/i);
    expect(said.at(-1)).toBe("Order 1 closed · Undo available");
  });

  it("holds a sequence's later steps with the held step", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setUnsaved("order", "a draft");
    const before = jali.getLayout();
    const r = store.apply([
      (x) => close(x, "order"),
      { op: "patch", patch: { peekSource: "orders" } },
    ]);
    expect(r.reason).toBe("unsaved");
    expect(jali.getLayout()).toBe(before);
    expect(store.get().peekSource).toBeUndefined();
    store.actions.discardAndContinue();
    expect(ids(jali)).not.toContain("order");
    expect(store.get().peekSource).toBe("orders");
  });
});

describe("beforeClose: a later yes meets the state of the moment", () => {
  it("still closes after the window is resized while the host decides", async () => {
    let answer!: (yes: boolean) => void;
    const jali = make({ beforeClose: () => new Promise<boolean>((r) => (answer = r)) });
    const r = jali.actions.close("order-2");
    expect(r.reason).toBe("pending");
    const before = jali.getLayout();
    storeOf(jali).set({ area: { width: 700, height: 800 } });
    expect(jali.getLayout()).not.toBe(before);
    answer(true);
    expect(await r.settled).toEqual({ ok: true });
    expect(ids(jali)).not.toContain("order-2");
  });

  it("asks again when the pane it asked about shows another object by then", async () => {
    let answer!: (yes: boolean) => void;
    const asked: unknown[] = [];
    const jali = make({
      beforeClose: (request) => {
        asked.push(request);
        return asked.length === 1 ? new Promise<boolean>((r) => (answer = r)) : true;
      },
    });
    const r = jali.actions.close("order-2");
    expect(jali.actions.openHere("order-2", order({ id: 9 })).ok).toBe(true);
    answer(true);
    expect(await r.settled).toEqual({ ok: true });
    expect(asked.at(-1)).toEqual({
      panes: [{ pane: "order-2", ref: order({ id: 9 }) }],
      reason: "close",
    });
    expect(asked).toHaveLength(3);
    expect(ids(jali)).not.toContain("order-2");
  });

  it("after a later yes and Discard, the host is not asked again", async () => {
    let calls = 0;
    const jali = make({ beforeClose: () => (calls++, Promise.resolve(true)) });
    const store = storeOf(jali);
    store.actions.setUnsaved("order-2", "a draft");
    const r = jali.actions.close("order-2");
    expect(await r.settled).toEqual({ ok: false, reason: "unsaved" });
    store.set({ area: { width: 1300, height: 800 } });
    store.actions.discardAndContinue();
    expect(calls).toBe(1);
    expect(ids(jali)).not.toContain("order-2");
  });
});

/** Let held answers settle (they resolve through promises). */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("Back and Forward keep their navigation with the question (C9)", () => {
  /** A workspace with history: the first address, then one pane opened (with unsaved work), then another. */
  function history(options: Partial<JaliOptions> = {}) {
    const location = memoryLocation();
    const jali = make({ url: { location }, ...options });
    const stop = jali.start();
    const first = location.search();
    const seven = jali.actions.openBeside("orders", order({ id: 7 })).pane!;
    const second = location.search();
    storeOf(jali).actions.setUnsaved(seven, "a draft");
    return { jali, store: storeOf(jali), location, stop, first, second, seven };
  }

  it("Keep editing puts the address back on what is on screen", async () => {
    const { jali, store, location, stop, first, second } = history();
    location.visit(first);
    expect(store.get().confirm).not.toBeNull();
    store.actions.keepEditing();
    await settle();
    expect(shows(jali, "order")).toBe(1);
    expect(jali.model().panes.some((p) => p.ref.params.id === 7)).toBe(true);
    expect(location.search()).toBe(second);
    stop();
  });

  it("Discard makes the arrival, and the address stays where Back went", async () => {
    const { jali, store, location, stop, first } = history();
    location.visit(first);
    store.actions.discardAndContinue();
    await settle();
    expect(jali.model().panes.some((p) => p.ref.params.id === 7)).toBe(false);
    expect(location.search()).toBe(first);
    expect(store.get().unsaved).toEqual({});
    stop();
  });

  it("a second Back takes the place of the first while it waits", async () => {
    const { jali, store, location, stop, first, second } = history();
    jali.actions.openBeside("orders", order({ id: 8 }));
    const third = location.search();
    location.visit(second);
    const asked = store.get().confirm;
    expect(asked).not.toBeNull();
    location.visit(first);
    expect(store.get().confirm).not.toBe(asked);
    store.actions.discardAndContinue();
    await settle();
    expect(jali.model().panes.map((p) => p.ref.params.id)).not.toContain(7);
    expect(jali.model().panes.map((p) => p.ref.params.id)).not.toContain(8);
    expect(location.search()).toBe(first);
    expect(third).not.toBe(first);
    stop();
  });

  it("a second Back closes the first one's question when it loses nothing", async () => {
    const { jali, store, location, stop, first, second } = history();
    location.visit(first);
    expect(store.get().confirm).not.toBeNull();
    // Forward again, to what is on screen: nothing is lost, so nothing is asked.
    location.visit(second);
    await settle();
    expect(store.get().confirm).toBeNull();
    expect(jali.model().panes.some((p) => p.ref.params.id === 7)).toBe(true);
    expect(location.search()).toBe(second);
    stop();
  });

  it("an older Back's later yes changes nothing once a newer one came", async () => {
    const answers: ((yes: boolean) => void)[] = [];
    let wait = false;
    const { jali, location, stop, first, second, store, seven } = history({
      beforeClose: () => !wait || new Promise<boolean>((r) => answers.push(r)),
    });
    store.actions.setUnsaved(seven, null);
    expect(jali.actions.openBeside("orders", order({ id: 8 })).ok).toBe(true);
    wait = true;
    location.visit(second);
    location.visit(first);
    expect(answers).toHaveLength(2);
    answers[0]!(true);
    await settle();
    // The older Back (to `second`) would have kept 7: it no longer happens.
    expect(jali.model().panes.map((p) => p.ref.params.id)).toContain(8);
    answers[1]!(true);
    await settle();
    expect(jali.model().panes.map((p) => p.ref.params.id)).not.toContain(7);
    expect(jali.model().panes.map((p) => p.ref.params.id)).not.toContain(8);
    expect(location.search()).toBe(first);
    stop();
  });
});
