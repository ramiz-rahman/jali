/** The active-item contract: a collection's cursor, through Jali's port, drives the list's following detail. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ActiveItemPort } from "../../packages/core/src/contracts/active-item";
import type { ObjectRef } from "../../packages/core/src/layout/types";
import { createLabStore } from "../lab";
import { FOLLOW_MS } from "../../packages/core/src/actions/follow";
import { activeItemPort } from "../../packages/core/src/pane/activeItem";
import { memoryStorage } from "../../packages/core/src/ports";
import type { UiStore } from "../../packages/core/src/state/store";

let store: UiStore;
let port: ActiveItemPort;
const order = (id: number): ObjectRef => ({ kind: "record", params: { table: "orders", id } });
const mapping = {
  toRef: (id: string) => order(Number(id)),
  idOf: (r: ObjectRef) => (r.params.table === "orders" ? String(r.params.id) : null),
};

beforeEach(() => {
  vi.useFakeTimers();
  store = createLabStore({
    storage: memoryStorage(),
    initial: { area: { width: 1600, height: 800 } },
  });
  store.actions.preset("order-chain");
  port = activeItemPort(store, "orders", mapping);
});
afterEach(() => vi.useRealTimers());

describe("the active-item port", () => {
  it("step moves the cursor; the following detail shows it once it rests", () => {
    expect(port.write("4", "step")).toEqual({ status: "accepted" });
    expect(port.itemId).toBe("4");
    vi.advanceTimersByTime(FOLLOW_MS + 10);
    expect(store.model().pane("order")?.ref).toEqual(order(4));
  });

  it("open shows the item in the following detail at once, never a second copy in a sheet", () => {
    port.write("7", "open");
    expect(store.model().pane("order")?.ref).toEqual(order(7));
    expect(store.get().view.peek).toBeUndefined();
  });

  it("with no detail on screen, open shows a sheet, step moves it, close shuts it and keeps the cursor", () => {
    store.actions.preset("one-table");
    const list = activeItemPort(store, "orders", mapping);
    list.write("2", "open");
    expect(store.get().view.peek).toEqual(order(2));
    list.write("3", "step");
    expect(store.get().view.peek).toEqual(order(3));
    list.write(null, "close");
    expect(store.get().view.peek).toBeUndefined();
    expect(list.itemId).toBe("3");
  });

  it("reads the cursor the workspace already has, whoever set it", () => {
    store.actions.select("orders", order(9));
    expect(port.itemId).toBe("9");
    store.actions.select("orders", { kind: "record", params: { table: "customers", id: 1 } });
    expect(port.itemId).toBeNull();
  });
});
