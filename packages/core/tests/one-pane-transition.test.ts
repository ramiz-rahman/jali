/**
 * One pane at a time starting and ending is the core's (state/store.ts, settleOnePane): what the adapter measured
 * (`store.measure`) or any other change that crosses the line freezes the arrangement just before, and widening puts
 * it back, in the same batch, said once. The first measurement since a start is only where the instance starts.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row, tabs } from "@jali/core";
import { storeOf, type JaliStore } from "@jali/core/adapter";

const kinds = [{ kind: "note", title: "Note", params: { n: Number }, width: { min: 200 } }];
const note = (n: number) => ({ kind: "note", params: { n } });

function make() {
  const jali = createJali({
    panes: kinds,
    layout: row(
      tabs({ active: "a" }, pane(note(1), { id: "a" }), pane(note(2), { id: "b" })),
      pane(note(3), { id: "c" }),
    ),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  return { jali, store: storeOf(jali) };
}
const at = (store: JaliStore, width: number) =>
  store.measure({ area: { width, height: 800 }, dir: "ltr", hinge: undefined });
const shown = (store: JaliStore) =>
  (store.get().layout.root as { children: readonly { active?: string }[] }).children[0]!.active;
const said = (store: JaliStore) => store.get().announcement.text;

describe("one pane at a time", () => {
  it("says nothing on the first measurement, even at phone width", () => {
    const { store } = make();
    at(store, 400);
    expect(store.model().onePane).toBe(true);
    expect(said(store)).toBe("");
  });

  it("puts back the tabs shown just before it began when the room comes back, in one notification", async () => {
    const { jali, store } = make();
    at(store, 1200);
    at(store, 400);
    expect(said(store)).toMatch(/^One pane at a time/);
    // The person chose another tab while one pane showed at a time.
    await jali.actions.focus("b");
    expect(shown(store)).toBe("b");
    let heard = 0;
    const off = store.subscribe(() => heard++);
    at(store, 1200);
    off();
    expect(heard).toBe(1);
    expect(shown(store)).toBe("a");
    expect(store.model().onePane).toBe(false);
    expect(said(store)).toMatch(/^Panes side by side again/);
    expect(store.get().wide).toBeNull();
  });

  it("is settled for any change that crosses the line, not only a measurement", () => {
    const { store } = make();
    at(store, 1200);
    store.set({ area: { width: 400, height: 800 } });
    expect(said(store)).toMatch(/^One pane at a time/);
    expect(store.get().wide).not.toBeNull();
  });

  it("ignores a hidden element (no width), and starts over after a stop", () => {
    const { store } = make();
    const stop = store.start();
    at(store, 1200);
    at(store, 0);
    expect(said(store)).toBe("");
    at(store, 400);
    expect(said(store)).toMatch(/^One pane at a time/);
    stop();
    store.start();
    const seq = store.get().announcement.seq;
    at(store, 1200);
    expect(store.get().announcement.seq).toBe(seq);
  });
});
