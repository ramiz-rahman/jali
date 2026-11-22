/**
 * After a resize or a new pane cap refits the layout, the address follows (core-opus CORE-4): Copy link and a reload
 * at the same size reopen what is on screen. Before, the refit's fold records lived only in memory.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type Jali } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const kinds = [
  { kind: "list", title: "List", width: { min: 260, comfortable: 360 } },
  { kind: "item", title: "Item", params: { id: Number }, width: { min: 320, max: 700 } },
  { kind: "wide", title: "Wide", width: { min: 520 } },
];
const item = (id: number) => ({ kind: "item", params: { id } });
const geometry = (j: Jali) =>
  JSON.stringify(
    j
      .model()
      .resolved.panes.filter((p) => !p.hidden)
      .map((p) => [p.id, Math.round(p.rect.x), Math.round(p.rect.width)]),
  );
const reopen = (j: Jali) =>
  createJali({
    panes: kinds,
    layout: row({ kind: "list", params: {} }),
    features: [urlSync({ location: memoryLocation(storeOf(j).href().slice("memory:".length)), sizes: "link" })],
    // A reload on the same device: the person's pane cap is theirs, not the link's.
    storage: storeOf(j).storage,
    size: storeOf(j).get().area,
    moveFocus: false,
  });

afterEach(() => vi.useRealTimers());

describe("the address after a refit", () => {
  it("folds a resize left in place are in the link (found by a fuzz)", () => {
    vi.useFakeTimers();
    const location = memoryLocation();
    const jali = createJali({
      panes: kinds,
      layout: row(
        { kind: "list", params: {} },
        item(1),
        { kind: "wide", params: {} },
        item(2),
        item(3),
      ),
      features: [urlSync({ location, sizes: "link" })],
      storage: memoryStorage(),
      size: { width: 1800, height: 800 },
      moveFocus: false,
    });
    const store = storeOf(jali);
    const resize = (width: number) => {
      store.set({ area: { width, height: 800 } });
      vi.advanceTimersByTime(500);
    };
    jali.actions.focus("list");
    resize(1873);
    jali.actions.focus("item");
    jali.actions.focus("item-2");
    resize(1892);
    resize(1184);
    expect(geometry(reopen(jali))).toBe(geometry(jali));
  });

  it.each([
    ["a narrower window", { area: { width: 900, height: 800 } }],
    ["a much narrower window", { area: { width: 700, height: 800 } }],
    ["a window a little narrower", { area: { width: 1300, height: 800 } }],
    ["a lower pane cap", { cap: 2 }],
  ])("%s: the link reopens what is on screen", (_, change) => {
    vi.useFakeTimers();
    const location = memoryLocation();
    const jali = createJali({
      panes: kinds,
      layout: row({ kind: "list", params: {} }, item(1), item(2), item(3)),
      features: [urlSync({ location, sizes: "link" })],
      storage: memoryStorage(),
      size: { width: 1800, height: 800 },
      moveFocus: false,
    });
    jali.start();
    const entries = location.entries.length;
    const store = storeOf(jali);
    if ("area" in change) store.set({ area: change.area! });
    else jali.actions.changeSettings({ paneCap: change.cap });
    vi.advanceTimersByTime(1000);
    expect(geometry(reopen(jali))).toBe(geometry(jali));
    // A refit is no deliberate change: no history entry.
    expect(location.entries.length).toBe(entries);
  });
});
