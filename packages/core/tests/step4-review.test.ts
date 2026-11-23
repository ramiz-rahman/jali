/**
 * The step 4 review (Codex, 23 Nov 2026): seven places where an offer, a refusal or an address still disagreed with
 * what the action or the reader does. Each follows the action to its next consequence: the address reopened, the
 * menu item chosen, the target that isn't there.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import {
  can,
  definePageEngine as definePage,
  readSearch,
  storeOf,
  tabMenuOf,
} from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const card = { kind: "card", title: "Card", params: { id: Number }, width: { min: 260 } };
const scratch = { kind: "scratch", title: "Scratch", scratch: true, width: { min: 200 } };
const side = { kind: "side", title: "Side", width: { min: 260 } };
const c = (id: number) => ({ kind: "card", params: { id } });
const page = definePage({
  id: "p",
  name: "Page",
  itemNoun: "item",
  home: "main",
  roles: [
    { id: "main", label: "Main", priority: "primary" as const },
    { id: "side", label: "Side", priority: "supporting" as const },
  ],
  firstItem: 1,
  bind: (item: number) => ({ main: c(item), side: { kind: "side", params: {} } }),
  build: (item: number) =>
    row(
      pane(c(item), { id: "main", role: "main" }),
      pane({ kind: "side", params: {} }, { id: "side", role: "side" }),
    ),
});
const make = (o: Partial<JaliOptions> = {}, search = "") => {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [card, scratch, side],
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...o,
  });
  jali.start();
  return { jali, location };
};
const settle = () => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(1000);
  vi.useRealTimers();
};

describe("1. start-up writes only an address the reader reads", () => {
  it("a pane whose params its kind can't read opens, and its address isn't written", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { jali, location } = make({
      layout: row(
        pane({ kind: "card", params: { id: "bad" } }, { id: "a" }),
        pane(c(2), { id: "b" }),
      ),
    });
    expect(jali.model().panes).toHaveLength(2);
    expect(location.search()).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    // Once the pane shows an object its kind reads, the address is written, and reads back.
    expect(jali.actions.openHere("a", c(1)).ok).toBe(true);
    const read = readSearch(location.search(), jali.env.kinds.registry());
    expect(read && "layout" in read).toBe(true);
    warn.mockRestore();
  });
});

describe("2. a page link keeps each scratch pane it opened", () => {
  it("two scratch panes opened reopen as two", () => {
    const { jali, location } = make({ page });
    jali.page!.open();
    jali.page!.setMode("split");
    const s = { kind: "scratch", params: {} };
    expect(jali.actions.addTab("main", s).ok).toBe(true);
    expect(jali.actions.addTab("main", s).ok).toBe(true);
    settle();
    const opened = (j: typeof jali) => j.model().panes.filter((p) => !p.role).length;
    expect(opened(jali)).toBe(2);
    expect(opened(make({ page }, location.search()).jali)).toBe(2);
  });
});

describe("3. a view change meets the address's text limit too", () => {
  it("at the limit, maximising (which the address holds) is refused, and a reload keeps what is on screen", () => {
    const note = { kind: "note", title: "Note", params: { text: String }, width: { min: 200 } };
    const location = memoryLocation();
    const jali = createJali({
      panes: [note],
      layout: row(
        pane({ kind: "note", params: { text: "x" } }, { id: "a" }),
        pane({ kind: "note", params: { text: "y" } }, { id: "b" }),
      ),
      features: [urlSync({ location, sizes: "link" })],
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    jali.start();
    const store = storeOf(jali);
    const measure = (store.url as unknown as { measure(s: unknown): number }).measure;
    // Grow b's text until the address is exactly at the limit (an openHere past it is refused).
    const at = (n: number) => {
      if (!jali.actions.openHere("b", { kind: "note", params: { text: "y".repeat(n) } }).ok)
        return Infinity;
      const s = store.get();
      return measure({ layout: s.layout, view: s.view, presetId: s.presetId, page: s.page });
    };
    let lo = 600_000,
      hi = 800_000;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (at(mid) <= 1_000_000) lo = mid;
      else hi = mid - 1;
    }
    expect(at(lo)).toBeLessThanOrEqual(1_000_000);
    expect(at(lo + 1)).toBeGreaterThan(1_000_000);
    at(lo);
    settle();
    const before = location.search();
    expect(jali.actions.toggleZoom("a")).toMatchObject({ ok: false, reason: "blocked" });
    expect(jali.get().view.zoomed).toBeUndefined();
    settle();
    expect(location.search()).toBe(before);
  });
});

describe("4. placing the view on screen beside itself", () => {
  it("from Single view, ⌥-click on the view shown is nothing to do, and stays in Single view", () => {
    const { jali } = make({ page, allow: { open: false } });
    jali.page!.open();
    expect(jali.get().page?.mode).toBe("single");
    const store = storeOf(jali);
    expect(can(store, "showViewBeside", "main")).toMatchObject({
      ok: false,
      reason: "nothing-to-do",
    });
    expect(store.actions.showViewBeside("main")).toMatchObject({ reason: "nothing-to-do" });
    expect(store.actions.placeTab("main", "main", "right")).toMatchObject({
      reason: "nothing-to-do",
    });
    expect(jali.get().page?.mode).toBe("single");
  });
});

describe("5. the last view on screen", () => {
  it("is offered no Close: its step refuses, and the menu greys it out", () => {
    const { jali } = make({ page });
    jali.page!.open();
    jali.page!.setMode("split");
    expect(jali.actions.close("side").ok).toBe(true);
    const store = storeOf(jali);
    expect(can(store, "close", "main")).toMatchObject({ ok: false, reason: "last-pane" });
    const close = tabMenuOf(store, "main")
      .flat()
      .find((i) => i.id === "close");
    expect(close?.disabled).toBeTruthy();
  });
});

describe("6. Back to the page with an opened pane the app keeps", () => {
  it("its step refuses, so every surface (the page bar too) can grey it out", () => {
    const kept = { kind: "kept", title: "Kept", width: { min: 200 }, allow: { close: false } };
    const location = memoryLocation();
    const jali = createJali({
      panes: [card, side, kept],
      page,
      features: [urlSync({ location })],
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    jali.page!.open();
    jali.page!.setMode("split");
    jali.actions.addTab("main", { kind: "kept", params: {} });
    expect(can(storeOf(jali), "page.back")).toMatchObject({ ok: false, reason: "not-allowed" });
  });
});

describe("7. a target that isn't there", () => {
  it("is not-found, whatever the focused pane allows", () => {
    const { jali } = make({
      layout: row(pane(c(1), { id: "a" }), pane(c(2), { id: "b" })),
      allow: { close: false },
    });
    jali.actions.focus("a");
    expect(jali.actions.close("does-not-exist")).toMatchObject({ ok: false, reason: "not-found" });
    expect(can(storeOf(jali), "close", "does-not-exist").reason).toBe("not-found");
  });
});
