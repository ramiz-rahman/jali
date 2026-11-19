import { describe, expect, it } from "vite-plus/test";
import { column, pane, row, tabs, toLayout } from "../build";
import type { ObjectRef } from "../types";

const note = (id: number): ObjectRef => ({ kind: "note", params: { id } });

describe("layout builders", () => {
  it("names nodes after what they hold, and keeps the ids given", () => {
    const layout = toLayout(
      row(note(1), column({ id: "side" }, note(2), pane(note(3), { id: "third" }))),
    );
    expect(layout).toEqual({
      version: 1,
      root: {
        id: "row",
        type: "row",
        size: { weight: 1 },
        children: [
          { id: "note", type: "pane", size: { weight: 1 }, ref: note(1) },
          {
            id: "side",
            type: "column",
            size: { weight: 1 },
            children: [
              { id: "note-2", type: "pane", size: { weight: 1 }, ref: note(2) },
              { id: "third", type: "pane", size: { weight: 1 }, ref: note(3) },
            ],
          },
        ],
      },
    });
  });

  it("never names a node with an id given elsewhere in the tree", () => {
    const layout = toLayout(row(note(1), pane(note(2), { id: "note" })));
    expect((layout.root as { children: { id: string }[] }).children.map((c) => c.id)).toEqual([
      "note-2",
      "note",
    ]);
  });

  it("sizes by weight or px, and carries pane options", () => {
    const layout = toLayout(
      row(
        pane(note(1), { id: "list", px: 280 }),
        pane(note(2), {
          weight: 2,
          linkedTo: "list",
          follows: true,
          kept: true,
          role: "detail",
          priority: "primary",
        }),
      ),
    );
    const [list, detail] = (layout.root as { children: unknown[] }).children;
    expect(list).toMatchObject({ size: { px: 280 } });
    expect(detail).toMatchObject({
      size: { weight: 2 },
      linkedTo: "list",
      follows: true,
      kept: true,
      role: "detail",
      priority: "primary",
    });
  });

  it("makes tabs, with the first shown unless another is named", () => {
    expect(toLayout(tabs(note(1), note(2))).root).toMatchObject({
      type: "stack",
      active: "note",
      origin: "user",
    });
    expect(toLayout(tabs({ active: "b" }, note(1), pane(note(2), { id: "b" }))).root).toMatchObject(
      { active: "b" },
    );
  });

  it("starts hidden panes off screen", () => {
    expect(toLayout(row(note(1), pane(note(2), { id: "later", hidden: true }))).overlay).toEqual({
      tucks: [],
      folds: [],
      shown: {},
      hidden: ["later"],
    });
  });

  it("takes a single ref, and leaves a whole layout as it is", () => {
    expect(toLayout(note(1)).root).toEqual({
      id: "note",
      type: "pane",
      size: { weight: 1 },
      ref: note(1),
    });
    const whole = toLayout(row(note(1)));
    expect(toLayout(whole)).toBe(whole);
  });

  it("copies refs, so a layout never shares params with the code that built it", () => {
    const ref = note(1);
    const layout = toLayout(ref);
    expect(layout.root.type === "pane" && layout.root.ref).not.toBe(ref);
  });
});
