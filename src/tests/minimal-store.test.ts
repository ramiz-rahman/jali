/** A workspace made with the public API alone and few options: what the docs' smallest app does must not throw. */
import { describe, expect, it } from "vitest";
import { createPaneKinds, createUiStore, memoryStorage, type Layout, type PaneKindBase } from "@jali/core";
import { runCommand } from "../../packages/core/src/commands/registry";

const note: PaneKindBase = { kind: "note", title: (r) => `Note ${r.params.id}`, minWidth: 240, minHeight: 160 };
const launcher: PaneKindBase = { kind: "chooser", title: () => "New pane", transient: true, recordable: false, minWidth: 240, minHeight: 160 };
const two = (): Layout => ({
  version: 1,
  root: { id: "root", type: "row", size: { weight: 1 }, children: [
    { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } },
    { id: "b", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 2 } } },
  ] },
});
const make = (kinds: PaneKindBase[], extra: Record<string, unknown> = {}) => {
  const store = createUiStore({ kinds: createPaneKinds(kinds), initial: { layout: two(), area: { width: 1200, height: 800 } }, storage: memoryStorage(), focusPane: null, ...extra });
  store.set({ view: { ...store.get().view, focused: "a" } });
  return store;
};

describe("a workspace without a launcher kind (finding 4)", () => {
  it("refuses split and new tab instead of throwing", () => {
    const store = make([note]);
    const before = store.get().layout;
    expect(() => store.actions.split("right")).not.toThrow();
    expect(() => store.actions.newTab()).not.toThrow();
    expect(store.get().layout).toBe(before);
  });
  it("leaves the split and new-tab commands out of ⌘K", () => {
    const store = make([note]);
    expect(() => runCommand(store, "pane.split.right")).not.toThrow();
    expect(store.get().layout.root.type).toBe("row");
  });
  it("uses the kind named by the `launcher` option", () => {
    const store = make([note, launcher], { launcher: "chooser" });
    const opened = store.actions.split("right");
    expect(opened).toBeDefined();
    expect(store.model().pane(opened!)?.ref.kind).toBe("chooser");
  });
});
