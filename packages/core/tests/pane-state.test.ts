/**
 * Pane state, one record per pane (core-opus CORE-2, core-codex CORE-1, react-codex REACT-1). Each pane's values and
 * the object they belong to are one record under a new key, `pane-state@2`. A tab writes only what it changed, over
 * what other tabs wrote since (it does not hear them while it runs; the last write wins per pane). The two keys
 * before it are dropped, never read, so an old build's tab can't attach its values to the wrong object. DECISIONS,
 * 22 Nov 2026 and 23 Nov 2026.
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
import { urlSync } from "../src/features/url-sync";

const order = { kind: "order", title: "Order", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "order", params: { id } });
const KEY = "pane-state@2";

/** Storage two tabs share, as they share localStorage. It notes its writes of pane state. */
const shared = (initial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(initial));
  const writes: string[] = [];
  const port: Required<StoragePort> = {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => {
      if (k.startsWith("pane-state")) writes.push(k);
      m.set(k, v);
    },
    remove: (k) => {
      writes.push(`-${k}`);
      m.delete(k);
    },
  };
  return { port, writes };
};
const counted = shared;

const tab = (layout: LayoutInput, storage: StoragePort) =>
  storeOf(
    createJali({
      panes: [order],
      layout,
      features: [urlSync({ location: memoryLocation() })],
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

  it("a draft typed in one tab is not heard by the other while it runs, and is read when one starts", () => {
    const storage = shared().port;
    const a = tab(two, storage);
    const b = tab(two, storage);
    storeOf(a.jali).jali.start();
    b.jali.start();
    a.actions.setPaneState("a", "draft", "Dear");
    flushPaneState(a);
    expect(stateOf(b, "a")).toBeUndefined();
    expect(stateOf(tab(two, storage), "a")).toEqual({ draft: "Dear" });
    a.jali.destroy();
    b.jali.destroy();
  });

  it("the last write wins per pane, and the other pane's record stays", () => {
    const storage = shared().port;
    const a = tab(two, storage);
    const b = tab(two, storage);
    a.actions.setPaneState("a", "draft", "from A");
    a.actions.setPaneState("b", "scroll", 5);
    flushPaneState(a);
    b.actions.setPaneState("a", "draft", "from B");
    flushPaneState(b);
    const reload = tab(two, storage);
    expect(stateOf(reload, "a")).toEqual({ draft: "from B" });
    expect(stateOf(reload, "b")).toEqual({ scroll: 5 });
  });

  it("another tab's record for another object is never removed by a tab that did not hold it", () => {
    const storage = shared().port;
    const a = tab(one(1), storage);
    const b = tab(one(9), storage);
    b.jali.start();
    a.actions.setPaneState("a", "draft", "for order 1");
    flushPaneState(a);
    expect(b.get().paneState).toEqual({});
    flushPaneState(b);
    expect(loadPaneState(storage)).toEqual({ a: { draft: "for order 1" } });
    b.jali.destroy();
  });

  it("a pane closed for good takes its record out while it still belongs to the same object", () => {
    const storage = memoryStorage();
    const a = tab(two, storage);
    a.actions.setPaneState("b", "scroll", 10);
    flushPaneState(a);
    a.jali.actions.close("b");
    // The undo could bring it back: kept until the undo goes.
    flushPaneState(a);
    expect(loadPaneState(storage).b).toEqual({ scroll: 10 });
    // Nothing can bring it back once a later change of layout finds it gone from the undo stack too.
    a.set({ undoStack: [] });
    a.actions.openBeside("a", ref(3));
    flushPaneState(a);
    expect(loadPaneState(storage).b).toBeUndefined();
  });

  it("a pane closed for good leaves a record another tab wrote for another object", () => {
    const storage = memoryStorage();
    const a = tab(two, storage);
    a.actions.setPaneState("b", "scroll", 10);
    flushPaneState(a);
    a.jali.actions.close("b");
    a.set({ undoStack: [] });
    a.actions.openBeside("a", ref(3));
    // Another tab now keeps pane `b` for order 5.
    savePaneState(storage, { b: { scroll: 99 } }, { b: objectKey(a.env.kinds, ref(5)) });
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
  it("leaves bad records out, keeps prototype names as pane ids, and drops both at the next write", () => {
    const of = JSON.stringify(["order", JSON.stringify("1")]);
    const storage = memoryStorage({
      [KEY]: `{"v":2,"panes":{"a":[1],"b":{"of":7,"values":{},"at":1},"__proto__":{"of":${JSON.stringify(of)},"values":{"x":1},"at":2}}}`,
    });
    const t = tab(two, storage);
    expect(Object.getPrototypeOf(t.get().paneState)).toBe(Object.prototype);
    expect(stateOf(t, "a")).toBeUndefined();
    t.actions.setPaneState("a", "scroll", 1);
    flushPaneState(t);
    expect(Object.keys(JSON.parse(storage.get(KEY)!).panes).sort()).toEqual(["__proto__", "a"]);
    const broken = memoryStorage({ [KEY]: "{not json" });
    const u = tab(two, broken);
    expect(u.get().paneState).toEqual({});
    u.actions.setPaneState("a", "scroll", 1);
    flushPaneState(u);
    expect(Object.keys(JSON.parse(broken.get(KEY)!).panes)).toEqual(["a"]);
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
