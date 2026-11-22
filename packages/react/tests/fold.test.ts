/** Folding screens: the hinge from viewport segments, and a pane each side of it. */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { frames, hingeOf, storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});
const WS = box(0, 40, 690, 800);

describe("hingeOf", () => {
  it("reads a fold down the middle, a fold across, and a dual screen's mask", () => {
    expect(hingeOf([box(0, 0, 345, 840), box(345, 0, 690, 840)], WS)).toEqual({
      axis: "row",
      start: 345,
      size: 0,
    });
    expect(hingeOf([box(0, 0, 690, 420), box(0, 420, 690, 840)], WS)).toEqual({
      axis: "column",
      start: 380,
      size: 0,
    });
    expect(hingeOf([box(0, 0, 331, 840), box(359, 0, 690, 840)], WS)).toMatchObject({ size: 28 });
  });

  it("ignores no fold, a fold that only grazes the workspace, and more than two segments", () => {
    expect(hingeOf([box(0, 0, 690, 840)], WS)).toBeUndefined();
    expect(hingeOf(undefined, WS)).toBeUndefined();
    expect(hingeOf([box(0, 0, 690, 60), box(0, 60, 690, 840)], WS)).toBeUndefined();
    expect(
      hingeOf([box(0, 0, 230, 840), box(230, 0, 460, 840), box(460, 0, 690, 840)], WS),
    ).toBeUndefined();
  });
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const make = (fold?: boolean) => {
  const jali = createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 }), note({ id: 3 })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 678, height: 760 },
    moveFocus: false,
    ...(fold === false ? { phone: { fold } } : {}),
  });
  storeOf(jali).set({ hinge: { axis: "row", start: 345, size: 0 } });
  return jali;
};

describe("across a fold", () => {
  it("shows the focused pane and the next one, a half each, none across the hinge", () => {
    const jali = make();
    const m = storeOf(jali).model();
    expect(m.onePane).toBe(true);
    expect(m.stacked).toMatchObject({ axis: "row", top: m.panes[0]!.id, bottom: m.panes[1]!.id });
    const shown = frames(
      m,
      storeOf(jali).get().view,
      "single",
      { width: 690, height: 760 },
      0.5,
    ).filter((f) => !f.hidden);
    expect(shown.map((f) => [f.rect.x, f.rect.width])).toEqual([
      [0, 345],
      [345, 345],
    ]);
  });

  it("is left alone with phone: { fold: false }", () => {
    expect(make(false).model().stacked).toBeUndefined();
  });
});
