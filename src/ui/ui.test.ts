import { describe, expect, it } from "vitest";
import { clampSize, snap, SNAP_IN, SNAP_OUT } from "./dividers/DividerLayer";
import { zoneFor, EDGE_ZONE } from "./dnd";
import { decodePeek, encodePeek } from "./url";
import { handleKey } from "./keyboard";
import { actions, allPanes, getState, setState } from "./store";
import { COMMANDS } from "./commands";
import { registerAllPaneKinds } from "../panes";

registerAllPaneKinds();

describe("divider snap", () => {
  it("enters within 10px of centre and leaves beyond 16px", () => {
    expect(SNAP_IN).toBe(10);
    expect(SNAP_OUT).toBe(16);
    expect(snap(489, 500, false)).toEqual({ size: 489, snapped: false });
    expect(snap(490, 500, false)).toEqual({ size: 500, snapped: true });
    expect(snap(485, 500, true)).toEqual({ size: 500, snapped: true });
    expect(snap(483, 500, true)).toEqual({ size: 483, snapped: false });
  });
  it("clamps at both minimums", () => {
    expect(clampSize(100, 320, 900)).toBe(320);
    expect(clampSize(1000, 320, 900)).toBe(900);
  });
});

describe("drop zones", () => {
  const r = { x: 0, y: 0, width: 400, height: 200 };
  it("outer quarter places beside, centre otherwise", () => {
    expect(EDGE_ZONE).toBe(0.25);
    expect(zoneFor(r, 50, 100)).toBe("left");
    expect(zoneFor(r, 350, 100)).toBe("right");
    expect(zoneFor(r, 200, 20)).toBe("top");
    expect(zoneFor(r, 200, 190)).toBe("bottom");
    expect(zoneFor(r, 200, 100)).toBe("centre");
  });
  it("corner picks the nearer edge", () => {
    expect(zoneFor(r, 10, 40)).toBe("left");
    expect(zoneFor(r, 90, 5)).toBe("top");
  });
});

describe("peek param", () => {
  it("round-trips numbers and strings", () => {
    const ref = { kind: "record", params: { table: "orders", id: 42 } };
    expect(encodePeek(ref)).toBe("record~table=orders~id=#42");
    expect(decodePeek(encodePeek(ref))).toEqual(ref);
  });
});

describe("command registry", () => {
  it("has unique stable ids covering the keyboard map", () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["pane.focus.next", "pane.focus.previous", "pane.focus.left", "pane.move.up", "pane.zoom", "pane.minimise", "pane.resize_mode", "pane.close", "pane.split.right", "pane.split.down", "pane.undo_close", "layout.reset"])
      expect(ids).toContain(id);
  });
});

describe("keyboard layer and close/undo", () => {
  const key = (init: KeyboardEventInit & { code?: string }) => new KeyboardEvent("keydown", init);
  it("F6 cycles focus, ⌥⌘W closes, ⌘Z restores", () => {
    setState({ area: { width: 1600, height: 900 } });
    actions.preset("order-chain");
    const first = getState().view.focused;
    expect(handleKey(key({ key: "F6" }))).toBe(true);
    expect(getState().view.focused).not.toBe(first);
    const before = allPanes().length;
    const mod = navigator.platform.includes("Mac") ? { metaKey: true } : { ctrlKey: true };
    expect(handleKey(key({ key: "w", code: "KeyW", altKey: true, ...mod }))).toBe(true);
    expect(allPanes().length).toBe(before - 1);
    expect(handleKey(key({ key: "z", code: "KeyZ", ...mod }))).toBe(true);
    expect(allPanes().length).toBe(before);
  });
  it("Esc leaves zoom", () => {
    actions.toggleZoom(allPanes()[0]!.id);
    expect(getState().view.zoomed).toBeTruthy();
    expect(handleKey(key({ key: "Escape" }))).toBe(true);
    expect(getState().view.zoomed).toBeUndefined();
  });
});
