/**
 * A stack with one tab is a legal layout (`tabs(pane)` passes validation), and every action takes it (core-codex
 * CORE-3). Unmerge and Hide read the missing sibling's id and threw.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, layout as L, memoryStorage, pane, row, tabs } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const make = () =>
  createJali({
    panes: [item],
    layout: row(tabs(pane(ref(1), { id: "lone" })), pane(ref(2), { id: "b" })),
    url: false,
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("a stack with one tab", () => {
  it("has nothing to unmerge", () => {
    const jali = make();
    jali.actions.focus("lone");
    expect(jali.actions.unmerge("lone")).toMatchObject({ ok: false, reason: "nothing-to-do" });
  });

  it("hides, and shows again", () => {
    const jali = make();
    const ctx = storeOf(jali).ctx();
    const hidden = L.hide(storeOf(jali).get().layout, storeOf(jali).get().view, "lone", ctx);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.layout.overlay?.hidden).toEqual(["lone"]);
    const shown = L.show(hidden.layout, hidden.view, "lone", ctx);
    expect(shown.ok && L.tree.panes(shown.layout.root).map((p) => p.id)).toEqual(["lone", "b"]);
  });
});
