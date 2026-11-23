/**
 * Undo reverses the operation; it never puts back an old layout (stabilisation step 3, findings UNDO and A2-5). An
 * undone close puts the pane back in its slot in the layout as it is now, so everything done since stays; an entry for
 * an object the host removed, or one open again, is dropped; "Back to …" closes the investigation's panes, and undo
 * reopens only those. Each test follows the action to its next consequence.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  column,
  createJali,
  memoryStorage,
  pane,
  row,
  tabs,
  layout as L,
  type LayoutInput,
  type ObjectRef,
} from "@jali/core";
import { paneStateFor, storeOf } from "@jali/core/adapter";
import { createTestStore } from "./fixtures/workspace";
import type { JaliStore } from "../src/state/store";

const rec = (id: number): ObjectRef => ({ kind: "rec", params: { id } });
const note = (n: number): ObjectRef => ({ kind: "note", params: { n } });
const kinds = [
  {
    kind: "rec",
    title: "Record",
    params: { id: Number } as Record<string, NumberConstructor>,
    width: { min: 120 },
    height: { min: 80 },
  },
  {
    kind: "note",
    title: "Note",
    params: { n: Number } as Record<string, NumberConstructor>,
    width: { min: 120 },
    height: { min: 80 },
    scratch: true,
  },
];
const make = (
  layout: LayoutInput,
  beforeClose?: Parameters<typeof createJali>[0]["beforeClose"],
) => {
  const jali = createJali({
    panes: kinds,
    layout,
    storage: memoryStorage(),
    size: { width: 2400, height: 1200 },
    moveFocus: false,
    ...(beforeClose ? { beforeClose } : {}),
  });
  return { jali, a: jali.actions, store: storeOf(jali) };
};
type Made = ReturnType<typeof make>;
const tree = (m: Made) => m.jali.getLayout().root;
const node = (m: Made, id: string) => L.tree.find(m.jali.getLayout().root as never, id);
const parentOf = (m: Made, id: string) => L.tree.parent(m.jali.getLayout().root as never, id);
const ids = (m: Made) => L.tree.panes(tree(m) as never).map((p) => p.id);
const refs = (m: Made) => L.tree.panes(tree(m) as never).map((p) => p.ref);

describe("an undone close puts the pane back in its slot, and keeps what happened since", () => {
  it("close B, open a pane, pin C, undo: B is back in its slot; the opened pane and C's pin stay", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b", px: 300 }),
        tabs({ id: "t" }, pane(rec(4), { id: "d" }), pane(rec(3), { id: "c" })),
      ),
    );
    m.a.close("b");
    const opened = m.a.openBeside("a", rec(9)).pane!;
    expect(m.a.setPinned("c", true).ok).toBe(true);
    expect(m.a.undo().ok).toBe(true);
    // B: the same parent, at the same place, with its own size.
    expect(parentOf(m, "b")?.id).toBe("r");
    expect(node(m, "b")?.size).toEqual({ px: 300 });
    expect(parentOf(m, "b")!.children.map((c) => c.id)).toEqual(["a", "b", opened, "t"]);
    // What was done since stays.
    expect(ids(m)).toContain(opened);
    expect(node(m, "c")).toMatchObject({ pinned: true });
    expect(parentOf(m, "c")?.children[0]?.id).toBe("c");
  });

  it("a tab comes back into its tab group, at its place", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        tabs(
          { id: "t" },
          pane(rec(2), { id: "b" }),
          pane(rec(3), { id: "c" }),
          pane(rec(4), { id: "d" }),
        ),
      ),
    );
    m.a.close("c");
    m.a.undo();
    expect(parentOf(m, "c")?.id).toBe("t");
    expect(parentOf(m, "c")!.children.map((c) => c.id)).toEqual(["b", "c", "d"]);
  });

  it("the space the closed pane gave back returns to it, unless the neighbour was resized since", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b" }),
        pane(rec(3), { id: "c" }),
      ),
    );
    const before = m.jali.getLayout();
    m.a.close("b");
    m.a.undo();
    expect(m.jali.getLayout().root).toEqual(before.root);
  });

  it("close others, then undo: every pane is back in its slot", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a", px: 300 }),
        column({ id: "k" }, pane(rec(2), { id: "b" }), pane(rec(3), { id: "c" })),
        pane(rec(4), { id: "d" }),
      ),
    );
    const shape = L.tree.shape(tree(m) as never);
    m.a.closeOthers("d");
    expect(ids(m)).toEqual(["d"]);
    m.a.undo();
    expect(L.tree.shape(tree(m) as never)).toBe(shape);
    expect(node(m, "a")?.size).toEqual({ px: 300 });
    // One entry: nothing left to undo.
    expect(m.store.get().undoStack).toEqual([]);
  });

  it("close tabs, then undo: each tab is back at its place, in one undo", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        tabs(
          { id: "t" },
          pane(rec(2), { id: "b" }),
          pane(rec(3), { id: "c" }),
          pane(rec(4), { id: "d" }),
        ),
      ),
    );
    m.a.closeTabs("b", "others");
    expect(ids(m)).toEqual(["a", "b"]);
    m.a.undo();
    expect(parentOf(m, "c")?.id).toBe("t");
    expect(parentOf(m, "c")!.children.map((c) => c.id)).toEqual(["b", "c", "d"]);
  });

  it("a pane whose parent was closed meanwhile comes back beside its old neighbour", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        column(
          { id: "k" },
          pane(rec(2), { id: "b" }),
          pane(rec(3), { id: "c" }),
          pane(rec(4), { id: "e" }),
        ),
      ),
    );
    m.a.close("c");
    m.a.remove("e"); // the column holds only B now: it goes, and B takes its place
    expect(node(m, "k")).toBeUndefined();
    m.a.undo();
    const p = parentOf(m, "c")!;
    expect(p.type).toBe("column");
    expect(p.children.map((c) => c.id)).toEqual(["b", "c"]);
    expect(ids(m)).toEqual(["a", "b", "c"]);
  });

  it("a pane with no parent and no neighbour left comes back at the end", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        column({ id: "k" }, pane(rec(2), { id: "b" }), pane(rec(3), { id: "c" })),
      ),
    );
    m.a.close("c");
    const x = m.a.openBeside("a", rec(9)).pane!;
    m.a.remove("b");
    m.a.remove("a");
    expect(ids(m)).toEqual([x]);
    m.a.undo();
    expect(ids(m)).toEqual([x, "c"]);
  });

  it("a closed pane whose id a new pane took comes back under another id, and both keep their state", () => {
    const m = make(
      row({ id: "r" }, pane(rec(1), { id: "pane-1" }), pane(rec(2), { id: "pane-2" })),
    );
    m.a.close("pane-2");
    expect(m.a.openBeside("pane-1", rec(9)).pane).toBe("pane-2");
    m.a.undo();
    expect(refs(m)).toEqual(expect.arrayContaining([rec(1), rec(2), rec(9)]));
    expect(node(m, "pane-2")).toMatchObject({ ref: rec(9) });
  });

  it("an undone close brings the pane's state back", () => {
    const m = make(row({ id: "r" }, pane(rec(1), { id: "a" }), pane(rec(2), { id: "b" })));
    m.store.actions.setPaneState("b", "scroll", 240);
    m.a.close("b");
    m.a.openBeside("a", rec(3));
    m.a.undo();
    const s = m.store.get();
    expect(paneStateFor(s, m.store.env.kinds, "b", rec(2))).toEqual({ scroll: 240 });
  });

  it("the state of a closed pane whose id was taken comes back with it, under its new id", () => {
    const m = make(
      row({ id: "r" }, pane(rec(1), { id: "pane-1" }), pane(rec(2), { id: "pane-2" })),
    );
    m.store.actions.setPaneState("pane-2", "scroll", 240);
    m.a.close("pane-2");
    m.a.openBeside("pane-1", rec(9));
    m.store.actions.setPaneState("pane-2", "sort", "date");
    m.a.undo();
    const s = m.store.get();
    const back = L.tree.panes(tree(m) as never).find((p) => p.ref.params.id === 2)!;
    expect(paneStateFor(s, m.store.env.kinds, back.id, rec(2))).toEqual({ scroll: 240 });
    expect(paneStateFor(s, m.store.env.kinds, "pane-2", rec(9))).toEqual({ sort: "date" });
  });

  it("the link a close dropped comes back with the pane", () => {
    const m = make(
      row({ id: "r" }, pane(rec(1), { id: "a" }), pane(rec(2), { id: "b", linkedTo: "a" })),
    );
    m.a.close("a");
    expect(node(m, "b")).not.toHaveProperty("linkedTo");
    m.a.undo();
    expect(node(m, "b")).toMatchObject({ linkedTo: "a" });
  });
});

describe("an undone batch keeps what each pane was (Codex review of step 3)", () => {
  it("a batch whose ids were taken meanwhile comes back in its own tab group", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        tabs({ id: "t" }, pane(rec(2), { id: "pane-1" }), pane(rec(3), { id: "pane-2" })),
      ),
    );
    m.a.closeOthers("a");
    expect(m.a.openBeside("a", rec(9)).pane).toBe("pane-1");
    m.a.undo();
    const at = (id: number) => L.tree.panes(tree(m) as never).find((p) => p.ref.params.id === id)!;
    const group = parentOf(m, at(2).id)!;
    expect(group.type).toBe("stack");
    expect(group.children.map((c) => (c as { ref: ObjectRef }).ref)).toEqual([rec(2), rec(3)]);
    expect(parentOf(m, "pane-1")?.type).not.toBe("stack");
  });

  it("a restored link never attaches to an unrelated pane under its old source's id", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "pane-1" }),
        pane(rec(3), { id: "b", linkedTo: "pane-1", follows: true }),
      ),
    );
    m.a.close("b");
    m.a.remove("pane-1");
    expect(m.a.openBeside("a", rec(9)).pane).toBe("pane-1");
    m.a.undo();
    expect(node(m, "b")).not.toHaveProperty("linkedTo");
    expect(node(m, "b")).not.toHaveProperty("follows");
  });

  it("nested panes keep their own sizes when their container is made again", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        column(
          { id: "k", weight: 2 },
          pane(rec(2), { id: "b", px: 250 }),
          pane(rec(3), { id: "c", weight: 3 }),
        ),
        pane(rec(4), { id: "d" }),
      ),
    );
    m.a.closeOthers("d");
    m.a.undo();
    expect(node(m, "k")?.size).toEqual({ weight: 2 });
    expect(node(m, "b")?.size).toEqual({ px: 250 });
    expect(node(m, "c")?.size).toEqual({ weight: 3 });
  });

  it("a tucked pane comes back tucked, and so does one tucked into a pane that comes back", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b" }),
        pane(rec(3), { id: "c" }),
      ),
    );
    expect(m.a.tuck("b").ok).toBe(true);
    const tucked = () => m.jali.getLayout().overlay?.tucks.map((t) => [t.pane, t.home]);
    const home = tucked()![0]![1];
    m.a.close("b");
    m.a.undo();
    expect(tucked()).toEqual([["b", home]]);
    m.a.close(home);
    expect(tucked() ?? []).toEqual([]);
    m.a.undo();
    expect(tucked()).toEqual([["b", home]]);
  });

  it("a row that scrolls comes back scrolling", () => {
    const m = make(
      column(
        { id: "col" },
        pane(rec(1), { id: "a" }),
        row({ id: "s", scroll: "x" }, pane(rec(2), { id: "b" }), pane(rec(3), { id: "c" })),
      ),
    );
    m.a.closeOthers("a");
    m.a.undo();
    expect(node(m, "s")).toMatchObject({ type: "row", scroll: "x" });
  });
});

describe("entries for what is gone or open again are dropped", () => {
  it("close B, remove C, undo: only B comes back", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b" }),
        pane(rec(3), { id: "c" }),
      ),
    );
    m.a.close("b");
    m.a.remove("c");
    m.a.undo();
    expect(ids(m)).toEqual(["a", "b"]);
  });

  it("removing a closed pane's object drops its entry; within a batch, only its own", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b" }),
        pane(rec(3), { id: "c" }),
      ),
    );
    m.a.closeOthers("a");
    expect(m.a.remove(rec(2)).ok).toBe(true);
    m.a.undo();
    expect(ids(m)).toEqual(["a", "c"]);
    // By id too, and an object never open is still not found.
    m.a.close("c");
    expect(m.a.remove("c").ok).toBe(true);
    expect(m.store.get().undoStack).toEqual([]);
    expect(m.a.remove("zzz")).toMatchObject({ ok: false, reason: "not-found" });
  });

  it("a closed pane whose object is open again is not duplicated", () => {
    const m = make(
      row(
        { id: "r" },
        pane(rec(1), { id: "a" }),
        pane(rec(2), { id: "b" }),
        pane(rec(3), { id: "c" }),
      ),
    );
    m.a.close("b");
    m.a.openBeside("a", rec(2));
    expect(m.a.undo()).toMatchObject({ ok: false, reason: "nothing-to-do" });
    expect(refs(m).filter((r) => r.params.id === 2)).toHaveLength(1);
    // Within a batch, only that pane's part goes.
    m.a.closeOthers("a");
    m.a.openBeside("a", rec(3));
    m.a.undo();
    expect(refs(m).filter((r) => r.params.id === 3)).toHaveLength(1);
    expect(refs(m).filter((r) => r.params.id === 2)).toHaveLength(1);
  });

  it("a scratch pane is its own: one like it open again doesn't drop it", () => {
    const m = make(row({ id: "r" }, pane(rec(1), { id: "a" }), pane(note(1), { id: "n" })));
    m.a.close("n");
    m.a.openBeside("a", note(1));
    m.a.undo();
    expect(refs(m).filter((r) => r.kind === "note")).toHaveLength(2);
  });
});

describe("an undo entry is published only with the close", () => {
  it("a refused close publishes none", () => {
    const m = make(row(pane(rec(1), { id: "a" }), pane(rec(2), { id: "b" })), () => false);
    expect(m.a.close("b").ok).toBe(false);
    expect(m.store.get().undoStack).toEqual([]);
  });

  it("a held close publishes none until it is allowed, then one", async () => {
    let allow!: (yes: boolean) => void;
    const m = make(
      row(pane(rec(1), { id: "a" }), pane(rec(2), { id: "b" })),
      () => new Promise<boolean>((r) => (allow = r)),
    );
    const r = m.a.close("b");
    expect(r).toMatchObject({ ok: false, reason: "pending" });
    expect(m.store.get().undoStack).toEqual([]);
    allow(true);
    await (r as { settled: Promise<unknown> }).settled;
    expect(m.store.get().undoStack).toHaveLength(1);
  });
});

describe("Back to the page closes the investigation; undo reopens only it", () => {
  let store: JaliStore;
  beforeEach(() => {
    localStorage.clear();
    store = createTestStore({ initial: { area: { width: 1920, height: 1000 } } });
    store.run("page.open", { item: 4, tab: "application" });
    store.run("page.setMode", "split");
  });
  const roles = () => store.model().panes.filter((p) => p.role);
  const opened = () => store.model().panes.filter((p) => !p.role);

  const sizeOf = (id: string) => L.tree.find(store.get().layout.root, id)!.size;
  const loan = (id: number) => ({ kind: "review-record", params: { table: "loans", id } });

  it("keeps a role's resize and a pin made during the investigation", () => {
    const first = store.actions.openBeside("application", loan(77)).pane!;
    expect(opened()).toHaveLength(1);
    // During the investigation: the divider after Application dragged, and Borrower pinned.
    const divider = store
      .model()
      .resolved.dividers.find(
        (d) => d.parentId === "arrangement" && d.neighbours?.[0].includes("application"),
      )!;
    expect(store.actions.resizeDivider("arrangement", divider.index, 60).ok).toBe(true);
    const resized = { application: sizeOf("application"), context: sizeOf("context") };
    expect(store.actions.setPinned("borrower", true).ok).toBe(true);
    store.run("page.back");
    expect(opened()).toHaveLength(0);
    expect({ application: sizeOf("application"), context: sizeOf("context") }).toEqual(resized);
    expect(L.tree.find(store.get().layout.root, "borrower")).toMatchObject({ pinned: true });
    expect(store.get().page).not.toHaveProperty("before");
    // Undo reopens the opened pane, and keeps both.
    store.actions.undo();
    expect(opened().map((p) => p.id)).toEqual([first]);
    expect({ application: sizeOf("application"), context: sizeOf("context") }).toEqual(resized);
    expect(L.tree.find(store.get().layout.root, "borrower")).toMatchObject({ pinned: true });
  });

  it("undo after it reopens only the investigation's panes, and keeps what changed since", () => {
    const first = store.actions.openBeside("application", loan(77)).pane!;
    store.actions.openBeside(first, loan(78));
    expect(opened()).toHaveLength(2);
    store.run("page.back");
    store.actions.setPinned("borrower", true);
    store.actions.undo();
    expect(opened().map((p) => p.ref.params.id)).toEqual([77, 78]);
    expect(roles()).toHaveLength(6);
    expect(L.tree.find(store.get().layout.root, "borrower")).toMatchObject({ pinned: true });
    expect(store.get().undoStack).toEqual([]);
  });

  it("undo keeps the page's placement rule: views go back to the tabs rather than fold", () => {
    store = createTestStore({ initial: { area: { width: 1300, height: 1000 } } });
    store.run("page.open", { item: 4, tab: "application" });
    store.run("page.setMode", "split");
    store.actions.openBeside("application", loan(77));
    store.run("page.back");
    store.actions.placeTab("officer", "application", "right");
    store.actions.undo();
    expect(opened()).toHaveLength(1);
    const folded = store
      .model()
      .resolved.panes.filter((b) => b.hidden === "tab" && roles().some((r) => r.id === b.id));
    expect(folded.map((b) => b.id)).toEqual([]);
  });
});
