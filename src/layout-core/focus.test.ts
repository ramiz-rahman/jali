import { describe, expect, it } from "vitest";
import { createLayoutCore, snapToCentre } from "./index";
import { freeze, view } from "./test-utils";
import type { Edge, PaneBox, ResolvedLayout } from "./types";

const box = (id: string, x: number, y: number, width = 100, height = 100): PaneBox => ({ id, rect: { x, y, width, height } });
const resolved = (...panes: PaneBox[]): ResolvedLayout => ({ panes, dividers: [], folded: [], stacks: [] });

describe("focus", () => {
  const core = createLayoutCore();
  it.each(["left", "right", "top", "bottom"] as Edge[])("moves strictly %s with cross-axis overlap", dir => {
    const geometry = resolved(box("a", 200, 200), box("left", 0, 200), box("right", 400, 200), box("top", 200, 0), box("bottom", 200, 400));
    expect(core.focusDirection(freeze(view()), geometry, dir).focused).toBe(dir);
  });
  it("rejects diagonal, overlapping, hidden, and merely touching cross-axis candidates", () => {
    const geometry = resolved(box("a", 0, 0), box("diagonal", 110, 101), box("overlap", 50, 0), box("touch", 110, 100), { ...box("hidden", 110, 0), hiddenInStack: true });
    expect(core.focusDirection(view(), geometry, "right").focused).toBe("a");
  });
  it("prefers MRU among panes sharing the nearest edge", () => {
    const geometry = resolved(box("a", 0, 0, 100, 300), box("b", 106, 0, 100, 100), box("c", 106, 106, 100, 194));
    expect(core.focusDirection(view("a", ["a", "b", "c"]), geometry, "right").focused).toBe("b");
    expect(core.focusDirection(view("a", ["a", "c", "b"]), geometry, "right").focused).toBe("c");
  });
  it("keeps a nearer edge ahead of a more recently focused distant pane", () => {
    const geometry = resolved(box("a", 0, 0), box("b", 106, 0), box("c", 300, 0));
    expect(core.focusDirection(view("a", ["a", "c", "b"]), geometry, "right").focused).toBe("b");
  });
  it("breaks missing-history ties by overlap then centre distance then order", () => {
    const geometry = resolved(box("a", 0, 100, 100, 100), box("b", 106, 180), box("c", 106, 120));
    expect(core.focusDirection(view("a", []), geometry, "right").focused).toBe("c");
    const centre = resolved(box("a", 0, 100, 100, 200), box("b", 106, 100, 100, 50), box("c", 106, 175, 100, 50));
    expect(core.focusDirection(view("a", []), centre, "right").focused).toBe("c");
    const tied = resolved(box("a", 0, 0), box("b", 106, 0), box("c", 106, 0));
    expect(core.focusDirection(view("a", []), tied, "right").focused).toBe("b");
  });
  it("never wraps directional focus and handles missing focused panes", () => {
    expect(core.focusDirection(view(), resolved(box("a", 0, 0)), "left")).toEqual(view());
    expect(core.focusDirection(view("missing"), resolved(box("a", 0, 0)), "right")).toEqual(view("missing"));
  });
  it("cycles in reading order, wrapping and skipping hidden tabs", () => {
    const geometry = resolved(box("a", 0, 0), { ...box("hidden", 0, 0), hiddenInStack: true }, box("b", 106, 0));
    expect(core.focusCycle(view(), geometry, 1).focused).toBe("b");
    expect(core.focusCycle(view("b"), geometry, 1).focused).toBe("a");
    expect(core.focusCycle(view(), geometry, -1).focused).toBe("b");
    expect(core.focusCycle(view("missing"), geometry, 1).focused).toBe("a");
    expect(core.focusCycle(view("missing"), geometry, -1).focused).toBe("b");
    expect(core.focusCycle(view(), resolved(), 1)).toEqual(view());
  });
  it("updates focus history without duplication and follows zoom", () => {
    expect(core.focus(freeze({ ...view("a", ["a", "b", "c"]), zoomed: "a" }), "b")).toEqual({ focused: "b", zoomed: "b", focusHistory: ["b", "a", "c"] });
  });
});

describe("centre snap hysteresis", () => {
  it.each([[490, false, 500], [510, false, 500], [489, false, 489], [511, false, 511], [484, true, 500], [516, true, 500], [483, true, 483], [517, true, 517], [500, false, 500]] as const)("snaps %s with previous state %s to %s", (value, snapped, expected) => {
    expect(snapToCentre(value, 500, snapped)).toBe(expected);
  });
});
