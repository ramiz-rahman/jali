/**
 * A rename belongs to its object (stabilisation step 5, A1-2). The state is `{ pane, object }`; when that pane shows
 * another object (open here, a following detail moving, Back, Undo, a link) or is gone, the core ends the rename, so
 * the person never saves "Order 1"'s new name onto Order 2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ObjectRef } from "../src/layout/types";
import { FOLLOW_MS } from "../src/actions/follow";
import type { Layout, PaneNode } from "../src/layout/types";
import { tree } from "../src/layout/engine";
import { restoreLayout } from "../src/actions/layout";
import { createTestStore } from "./fixtures/workspace";
import type { JaliStore } from "../src/state/store";

let store: JaliStore;
const order = (id: number): ObjectRef => ({ kind: "record", params: { table: "orders", id } });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  store = createTestStore({
    rename: { run: () => {} },
    initial: { area: { width: 1600, height: 800 } },
  });
  store.actions.preset("order-chain");
  store.actions.focus("order");
});
afterEach(() => vi.useRealTimers());

describe("the rename state", () => {
  it("names the pane and the object the rename started on", () => {
    store.actions.startRename("order");
    expect(store.get().renaming).toMatchObject({ pane: "order" });
    expect(typeof store.get().renaming?.object).toBe("string");
  });

  it("ends when the pane opens another object here", () => {
    store.actions.startRename("order");
    expect(store.actions.openHere("order", order(9)).ok).toBe(true);
    expect(store.get().renaming).toBeNull();
  });

  it("stays when the same object is opened again", () => {
    store.actions.startRename("order");
    store.actions.openHere("order", order(1));
    expect(store.get().renaming?.pane).toBe("order");
  });

  it("ends when a following detail moves to another object", () => {
    store.actions.startRename("order");
    store.actions.select("orders", order(4));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(store.model().pane("order")?.ref).toEqual(order(4));
    expect(store.get().renaming).toBeNull();
  });

  it("ends when a layout arrives with another object there (setLayout, a link, Back)", () => {
    store.actions.startRename("order");
    const layout = structuredClone(store.get().layout) as Layout;
    (tree.panes(layout.root).find((p) => p.id === "order") as PaneNode).ref = order(7);
    expect(store.apply((x) => restoreLayout(x, layout), "setLayout").ok).toBe(true);
    expect(store.get().renaming).toBeNull();
  });

  it("ends when the pane closes", () => {
    store.actions.startRename("order");
    store.actions.close("order");
    expect(store.get().renaming).toBeNull();
  });
});
