/**
 * What an app reads (docs/DECISIONS.md, "Stabilisation step 7a"): `jali.get()` and `jali.model()` are Jali's own
 * public shapes, worked out from the engine's state and kept while nothing they hold changed, so a selector over them
 * hears only what it reads. Each pane says where it is (`where`), and the model finds a pane by object (`paneOf`).
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row, tabs, type JaliOptions } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const names: Record<number, string> = { 1: "Alpha", 2: "Beta", 3: "Gamma" };
const note = {
  kind: "note",
  title: (p: { id: number }) => names[p.id] ?? `Note ${p.id}`,
  params: { id: Number },
  width: { min: 300 },
};
// Another kind of pane for the same objects: a note's card shows a note.
const card = {
  kind: "card",
  title: "Card",
  params: { id: Number },
  shows: "note",
  width: { min: 300 },
};
const launcher = { kind: "new", title: "New pane" };
const n = (id: number) => ({ kind: "note", params: { id } });

const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note, card],
    launcher,
    layout: row(pane(n(1), { id: "a" }), pane(n(2), { id: "b" }), pane(n(3), { id: "c" })),
    storage: memoryStorage(),
    size: { width: 1500, height: 800 },
    moveFocus: false,
    ...o,
  });

const where = (jali: ReturnType<typeof make>) =>
  Object.fromEntries(jali.model().panes.map((p) => [p.id, p.where]));

describe("the public state", () => {
  it("is the same object while the engine changes only what it doesn't hold", () => {
    const jali = make();
    const s = jali.get();
    const store = storeOf(jali);
    store.set({ paletteOpen: true });
    store.announce("Something said");
    store.actions.setPaneState("a", "draft", "x");
    expect(jali.get()).toBe(s);
  });

  it("is a new object when focus moves, keeping every field that didn't change", () => {
    const jali = make();
    const s = jali.get();
    jali.actions.focus("b");
    const t = jali.get();
    expect(t).not.toBe(s);
    expect(t.view).toEqual({ focused: "b" });
    expect(t.layout).toBe(s.layout);
    expect(t.settings).toBe(s.settings);
    expect(t.selection).toBe(s.selection);
  });

  it("can't be edited", () => {
    const jali = make();
    expect(() => ((jali.get() as { presetId?: string }).presetId = "x")).toThrow(TypeError);
    expect(() => ((jali.get().view as { focused?: string }).focused = "x")).toThrow(TypeError);
  });

  it("lists the presets by id and label", () => {
    const jali = make({
      presets: [
        { id: "one", label: "One", layout: n(1) },
        { id: "two", label: "Two", layout: row(n(1), n(2)) },
      ],
    });
    expect(jali.presets).toEqual([
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
    ]);
    jali.actions.preset(jali.presets[1]!.id);
    expect(jali.get().presetId).toBe("two");
  });
});

describe("the public model", () => {
  it("says what each pane shows, its name, where it is and what it is linked to", () => {
    const jali = make();
    const [a] = jali.model().panes;
    expect(a).toEqual({
      id: "a",
      ref: n(1),
      title: "Alpha",
      where: "shown",
      focused: true,
      // In the root's coordinates: inside its inset (the gap, 6px).
      box: { x: 6, y: 6, width: expect.any(Number), height: 800 },
      follows: false,
      kept: false,
      pinned: false,
    });
    expect(jali.model().pane("b")?.box?.x).toBeGreaterThan(a!.box!.width);
  });

  it("keeps the model and each pane while the engine changes only what they don't hold", () => {
    const jali = make();
    const m = jali.model();
    const store = storeOf(jali);
    store.set({ paletteOpen: true });
    store.actions.setPaneState("a", "draft", "x");
    store.actions.setUnsaved("a", "a draft");
    expect(jali.model()).toBe(m);
  });

  it("makes new objects only for the panes that changed: focus, a selection, a title", () => {
    const jali = make();
    const m = jali.model();
    const [a, b, c] = m.panes;
    jali.actions.focus("b");
    const after = jali.model();
    expect(after).not.toBe(m);
    expect(after.panes[0]).not.toBe(a);
    expect(after.panes[1]).toMatchObject({ id: "b", focused: true });
    expect(after.panes[2]).toBe(c);

    jali.actions.select("c", n(9));
    expect(jali.model().pane("c")?.selected).toEqual(n(9));
    expect(jali.model().pane("b")).toBe(after.panes[1]);

    const selected = jali.model().pane("c");
    storeOf(jali).actions.setTitle("a", "A title of its own");
    expect(jali.model().pane("a")?.title).toBe("A title of its own");
    expect(jali.model().pane("c")).toBe(selected);
    expect(b).not.toBe(after.panes[1]);
  });

  it("reads a kind's title again on every read: a title can come from the app's own data", () => {
    const jali = make();
    const m = jali.model();
    names[2] = "Renamed";
    try {
      const after = jali.model();
      expect(after.pane("b")?.title).toBe("Renamed");
      expect(after).not.toBe(m);
      expect(after.pane("a")).toBe(m.pane("a"));
      expect(jali.model()).toBe(after);
    } finally {
      names[2] = "Beta";
    }
  });

  it("can't be edited", () => {
    const jali = make();
    const m = jali.model();
    expect(() => (m.panes as unknown[]).pop()).toThrow(TypeError);
    expect(() => ((m.panes[0] as { title: string }).title = "x")).toThrow(TypeError);
  });
});

describe("where a pane is", () => {
  it("tab: behind another tab of its group; shown again when focused", () => {
    const jali = make({
      layout: row(pane(n(1), { id: "a" }), tabs(pane(n(2), { id: "b" }), pane(n(3), { id: "c" }))),
    });
    expect(where(jali)).toEqual({ a: "shown", b: "shown", c: "tab" });
    expect(jali.model().pane("c")?.box).toBeNull();
    jali.actions.focus("c");
    expect(where(jali)).toEqual({ a: "shown", b: "tab", c: "shown" });
  });

  it("tucked: on the shelf; shown again when put back", () => {
    const jali = make();
    expect(jali.actions.tuck("b").ok).toBe(true);
    expect(jali.model().pane("b")).toMatchObject({ where: "tucked", box: null });
    jali.actions.putBack("b");
    expect(jali.model().pane("b")?.where).toBe("shown");
  });

  it("folded: no room for it; shown again when focused, folding another", () => {
    const jali = make({ size: { width: 700, height: 800 } });
    const folded = jali.model().panes.filter((p) => p.where === "folded");
    expect(folded.length).toBeGreaterThan(0);
    jali.actions.focus(folded[0]!.id);
    expect(jali.model().pane(folded[0]!.id)?.where).toBe("shown");
    expect(jali.model().panes.filter((p) => p.where === "folded").length).toBe(folded.length);
  });

  it("hidden: behind a maximised pane, which fills the room; back when restored", () => {
    const jali = make();
    jali.actions.focus("b");
    jali.actions.toggleZoom();
    expect(where(jali)).toEqual({ a: "hidden", b: "shown", c: "hidden" });
    expect(jali.model().pane("b")?.box).toEqual({ x: 6, y: 6, width: 1500, height: 800 });
    jali.actions.toggleZoom();
    expect(where(jali)).toEqual({ a: "shown", b: "shown", c: "shown" });
  });

  it("hidden: taken off screen by the layout, with no slot and no tab", () => {
    const jali = make({
      layout: row(pane(n(1), { id: "a" }), pane(n(2), { id: "b", hidden: true })),
    });
    expect(where(jali)).toEqual({ a: "shown", b: "hidden" });
  });

  it("hidden: scrolled out of its row's window; shown once the row scrolls to it", () => {
    const jali = make({
      layout: row(
        { scroll: "x", id: "strip" },
        ...[1, 2, 3, 4, 5, 6].map((i) => pane(n(i), { id: `p${i}`, px: 400 })),
      ),
      size: { width: 1000, height: 800 },
    });
    expect(jali.model().pane("p1")?.where).toBe("shown");
    expect(jali.model().pane("p6")).toMatchObject({ where: "hidden", box: null });
    storeOf(jali).actions.setScroll("strip", 2000);
    expect(jali.model().pane("p6")?.where).toBe("shown");
    expect(jali.model().pane("p1")?.where).toBe("hidden");
  });

  it("one pane at a time: the focused one is shown, the others keep why they aren't", () => {
    const jali = make({
      layout: tabs(pane(n(1), { id: "a" }), pane(n(2), { id: "b" })),
      size: { width: 400, height: 800 },
    });
    expect(where(jali)).toEqual({ a: "shown", b: "tab" });
    // Under the pane switcher (44px), across the whole root.
    expect(jali.model().pane("a")?.box).toEqual({ x: 0, y: 44, width: 412, height: 768 });
    jali.actions.focus("b");
    expect(where(jali)).toEqual({ a: "tab", b: "shown" });
    const crowded = make({ size: { width: 400, height: 800 } });
    expect(where(crowded)).toEqual({ a: "shown", b: "folded", c: "folded" });
    crowded.actions.focus("c");
    expect(crowded.model().pane("c")?.where).toBe("shown");
  });

  it("a closed pane is gone, and comes back where it was with Undo", () => {
    const jali = make();
    jali.actions.close("b");
    expect(jali.model().pane("b")).toBeUndefined();
    jali.actions.undo();
    expect(jali.model().pane("b")).toMatchObject({ where: "shown", ref: n(2) });
  });
});

describe("paneOf", () => {
  it("finds the pane showing an object, whatever kind shows it", () => {
    const jali = make({
      layout: row(pane(n(1), { id: "a" }), pane({ kind: "card", params: { id: 2 } }, { id: "b" })),
    });
    expect(jali.model().paneOf(n(1))?.id).toBe("a");
    expect(jali.model().paneOf({ kind: "card", params: { id: 1 } })?.id).toBe("a");
    expect(jali.model().paneOf(n(2))?.id).toBe("b");
    expect(jali.model().paneOf(n(3))).toBeUndefined();
  });

  it("finds nothing for a scratch kind: every one is new", () => {
    const scratch = { kind: "scratch", title: "Scratch", scratch: true };
    const jali = make({
      panes: [note, card, scratch],
      layout: row(pane(n(1), { id: "a" }), pane({ kind: "scratch", params: {} }, { id: "s" })),
    });
    expect(jali.model().pane("s")?.ref.kind).toBe("scratch");
    expect(jali.model().paneOf({ kind: "scratch", params: {} })).toBeUndefined();
  });
});
