/**
 * A gesture belongs to the instance that started it (architecture review 22 Nov 2026, P2-4). A pane drag the browser
 * cancels (`pointercancel`) ends without a drop, and a drag still going when the instance stops or is destroyed ends
 * then: its window listeners go, its preview is put back, and a later release drops nothing. Live, in Chrome, a
 * cancelled drag used to drop on the next release, and a divider drag outlived by its instance left the page's resize
 * cursor on for good (tooling/live-probe).
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
import { startDividerDrag, startPaneDrag, storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number, pane: string) => ({ kind: "item", params: { id }, id: pane }) as never;

const make = () =>
  createJali({
    panes: [item],
    layout: row(ref(1, "a"), ref(2, "b"), ref(3, "c")),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

const pointer = (type: string, x = 0, y = 0) =>
  Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y });

/** A pane drag of `a`, started and moved past the threshold. */
function dragA(jali: ReturnType<typeof make>) {
  const store = storeOf(jali);
  const grip = document.createElement("div");
  document.body.append(grip);
  startPaneDrag(
    store,
    { button: 0, clientX: 10, clientY: 10, pointerId: 1, currentTarget: grip, target: grip },
    "a",
  );
  window.dispatchEvent(pointer("pointermove", 400, 300));
  expect(store.dom.dragging()).toBe("pane");
  // Aimed at a pane's edge (the adapter measures where; jsdom has no layout), so a release would drop there.
  store.set({ dnd: { dragged: "a", x: 400, y: 300, target: "c", zone: "right" } });
  return store;
}

const selectionBlocked = () =>
  !document.dispatchEvent(new Event("selectstart", { cancelable: true }));

describe("a pane drag", () => {
  it("cancelled by the browser ends without a drop, and a later release drops nothing", () => {
    const jali = make();
    const store = dragA(jali);
    const layout = store.get().layout;
    window.dispatchEvent(pointer("pointercancel"));
    expect(store.get().dnd).toBeNull();
    expect(store.dom.dragging()).toBeNull();
    expect(selectionBlocked()).toBe(false);
    window.dispatchEvent(pointer("pointerup", 400, 300));
    expect(store.get().layout).toBe(layout);
  });

  it("ends when the instance is destroyed: no listener, no preview, no drop", () => {
    const jali = make();
    const store = dragA(jali);
    expect(selectionBlocked()).toBe(true);
    jali.destroy();
    expect(store.get().dnd).toBeNull();
    expect(store.dom.dragging()).toBeNull();
    expect(selectionBlocked()).toBe(false);
    const layout = store.get().layout;
    window.dispatchEvent(pointer("pointermove", 500, 300));
    window.dispatchEvent(pointer("pointerup", 500, 300));
    expect(store.get().layout).toBe(layout);
    expect(store.get().dnd).toBeNull();
  });

  it("ends when the instance stops", () => {
    const jali = make();
    const stop = jali.start();
    const store = dragA(jali);
    stop();
    expect(store.get().dnd).toBeNull();
    expect(selectionBlocked()).toBe(false);
  });
});

describe("a divider drag", () => {
  it("ends when the instance is destroyed", () => {
    const jali = make();
    const store = storeOf(jali);
    const d = store.model().content.dividers[0]!;
    const sep = document.createElement("div");
    document.body.append(sep);
    startDividerDrag(
      store,
      { pointerId: 1, button: 0, clientX: 300, clientY: 10, currentTarget: sep },
      d.parentId,
      d.index,
    );
    expect(store.dom.dragging()).not.toBeNull();
    jali.destroy();
    expect(store.dom.dragging()).toBeNull();
  });
});

describe("a destroyed instance", () => {
  it("takes no raw write either", () => {
    const jali = make();
    const store = storeOf(jali);
    jali.destroy();
    store.set({ announcement: { text: "late", seq: 99 } });
    expect(store.get().announcement.text).toBe("");
  });
});
