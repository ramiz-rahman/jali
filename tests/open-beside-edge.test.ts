/**
 * openBeside on a chosen edge (`{ edge }`, 20 Nov 2026): the same link as openBeside without one (linkedTo, the
 * earlier link replaced in place, focus, history, the announcement), placed on that side of the source as on screen.
 */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type Direction,
  type Edge,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { createTestStore } from "./workspace";
import type { UiStore } from "../packages/core/src/state/store";

const video = definePane("video", {
  params: { id: Number },
  title: ({ id }) => `Video ${id}`,
  width: { min: 200 },
  height: { min: 100 },
  Component: () => null,
});
const transcript = definePane("transcript", {
  params: { id: Number },
  title: ({ id }) => `Transcript ${id}`,
  width: { min: 200 },
  height: { min: 100 },
  Component: () => null,
});
const make = (
  { width = 1600, height = 900, dir }: { width?: number; height?: number; dir?: Direction } = {},
  location = memoryLocation(),
) =>
  createJali({
    panes: [video, transcript],
    layout: row(pane(video({ id: 1 }), { id: "v" })),
    url: { location },
    storage: memoryStorage(),
    size: { width, height },
    moveFocus: false,
    ...(dir ? { dir } : {}),
  });
type J = ReturnType<typeof make>;
const box = (jali: J, id: string) => jali.model().resolved.panes.find((b) => b.id === id)!.rect;
const said = (jali: J) => storeOf(jali).get().announcement.text;

describe("openBeside with an edge, in a free workspace", () => {
  it.each<[Edge, (v: DOMRectLike, t: DOMRectLike) => boolean]>([
    ["bottom", (v, t) => t.y >= v.y + v.height && t.x === v.x],
    ["top", (v, t) => t.y + t.height <= v.y && t.x === v.x],
    ["left", (v, t) => t.x + t.width <= v.x && t.y === v.y],
    ["right", (v, t) => t.x >= v.x + v.width && t.y === v.y],
  ])("%s: on that side of the source", (edge, where) => {
    const jali = make();
    const r = jali.actions.openBeside("v", transcript({ id: 1 }), { edge });
    expect(r.ok).toBe(true);
    expect(where(box(jali, "v"), box(jali, r.pane!))).toBe(true);
  });

  it("is the same link as without one: linked, focus stays, one history entry, the same words", () => {
    const location = memoryLocation();
    const jali = make({}, location);
    const before = location.entries.length;
    const t = jali.actions.openBeside("v", transcript({ id: 1 }), { edge: "bottom" }).pane!;
    expect(jali.model().pane(t)?.linkedTo).toBe("v");
    expect(jali.get().view.focused).toBe("v");
    expect(location.entries.length).toBe(before + 1);
    expect(said(jali)).toBe("Transcript 1 opened beside Video 1");
  });

  it("replaces the source's earlier link where it is, whatever the edge", () => {
    const jali = make();
    const first = jali.actions.openBeside("v", transcript({ id: 1 }), { edge: "bottom" }).pane!;
    const at = box(jali, first);
    const again = jali.actions.openBeside("v", transcript({ id: 2 }), { edge: "right" });
    expect(again.pane).toBe(first);
    expect(jali.model().pane(first)?.ref.params.id).toBe(2);
    expect(box(jali, first)).toEqual(at);
    expect(said(jali)).toBe("Transcript 2 shown beside Video 1");
  });

  it("without one, opens after the source as before", () => {
    const jali = make();
    const t = jali.actions.openBeside("v", transcript({ id: 1 })).pane!;
    expect(box(jali, t).x).toBeGreaterThanOrEqual(box(jali, "v").x + box(jali, "v").width);
  });

  it("is the screen's side right to left, as move and split are; the default stays after the source", () => {
    const right = make({ dir: "rtl" });
    const r = right.actions.openBeside("v", transcript({ id: 1 }), { edge: "right" }).pane!;
    expect(box(right, r).x).toBeGreaterThanOrEqual(box(right, "v").x + box(right, "v").width);
    const after = make({ dir: "rtl" });
    const a = after.actions.openBeside("v", transcript({ id: 1 })).pane!;
    expect(box(after, a).x + box(after, a).width).toBeLessThanOrEqual(box(after, "v").x);
  });

  it("with no room on that edge, opens as a tab of the source, as without one", () => {
    const jali = make({ height: 160 });
    const t = jali.actions.openBeside("v", transcript({ id: 1 }), { edge: "bottom" }).pane!;
    expect(said(jali)).toBe("Transcript 1 opened as a tab: not enough room beside Video 1");
    expect(jali.model().pane(t)?.linkedTo).toBe("v");
    expect(jali.get().view.focused).toBe("v");
  });

  it("on a phone, goes in the layout on that edge, shown one pane at a time", () => {
    const jali = make({ width: 390, height: 800 });
    expect(jali.model().single).toBe(true);
    const t = jali.actions.openBeside("v", transcript({ id: 1 }), { edge: "bottom" }).pane!;
    const col = layout.tree.parent(jali.get().layout.root, t);
    expect(col?.type).toBe("column");
    expect(col?.children.map((c) => c.id)).toEqual(["v", t]);
  });

  it("refuses an edge that is not one, and opens nothing", () => {
    const jali = make();
    const r = jali.actions.openBeside("v", transcript({ id: 1 }), {
      edge: "middle" as unknown as Edge,
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    expect(jali.model().panes).toHaveLength(1);
  });
});

type DOMRectLike = { x: number; y: number; width: number; height: number };

describe("openBeside with an edge, on a curated page", () => {
  let store: UiStore;
  beforeEach(() => {
    localStorage.clear();
    store = createTestStore({ initial: { area: { width: 2400, height: 900 } } });
    store.actions.openPage({ item: 4, tab: "application" });
    store.actions.setMode("split");
  });
  const loan = (id: string) => ({ kind: "record", params: { table: "loans", id } });
  const rect = (id: string) => store.model().resolved.panes.find((b) => b.id === id)!.rect;
  const roles = () => store.model().panes.filter((p) => p.role);
  const rightOfViews = (id: string) =>
    roles().every((p) => {
      const b = store.model().resolved.panes.find((x) => x.id === p.id);
      return !b || b.hidden || rect(id).x >= b.rect.x + b.rect.width;
    });

  it("from a view, the first opened pane starts the investigation after the views, whatever the edge", () => {
    const r = store.jali.actions.openBeside("application", loan("30"), { edge: "bottom" });
    expect(r.ok).toBe(true);
    expect(store.model().pane(r.pane)?.linkedTo).toBe("application");
    expect(rightOfViews(r.pane!)).toBe(true);
  });

  it("from a view again, opens on that edge of the investigation, never beside the views", () => {
    const first = store.jali.actions.openBeside("application", loan("30")).pane!;
    const r = store.jali.actions.openBeside("overview", loan("31"), { edge: "bottom" });
    const second = r.pane!;
    expect(second).not.toBe(first);
    expect(rect(second).y).toBeGreaterThanOrEqual(rect(first).y + rect(first).height);
    expect(rect(second).x).toBe(rect(first).x);
    expect(rightOfViews(second)).toBe(true);
  });

  it("from an opened pane, on that edge of it", () => {
    const first = store.jali.actions.openBeside("application", loan("30")).pane!;
    const r = store.jali.actions.openBeside(first, loan("31"), { edge: "bottom" });
    expect(store.model().pane(r.pane)?.linkedTo).toBe(first);
    expect(rect(r.pane!).y).toBeGreaterThanOrEqual(rect(first).y + rect(first).height);
  });

  it("in Single view, peeks, as a link there always does", () => {
    store.actions.setMode("single");
    const n = store.model().panes.length;
    store.jali.actions.openBeside("application", loan("30"), { edge: "bottom" });
    expect(store.get().view.peek).toEqual(loan("30"));
    expect(store.model().panes).toHaveLength(n);
  });
});
