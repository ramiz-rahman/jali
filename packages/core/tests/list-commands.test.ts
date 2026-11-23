/**
 * `listCommands` (docs/DECISIONS.md, "Stabilisation step 7a") is the same array until something it lists changes,
 * compared on every read and never kept by the state's identity: an app's `allow` rule can read the app's own data.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, listCommands, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const note = { kind: "note", title: "Note", params: { id: Number }, width: { min: 300 } };
const n = (id: number) => ({ kind: "note", params: { id } });
const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(pane(n(1), { id: "a" }), pane(n(2), { id: "b" })),
    storage: memoryStorage(),
    size: { width: 1500, height: 800 },
    moveFocus: false,
    ...o,
  });

describe("listCommands", () => {
  it("is the same array, with the same entries and runs, until something it lists changes", () => {
    const jali = make();
    const first = listCommands(jali);
    expect(listCommands(jali)).toBe(first);
    storeOf(jali).actions.setPaneState("a", "draft", "x");
    expect(listCommands(jali)).toBe(first);
    storeOf(jali).actions.setPaneCommands("a", [{ id: "save", title: "Save", run: () => {} }]);
    const next = listCommands(jali);
    expect(next).not.toBe(first);
    expect(next[0]?.key).toBe("pane:save");
    const zoom = (l: readonly { id?: string }[]) => l.find((c) => c.id === "pane.zoom");
    expect(zoom(next)).toBe(zoom(first));
  });

  it("is worked out on every read: an app's rule reading its own data changes it with no change of state", () => {
    let locked = false;
    const jali = make({
      allow: { when: ({ action }) => (action === "close" && locked ? false : undefined) },
    });
    const before = listCommands(jali);
    const close = (l: typeof before) => l.find((c) => c.id === "pane.close")!;
    expect(close(before).disabled).toBe(false);
    locked = true;
    const after = listCommands(jali);
    expect(after).not.toBe(before);
    expect(close(after).disabled).toBe(true);
    expect(close(after).run).toBe(close(before).run);
    expect(listCommands(jali)).toBe(after);
  });
});
