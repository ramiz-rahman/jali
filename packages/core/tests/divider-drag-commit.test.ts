/**
 * A divider drag owns the styles it previews until its commit lands (core review 22 Nov 2026, #6). Before, a release
 * whose resize was refused (the app withdrew permission mid-drag) left the panes drawn at the preview's widths while
 * the model kept the committed ones, and nothing re-rendered them, since the committed rects hadn't changed.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
import { startDividerDrag, storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 100 } };
const ref = (id: number, pane: string) => ({ kind: "item", params: { id }, id: pane }) as never;

function setup() {
  let resizable = true;
  const jali = createJali({
    panes: [item],
    layout: row(ref(1, "a"), ref(2, "b"), ref(3, "c")),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    allow: { when: ({ action }) => action !== "resize" || resizable },
  });
  const store = storeOf(jali);
  const root = document.createElement("div");
  document.body.append(root);
  store.dom.attach(root);
  // The frames an adapter renders, at the committed geometry.
  const frames = new Map<string, HTMLElement>();
  for (const b of store.model().content.panes) {
    const el = document.createElement("div");
    el.id = `${store.dom.id}-pane-${b.id}`;
    el.style.width = `${b.rect.width}px`;
    el.style.left = `${b.rect.x}px`;
    root.append(el);
    frames.set(b.id, el);
  }
  const sep = document.createElement("div");
  root.append(sep);
  const d = store.model().content.dividers[0]!;
  const drag = (dx: number) => {
    startDividerDrag(
      store,
      { pointerId: 1, button: 0, clientX: 300, clientY: 10, currentTarget: sep },
      d.parentId,
      d.index,
    );
    sep.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 300 + dx, clientY: 10 }));
  };
  const release = () => sep.dispatchEvent(new Event("pointerup"));
  const committed = (id: string) =>
    `${store.model().content.panes.find((b) => b.id === id)!.rect.width}px`;
  return { jali, store, frames, drag, release, committed, refuse: () => (resizable = false) };
}

describe("a divider drag's release", () => {
  it("refused: the panes are drawn at the committed geometry again", () => {
    const t = setup();
    const layout = t.store.get().layout;
    t.drag(60);
    t.refuse();
    t.release();
    expect(t.store.get().layout).toBe(layout);
    for (const [id, el] of t.frames) expect(el.style.width).toBe(t.committed(id));
  });

  it("landed: the panes are drawn as the model has them", () => {
    const t = setup();
    const layout = t.store.get().layout;
    t.drag(60);
    t.release();
    expect(t.store.get().layout).not.toBe(layout);
    for (const [id, el] of t.frames) expect(el.style.width).toBe(t.committed(id));
  });

  it("after another layout replaced the one it started on: drawn as that layout", () => {
    const t = setup();
    const [a, b, c] = t.store.model().content.panes.map((p) => p.id);
    t.drag(60);
    expect(t.jali.actions.close(c!).ok).toBe(true);
    t.release();
    for (const id of [a!, b!]) expect(t.frames.get(id)!.style.width).toBe(t.committed(id));
  });
});
