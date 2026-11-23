/**
 * A pane's own state and a list's selection belong to the object the pane showed, not to its id alone
 * (QUALITY-REVIEW P13): ids are reused after a close, come back with an undo, and name other objects after a reload.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type LayoutInput } from "@jali/core";
import { paneStateFor, savePaneState, storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const orders = definePane("orders", {
  params: { region: String },
  title: ({ region }) => `Orders ${region}`,
  selects: "order",
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: () => null,
});

const make = (layout: LayoutInput, storage = memoryStorage()) =>
  storeOf(
    createJali({
      panes: [orders, order],
      layout,
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage,
      size: { width: 1600, height: 800 },
      moveFocus: false,
    }),
  );

/** What usePaneState reads for pane `id`: its state while it shows what it shows now. */
const stateOf = (store: ReturnType<typeof make>, id: string) => {
  const p = store.model().pane(id);
  return p ? paneStateFor(store.get(), store.env.kinds, id, p.ref) : undefined;
};

describe("pane state is the object's, not the id's", () => {
  it("after a reload, a pane under the same id that shows another object starts afresh", () => {
    const storage = memoryStorage();
    const before = make(row(pane(order({ id: 1 }), { id: "a" })), storage);
    before.actions.setPaneState("a", "scroll", 240);
    savePaneState(storage, before.get().paneState, before.get().paneStateOf);
    // The same object again: its state is back.
    expect(stateOf(make(row(pane(order({ id: 1 }), { id: "a" })), storage), "a")).toEqual({
      scroll: 240,
    });
    // Another object under the same id: nothing, and nothing kept for it.
    const after = make(row(pane(order({ id: 2 }), { id: "a" })), storage);
    expect(stateOf(after, "a")).toBeUndefined();
    expect(after.get().paneState.a).toBeUndefined();
  });

  it("a new pane under a closed pane's id doesn't read its state; an undo brings the state back with the pane", () => {
    const store = make(
      row(
        pane(orders({ region: "north" }), { id: "pane-1" }),
        pane(order({ id: 1 }), { id: "pane-2" }),
      ),
    );
    store.actions.setPaneState("pane-2", "scroll", 240);
    store.actions.close("pane-2");
    const opened = store.actions.openBeside("pane-1", order({ id: 9 }));
    expect(opened.pane).toBe("pane-2");
    expect(stateOf(store, "pane-2")).toBeUndefined();
    // Writing it starts the new object's own state.
    store.actions.setPaneState("pane-2", "sort", "date");
    expect(stateOf(store, "pane-2")).toEqual({ sort: "date" });
  });

  it("is kept while an undo could bring its pane back, and comes back with it", () => {
    const store = make(
      row(
        pane(orders({ region: "north" }), { id: "pane-1" }),
        pane(order({ id: 1 }), { id: "pane-2" }),
      ),
    );
    store.actions.setPaneState("pane-2", "scroll", 240);
    store.actions.close("pane-2");
    store.actions.undo();
    expect(stateOf(store, "pane-2")).toEqual({ scroll: 240 });
  });

  it("A, then B under the same id, then Undo: A comes back under a new id with its own state, and B keeps its own (codex CORE-1)", () => {
    const store = make(
      row(
        pane(orders({ region: "north" }), { id: "pane-1" }),
        pane(order({ id: 1 }), { id: "pane-2" }),
      ),
    );
    store.actions.setPaneState("pane-2", "scroll", 240);
    store.actions.close("pane-2");
    expect(store.actions.openBeside("pane-1", order({ id: 9 })).pane).toBe("pane-2");
    store.actions.setPaneState("pane-2", "sort", "date");
    store.actions.undo();
    // Undo reverses the close: B, opened since, stays.
    expect(store.model().pane("pane-2")?.ref).toEqual(order({ id: 9 }));
    expect(stateOf(store, "pane-2")).toEqual({ sort: "date" });
    const a = store.model().panes.find((p) => p.ref.params.id === 1)!;
    expect(a.id).not.toBe("pane-2");
    expect(stateOf(store, a.id)).toEqual({ scroll: 240 });
  });

  it("Discard forgets the discarded pane's own state too, so an undo doesn't bring the draft back", () => {
    const store = make(
      row(
        pane(orders({ region: "north" }), { id: "pane-1" }),
        pane(order({ id: 1 }), { id: "pane-2" }),
      ),
    );
    store.actions.setPaneState("pane-2", "draft", "Half a reply");
    store.actions.setUnsaved("pane-2", "a draft reply");
    store.actions.close("pane-2");
    expect(store.get().confirm?.panes).toEqual(["pane-2"]);
    store.actions.discardAndContinue();
    expect(store.model().pane("pane-2")).toBeUndefined();
    store.actions.undo();
    expect(store.model().pane("pane-2")).toBeDefined();
    expect(stateOf(store, "pane-2")).toBeUndefined();
  });
});

describe("a list's selection is the list's, not the id's", () => {
  it("a new list under a closed list's id doesn't start on its selection", () => {
    const store = make(
      row(
        pane(order({ id: 1 }), { id: "detail" }),
        pane(orders({ region: "north" }), { id: "pane-1" }),
      ),
    );
    store.actions.select("pane-1", order({ id: 3 }));
    expect(store.get().selection["pane-1"]?.ref).toEqual(order({ id: 3 }));
    store.actions.close("pane-1");
    const opened = store.actions.openBeside("detail", orders({ region: "south" }));
    expect(opened.pane).toBe("pane-1");
    expect(store.get().selection["pane-1"]).toBeUndefined();
  });

  it("a layout that puts another list under the same id doesn't carry the selection over", () => {
    const store = make(
      row(
        pane(order({ id: 1 }), { id: "detail" }),
        pane(orders({ region: "north" }), { id: "list" }),
      ),
    );
    store.actions.select("list", order({ id: 3 }));
    store.jali.setLayout(
      row(
        pane(order({ id: 1 }), { id: "detail" }),
        pane(orders({ region: "south" }), { id: "list" }),
      ),
    );
    expect(store.get().selection.list).toBeUndefined();
    // The same list in a new layout keeps it.
    store.actions.select("list", order({ id: 4 }));
    store.jali.setLayout(
      row(
        pane(orders({ region: "south" }), { id: "list" }),
        pane(order({ id: 1 }), { id: "detail" }),
      ),
    );
    expect(store.get().selection.list?.ref).toEqual(order({ id: 4 }));
  });

  it("an undo that brings the same list back keeps its selection", () => {
    const store = make(
      row(
        pane(order({ id: 1 }), { id: "detail" }),
        pane(orders({ region: "north" }), { id: "pane-1" }),
      ),
    );
    store.actions.select("pane-1", order({ id: 3 }));
    store.actions.close("pane-1");
    store.actions.undo();
    expect(store.get().selection["pane-1"]?.ref).toEqual(order({ id: 3 }));
  });
});
