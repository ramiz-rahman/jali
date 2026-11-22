/**
 * Pane state, one record per pane (core-opus CORE-2, core-codex CORE-1, react-codex REACT-1). Each pane's values and
 * the object they belong to are one record under a new key, `pane-state@2`. A tab writes only what it changed, over
 * what other tabs wrote since, and hears what they write. The two keys before it are dropped, never read, so an old
 * build's tab can't attach its values to the wrong object. DECISIONS, 22 Nov 2026.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type LayoutInput,
  type StoragePort,
} from "@jali/core";
import {
  flushPaneState,
  loadPaneState,
  loadPaneStateOwners,
  objectKey,
  paneStateFor,
  savePaneState,
  storeOf,
  PANE_STATE_MAX,
} from "@jali/core/adapter";

const order = { kind: "order", title: "Order", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "order", params: { id } });
const KEY = "pane-state@2";

/** Storage that notes its writes of pane state. */
const counted = (initial: Record<string, string> = {}) => {
  const storage = memoryStorage(initial);
  const writes: string[] = [];
  const port: StoragePort = {
    get: (k) => storage.get(k),
    set: (k, v) => {
      if (k.startsWith("pane-state")) writes.push(k);
      storage.set(k, v);
    },
    remove: (k) => {
      writes.push(`-${k}`);
      storage.remove!(k);
    },
    subscribe: (k, fn) => storage.subscribe!(k, fn),
  };
  return { port, writes };
};

const tab = (layout: LayoutInput, storage: StoragePort) =>
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
type Tab = ReturnType<typeof tab>;
/** What usePaneState reads for pane `id`: its state while it shows what it shows now. */
const stateOf = (t: Tab, id: string) => {
  const p = t.model().pane(id);
  return p ? paneStateFor(t.get(), t.env.kinds, id, p.ref) : undefined;
};
const two = row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" }));
const one = (id: number) => row(pane(ref(id), { id: "a" }));

afterEach(() => vi.useRealTimers());

describe("two tabs of one build", () => {
  it("a tab that changed nothing writes nothing, and never erases another's drafts", () => {
    const { port, writes } = counted();
    const a = tab(two, port);
    const b = tab(one(7), port);
    a.actions.setPaneState("a", "draft", "reply to customer 1");
    a.actions.setPaneState("b", "scroll", 400);
    flushPaneState(a);
    writes.length = 0;
    flushPaneState(b);
    expect(writes).toEqual([]);
    b.actions.setPaneState("a", "draft", "tab B's own");
    flushPaneState(b);
    // B's pane `a` shows order 7: its own record. A's record for pane `b` stays; `a` is now B's, as last written.
    const reload = tab(two, port);
    expect(stateOf(reload, "b")).toEqual({ scroll: 400 });
    expect(loadPaneStateOwners(port).a).toBe(objectKey(reload.env.kinds, ref(7)));
  });

  it("a draft typed in one tab shows in the other, for the same object under the same pane", () => {
    const storage = memoryStorage();
    const a = tab(two, storage);
    const b = tab(two, storage);
    storeOf(a.jali).jali.start();
    b.jali.start();
    a.actions.setPaneState("a", "draft", "Dear");
    flushPaneState(a);
    expect(stateOf(b, "a")).toEqual({ draft: "Dear" });
    a.jali.destroy();
    b.jali.destroy();
  });

  it("another tab's record for another object is never taken in, and never removed", () => {
    const storage = memoryStorage();
    const a = tab(one(1), storage);
    const b = tab(one(9), storage);
    b.jali.start();
    a.actions.setPaneState("a", "draft", "for order 1");
    flushPaneState(a);
    expect(stateOf(b, "a")).toBeUndefined();
    expect(b.get().paneState).toEqual({});
    flushPaneState(b);
    expect(loadPaneState(storage)).toEqual({ a: { draft: "for order 1" } });
    b.jali.destroy();
  });

  it("a pane closed for good takes its record out, unless another tab wrote it since", () => {
    const storage = memoryStorage();
    const a = tab(two, storage);
    a.actions.setPaneState("b", "scroll", 10);
    flushPaneState(a);
    a.jali.actions.close("b");
    // The undo could bring it back: kept until the undo goes.
    flushPaneState(a);
    expect(loadPaneState(storage).b).toEqual({ scroll: 10 });
    a.set({ undoStack: [] });
    a.actions.setPaneState("a", "x", 1);
    // Another tab writes `b` meanwhile.
    savePaneState(storage, { b: { scroll: 99 } }, { b: objectKey(a.env.kinds, ref(2)) });
    flushPaneState(a);
    expect(loadPaneState(storage).b).toEqual({ scroll: 99 });
  });
});

describe("pane state from before 22 Nov 2026", () => {
  const old = { a: { scroll: 240, draft: "Refund the deposit" }, b: { sort: "date" } };

  it("is never read, in either old form, and is taken out of storage", () => {
    for (const initial of <Record<string, string>[]>[
      { "pane-state": JSON.stringify(old) },
      {
        "pane-state": JSON.stringify(old),
        "pane-state-of": JSON.stringify({ a: JSON.stringify(["order", '"1"']) }),
      },
    ]) {
      const { port, writes } = counted(initial);
      const t = tab(two, port);
      expect(t.get().paneState).toEqual({});
      expect(stateOf(t, "a")).toBeUndefined();
      expect(port.get("pane-state")).toBeNull();
      expect(port.get("pane-state-of")).toBeNull();
      expect(writes.filter((w) => !w.startsWith("-"))).toEqual([]);
    }
  });

  it("an old build's tab writing the old keys can't touch what this one saved", () => {
    const storage = memoryStorage();
    const t = tab(two, storage);
    t.actions.setPaneState("a", "draft", "new build");
    flushPaneState(t);
    // The old tab saves its values, and leaves the owners as they were.
    storage.set("pane-state", JSON.stringify({ a: { draft: "old build, another object" } }));
    const reload = tab(two, storage);
    expect(stateOf(reload, "a")).toEqual({ draft: "new build" });
  });
});

describe("what is stored", () => {
  it("drops bad records, keeps prototype names as pane ids, and replaces text that isn't JSON", () => {
    const of = JSON.stringify(["order", JSON.stringify("1")]);
    const storage = memoryStorage({
      [KEY]: `{"v":2,"panes":{"a":[1],"b":{"of":7,"values":{},"at":1},"__proto__":{"of":${JSON.stringify(of)},"values":{"x":1},"at":2}}}`,
    });
    const t = tab(two, storage);
    expect(Object.getPrototypeOf(t.get().paneState)).toBe(Object.prototype);
    expect(Object.keys(JSON.parse(storage.get(KEY)!).panes)).toEqual(["__proto__"]);
    const broken = memoryStorage({ [KEY]: "{not json" });
    tab(two, broken);
    expect(JSON.parse(broken.get(KEY)!)).toEqual({ v: 2, panes: {} });
  });

  it("good storage is read back and never rewritten", () => {
    const storage = memoryStorage();
    const t = tab(two, storage);
    t.actions.setPaneState("a", "scroll", 240);
    flushPaneState(t);
    const { port, writes } = counted({ [KEY]: storage.get(KEY)! });
    const again = tab(two, port);
    expect(stateOf(again, "a")).toEqual({ scroll: 240 });
    flushPaneState(again);
    expect(writes).toEqual([]);
  });

  it(`keeps the newest ${PANE_STATE_MAX} records`, () => {
    const storage = memoryStorage();
    const kinds = tab(two, storage).env.kinds;
    for (let i = 0; i < PANE_STATE_MAX + 5; i++)
      savePaneState(storage, { [`p${i}`]: { i } }, { [`p${i}`]: objectKey(kinds, ref(i)) });
    const kept = Object.keys(loadPaneState(storage));
    expect(kept.length).toBe(PANE_STATE_MAX);
  });
});

describe("a write meant for the object a pane showed", () => {
  it("is dropped once the pane shows another object (a setter kept from before)", () => {
    const t = tab(two, memoryStorage());
    const before = t.model().pane("a")!.ref;
    t.jali.actions.openHere("a", ref(5));
    t.actions.setPaneState("a", "draft", "for order 1", before);
    expect(stateOf(t, "a")).toBeUndefined();
    t.actions.setPaneState("a", "draft", "for order 5", ref(5));
    expect(stateOf(t, "a")).toEqual({ draft: "for order 5" });
  });
});
