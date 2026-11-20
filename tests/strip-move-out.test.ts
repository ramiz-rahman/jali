/**
 * "Move out of the row": a pane in a row that scrolls sideways leaves it from its menu or ⌘K, whichever pane of the
 * row it is, beside the row on the side it is nearer on screen. Like any move, it adds a history entry: Back puts the
 * pane back (Jali's Undo is for closing and tucking).
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type Jali } from "@jali/core";
import { definePane } from "@jali/react";
import { runCommand } from "../packages/core/src/commands/registry";
import { tabMenuOf } from "../packages/core/src/commands/tab-menu";
import { storeOf } from "../packages/core/src/state/instance";

const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  width: { min: 300, comfortable: 360 },
  Component: () => null,
});
const side = definePane("side", {
  params: { id: String },
  title: ({ id }) => `Side ${id}`,
  width: { min: 280, comfortable: 300 },
  Component: () => null,
});

const make = (location = memoryLocation()): Jali => {
  const jali = createJali({
    panes: [day, side],
    layout: row(
      { id: "outer" },
      pane(side({ id: "a" }), { id: "left", px: 300 }),
      row(
        { id: "week", scroll: "x" },
        ...[1, 2, 3, 4, 5].map((n) => pane(day({ n }), { id: `d${n}` })),
      ),
      pane(side({ id: "b" }), { id: "right", px: 300 }),
    ),
    url: { location },
    storage: memoryStorage(),
    size: { width: 1440, height: 900 },
    moveFocus: false,
  });
  return jali;
};
/** The outer row's children, and the week's, by id. */
const shape = (jali: Jali) => {
  const outer = jali.model().layout.root as {
    children: { id: string; children?: { id: string }[] }[];
  };
  return outer.children.map((c) =>
    c.id === "week" ? { week: c.children!.map((d) => d.id) } : c.id,
  );
};
const menuIds = (jali: Jali, id: string) =>
  tabMenuOf(storeOf(jali), id)
    .flat()
    .map((i) => i.id);

describe("move out of the row", () => {
  it("is in the menu of a pane in the row, and of no other", () => {
    const jali = make();
    expect(menuIds(jali, "d3")).toContain("move-out-of-row");
    expect(menuIds(jali, "left")).not.toContain("move-out-of-row");
  });

  it("takes a pane in the row's left half out before the row", () => {
    const jali = make();
    jali.actions.focus("d1");
    expect(runCommand(jali, "pane.move.out")).toBe(true);
    expect(shape(jali)).toEqual(["left", "d1", { week: ["d2", "d3", "d4", "d5"] }, "right"]);
    expect(jali.get().view.focused).toBe("d1");
  });

  it("takes a pane in the row's right half out after it, from the middle of the row in one step", () => {
    const jali = make();
    // The week's window shows days 1 and 2 (1440 less the sides and gaps): day 2 is in its right half.
    jali.actions.moveOutOfRow("d2");
    expect(shape(jali)).toEqual(["left", { week: ["d1", "d3", "d4", "d5"] }, "d2", "right"]);
  });

  it("does nothing for a pane in no row that scrolls", () => {
    const jali = make();
    jali.actions.focus("left");
    const before = jali.model().layout;
    expect(runCommand(jali, "pane.move.out")).toBe(false);
    expect(jali.model().layout).toBe(before);
  });

  it("adds a history entry, as any move does, so Back puts the pane back", () => {
    const location = memoryLocation();
    const jali = make(location);
    const before = location.entries.length;
    jali.actions.moveOutOfRow("d2");
    expect(location.entries.length).toBe(before + 1);
  });
});
