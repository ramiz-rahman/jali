/**
 * One ref equality, independent of key order (QUALITY-REVIEW P14). A layout read back from a store that reorders
 * object keys (Postgres `jsonb`) shows the same objects: nothing is "replaced", nothing asks, nothing is forgotten.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, sameRef } from "@jali/core";
import { layout as core, sameNode, storeOf } from "@jali/core/adapter";
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "@jali/core";
import { definePane } from "@jali/react";

const cell = definePane("cell", {
  params: { sheet: String, row: Number },
  title: ({ sheet, row }) => `${sheet} ${row}`,
  Component: () => null,
});

/** The same layout with every pane's params in the reverse key order, as `jsonb` may give it back. */
function reordered(layout: Layout): Layout {
  const flip = (n: LayoutNode): LayoutNode =>
    n.type === "pane"
      ? {
          ...n,
          ref: {
            kind: n.ref.kind,
            params: Object.fromEntries(Object.entries(n.ref.params).reverse()),
          },
        }
      : ({ ...n, children: n.children.map(flip) } as LayoutNode);
  return { ...layout, root: flip(layout.root) };
}

const make = (beforeClose?: () => boolean) =>
  createJali({
    panes: [cell],
    layout: row(
      pane(cell({ sheet: "A", row: 1 }), { id: "a" }),
      pane(cell({ sheet: "B", row: 2 }), { id: "b" }),
    ),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...(beforeClose ? { beforeClose } : {}),
  });

describe("sameRef", () => {
  it("ignores key order and compares values exactly", () => {
    const a: ObjectRef = { kind: "cell", params: { sheet: "A", row: 1 } };
    const b: ObjectRef = { kind: "cell", params: { row: 1, sheet: "A" } };
    expect(sameRef(a, b)).toBe(true);
    expect(sameRef(a, { kind: "cell", params: { sheet: "A", row: "1" } })).toBe(false);
    expect(sameRef(a, { kind: "cell", params: { sheet: "A" } })).toBe(false);
    expect(sameRef(a, { kind: "cell", params: { sheet: "A", rows: 1 } })).toBe(false);
    expect(sameRef(a, undefined)).toBe(false);
  });

  it("a frame's pane is the same node when only key order differs", () => {
    const n = {
      type: "pane",
      id: "a",
      ref: { kind: "cell", params: { sheet: "A", row: 1 } },
    } as unknown as PaneNode;
    expect(sameNode(n, { ...n, ref: { kind: "cell", params: { row: 1, sheet: "A" } } })).toBe(true);
  });

  it("a layout read back in another key order keeps unsaved work and pane state, and asks nobody", () => {
    const beforeClose = vi.fn(() => true);
    const jali = make(beforeClose);
    const store = storeOf(jali);
    store.actions.setUnsaved("a", "an edit");
    store.actions.setPaneState("b", "sort", "row");
    const opened = vi.fn();
    jali.on("open", opened);
    const r = jali.setLayout(reordered(storeOf(jali).get().layout));
    expect(r.ok).toBe(true);
    expect(store.get().confirm).toBeNull();
    expect(beforeClose).not.toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
    expect(store.get().unsaved).toEqual({ a: "an edit" });
    expect(store.get().paneState.b).toEqual({ sort: "row" });
  });

  it("showing a pane its own object in another key order changes nothing", () => {
    const store = storeOf(make());
    const before = store.get().layout;
    const after = core.setRef(
      before,
      store.get().view,
      "a",
      { kind: "cell", params: { row: 1, sheet: "A" } },
      store.ctx(),
    );
    expect(after).toBe(before);
  });
});
