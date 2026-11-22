/**
 * Pane reports have one owner (architecture review 22 Nov 2026, P2-6): each caller's report is the source, and the
 * maps the instance reads (activity, unsaved work, commands, titles, attributes) are made from the reports, never
 * written on their own. A direct report (`store.actions.setUnsaved`) is one more caller, so it merges with the hooks'.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const make = () =>
  createJali({
    panes: [item],
    layout: row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" })),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
  });

describe("pane reports", () => {
  it("merge a direct report with a hook's, and lose only the one taken away", () => {
    const store = storeOf(make());
    store.actions.reportPane("a", "editor", 1, { unsaved: "a draft" });
    store.actions.setUnsaved("a", "a comment");
    expect(store.get().unsaved.a).toBe("a draft, a comment");
    store.actions.setUnsaved("a", null);
    expect(store.get().unsaved.a).toBe("a draft");
    store.actions.reportPane("a", "editor", 1, null);
    expect(store.get().unsaved).toEqual({});
    expect(store.get().paneReports).toEqual({});
  });

  it("keep the maps of panes a report doesn't touch, entry by entry", () => {
    const store = storeOf(make());
    store.actions.setTitle("a", "Quarterly");
    store.actions.setActivity("b", "working");
    const titles = store.get().titles;
    store.actions.setActivity("b", "needs-you");
    expect(store.get().titles).toBe(titles);
    expect(store.get().activity.b).toBe("needs-you");
  });

  it("follow a pane that shows another object: its title goes, what its content reports stays", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.reportPane("a", "editor", 1, { title: "Quarterly", activity: "working" });
    expect(jali.actions.openHere("a", ref(9)).ok).toBe(true);
    expect(store.get().titles.a).toBeUndefined();
    expect(store.get().activity.a).toBe("working");
    expect(store.get().paneReports.a).toEqual({ editor: { seq: 1, activity: "working" } });
  });

  it("go with a closed pane, maps and all", () => {
    const jali = make();
    const store = storeOf(jali);
    store.actions.setTitle("b", "Notes");
    store.actions.setActivity("b", "working");
    expect(jali.actions.close("b").ok).toBe(true);
    expect(store.get().titles).toEqual({});
    expect(store.get().activity).toEqual({});
    expect(store.get().paneReports).toEqual({});
  });
});
