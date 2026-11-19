/** Auto layout (`layout.arrange`, `jali.actions.autoLayout`): the same panes, arranged from the room and the kinds. */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  row,
  tabs,
  type Layout,
} from "@jali/core";
import { definePane } from "@jali/react";

const list = definePane("list", {
  title: () => "Orders",
  width: { min: 320 },
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 360, comfortable: 480 },
  Component: () => null,
});

const make = (l: Parameters<typeof createJali>[0]["layout"], width = 1600, height = 900) =>
  createJali({
    panes: [list, order],
    layout: l,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width, height },
    moveFocus: false,
  });

/** The tree's shape: types down from the root, panes by id. */
const shape = (l: Layout): unknown => {
  const walk = (n: Layout["root"]): unknown =>
    n.type === "pane" ? n.id : { [n.type]: n.children.map(walk) };
  return walk(l.root);
};

describe("auto layout", () => {
  it("puts panes that fit side by side, keeping their ids, links and pins", () => {
    const jali = make(tabs(list(), order({ id: 1 }), order({ id: 2 })));
    const before = layout.tree.panes(jali.getLayout().root);
    expect(jali.actions.autoLayout()).toMatchObject({ ok: true });
    const after = layout.tree.panes(jali.getLayout().root);
    expect(after.map((p) => p.id).sort()).toEqual(before.map((p) => p.id).sort());
    expect(jali.getLayout().root.type).toBe("row");
    expect(jali.model().visible.length).toBe(3);
  });

  it("stacks a second row when the width runs out and the height has room", () => {
    const jali = make(
      row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 }), order({ id: 4 })),
      1100,
      900,
    );
    jali.actions.autoLayout();
    const s = shape(jali.getLayout()) as { row: unknown[] };
    expect(s.row.length).toBe(2);
    expect(jali.model().visible.length).toBe(4);
  });

  it("puts what doesn't fit in tabs, and keeps the focused pane shown", () => {
    const jali = make(row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 })), 900, 300);
    const last = layout.tree.panes(jali.getLayout().root).at(-1)!.id;
    jali.actions.focus(last);
    jali.actions.autoLayout();
    const stacks: string[] = [];
    const walk = (n: Layout["root"]) => {
      if (n.type === "stack") stacks.push(n.active);
      else if (n.type !== "pane") n.children.forEach(walk);
    };
    walk(jali.getLayout().root);
    expect(stacks).toContain(last);
    expect(jali.model().visible).toContain(last);
  });

  it("says nothing-to-do with one pane, and is a layout change otherwise", () => {
    expect(make(list()).actions.autoLayout()).toMatchObject({ ok: false, reason: "nothing-to-do" });
    const jali = make(tabs(list(), order({ id: 1 })));
    const heard: string[] = [];
    jali.on("layout", () => heard.push("layout"));
    expect(jali.actions.autoLayout()).toMatchObject({ ok: true });
    expect(heard).toEqual(["layout"]);
  });
});
