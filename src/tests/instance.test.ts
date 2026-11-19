/**
 * The public instance (docs/DECISIONS.md, 19 Nov 2026): what `createJali` returns, the action convention (pane
 * first, an id or a ref), results that say why not, events, `getLayout`/`setLayout`, and the host's `beforeClose`.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type JaliEvents,
  type JaliOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";

const list = definePane("orders", { title: "Orders", Component: () => null });
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 300 },
  Component: () => null,
});
const launcher = definePane("launcher", {
  title: "New pane",
  scratch: true,
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

/** Every event, in order, as `[name, payload]`. */
function record(jali: ReturnType<typeof make>) {
  const heard: [keyof JaliEvents, unknown][] = [];
  for (const name of ["open", "close", "focus", "layout"] as const)
    jali.on(name, (e) => heard.push([name, e]));
  return heard;
}

const ids = (jali: ReturnType<typeof make>) => jali.model().panes.map((p) => p.id);
const said = (jali: ReturnType<typeof make>) => storeOf(jali).get().announcement.text;

afterEach(() => vi.useRealTimers());

describe("the instance", () => {
  it("has only what an app needs", () => {
    expect(Object.keys(make()).sort()).toEqual([
      "actions",
      "env",
      "get",
      "getLayout",
      "href",
      "keymap",
      "messages",
      "model",
      "on",
      "onToast",
      "setLayout",
      "start",
      "subscribe",
    ]);
  });

  it("holds the actions an app calls, and none of the engine's steps", () => {
    const names = Object.keys(make().actions);
    expect(names.sort()).toEqual(
      [
        "focus",
        "toggleZoom",
        "openBeside",
        "openHere",
        "peek",
        "closePeek",
        "select",
        "setPinned",
        "split",
        "newTab",
        "addTab",
        "remove",
        "close",
        "closeOthers",
        "undo",
        "tuck",
        "putBack",
        "move",
        "swapWithNext",
        "mergeInto",
        "unmerge",
        "preset",
        "resetLayout",
        "openPage",
        "leavePage",
        "setMode",
        "openTab",
        "activate",
        "backToPage",
        "resetPage",
        "setCanInvestigate",
        "openPalette",
        "closePalette",
        "openSettings",
        "closeSettings",
        "changeSettings",
      ].sort(),
    );
    for (const step of [
      "commitDividerDrag",
      "noteOpen",
      "arrive",
      "setPaneState",
      "setActivity",
      "reveal",
    ])
      expect(names).not.toContain(step);
  });

  it("is frozen, and the store behind it is the adapter's", () => {
    const jali = make();
    expect(Object.isFrozen(jali)).toBe(true);
    expect("set" in jali).toBe(false);
    expect(storeOf(jali).jali).toBe(jali);
    expect(() => storeOf({} as never)).toThrow(/not a workspace/);
  });
});

describe("the convention: the pane first, by id or by the object it shows", () => {
  it("takes a ref wherever it takes a pane id", () => {
    const a = make(),
      b = make();
    const byId = a.actions.openBeside("orders", order({ id: 7 }));
    const byRef = b.actions.openBeside(list(), order({ id: 7 }));
    expect(byId.ok && byRef.ok).toBe(true);
    expect(a.getLayout()).toEqual(b.getLayout());
  });

  it("resolves a ref to the pane showing that object, whatever its id", () => {
    const jali = make();
    expect(jali.actions.close(order({ id: 2 }))).toEqual({ ok: true, pane: "order-2" });
    expect(ids(jali)).toEqual(["orders", "order"]);
    expect(jali.actions.focus(order({ id: 1 }))).toEqual({ ok: true, pane: "order" });
    expect(jali.get().view.focused).toBe("order");
  });

  it("refuses a pane that is not there, silently", () => {
    const jali = make();
    const before = jali.getLayout();
    expect(jali.actions.close("nope")).toEqual({ ok: false, reason: "not-found" });
    expect(jali.actions.focus(order({ id: 99 }))).toEqual({ ok: false, reason: "not-found" });
    expect(jali.actions.mergeInto("orders", order({ id: 99 }))).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(jali.getLayout()).toBe(before);
    expect(said(jali)).toBe("");
  });

  it("an optional pane means the focused one", () => {
    const jali = make();
    jali.actions.focus("order-2");
    expect(jali.actions.close()).toEqual({ ok: true, pane: "order-2" });
  });

  it("peek and select take the pane they act for first", () => {
    const jali = make();
    expect(jali.actions.peek("orders", order({ id: 5 })).ok).toBe(true);
    expect(jali.get().view.peek).toEqual(order({ id: 5 }));
    expect(jali.get().peekSource).toBe("orders");
    jali.actions.closePeek();
    expect(jali.get().view.peek).toBeUndefined();
    expect(jali.actions.select(list(), order({ id: 3 })).ok).toBe(true);
    expect(jali.get().selection.orders?.ref).toEqual(order({ id: 3 }));
  });

  it("split's direction follows the pane, and moves take the pane and an edge", () => {
    const jali = make({ launcher });
    const r = jali.actions.split("orders");
    expect(r.ok && jali.model().pane(r.pane)?.ref.kind).toBe("launcher");
    const moved = make();
    expect(moved.actions.move("orders", "right").ok).toBe(true);
    expect(ids(moved)[0]).toBe("order");
  });
});

describe("results", () => {
  it("say what was opened", () => {
    const jali = make();
    const r = jali.actions.openBeside("orders", order({ id: 7 }));
    expect(r.ok).toBe(true);
    expect(jali.model().pane(r.pane)?.ref).toEqual(order({ id: 7 }));
  });

  it("say why not, with the announcement unchanged", () => {
    const jali = make({ layout: list() });
    expect(jali.actions.close()).toEqual({
      ok: false,
      reason: "last-pane",
      message: "The last pane stays open",
    });
    expect(said(jali)).toBe("The last pane stays open");
    expect(jali.actions.undo()).toEqual({
      ok: false,
      reason: "nothing-to-do",
      message: "Nothing to restore",
    });
    expect(said(jali)).toBe("Nothing to restore");
    expect(jali.actions.split()).toEqual({ ok: false, reason: "unavailable" });
    expect(jali.actions.preset("triage")).toEqual({ ok: false, reason: "unavailable" });
    expect(jali.actions.openPage()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("name a preset that is not there", () => {
    const jali = make({
      layout: undefined,
      presets: [{ id: "one", label: "One", layout: () => row(list(), order({ id: 5 })) }],
    });
    expect(jali.actions.preset("two")).toEqual({ ok: false, reason: "not-found" });
    expect(jali.actions.preset("one").ok).toBe(true);
  });

  it("is ok when what it asks for is already so", () => {
    const jali = make();
    jali.actions.focus("orders");
    expect(jali.actions.focus("orders")).toEqual({ ok: true, pane: "orders" });
  });

  it("say a change is held for unsaved work", () => {
    const jali = make();
    storeOf(jali).actions.setUnsaved("order", "a draft");
    expect(jali.actions.close("order")).toEqual({ ok: false, reason: "unsaved" });
    expect(storeOf(jali).get().confirm?.panes).toEqual(["order"]);
    expect(ids(jali)).toContain("order");
  });
});

describe("events", () => {
  it("open, focus and layout fire once for an open, with what happened", () => {
    const jali = make();
    jali.actions.focus("orders");
    const heard = record(jali);
    const r = jali.actions.openBeside("orders", order({ id: 7 }));
    expect(heard).toEqual([
      ["open", { pane: r.pane, ref: order({ id: 7 }) }],
      ["layout", { layout: jali.getLayout(), source: "action" }],
    ]);
  });

  it("close fires for the pane that left, and focus for the pane that took over", () => {
    const jali = make();
    jali.actions.focus("order-2");
    const heard = record(jali);
    jali.actions.close("order-2");
    expect(heard.map(([n]) => n)).toEqual(["close", "focus", "layout"]);
    expect(heard[0]![1]).toEqual({ pane: "order-2", ref: order({ id: 2 }) });
    expect(heard[1]![1]).toEqual({ pane: jali.get().view.focused, previous: "order-2" });
  });

  it("open says what a pane showed before", () => {
    const jali = make();
    const heard = record(jali);
    jali.actions.openHere("order", order({ id: 9 }));
    expect(heard[0]).toEqual([
      "open",
      { pane: "order", ref: order({ id: 9 }), previous: order({ id: 1 }) },
    ]);
  });

  it("a change made of several steps is told once", () => {
    const jali = make({
      layout: undefined,
      presets: [
        { id: "a", label: "A", layout: () => row(list(), order({ id: 1 })) },
        { id: "b", label: "B", layout: () => row(list(), order({ id: 2 }), order({ id: 3 })) },
      ],
    });
    // Pin from peek: close the sheet, then open beside (two steps).
    jali.actions.peek("orders", order({ id: 4 }));
    const heard = record(jali);
    storeOf(jali).actions.pinPeek();
    expect(heard.filter(([n]) => n === "layout")).toHaveLength(1);
    expect(heard.filter(([n]) => n === "open")).toHaveLength(1);
    heard.length = 0;
    jali.actions.preset("b");
    expect(heard.map(([n]) => n)).toEqual(["close", "open", "open", "layout"]);
  });

  it("never fire for what does not change the layout or focus, or for a refit", () => {
    const jali = make();
    const heard = record(jali);
    jali.actions.select("orders", order({ id: 3 }));
    jali.actions.openPalette();
    jali.actions.close("nope");
    storeOf(jali).actions.setActivity("orders", "working");
    storeOf(jali).set({ area: { width: 500, height: 800 } });
    expect(storeOf(jali).get().layout).not.toBe(undefined);
    expect(heard.filter(([n]) => n === "layout")).toEqual([]);
    expect(heard).toEqual([]);
  });

  it("a following detail's step is told once, when it lands", () => {
    vi.useFakeTimers();
    const jali = make({ layout: row(list(), order({ id: 1 })) });
    jali.actions.select("orders", order({ id: 3 }));
    jali.actions.openBeside("orders", order({ id: 3 }));
    const heard = record(jali);
    jali.actions.select("orders", order({ id: 4 }));
    jali.actions.select("orders", order({ id: 5 }));
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(heard.filter(([n]) => n === "open")).toHaveLength(1);
    expect(heard.find(([n]) => n === "open")![1]).toMatchObject({ ref: order({ id: 5 }) });
  });

  it("layout says when it came from the address", () => {
    const location = memoryLocation();
    const jali = make({ url: { location } });
    const stop = jali.start();
    const first = location.search();
    jali.actions.close("order-2");
    const heard = record(jali);
    location.visit(first);
    expect(heard.find(([n]) => n === "layout")![1]).toMatchObject({ source: "address" });
    expect(ids(jali)).toContain("order-2");
    stop();
  });

  it("unsubscribes", () => {
    const jali = make();
    const fn = vi.fn();
    const off = jali.on("close", fn);
    off();
    jali.actions.close("order-2");
    expect(fn).not.toHaveBeenCalled();
  });

  it("a handler that throws does not stop the others", () => {
    const jali = make();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = vi.fn();
    jali.on("close", () => {
      throw new Error("boom");
    });
    jali.on("close", fn);
    jali.actions.close("order-2");
    expect(fn).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe("getLayout and setLayout", () => {
  it("round-trips a layout", () => {
    const jali = make();
    jali.actions.openBeside("orders", order({ id: 7 }));
    const saved = structuredClone(jali.getLayout());
    jali.actions.close("order-2");
    jali.actions.close("order");
    expect(jali.setLayout(saved).ok).toBe(true);
    expect(jali.getLayout()).toEqual(saved);
  });

  it("takes anything createJali({ layout }) takes, and keeps focus where it still is", () => {
    const jali = make();
    jali.actions.focus("orders");
    expect(jali.setLayout(row(list(), tabs(order({ id: 4 }), order({ id: 5 })))).ok).toBe(true);
    expect(jali.model().panes.map((p) => p.ref)).toEqual([
      list(),
      order({ id: 4 }),
      order({ id: 5 }),
    ]);
    expect(jali.get().view.focused).toBe("orders");
    expect(jali.setLayout(order({ id: 8 })).ok).toBe(true);
    expect(jali.get().view.focused).toBe("order");
  });

  it("fits the layout to the room", () => {
    const jali = make({ size: { width: 700, height: 800 } });
    jali.setLayout(row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 })));
    expect(jali.model().folded.length).toBeGreaterThan(0);
    expect(jali.model().visible.length).toBeLessThan(4);
  });

  it("refuses a layout it can't show", () => {
    const jali = make();
    const before = jali.getLayout();
    expect(jali.setLayout({ kind: "invoice", params: {} })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(jali.setLayout({ version: 1, root: null } as never)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(jali.getLayout()).toBe(before);
  });

  it("asks before losing unsaved work", () => {
    const jali = make();
    storeOf(jali).actions.setUnsaved("order-2", "a draft");
    const before = jali.getLayout();
    expect(jali.setLayout(row(list()))).toEqual({ ok: false, reason: "unsaved" });
    expect(jali.getLayout()).toBe(before);
    storeOf(jali).actions.discardAndContinue();
    expect(ids(jali)).toEqual(["orders"]);
  });

  it("writes the address, so Back returns to the layout before", () => {
    const location = memoryLocation();
    const jali = make({ url: { location } });
    const stop = jali.start();
    const count = location.entries.length;
    jali.setLayout(row(list()));
    expect(location.entries.length).toBe(count + 1);
    location.visit(location.entries[count - 1]!);
    expect(ids(jali)).toEqual(["orders", "order", "order-2"]);
    stop();
  });

  it("fires one layout event, so a host can save it", () => {
    const jali = make();
    const saved: unknown[] = [];
    jali.on("layout", ({ layout }) => saved.push(layout));
    jali.setLayout(row(list(), order({ id: 3 })));
    expect(saved).toEqual([jali.getLayout()]);
  });
});

describe("beforeClose: the host is asked before panes go", () => {
  it("is asked with the panes and why, and false keeps them", () => {
    const beforeClose = vi.fn(() => false);
    const jali = make({ beforeClose });
    const heard = record(jali);
    expect(jali.actions.close("order-2")).toEqual({ ok: false, reason: "kept" });
    expect(beforeClose).toHaveBeenCalledWith({
      panes: [{ pane: "order-2", ref: order({ id: 2 }) }],
      reason: "close",
    });
    expect(ids(jali)).toContain("order-2");
    expect(heard).toEqual([]);
  });

  it("is not asked when the workspace starts, or for what removes nothing", () => {
    const beforeClose = vi.fn(() => true);
    const jali = make({ beforeClose });
    expect(beforeClose).not.toHaveBeenCalled();
    jali.actions.focus("order");
    jali.actions.tuck("order-2");
    jali.actions.openBeside("orders", order({ id: 7 }));
    expect(beforeClose).not.toHaveBeenCalled();
  });

  it("covers close others, a preset, setLayout and showing another object", () => {
    const asked: string[] = [];
    const jali = make({
      layout: undefined,
      presets: [
        { id: "a", label: "A", layout: () => row(list(), order({ id: 1 }), order({ id: 2 })) },
        { id: "b", label: "B", layout: () => row(list()) },
      ],
      beforeClose: ({ reason }) => (asked.push(reason), false),
    });
    expect(jali.actions.closeOthers("orders").reason).toBe("kept");
    expect(jali.actions.preset("b").reason).toBe("kept");
    expect(jali.setLayout(list()).reason).toBe("kept");
    expect(jali.actions.openHere("order", order({ id: 9 })).reason).toBe("kept");
    expect(asked).toEqual(["close", "layout", "layout", "show"]);
    expect(ids(jali)).toEqual(["orders", "order", "order-2"]);
  });

  it("covers Back and Forward, and puts the address back when it keeps the panes", () => {
    const location = memoryLocation();
    let allow = true;
    const jali = make({ url: { location }, beforeClose: () => allow });
    const stop = jali.start();
    const first = location.search();
    jali.actions.openBeside("orders", order({ id: 7 }));
    const shown = location.search();
    allow = false;
    location.visit(first);
    expect(jali.model().panes.some((p) => p.ref.params.id === 7)).toBe(true);
    expect(location.search()).toBe(shown);
    stop();
  });

  it("waits for an answer that comes later, then makes the change", async () => {
    let answer!: (yes: boolean) => void;
    const jali = make({ beforeClose: () => new Promise<boolean>((r) => (answer = r)) });
    const heard = record(jali);
    const r = jali.actions.close("order-2");
    expect(r.ok === false && r.reason).toBe("pending");
    expect(ids(jali)).toContain("order-2");
    expect(heard).toEqual([]);
    answer(true);
    expect(await r.settled).toEqual({ ok: true });
    expect(ids(jali)).not.toContain("order-2");
    expect(heard.filter(([n]) => n === "close")).toHaveLength(1);
    expect(said(jali)).toBe("Order 2 closed · Undo available");
  });

  it("keeps the panes when a later answer is no, or fails", async () => {
    const no = make({ beforeClose: () => Promise.resolve(false) });
    const r = no.actions.close("order-2");
    expect(await r.settled).toEqual({ ok: false, reason: "kept" });
    expect(ids(no)).toContain("order-2");

    const failing = make({ beforeClose: () => Promise.reject(new Error("offline")) });
    const f = failing.actions.close("order-2");
    expect(await f.settled).toEqual({ ok: false, reason: "kept" });
    expect(ids(failing)).toContain("order-2");

    const throwing = make({
      beforeClose: () => {
        throw new Error("bug");
      },
    });
    expect(throwing.actions.close("order-2")).toEqual({ ok: false, reason: "kept" });
  });

  it("drops a change the layout has moved on from by the time the answer comes", async () => {
    let answer!: (yes: boolean) => void;
    let first = true;
    const jali = make({
      beforeClose: () =>
        first ? ((first = false), new Promise<boolean>((r) => (answer = r))) : true,
    });
    const r = jali.actions.close("order-2");
    jali.actions.openBeside("orders", order({ id: 7 }));
    answer(true);
    expect(await r.settled).toEqual({ ok: false, reason: "kept" });
    expect(ids(jali)).toContain("order-2");
  });

  it("comes before Jali's own question about unsaved work", async () => {
    const order_: string[] = [];
    const jali = make({ beforeClose: () => (order_.push("host"), true) });
    storeOf(jali).actions.setUnsaved("order-2", "a draft");
    expect(jali.actions.close("order-2")).toEqual({ ok: false, reason: "unsaved" });
    expect(order_).toEqual(["host"]);
    // Discard makes the change without asking the host again.
    storeOf(jali).actions.discardAndContinue();
    expect(order_).toEqual(["host"]);
    expect(ids(jali)).not.toContain("order-2");

    const kept = make({ beforeClose: () => false });
    storeOf(kept).actions.setUnsaved("order-2", "a draft");
    expect(kept.actions.close("order-2").reason).toBe("kept");
    expect(storeOf(kept).get().confirm).toBeNull();
  });

  it("asks once, after a later yes, before unsaved work is lost", async () => {
    const jali = make({ beforeClose: () => Promise.resolve(true) });
    storeOf(jali).actions.setUnsaved("order-2", "a draft");
    const r = jali.actions.close("order-2");
    expect(await r.settled).toEqual({ ok: false, reason: "unsaved" });
    expect(storeOf(jali).get().confirm?.panes).toEqual(["order-2"]);
  });

  it("names panes by the ids the layout gives them", () => {
    const jali = make({
      layout: row(pane(list(), { id: "left" }), pane(order({ id: 1 }), { id: "right" })),
      beforeClose: ({ panes }) => panes.every((p) => p.pane === "right"),
    });
    expect(jali.actions.close("right").ok).toBe(true);
  });
});

describe("keeping in step with the host's documents", () => {
  it("addTab shows a ref as a new tab of a pane, by id or by ref", () => {
    const jali = make();
    const r = jali.actions.addTab(order({ id: 1 }), order({ id: 8 }));
    expect(r.ok).toBe(true);
    expect(jali.model().pane(r.pane)?.ref).toEqual(order({ id: 8 }));
    expect(
      jali
        .model()
        .stackOf(r.pane)
        ?.children.map((c) => c.ref),
    ).toEqual([order({ id: 1 }), order({ id: 8 })]);
    expect(said(jali)).toBe("Order 8 opened");
  });

  it("addTab shows a ref that is already open instead of opening it twice", () => {
    const jali = make();
    expect(jali.actions.addTab("orders", order({ id: 2 }))).toEqual({ ok: true, pane: "order-2" });
    expect(ids(jali)).toEqual(["orders", "order", "order-2"]);
    expect(jali.actions.addTab("orders", { kind: "invoice", params: {} })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("openHere shows another object in place, by id or by ref", () => {
    const jali = make();
    expect(jali.actions.openHere(order({ id: 2 }), order({ id: 6 }))).toEqual({
      ok: true,
      pane: "order-2",
    });
    expect(jali.model().pane("order-2")?.ref).toEqual(order({ id: 6 }));
  });

  it("remove takes a pane away quietly: no undo, no toast, no announcement, no question", () => {
    const beforeClose = vi.fn(() => false);
    const location = memoryLocation();
    const jali = make({ beforeClose, url: { location } });
    const toasts = vi.fn();
    jali.onToast(toasts);
    storeOf(jali).actions.setUnsaved("order-2", "a draft");
    const entries = location.entries.length;
    const heard = record(jali);
    expect(jali.actions.remove(order({ id: 2 }))).toEqual({ ok: true, pane: "order-2" });
    expect(ids(jali)).toEqual(["orders", "order"]);
    expect(beforeClose).not.toHaveBeenCalled();
    expect(storeOf(jali).get().confirm).toBeNull();
    expect(storeOf(jali).get().unsaved).toEqual({});
    expect(storeOf(jali).get().undoStack).toEqual([]);
    expect(toasts).not.toHaveBeenCalled();
    expect(said(jali)).toBe("");
    expect(location.entries.length).toBe(entries);
    expect(heard.map(([n]) => n)).toEqual(["close", "layout"]);
  });

  it("remove turns the last pane into the launcher, or says it stays without one", () => {
    const withLauncher = make({ layout: order({ id: 1 }), launcher });
    expect(withLauncher.actions.remove("order")).toEqual({ ok: true, pane: "order" });
    expect(withLauncher.model().pane("order")?.ref.kind).toBe("launcher");

    const without = make({ layout: order({ id: 1 }) });
    expect(without.actions.remove("order")).toEqual({ ok: false, reason: "last-pane" });
    expect(ids(without)).toEqual(["order"]);
    expect(said(without)).toBe("");
  });

  it("remove refuses a pane that is not there", () => {
    expect(make().actions.remove(order({ id: 99 }))).toEqual({ ok: false, reason: "not-found" });
  });
});
