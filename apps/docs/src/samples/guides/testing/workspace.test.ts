import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  boot, createPaneKinds, createUiStore, createUrlSync, memoryLocation, memoryStorage, type UiStore,
} from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** A workspace with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
function testStore(search = "") {
  const location = memoryLocation(search);
  const store = createUiStore({
    kinds: createPaneKinds(orderKinds),
    presets,
    preset: "triage",
    url: createUrlSync({ location, storage: memoryStorage() }),
    storage: memoryStorage(),
    focusPane: null,
    initial: { area: { width: 1440, height: 900 } },
  });
  return { store, location };
}

const ids = (store: UiStore) => store.model().panes.map((p) => p.id);

describe("the orders workspace", () => {
  let store: UiStore;
  let location: ReturnType<typeof memoryLocation>;
  beforeEach(() => ({ store, location } = testStore()));
  afterEach(() => vi.useRealTimers());

  it("opens an order beside the list and keeps focus in the list", () => {
    const opened = store.actions.openBeside("orders", { kind: "order", params: { id: 3 } });
    expect(store.model().pane(opened)?.ref.params.id).toBe(3);
    expect(store.get().view.focused).toBe("orders");
  });

  it("asks before closing a pane with unsaved work", () => {
    store.actions.setUnsaved("order", "an unsaved note");
    store.actions.close("order");
    expect(store.get().confirm?.panes).toEqual(["order"]);
    expect(ids(store)).toContain("order");

    store.actions.discardAndContinue();
    expect(ids(store)).not.toContain("order");
  });

  it("writes the layout to its own address, and a new history entry for a deliberate change", () => {
    store.actions.preset("customer-desk");
    const q = new URLSearchParams(location.search());
    expect(q.get("l")).toBeTruthy();
    expect(location.entries.length).toBe(2);
  });

  it("opens a link: the layout in the address wins over the preset", () => {
    store.actions.preset("customer-desk");
    const link = location.search();

    const { store: reader } = testStore(link);
    boot(reader);
    expect(ids(reader)).toEqual(ids(store));
  });

  it("shows the selected order in the following detail once the cursor rests", () => {
    vi.useFakeTimers();
    store.actions.select("orders", { kind: "order", params: { id: 5 } });
    vi.advanceTimersByTime(200);
    expect(store.model().pane("order")?.ref.params.id).toBe(5);
  });

  it("folds what does not fit", () => {
    store.set({ area: { width: 700, height: 900 } }); // orders 440 + order 360 do not fit in 700
    expect(store.model().folded.length).toBeGreaterThan(0);
  });
});
