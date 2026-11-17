/**
 * Layout stability (state/apply.ts): focus and swap ops never move a pane. Each step runs through the store, which
 * reports any focus or swap op whose rects changed; the test also compares the geometry itself.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { registerAllPaneKinds } from "../panes";
import { registerLoanReview } from "../review";
import { geometryOf } from "./state/apply";
import { createUiStore, type UiStore } from "./state/store";

registerAllPaneKinds();
registerLoanReview();

let store: UiStore;
let breaches: string[];
beforeEach(() => {
  localStorage.clear();
  breaches = [];
  store = createUiStore({ unstable: (op) => breaches.push(op), initial: { area: { width: 1156, height: 644 } } });
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
    store.actions.enterReview({ item: 4, tab: "application" });
    for (const tab of ["borrower", "overview", "history", "group", "officer", "application"]) still(() => store.actions.openTab(tab));
    still(() => store.actions.activate(9));
    expect(shown()).toEqual(["application"]);
  });

  it("Multiplexed: on screen focuses, off screen takes the place of the view in use, behind a tab is chosen there", () => {
    store.actions.enterReview({ item: 4, tab: "application" });
    store.actions.setMode("multi");
    expect(shown()).toEqual(["application", "borrower", "history"]);
    still(() => store.actions.openTab("borrower"));
    expect(store.get().view.focused).toBe("borrower");
    const slot = store.model().resolved.panes.find((b) => b.id === "borrower")!.rect;
    still(() => store.actions.openTab("group"));
    expect(store.model().resolved.panes.find((b) => b.id === "group")!.rect).toEqual(slot);
    expect(store.model().off).toContain("borrower");
    still(() => store.actions.openTab("overview"));
    still(() => store.actions.openTab("officer"));
    still(() => store.actions.openTab("application"));
    still(() => store.actions.activate(12));
    expect(breaches).toEqual([]);
  });

  it("a view behind another tab is chosen in its group, in place", () => {
    store.set({ area: { width: 1156, height: 400 } }); // too short for two stacked: history folds behind borrower
    store.actions.enterReview({ item: 4, tab: "application" });
    store.actions.setMode("multi");
    expect(store.model().folded).toContain("history");
    still(() => store.actions.openTab("history"));
    expect(shown()).toContain("history");
  });

  it("deliberate gestures reshape, and are counted so panes can slide", () => {
    store.actions.enterReview({ item: 4, tab: "application" });
    store.actions.setMode("multi");
    const n = store.get().reshapes;
    store.actions.openTabBeside("group");
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
    for (const t of group!.tabs) still(() => store.actions.setActiveTab(group.id, t.id));
  });
});
