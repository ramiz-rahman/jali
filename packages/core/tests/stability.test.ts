/**
 * Layout stability (state/apply.ts): focus and swap ops never move a pane. Each step runs through the store, which
 * reports any focus or swap op whose rects changed; the test also compares the geometry itself.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { geometryOf } from "../src/state/apply";
import { createTestStore } from "./fixtures/workspace";
import type { JaliStore } from "../src/state/store";

let store: JaliStore;
let breaches: string[];
beforeEach(() => {
  localStorage.clear();
  breaches = [];
  store = createTestStore({
    unstable: (op) => breaches.push(op),
    initial: { area: { width: 1156, height: 644 } },
  });
});
const geometry = () => geometryOf(store.model());
/** Run `step` and expect nothing on screen to move. */
function still(step: () => void) {
  const before = geometry();
  step();
  expect(geometry()).toBe(before);
  expect(breaches).toEqual([]);
}
const shown = () => store.model().visible;

describe("layout stability: a tab click never reshapes", () => {
  it("Single: every tab and another application swap the one view in place", () => {
    store.run("page.open", { item: 4, tab: "application" });
    for (const tab of ["borrower", "overview", "history", "group", "officer", "application"])
      still(() => store.run("page.showView", tab));
    still(() => store.run("page.showItem", 9));
    expect(shown()).toEqual(["application"]);
  });

  it("Split view: on screen focuses, off screen takes the place of the view in use, behind a tab is chosen there", () => {
    store.run("page.open", { item: 4, tab: "application" });
    store.run("page.setMode", "split");
    expect(shown()).toEqual(["application", "borrower", "history"]);
    still(() => store.run("page.showView", "borrower"));
    expect(store.get().view.focused).toBe("borrower");
    const slot = store.model().resolved.panes.find((b) => b.id === "borrower")!.rect;
    still(() => store.run("page.showView", "group"));
    expect(store.model().resolved.panes.find((b) => b.id === "group")!.rect).toEqual(slot);
    expect(store.model().off).toContain("borrower");
    still(() => store.run("page.showView", "overview"));
    still(() => store.run("page.showView", "officer"));
    still(() => store.run("page.showView", "application"));
    still(() => store.run("page.showItem", 12));
    expect(breaches).toEqual([]);
  });

  it("a view behind another tab is chosen in its group, in place", () => {
    store.set({ area: { width: 1156, height: 400 } }); // too short for two stacked: history folds behind borrower
    store.run("page.open", { item: 4, tab: "application" });
    store.run("page.setMode", "split");
    expect(store.model().folded).toContain("history");
    still(() => store.run("page.showView", "history"));
    expect(shown()).toContain("history");
  });

  it("deliberate gestures reshape, and are counted so panes can slide", () => {
    store.run("page.open", { item: 4, tab: "application" });
    store.run("page.setMode", "split");
    const n = store.get().reshapes;
    store.actions.showViewBeside("group");
    expect(store.get().reshapes).toBe(n + 1);
    expect(breaches).toEqual([]);
  });
});

describe("layout stability: Data Studio", () => {
  it("choosing a tab and focusing never move a pane", () => {
    store.actions.preset("stress-10");
    const m = store.model();
    const group = [...m.groups.values()][0];
    for (const id of m.visible) still(() => store.actions.focus(id));
    expect(group).toBeDefined();
    for (const t of group!.tabs) still(() => store.actions.setActiveTab(group!.id, t.id));
  });
});

describe("filling a placeholder is a reshape", () => {
  it("a record chosen in a launcher settles by the share rule; the launcher's width is not held", () => {
    store.set({ area: { width: 1908, height: 644 } });
    store.actions.preset("one-table");
    const launcher = store.actions.split("orders", "right").pane!;
    const width = (id: string) => store.model().resolved.panes.find((b) => b.id === id)!.rect.width;
    expect(width(launcher)).toBeGreaterThan(600);
    store.actions.openHere(launcher, { kind: "record", params: { table: "orders", id: 1 } });
    expect(breaches).toEqual([]);
    const weights = (n: { size: { weight?: number }; children?: unknown[] }): number[] => [
      n.size.weight ?? 1,
      ...((n.children ?? []) as (typeof n)[]).flatMap(weights),
    ];
    // A held swap stores lengths as px-unit weights, as a divider drag does; settling leaves the plain weights.
    expect(weights(store.get().layout.root as never).every((w) => w <= 2)).toBe(true);
    expect(store.model().pane(launcher)?.ref.kind).toBe("record");
    expect(width(launcher)).toBeLessThanOrEqual(600);
    expect(width("orders")).toBeGreaterThan(width(launcher));
  });
});
