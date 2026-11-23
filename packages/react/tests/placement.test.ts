/**
 * Placement: the presentation, every frame's final rect and stacked view's divider, from one calculation. A pane alone
 * is drawn full-bleed; the divider sits in the same split the frames are cut by.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import {
  STACK_GAP,
  SWITCHER_H,
  defaultStackShare,
  frames,
  stackShare,
  storeOf,
} from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { placement } from "../src/workspace/placement";
import { defaultFeatures, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 280 },
  Component: () => null,
});
// A short pane: comfortable at 200, never usefully taller than 260.
const strip = definePane("strip", {
  title: () => "Strip",
  width: { min: 280 },
  height: { min: 120, comfortable: 200, max: 260 },
  Component: () => null,
});

const PHONE = { width: 378, height: 760 };
type Layout = Parameters<typeof createJali>[0]["layout"];
const make = (options: { layout?: Layout; size?: typeof PHONE } = {}) =>
  createJali({
    panes: [note, strip],
    layout: options.layout ?? note({ id: 1 }),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: options.size ?? { width: 1200, height: 800 },
    moveFocus: false,
    phone: { stack: true },
  });
const stackedPair = (first: "note" | "strip" = "note") => {
  const jali = make({
    layout: first === "strip" ? strip() : undefined,
    size: PHONE,
  });
  jali.actions.openBeside(storeOf(jali).model().visible[0]!, note({ id: 7 }));
  return jali;
};
const placed = (
  jali: ReturnType<typeof make>,
  input: Partial<Parameters<typeof placement>[2]> = {},
) => {
  const store = storeOf(jali);
  const m = store.model();
  return { m, p: placement(m, store.get().view, { area: store.get().area, ...input }) };
};

describe("placement, tiled", () => {
  it("draws a pane alone full-bleed, over the inset", () => {
    const jali = make();
    const { m, p } = placed(jali);
    const { inset } = m.env.spacing;
    const { area } = storeOf(jali).get();
    expect(p.presentation).toBe("tiled");
    expect(p.alone).toBe(true);
    expect(p.inner).toEqual({ left: inset, top: inset, ...area });
    const whole = { width: area.width + inset * 2, height: area.height + inset * 2 };
    expect(p.bleed).toEqual({ left: 0, top: 0, ...whole });
    expect(p.frames.filter((f) => !f.hidden).map((f) => f.rect)).toEqual([
      { x: 0, y: 0, ...whole },
    ]);
    expect(p.divider).toBeUndefined();
  });

  it("leaves the frames where core placed them when more than one is on screen, or on a curated page", () => {
    const jali = make({ layout: row(note({ id: 1 }), note({ id: 2 })) });
    const { m, p } = placed(jali);
    expect(p.alone).toBe(false);
    expect(p.bleed).toBe(p.inner);
    const size = { width: p.inner.width, height: p.inner.height };
    const origin = { x: p.inner.left, y: p.inner.top };
    expect(p.frames).toEqual(frames(m, storeOf(jali).get().view, "tiled", size, false, origin));
    expect(placed(make(), { page: true }).p.alone).toBe(false);
  });
});

describe("placement, stacked", () => {
  const halves = (p: ReturnType<typeof placement>, m: ReturnType<typeof placed>["m"]) => {
    const top = p.frames.find((f) => f.node.id === m.stacked!.top)!.rect;
    const bottom = p.frames.find((f) => f.node.id === m.stacked!.bottom)!.rect;
    return { top, bottom };
  };

  it("places the divider in the split the frames are cut by, from the kinds' heights", () => {
    const jali = stackedPair("strip");
    const { m, p } = placed(jali);
    expect(p.presentation).toBe("single");
    expect(p.stacked).toBe(true);
    const { inset, gap } = m.env.spacing;
    const { area } = storeOf(jali).get();
    expect(p.inner).toEqual({
      left: 0,
      top: SWITCHER_H,
      width: area.width + inset * 2,
      height: area.height + inset * 2 - SWITCHER_H,
    });
    const share = stackShare(
      m.env,
      m.pane(m.stacked!.top),
      m.pane(m.stacked!.bottom),
      p.inner.height,
      Math.max(gap, STACK_GAP),
    );
    expect(p.divider!.share).toBe(share);
    // Core's frames, given no share, split by the same default.
    expect(defaultStackShare(m, p.inner.height)).toBe(share);
    const { top, bottom } = halves(p, m);
    expect(top.height).toBe(260);
    expect(p.divider!.y).toBe(top.y + top.height);
    expect(p.divider!.height).toBe(STACK_GAP);
    expect(p.divider!.y + p.divider!.height).toBe(bottom.y);
  });

  it("uses the person's share for both, once they moved the divider", () => {
    const jali = stackedPair("strip");
    const { m, p } = placed(jali, { share: 2 / 3 });
    expect(p.divider!.share).toBe(2 / 3);
    const { top, bottom } = halves(p, m);
    expect(top.height).toBe(Math.round((p.inner.height - STACK_GAP) * (2 / 3)));
    expect(p.divider!.y).toBe(top.height);
    expect(p.divider!.y + p.divider!.height).toBe(bottom.y);
  });

  it("shows one pane, with no divider, while the keyboard is up", () => {
    const { m, p } = placed(stackedPair(), { keyboardUp: true });
    expect(m.stacked).toBeDefined();
    expect(p.stacked).toBe(false);
    expect(p.divider).toBeUndefined();
    expect(p.frames.filter((f) => !f.hidden)).toHaveLength(1);
  });

  it("has no divider across a fold, whatever the keyboard or a share says", () => {
    const jali = make({
      layout: row(note({ id: 1 }), note({ id: 2 }), note({ id: 3 })),
      size: { width: 678, height: 760 },
    });
    storeOf(jali).set({ hinge: { axis: "row", start: 345, size: 0 } });
    for (const input of [{}, { keyboardUp: true }, { share: 0.3 }]) {
      const { m, p } = placed(jali, input);
      expect(m.stacked?.hinge).toBeDefined();
      expect(p.stacked).toBe(true);
      expect(p.divider).toBeUndefined();
      const { top, bottom } = halves(p, m);
      expect([top.x, top.width, bottom.x]).toEqual([0, 345, 345]);
    }
  });
});
