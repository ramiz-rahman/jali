/** Auto layout (`layout.arrange`, `jali.actions.autoLayout`): the same panes, arranged from the room and the kinds. */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type Layout,
} from "@jali/core";
import { definePane } from "@jali/react";
import { createAgent } from "../../core/src/agent";

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

  it("adds a second row, below, only for what doesn't fit across, when the height has room", () => {
    // 320 + 4 × 360 + gaps is more than 1100 across: two rows, the first as full as it can be (320 + 2 × 360).
    const jali = make(
      row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 }), order({ id: 4 })),
      1100,
      900,
    );
    jali.actions.autoLayout();
    const s = shape(jali.getLayout()) as { column: { row: unknown[] }[] };
    expect(s.column.length).toBe(2);
    expect(s.column[0]!.row.length).toBe(3);
    expect(jali.model().visible.length).toBe(5);
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

  it("keeps linked panes side by side: a list, its detail and what the detail opened, in a row", () => {
    // At their comfortable widths these don't fit 1300 across, at their minimums they do: one row, in link order.
    const jali = make(
      tabs(
        pane(order({ id: 2 }), { id: "other" }),
        pane(list(), { id: "list" }),
        pane(order({ id: 1 }), { id: "detail", linkedTo: "list" }),
      ),
      1300,
      300,
    );
    jali.actions.autoLayout();
    expect(shape(jali.getLayout())).toEqual({ row: ["other", "list", "detail"] });
  });

  it("never shows fewer panes than the fit would", () => {
    // Four panes that fit across at their minimums: auto layout keeps them all on screen.
    const jali = make(row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 })), 1500, 300);
    expect(jali.model().visible.length).toBe(4);
    jali.actions.autoLayout();
    expect(jali.model().visible.length).toBe(4);
    expect(jali.model().folded).toEqual([]);
  });

  it("gives the same layout when run again", () => {
    for (const [w, h] of [
      [1600, 900],
      [1100, 900],
      [900, 300],
      [700, 900],
    ] as const) {
      const jali = make(
        row(list(), order({ id: 1 }), order({ id: 2 }), order({ id: 3 }), order({ id: 4 })),
        w,
        h,
      );
      jali.actions.autoLayout();
      const once = shape(jali.getLayout());
      jali.actions.autoLayout();
      expect(shape(jali.getLayout()), `${w}x${h}`).toEqual(once);
    }
  });

  it("keeps a row that scrolls sideways whole, with its own order and flag", () => {
    const jali = make(
      row(
        list(),
        row({ id: "week", scroll: "x" }, order({ id: 1 }), order({ id: 2 }), order({ id: 3 })),
        order({ id: 9 }),
      ),
      1100,
      300,
    );
    const before = layout.tree.find(jali.getLayout().root, "week")!;
    jali.actions.autoLayout();
    const week = layout.tree.find(jali.getLayout().root, "week");
    expect(week).toMatchObject({ type: "row", scroll: "x" });
    expect(layout.tree.panes(week!).map((p) => p.id)).toEqual(
      layout.tree.panes(before).map((p) => p.id),
    );
  });

  it("puts a pane opened from another beside it, and what doesn't fit in tabs with the pane before it", () => {
    // 700 across and 300 high: two panes fit, in one row. "c" was opened from the list, so it comes right after it.
    const jali = make(
      row(
        pane(list(), { id: "list" }),
        pane(order({ id: 1 }), { id: "a" }),
        pane(order({ id: 2 }), { id: "b" }),
        pane(order({ id: 3 }), { id: "c", linkedTo: "list" }),
      ),
      700,
      300,
    );
    jali.actions.autoLayout();
    expect(shape(jali.getLayout())).toEqual({ row: ["list", { stack: ["c", "a", "b"] }] });
    // The cell's own pane shows.
    expect(jali.model().visible).toEqual(["list", "c"]);
  });

  it("keeps a hidden pane hidden", () => {
    const jali = make(
      row(list(), order({ id: 1 }), pane(order({ id: 2 }), { id: "off", hidden: true })),
      1600,
      900,
    );
    expect(jali.model().off).toEqual(["off"]);
    jali.actions.autoLayout();
    expect(jali.model().off).toEqual(["off"]);
    expect(jali.model().visible).not.toContain("off");
  });
});

/**
 * The pure step against the cases an adversarial review found (GPT 6.2 Sol, 20 Nov 2026): panes lost under a row
 * that scrolls, a hidden pane copied, linked panes split by a row break, a row ended early by a wide pane, a second
 * row vetoed by a tall one, a tab that made its cell too wide, and names that changed on every run.
 */
describe("layout.arrange, adversarially", () => {
  type K = [string, number, number, number?];
  const registry = (...ks: K[]) =>
    Object.fromEntries(
      ks.map(([kind, minWidth, minHeight, comfortableWidth]) => [
        kind,
        { kind, minWidth, minHeight, comfortableWidth, title: () => kind },
      ]),
    ) as never;
  const ctx = (kinds: never, width: number, height: number, paneCap = 10) => ({
    fit: { width, height, gap: 10, kinds },
    paneCap,
  });
  const p = (id: string, kind = "w300", extra: Record<string, unknown> = {}) =>
    ({ id, type: "pane", size: { weight: 1 }, ref: { kind, params: {} }, ...extra }) as const;
  const split = (type: "row" | "column", id: string, children: unknown[], extra = {}) =>
    ({ id, type, size: { weight: 1 }, children, ...extra }) as never;
  const lay = (root: unknown, overlay?: unknown): Layout =>
    ({ version: 1, root, ...(overlay ? { overlay } : {}) }) as Layout;
  const ids = (l: Layout) => layout.tree.panes(l.root).map((x) => x.id);
  const kinds = registry(
    ["w300", 300, 180],
    ["w350", 350, 180],
    ["w200", 200, 180],
    ["w450", 450, 180],
    ["w100", 100, 180],
    ["w400", 400, 180],
    ["tall", 300, 350],
  );
  const once = (l: Layout, c: ReturnType<typeof ctx>) => {
    const out = layout.arrange(l, c);
    expect([...ids(out)].sort()).toEqual([...ids(l)].sort());
    expect(new Set(ids(out)).size).toBe(ids(out).length);
    expect(layout.validate(out, c.fit.kinds)).toEqual({ ok: true });
    return out;
  };

  it("never loses a pane when a row that scrolls takes the only place", () => {
    const l = lay(
      split("row", "r", [
        p("A", "w350"),
        split("row", "s", [p("B", "w350"), p("C", "w350")], { scroll: "x" }),
      ]),
    );
    once(l, ctx(kinds, 650, 300));
    // Two strips competing for one place: both stay.
    const two = lay(
      split("row", "r", [
        split("row", "s1", [p("A", "w350"), p("B", "w350")], { scroll: "x" }),
        split("row", "s2", [p("C", "w350"), p("D", "w350")], { scroll: "x" }),
      ]),
    );
    const out = once(two, ctx(kinds, 400, 300));
    expect(layout.tree.find(out.root, "s1")).toBeDefined();
    expect(layout.tree.find(out.root, "s2")).toBeDefined();
  });

  it("keeps a hidden pane inside a row that scrolls exactly once, and hidden", () => {
    const l = lay(
      split("row", "r", [p("A"), split("row", "s", [p("B"), p("C")], { scroll: "x" })]),
      {
        tucks: [],
        folds: [],
        shown: {},
        hidden: ["C"],
      },
    );
    const out = once(l, ctx(kinds, 900, 300));
    expect(out.overlay?.hidden).toEqual(["C"]);
  });

  it("keeps a linked pair on one row when a row break would split it", () => {
    const l = lay(split("row", "r", [p("X"), p("A"), p("B", "w300", { linkedTo: "A" })]));
    const out = once(l, ctx(kinds, 610, 400));
    const rows = (out.root as { children: Layout["root"][] }).children.map((c) =>
      layout.tree.panes(c).map((x) => x.id),
    );
    expect(rows).toContainEqual(["A", "B"]);
  });

  it("goes on past a pane too wide for what's left of the row, and a too-tall pane doesn't veto the second row", () => {
    // 200 + 450 + 100 at 610 across: A and C fit, B waits as a tab.
    const wide = once(
      lay(split("row", "r", [p("A", "w200"), p("B", "w450"), p("C", "w100")])),
      ctx(kinds, 610, 300),
    );
    expect(layout.tree.panes(wide.root).length).toBe(3);
    expect((wide.root as { children: unknown[] }).children.length).toBe(2);
    // Four 300s at 610 × 400, the last 350 tall: the second row still takes C.
    const tall = once(
      lay(split("row", "r", [p("A"), p("B"), p("C"), p("D", "tall")])),
      ctx(kinds, 610, 400),
    );
    expect(tall.root.type).toBe("column");
  });

  it("puts a tab where its width still fits, so the fit has no reason to fold a whole cell", () => {
    // B and C (400) together are wider than the room beside A: C goes behind A instead.
    const l = lay(
      split("row", "r", [
        {
          id: "t",
          type: "stack",
          size: { weight: 1 },
          active: "A",
          children: [p("A"), p("C", "w400", { linkedTo: "B" })],
        },
        p("B", "w200"),
      ]),
    );
    const out = once(l, ctx(kinds, 610, 300));
    const fitted = layout.resolve(
      layout.refit(out, { focusHistory: [] }, ctx(kinds, 610, 300)),
      { focusHistory: [] },
      ctx(kinds, 610, 300),
    );
    expect(
      fitted.panes
        .filter((b) => !b.hidden)
        .map((b) => b.id)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  it("is the same layout, names and all, when run on its own result", () => {
    for (const [w, h, focused] of [
      [800, 300, undefined],
      [610, 300, "C"],
      [1000, 400, "B"],
    ] as const) {
      const l = lay(split("row", "r", [p("A"), p("B"), p("C"), p("D", "w200")]));
      const first = layout.arrange(l, ctx(kinds, w, h), { focused });
      expect(layout.arrange(first, ctx(kinds, w, h), { focused })).toBe(first);
    }
  });

  it("holds for random layouts: every pane once, valid, and stable", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    const kindNames = ["w300", "w350", "w200", "w450", "w100", "w400", "tall"];
    for (let t = 0; t < 500; t++) {
      const count = 2 + Math.floor(rnd() * 8);
      const panes = Array.from({ length: count }, (_, i) =>
        p(
          `p${i}`,
          pick(kindNames),
          i && rnd() < 0.4 ? { linkedTo: `p${Math.floor(rnd() * i)}` } : {},
        ),
      );
      const strip = count > 3 && rnd() < 0.3;
      const kids: unknown[] = strip
        ? [
            ...panes.slice(0, 2),
            split("row", "s", panes.slice(2, 4), { scroll: "x" }),
            ...panes.slice(4),
          ]
        : panes;
      const l = lay(split("row", "r", kids));
      const c = ctx(
        kinds,
        pick([400, 610, 900, 1280, 1920]),
        pick([300, 400, 800, 1080]),
        pick([3, 5, 10]),
      );
      const out = once(l, c);
      const again = layout.arrange(out, c);
      if (again !== out)
        throw new Error(
          `case ${t}: ${JSON.stringify(c.fit.width)}x${c.fit.height} cap ${c.paneCap}\n${JSON.stringify(l.root)}\n${JSON.stringify(out.root)}\n${JSON.stringify(again.root)}`,
        );
    }
  });
});

describe("jali.actions.autoLayout", () => {
  it("says nothing-to-do when the workspace is already arranged, and adds no history entry", () => {
    const location = memoryLocation();
    const jali = createJali({
      panes: [list, order],
      layout: row(list(), order({ id: 1 }), order({ id: 2 })),
      url: { location },
      storage: memoryStorage(),
      size: { width: 1600, height: 900 },
      moveFocus: false,
    });
    expect(jali.actions.autoLayout()).toMatchObject({ ok: true });
    const entries = location.entries.length;
    expect(jali.actions.autoLayout()).toMatchObject({ ok: false, reason: "nothing-to-do" });
    expect(location.entries.length).toBe(entries);
  });

  it("refuses when a pane may not move, and on a phone", () => {
    const locked = createJali({
      panes: [list, order],
      layout: row(list(), order({ id: 1 })),
      allow: { move: false },
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1600, height: 900 },
      moveFocus: false,
    });
    expect(locked.actions.autoLayout()).toMatchObject({ ok: false, reason: "not-allowed" });
    expect(make(row(list(), order({ id: 1 })), 390, 844).actions.autoLayout()).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("an agent's automatic arrange asks allow, skips a turn that chose a preset, and is quiet on a phone", () => {
    const steps = (jali: ReturnType<typeof make>, options: Parameters<typeof createAgent>[1]) =>
      createAgent(jali, options).act({
        steps: [{ action: "addTab", args: [jali.model().visible[0]!, order({ id: 7 })] }],
      }).steps;
    // The app's allow says no to autoLayout: the turn's own step runs, the automatic one doesn't.
    const vetoed = steps(make(row(list(), order({ id: 1 }))), {
      arrange: "after-changes",
      allow: ({ action }) => action !== "autoLayout",
    });
    expect(vetoed.map((s) => s.action)).toEqual(["addTab"]);
    // On a phone there is nothing to arrange: no failed step reported.
    const phone = steps(make(row(list(), order({ id: 1 })), 390, 844), {
      arrange: "after-changes",
    });
    expect(phone.map((s) => s.action)).toEqual(["addTab"]);
  });
});
