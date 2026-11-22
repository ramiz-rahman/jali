/**
 * Pane state saved before 20 Nov 2026 (QUALITY-REVIEW phase 2, open): it was kept under the pane id alone, with nothing
 * about the object the pane showed, and no layout saved beside it. It can't be tied to an object safely, so it is never
 * attached to a pane (the P13 bug was exactly that), and it is taken out of storage on the first read. Bad data stored
 * beside good is dropped the same way; good data is read as before and not rewritten. DECISIONS, 21 Nov 2026.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type LayoutInput,
  type StoragePort,
} from "@jali/core";
import { objectKey, paneStateFor, savePaneState, storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";

const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: () => null,
});

/** Storage that notes its writes of pane state (the address's kept sizes are written beside them). */
const counted = (initial: Record<string, string>) => {
  const storage = memoryStorage(initial);
  const writes: string[] = [];
  const port: StoragePort = {
    get: (k) => storage.get(k),
    set: (k, v) => {
      if (k.startsWith("pane-state")) writes.push(k);
      storage.set(k, v);
    },
  };
  return { port, writes };
};

const make = (layout: LayoutInput, storage: StoragePort) =>
  storeOf(
    createJali({
      panes: [order],
      layout,
      url: { location: memoryLocation() },
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

const two = row(pane(order({ id: 1 }), { id: "a" }), pane(order({ id: 2 }), { id: "b" }));
/** What a build before 20 Nov 2026 saved: values by pane id, and nothing else. */
const old = JSON.stringify({
  a: { scroll: 240, draft: "Refund the deposit" },
  b: { sort: "date" },
});

describe("pane state saved under a pane id alone (before 20 Nov 2026)", () => {
  it("is never attached to a pane, whatever the pane under that id shows now", () => {
    const { port } = counted({ "pane-state": old });
    const store = make(two, port);
    expect(stateOf(store, "a")).toBeUndefined();
    expect(stateOf(store, "b")).toBeUndefined();
    expect(store.get().paneState).toEqual({});
    // A write starts the object's own state; the old values never join it.
    store.actions.setPaneState("a", "scroll", 12);
    expect(stateOf(store, "a")).toEqual({ scroll: 12 });
  });

  it("is gone from storage after one read, so a later start never sees it", () => {
    const { port, writes } = counted({ "pane-state": old });
    make(two, port);
    expect(JSON.parse(port.get("pane-state")!)).toEqual({});
    expect(JSON.parse(port.get("pane-state-of")!)).toEqual({});
    expect(writes).toEqual(["pane-state", "pane-state-of"]);
    // The next start reads nothing and writes nothing.
    writes.length = 0;
    expect(make(two, port).get().paneState).toEqual({});
    expect(writes).toEqual([]);
  });

  it("is dropped beside state saved with its object, which is read back and kept", () => {
    const storage = memoryStorage();
    const kinds = make(two, storage).env.kinds;
    // `a` saved by this build, with its object; `b` by an older one, without.
    savePaneState(storage, { a: { scroll: 240 } }, { a: objectKey(kinds, order({ id: 1 })) });
    storage.set("pane-state", JSON.stringify({ a: { scroll: 240 }, b: { sort: "date" } }));
    const store = make(two, storage);
    expect(stateOf(store, "a")).toEqual({ scroll: 240 });
    expect(stateOf(store, "b")).toBeUndefined();
    expect(JSON.parse(storage.get("pane-state")!)).toEqual({ a: { scroll: 240 } });
    expect(Object.keys(JSON.parse(storage.get("pane-state-of")!))).toEqual(["a"]);
  });

  it("drops bad data stored with it, and leaves names on Object.prototype alone", () => {
    // Written as text: an object literal's `__proto__` sets its prototype instead of a key.
    const storage = memoryStorage({
      "pane-state":
        '{"a":[1,2],"b":"scroll","__proto__":{"scroll":1},"constructor":{"scroll":2},"<img>":{"scroll":3}}',
      "pane-state-of": '{"a":"x","b":7,"toString":"y"}',
    });
    const store = make(two, storage);
    expect(store.get().paneState).toEqual({});
    expect(stateOf(store, "a")).toBeUndefined();
    expect(stateOf(store, "b")).toBeUndefined();
    expect(Object.getPrototypeOf(store.get().paneState)).toBe(Object.prototype);
    expect(storage.get("pane-state")).toBe("{}");
    expect(storage.get("pane-state-of")).toBe("{}");
  });

  it("replaces text that isn't JSON, and writes nothing when storage holds only good state", () => {
    const broken = memoryStorage({ "pane-state": "{not json", "pane-state-of": "[]" });
    make(two, broken);
    expect(broken.get("pane-state")).toBe("{}");
    expect(broken.get("pane-state-of")).toBe("{}");

    const storage = memoryStorage();
    const kinds = make(two, storage).env.kinds;
    savePaneState(storage, { a: { scroll: 240 } }, { a: objectKey(kinds, order({ id: 1 })) });
    const { port, writes } = counted({
      "pane-state": storage.get("pane-state")!,
      "pane-state-of": storage.get("pane-state-of")!,
    });
    expect(stateOf(make(two, port), "a")).toEqual({ scroll: 240 });
    expect(writes).toEqual([]);
  });
});
