/**
 * The pane contract beyond showing an object: unsaved work is never lost without asking, a pane's own state is kept
 * by the workspace, and a pane's commands live and die with it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ObjectRef } from "../src/layout/types";
import { createTestStore } from "./fixtures/workspace";
import { FOLLOW_MS } from "../src/actions/follow";
import { memoryStorage } from "../src/ports";
import { savePaneState } from "../src/state/pane-state";
import type { JaliStore } from "../src/state/store";

let store: JaliStore;
const order = (id: number): ObjectRef => ({ kind: "record", params: { table: "orders", id } });
const ids = () => store.model().panes.map((p) => p.id);
const said = () => store.get().announcement.text;

beforeEach(() => {
  vi.useFakeTimers();
  store = createTestStore({
    storage: memoryStorage(),
    initial: { area: { width: 1600, height: 800 } },
  });
  store.actions.preset("order-chain");
});
afterEach(() => vi.useRealTimers());

describe("unsaved work", () => {
  it("closing a pane with unsaved work asks first; Keep editing changes nothing", () => {
    store.actions.setUnsaved("customer", "an unsaved note");
    const before = store.get().layout;
    store.actions.close("customer");
    expect(store.get().layout).toBe(before);
    expect(store.get().confirm?.panes).toEqual(["customer"]);
    store.actions.keepEditing();
    expect(store.get().confirm).toBeNull();
    expect(store.get().layout).toBe(before);
    expect(store.get().unsaved.customer).toBe("an unsaved note");
  });

  it("Discard makes the held change exactly, and the work is forgotten", () => {
    store.actions.setUnsaved("customer", "an unsaved note");
    store.actions.close("customer");
    store.actions.discardAndContinue();
    expect(ids()).not.toContain("customer");
    expect(store.get().unsaved).toEqual({});
    expect(store.get().confirm).toBeNull();
  });

  it("any change that would drop the pane asks: close others, a preset, showing another object in it", () => {
    store.actions.setUnsaved("customer", "an unsaved note");
    store.actions.closeOthers("orders");
    expect(store.get().confirm?.panes).toEqual(["customer"]);
    store.actions.keepEditing();
    store.actions.preset("one-table");
    expect(store.get().confirm?.panes).toEqual(["customer"]);
    store.actions.keepEditing();
    store.actions.openHere("customer", { kind: "record", params: { table: "customers", id: 2 } });
    expect(store.get().confirm?.panes).toEqual(["customer"]);
  });

  it("moving, tucking or tabbing the pane keeps it mounted, so nothing asks", () => {
    store.actions.setUnsaved("customer", "an unsaved note");
    store.actions.tuck("customer");
    expect(store.get().confirm).toBeNull();
    store.actions.putBack("customer");
    store.actions.mergeInto("customer", "order");
    expect(store.get().confirm).toBeNull();
    expect(store.get().unsaved.customer).toBe("an unsaved note");
  });

  it("a following detail with unsaved work stays put while the list moves on, and says why", () => {
    store.actions.setUnsaved("order", "an unsaved note");
    store.actions.select("orders", order(5));
    vi.advanceTimersByTime(FOLLOW_MS + 10);
    expect(store.model().pane("order")?.ref).toEqual(order(1));
    expect(store.get().confirm).toBeNull();
    expect(said()).toMatch(/stays put/);
  });

  it("once saved, it closes without asking", () => {
    store.actions.setUnsaved("customer", "an unsaved note");
    store.actions.setUnsaved("customer", null);
    store.actions.close("customer");
    expect(ids()).not.toContain("customer");
  });
});

describe("a pane's own state", () => {
  it("is kept through a tuck, comes back with an undo, and goes when the pane is gone for good", () => {
    store.actions.setPaneState("customer", "scroll", 240);
    store.actions.tuck("customer");
    store.actions.putBack("customer");
    expect(store.get().paneState.customer).toEqual({ scroll: 240 });
    store.actions.close("customer");
    // Still in the undo stack: Undo brings the pane and its state back.
    expect(store.get().paneState.customer).toEqual({ scroll: 240 });
    store.actions.undo();
    expect(store.get().paneState.customer).toEqual({ scroll: 240 });
    store.actions.preset("one-table");
    expect(store.get().paneState.customer).toBeUndefined();
  });

  it("starts afresh when the pane shows another object", () => {
    store.actions.setPaneState("customer", "scroll", 240);
    store.actions.openHere("customer", { kind: "record", params: { table: "customers", id: 2 } });
    expect(store.get().paneState.customer).toBeUndefined();
  });

  it("is read back from the store's storage, so it survives a reload", () => {
    store.actions.setPaneState("customer", "scroll", 99);
    const storage = memoryStorage();
    savePaneState(storage, store.get().paneState, store.get().paneStateOf);
    const again = createTestStore({ storage, initial: { area: { width: 1600, height: 800 } } });
    expect(again.get().paneState.customer).toEqual({ scroll: 99 });
  });

  it("saved without the object it was about (before 20 Nov 2026), it is left out", () => {
    const storage = memoryStorage({ "pane-state": JSON.stringify({ customer: { scroll: 99 } }) });
    const again = createTestStore({ storage, initial: { area: { width: 1600, height: 800 } } });
    expect(again.get().paneState.customer).toBeUndefined();
  });
});

describe("a pane's commands", () => {
  it("are listed while the pane is in the layout and go with it", () => {
    store.actions.setPaneCommands("customer", [{ id: "save", title: "Save note", run: () => {} }]);
    expect(store.get().paneCommands.customer?.map((c) => c.title)).toEqual(["Save note"]);
    store.actions.close("customer");
    expect(store.get().paneCommands.customer).toBeUndefined();
  });
});
