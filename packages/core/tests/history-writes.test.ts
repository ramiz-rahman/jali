/**
 * History writes (docs/reviews/2026-11-23/PLAN.md, step 2). One history decision per action, written once after it
 * commits, from the final state; a held action writes nothing until it commits. Nothing is written while a gesture
 * holds the instance; once the last one ends, one write. Replaces are at most one per 250 ms, the latest winning; a
 * push writes at once, after the replace still waiting. A write the browser refuses is caught: the address lags, the
 * action still happens.
 *
 * Findings URL-1 (peek, Open beside, Back), URL-2 (a broken link's fallback wrote before its approval) and SAFARI-3 (a
 * long drag made more than 100 history writes in 10 s, and Safari threw mid-commit).
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type JaliOptions,
  type LocationPort,
} from "@jali/core";
import { browserLocation, createUrlSync, edgeScroll, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

afterEach(() => vi.useRealTimers());

/** An address with Back, that notes each history write. */
function history(initial = "") {
  const entries = [initial];
  let at = 0;
  const fns = new Set<() => void>();
  const writes: string[] = [];
  const port: LocationPort & {
    back(): void;
    visit(search: string): void;
    entries: () => string[];
  } = {
    search: () => entries[at]!,
    href: () => `memory:${entries[at]!}`,
    navigate(search, mode) {
      writes.push(mode);
      if (mode === "push") {
        entries.splice(at + 1, Infinity, search);
        at++;
      } else entries[at] = search;
    },
    subscribe(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    back() {
      at--;
      for (const fn of fns) fn();
    },
    /** Navigation the instance did not make (a router link): a new entry, and subscribers hear it. */
    visit(search) {
      entries.splice(at + 1, Infinity, search);
      at++;
      for (const fn of fns) fn();
    },
    entries: () => entries.slice(0, at + 1),
  };
  return { port, writes };
}

const list = { kind: "list", title: "List", width: { min: 300 } };
const card = { kind: "card", title: "Card", params: { id: Number }, width: { min: 300 } };
const c = (id: number) => ({ kind: "card", params: { id } });
const make = (location: LocationPort, o: Partial<JaliOptions> = {}) => {
  const jali = createJali({
    panes: [list, card],
    layout: row(pane({ kind: "list", params: {} }, { id: "a" })),
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    ...o,
  });
  jali.start();
  return jali;
};

describe("one history decision per action", () => {
  it("peek, Open beside, then Back returns to the layout and address from before the peek (URL-1)", () => {
    const { port } = history();
    const jali = make(port);
    const before = port.search();
    jali.actions.peek("a", c(2));
    storeOf(jali).actions.openPeekBeside();
    expect(jali.model().panes).toHaveLength(2);
    expect(jali.get().view.peek).toBeUndefined();
    port.back();
    expect(port.search()).toBe(before);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
    expect(jali.get().view.peek).toBeUndefined();
  });

  it("a broken link's fallback held for the host writes nothing until it is allowed, then once (URL-2)", async () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    let answer!: (yes: boolean) => void;
    const two = () => row(pane(c(1), { id: "x" }), pane(c(2), { id: "y" }));
    const jali = make(port, {
      presets: [{ id: "two", label: "Two", layout: two }],
      layout: two(),
      beforeClose: () => new Promise<boolean>((r) => (answer = r)),
    });
    jali.actions.openBeside("x", c(3));
    vi.advanceTimersByTime(1000);
    writes.length = 0;
    const toasts = vi.fn();
    jali.on("toast", toasts);
    // A link that can't be read arrives (a router link, Back): the preset opens instead, which would close the pane
    // opened since; the host holds it.
    port.visit("?l=not-a-layout&preset=two");
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual([]);
    expect(toasts).not.toHaveBeenCalled();
    expect(jali.model().panes).toHaveLength(3);
    answer(true);
    await vi.runAllTimersAsync();
    expect(jali.model().panes.map((p) => p.id)).toEqual(["x", "y"]);
    expect(writes).toEqual(["replace"]);
    expect(port.search()).not.toContain("not-a-layout");
    expect(toasts).toHaveBeenCalledTimes(1);
  });
});

describe("a gesture writes the address once, when it ends (SAFARI-3)", () => {
  const day = {
    kind: "day",
    title: "Day",
    params: { n: Number },
    width: { min: 300, comfortable: 360 },
  };
  const week = row(
    { id: "outer" },
    row(
      { id: "week", scroll: "x" },
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => pane({ kind: "day", params: { n } }, { id: `d${n}` })),
    ),
  );
  const strip = (location: LocationPort) =>
    make(location, { panes: [day], layout: week, size: { width: 1200, height: 800 } });

  it("ten seconds of edge scrolling make no history write, and one at the end, which reopens there", () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    const jali = strip(port);
    vi.advanceTimersByTime(1000);
    writes.length = 0;
    const store = storeOf(jali);
    const edge = edgeScroll(jali);
    edge.move(10, 10);
    // About ten scroll reports a second, as a held edge makes them.
    for (let i = 1; i <= 100; i++) {
      store.actions.setScroll("week", i * 4);
      vi.advanceTimersByTime(100);
    }
    expect(writes).toEqual([]);
    edge.stop();
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual(["replace"]);
    expect(new URLSearchParams(port.search()).get("scroll")).toBe("week:400");
    expect(strip(memoryLocation(port.search())).get().view.scroll).toEqual({ week: 400 });
  });

  it("a drop inside a drag is held with it, and written once it ends", () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    const jali = strip(port);
    vi.advanceTimersByTime(1000);
    writes.length = 0;
    const store = storeOf(jali);
    const release = store.gesture(() => {});
    const outer = store.gesture(() => {});
    store.actions.setScroll("week", 300);
    jali.actions.close("d7");
    outer();
    expect(writes).toEqual([]);
    release();
    expect(writes).toEqual(["push"]);
    expect(port.search()).toContain("scroll=week");
  });
  it("a replace still waiting when a drag starts is held with it, and written once it ends", () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    const jali = strip(port);
    vi.advanceTimersByTime(1000);
    writes.length = 0;
    const store = storeOf(jali);
    store.actions.setScroll("week", 300);
    store.actions.setScroll("week", 600);
    expect(writes).toEqual(["replace"]);
    const release = store.gesture(() => {});
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual(["replace"]);
    release();
    vi.advanceTimersByTime(1000);
    expect(writes).toEqual(["replace", "replace"]);
    expect(new URLSearchParams(port.search()).get("scroll")).toBe("week:600");
  });
});

describe("the writer", () => {
  const state = (zoomed: string) => () => ({
    layout: storeOf(jaliFor).get().layout,
    view: { focusHistory: [], zoomed },
    presetId: undefined,
    page: null,
  });
  const jaliFor = createJali({
    panes: [list],
    layout: row(
      pane({ kind: "list", params: {} }, { id: "a" }),
      pane({ kind: "list", params: {} }, { id: "b" }),
    ),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
  });

  it("writes a resize still waiting as it was before a push, so Back returns to it", () => {
    vi.useFakeTimers();
    const { port } = history();
    const sync = createUrlSync({ location: port, storage: memoryStorage() });
    let zoomed = "a";
    sync.write(state("b"), "replace");
    vi.advanceTimersByTime(1000);
    sync.write(() => state(zoomed)(), "debounce");
    zoomed = "b";
    sync.write(() => state(zoomed)(), "push");
    expect(port.entries().map((e) => new URLSearchParams(e).get("zoom"))).toEqual(["a", "b"]);
    port.back();
    expect(new URLSearchParams(port.search()).get("zoom")).toBe("a");
  });

  it("a replace written late keeps what another instance wrote to the address meanwhile", () => {
    vi.useFakeTimers();
    const { port } = history();
    const one = createUrlSync({ location: port, storage: memoryStorage() });
    const two = createUrlSync({ location: port, storage: memoryStorage(), prefix: "w2." });
    one.write(state("a"), "replace");
    one.write(state("b"), "replace");
    two.write(state("a"), "replace");
    vi.advanceTimersByTime(1000);
    const q = new URLSearchParams(port.search());
    expect(q.get("zoom")).toBe("b");
    expect(q.get("w2.zoom")).toBe("a");
  });

  it("an action a writer of the host's own runs as it writes makes its own write", () => {
    const modes: string[] = [];
    let jali!: ReturnType<typeof createJali>;
    let acted = false;
    jali = createJali({
      panes: [list],
      layout: row(
        pane({ kind: "list", params: {} }, { id: "a" }),
        pane({ kind: "list", params: {} }, { id: "b" }),
        pane({ kind: "list", params: {} }, { id: "c" }),
      ),
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
      url: {
        write(_state, mode) {
          if (!jali) return;
          modes.push(mode);
          if (!acted) {
            acted = true;
            jali.actions.setPinned("a", true);
          }
        },
      },
    });
    jali.actions.close("c");
    expect(modes).toEqual(["push", "push"]);
    expect(jali.model().pane("a")?.pinned).toBe(true);
  });

  it("writes at most one replace per 250 ms, the latest winning, with the address as it was asked for", () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    const sync = createUrlSync({ location: port, storage: memoryStorage() });
    sync.write(state("a"), "replace");
    expect(writes).toEqual(["replace"]);
    sync.write(state("b"), "replace");
    sync.write(state("a"), "replace");
    let late = "b";
    sync.write(() => state(late)(), "replace");
    late = "a";
    vi.advanceTimersByTime(200);
    expect(writes).toEqual(["replace"]);
    vi.advanceTimersByTime(50);
    expect(writes).toEqual(["replace", "replace"]);
    // Captured when asked for: `late` changed after, and the address says "b".
    expect(new URLSearchParams(port.search()).get("zoom")).toBe("b");
  });

  it("a push writes the replace still waiting first, so Back returns to it", () => {
    vi.useFakeTimers();
    const { port, writes } = history();
    const sync = createUrlSync({ location: port, storage: memoryStorage() });
    sync.write(state("a"), "replace");
    sync.write(state("b"), "replace");
    sync.write(state("a"), "push");
    expect(writes).toEqual(["replace", "replace", "push"]);
    expect(port.entries().map((e) => new URLSearchParams(e).get("zoom"))).toEqual(["b", "a"]);
    vi.advanceTimersByTime(1000);
    expect(writes).toHaveLength(3);
  });

  it("a history write the browser refuses leaves actions and events working, with one warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const refuse = () => {
      throw new DOMException(
        "Attempt to use history.replaceState() more than 100 times per 10 seconds",
        "SecurityError",
      );
    };
    const win = {
      location: { href: "http://x/", search: "" },
      history: { state: null, pushState: refuse, replaceState: refuse },
      addEventListener() {},
      removeEventListener() {},
    } as unknown as Window;
    const jali = make(browserLocation(win));
    const heard: string[] = [];
    jali.on("open", (e) => heard.push(e.pane));
    const a = jali.actions.openBeside("a", c(1));
    const b = jali.actions.openBeside("a", c(2));
    expect(a.ok && b.ok).toBe(true);
    expect(heard).toEqual([a.pane, b.pane]);
    expect(jali.model().pane(b.pane!)?.ref).toEqual(c(2));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
