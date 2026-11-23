/**
 * Two behaviours the guides state (finding 49), kept: a tab group is as narrow as its widest tab allows, and a pane
 * id two presets share keeps its state and unsaved work across a switch, when it shows the same object in both.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type PresetOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const Nothing = () => null;
const narrow = definePane("narrow", { title: "Narrow", width: { min: 240 }, Component: Nothing });
const wide = definePane("wide", { title: "Wide", width: { min: 520 }, Component: Nothing });
const draft = definePane("draft", {
  params: { id: Number },
  title: ({ id }) => `Draft ${id}`,
  width: { min: 300 },
  Component: Nothing,
});

const make = (options: Partial<Parameters<typeof createJali>[0]>) =>
  createJali({
    panes: [narrow, wide, draft],
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...options,
  });

describe("a tab group's narrowest width is its widest member's", () => {
  it("a group holding a wide tab folds rather than go below that tab's minimum, whichever tab shows", () => {
    const layout = row(
      pane(narrow(), { id: "left" }),
      tabs(pane(narrow(), { id: "small" }), pane(wide(), { id: "big" })),
    );
    // 240 + 520 + gaps fits at 800; at 700 the group can't have 520, so something folds.
    const roomy = make({ layout, size: { width: 800, height: 600 } });
    expect(storeOf(roomy).model().folded).toEqual([]);
    const box = storeOf(roomy)
      .model()
      .resolved.panes.find((b) => b.id === "small")!;
    expect(box.rect.width).toBeGreaterThanOrEqual(520);
    const tight = make({ layout, size: { width: 700, height: 600 } });
    expect(storeOf(tight).model().folded.length).toBeGreaterThan(0);
  });
});

describe("a pane id two presets share", () => {
  const presets: PresetOptions[] = [
    {
      id: "one",
      label: "One",
      layout: row(pane(narrow(), { id: "a" }), pane(draft({ id: 1 }), { id: "draft" })),
    },
    {
      id: "two",
      label: "Two",
      layout: row(pane(wide(), { id: "b" }), pane(draft({ id: 1 }), { id: "draft" })),
    },
    {
      id: "three",
      label: "Three",
      layout: row(pane(wide(), { id: "b" }), pane(draft({ id: 2 }), { id: "draft" })),
    },
  ];

  it("keeps its state and unsaved work across a switch, without asking, when it shows the same object", () => {
    const jali = make({ presets });
    const store = storeOf(jali);
    store.actions.setPaneState("draft", "text", "Half a reply");
    store.actions.setUnsaved("draft", "an unsent reply");
    expect(jali.actions.preset("two").ok).toBe(true);
    expect(store.get().confirm).toBeNull();
    expect(store.get().paneState.draft).toEqual({ text: "Half a reply" });
    expect(jali.get().unsaved.draft).toBe("an unsent reply");
  });

  it("showing another object, asks first, and starts afresh", () => {
    const jali = make({ presets });
    const store = storeOf(jali);
    store.actions.setPaneState("draft", "text", "Half a reply");
    store.actions.setUnsaved("draft", "an unsent reply");
    expect(jali.actions.preset("three")).toMatchObject({ ok: false, reason: "unsaved" });
    store.actions.discardAndContinue();
    expect(jali.get().presetId).toBe("three");
    expect(store.get().paneState.draft).toBeUndefined();
  });
});
