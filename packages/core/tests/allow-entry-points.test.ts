/**
 * What a pane allows holds whatever asks (core-codex CORE-7). A divider's sides are the panes beside it on screen, not
 * the split's next two children (a fold puts another pane there); a reset and a drag's commit are checked like a key;
 * and the curated page's "Back to the page" keeps an opened pane the app won't let close, as `close` does.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  definePage,
  layout as L,
  memoryStorage,
  pane,
  row,
  type JaliOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const free = { kind: "free", title: "Free", params: { id: Number }, width: { min: 400 } };
const fixed = {
  kind: "fixed",
  title: "Fixed",
  width: { min: 300 },
  allow: { resize: false, close: false },
};
const make = (o: Partial<JaliOptions>) =>
  createJali({
    panes: [free, fixed],
    url: false,
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });

describe("a pane that may not be resized", () => {
  it("keeps the divider a fold puts beside it still", () => {
    // 1000px: a, b and c can't all fit (400 + 400 + 300 and gaps), so c folds in with b: the row's one divider is
    // between a and that group, while the split's next two children are a and b.
    const jali = make({
      layout: row(
        pane({ kind: "free", params: { id: 1 } }, { id: "a" }),
        pane({ kind: "free", params: { id: 2 } }, { id: "b", linkedTo: "a" }),
        pane({ kind: "fixed", params: {} }, { id: "c" }),
      ),
      size: { width: 1000, height: 800 },
    });
    const store = storeOf(jali);
    const d = jali.model().resolved.dividers[0]!;
    expect(d.neighbours![1]).toContain("c");
    const layout = jali.getLayout();
    store.actions.resizeDivider(d.parentId, d.index, 40);
    expect(jali.getLayout()).toBe(layout);
    store.actions.resetDivider(d.parentId, d.index);
    expect(jali.getLayout()).toBe(layout);
  });

  it("isn't resized by a drag's commit either", () => {
    const jali = make({
      layout: row(
        pane({ kind: "free", params: { id: 1 } }, { id: "a" }),
        pane({ kind: "fixed", params: {} }, { id: "c" }),
      ),
    });
    const store = storeOf(jali);
    const layout = jali.getLayout();
    const d = jali.model().resolved.dividers[0]!;
    // What a drag would preview, made without the check.
    const preview = L.resizeDivider(layout, d.parentId, d.index, 60, store.ctx());
    store.actions.commitDividerDrag(preview);
    expect(jali.getLayout()).toBe(layout);
  });
});

describe("Back to the page", () => {
  it("keeps the investigation while an opened pane may not close", () => {
    const page = definePage({
      id: "p",
      name: "Page",
      itemNoun: "item",
      home: "main",
      roles: [{ id: "main", label: "Main", priority: "primary" as const }],
      firstItem: 1,
      bind: (item: number) => ({ main: { kind: "free", params: { id: item } } }),
      build: (item: number) =>
        pane({ kind: "free", params: { id: item } }, { id: "main", role: "main" }),
    });
    const jali = make({ page, size: { width: 1600, height: 800 } });
    jali.actions.setMode("split");
    expect(jali.actions.openBeside("main", { kind: "fixed", params: {} }).ok).toBe(true);
    const layout = jali.getLayout();
    expect(jali.actions.backToPage()).toMatchObject({ ok: false, reason: "not-allowed" });
    expect(jali.getLayout()).toBe(layout);
  });
});
