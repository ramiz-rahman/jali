/**
 * A tab group's order is the person's to change, and changing it moves nothing (core-opus CORE-5, core-codex CORE-6).
 * The group's place among folds and its sizes followed its first tab: moving or pinning that tab renamed the fold
 * group (its records went stale and the folds replayed differently), changed the slot's comfortable and max widths,
 * and could send the group to another neighbour. A sweep of shapes and widths moves and pins every tab.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout as L,
  memoryStorage,
  pane,
  row,
  column,
  tabs,
  type Jali,
  type LayoutInput,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { stabilityBreaches } from "./fixtures/stability";

const kinds = [
  { kind: "list", title: "List", width: { min: 260, comfortable: 360 } },
  { kind: "item", title: "Item", params: { id: Number }, width: { min: 320, max: 700 } },
  { kind: "wide", title: "Wide", width: { min: 520, comfortable: 640 } },
  { kind: "note", title: "Note", width: { min: 200, max: 300 } },
];
const item = (id: number) => ({ kind: "item", params: { id } });
const SHAPES: LayoutInput[] = [
  row(
    pane({ kind: "list", params: {} }, { id: "a" }),
    tabs(
      pane(item(1), { id: "t1", linkedTo: "a" }),
      pane({ kind: "wide", params: {} }, { id: "t2", linkedTo: "c" }),
    ),
    pane(item(9), { id: "c" }),
  ),
  row(
    pane({ kind: "note", params: {} }, { id: "a" }),
    tabs(
      pane({ kind: "wide", params: {} }, { id: "t1" }),
      pane({ kind: "note", params: {} }, { id: "t2" }),
      pane(item(2), { id: "t3" }),
    ),
    pane({ kind: "list", params: {} }, { id: "c" }),
    pane(item(3), { id: "d" }),
  ),
  column(
    row(
      pane({ kind: "list", params: {} }, { id: "a" }),
      tabs(pane(item(1), { id: "t1" }), pane({ kind: "wide", params: {} }, { id: "t2" })),
    ),
    row(pane(item(4), { id: "c" }), pane({ kind: "note", params: {} }, { id: "d" })),
  ),
];
const geometry = (j: Jali) =>
  j
    .model()
    .resolved.panes.filter((b) => !b.hidden)
    .map((b) => `${b.rect.x},${b.rect.y},${b.rect.width},${b.rect.height}`)
    .sort()
    .join(" ");

const unstable = stabilityBreaches();

describe("moving and pinning tabs", () => {
  it("never moves a rect, at any width", () => {
    const breaches: string[] = [];
    for (const [s, shape] of SHAPES.entries())
      for (let width = 400; width <= 1800; width += 50) {
        const tabsOf = (j: Jali) =>
          L.tree
            .panes(j.getLayout().root)
            .filter((p) => L.tree.parent(j.getLayout().root, p.id)?.type === "stack")
            .map((p) => p.id);
        const make = () =>
          createJali({
            panes: kinds,
            layout: shape,
            storage: memoryStorage(),
            size: { width, height: 800 },
            moveFocus: false,
          });
        for (const id of tabsOf(make()))
          for (const act of ["first", "last", "pin"] as const) {
            const j = make();
            const before = geometry(j);
            if (act === "pin") j.actions.setPinned(id, true);
            else j.actions.moveTab(id, act === "first" ? 0 : 9);
            const after = geometry(j);
            if (after !== before) breaches.push(`shape ${s} at ${width}: ${act} ${id}`);
            expect(storeOf(j).get().layout).toBeDefined();
          }
      }
    expect(breaches.slice(0, 10)).toEqual([]);
  });
});

describe("an action whose rects depend on what it shows", () => {
  it("slides panes to their new place instead of jumping, and is no stability breach", () => {
    unstable.length = 0;
    const j = createJali({
      panes: kinds,
      layout: row(
        pane({ kind: "note", params: {} }, { id: "n" }),
        pane({ kind: "wide", params: {} }, { id: "w" }),
      ),
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
    });
    const store = storeOf(j);
    const before = geometry(j);
    const reshapes = store.get().reshapes;
    expect(j.actions.swapWithNext("n").ok).toBe(true);
    // A note and a wide pane size differently: swapping them moves rects, so the workspace animates.
    expect(geometry(j)).not.toBe(before);
    expect(store.get().reshapes).toBe(reshapes + 1);
    expect(unstable).toEqual([]);
  });
});
