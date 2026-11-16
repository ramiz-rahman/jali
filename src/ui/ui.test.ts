import { describe, expect, it } from "vitest";
import { clampSize, snap, SNAP_IN, SNAP_OUT } from "./dividers/DividerLayer";
import { zoneFor, EDGE_ZONE } from "./dnd";
import { decodePeek, encodePeek } from "./url";
import { handleKey } from "./keyboard";
import { actions, allPanes, findPane, getState, mergeTargets, sameRef, setState, stackOf } from "./store";
import { COMMANDS, runCommand } from "./commands";
import { dropLabel } from "./Workspace";
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

const modKey = () => (navigator.platform.includes("Mac") ? { metaKey: true } : { ctrlKey: true });
const press = (init: KeyboardEventInit & { code?: string }) => handleKey(new KeyboardEvent("keydown", init));
const kinds = () => allPanes().map((p) => p.ref.kind);

describe("split opens a launcher", () => {
  it("split right adds a launcher beside the focused pane and focuses it", () => {
    setState({ area: { width: 1600, height: 900 } });
    actions.preset("one-table");
    actions.focus("orders");
    expect(press({ key: "\\", code: "Backslash", altKey: true, ...modKey() })).toBe(true);
    const launcher = allPanes().find((p) => p.ref.kind === "launcher")!;
    expect(launcher).toBeTruthy();
    expect(getState().view.focused).toBe(launcher.id);
    expect(kinds().filter((k) => k === "table")).toHaveLength(1); // no copy of orders
  });
  it("split down and split auto open launchers too", () => {
    actions.preset("one-table");
    actions.focus("orders");
    expect(runCommand("pane.split.down")).toBe(true);
    expect(runCommand("pane.split.auto")).toBe(true);
    expect(kinds().filter((k) => k === "launcher")).toHaveLength(2);
  });
  it("choosing fills the same node in place", () => {
    actions.preset("one-table");
    actions.focus("orders");
    const id = actions.split("right")!;
    actions.openHere(id, { kind: "table", params: { table: "customers" } });
    const p = findPane(id)!;
    expect(p.ref).toEqual({ kind: "table", params: { table: "customers" } });
    expect(getState().view.focused).toBe(id);
    expect(getState().recent[0]).toEqual(p.ref);
  });
  it("an object already open is focused, not duplicated, and the launcher goes", () => {
    actions.preset("one-table");
    actions.focus("catalog");
    const id = actions.split("right")!;
    const n = allPanes().length;
    const got = actions.openHere(id, { kind: "table", params: { table: "orders" } });
    expect(got).toBe("orders");
    expect(findPane(id)).toBeUndefined();
    expect(allPanes()).toHaveLength(n - 1);
    expect(getState().view.focused).toBe("orders");
  });
  it("record ids compare as text; queries never count as duplicates", () => {
    expect(sameRef({ kind: "record", params: { table: "customers", id: 1 } }, { kind: "record", params: { table: "customers", id: "1" } })).toBe(true);
    expect(sameRef({ kind: "query", params: { sql: "x", autorun: 1 } }, { kind: "query", params: { sql: "x" } })).toBe(true);
    actions.preset("query-chart");
    const id = actions.split("right", "query")!;
    actions.openHere(id, { kind: "query", params: {} });
    expect(findPane(id)?.ref.kind).toBe("query");
  });
  it("dismiss closes an untouched launcher and returns focus to its source", () => {
    actions.preset("one-table");
    actions.focus("orders");
    const id = actions.split("right")!;
    actions.dismiss(id);
    expect(findPane(id)).toBeUndefined();
    expect(getState().view.focused).toBe("orders");
    expect(getState().closedStack).toHaveLength(0); // no undo toast for a launcher
  });
  it("Recent keeps the last 8 objects, newest first, without launchers or repeats", () => {
    actions.preset("order-chain");
    for (let i = 1; i <= 10; i++) actions.openBeside("orders", { kind: "record", params: { table: "orders", id: i } });
    const r = getState().recent;
    expect(r).toHaveLength(8);
    expect(r[0]).toEqual({ kind: "record", params: { table: "orders", id: 10 } });
    expect(r.some((x) => x.kind === "launcher")).toBe(false);
  });
});

describe("merge and unmerge without dragging", () => {
  it("lists other visible panes and stacks, not itself", () => {
    actions.preset("order-chain");
    actions.focus("customer");
    expect(mergeTargets().map((t) => t.id)).toEqual(["orders", "order"]);
  });
  it("⌥⌘T opens the chooser; mergeInto adds the pane as a tab", () => {
    actions.preset("order-chain");
    actions.focus("customer");
    expect(press({ key: "t", code: "KeyT", altKey: true, ...modKey() })).toBe(true);
    expect(getState().chooser).toEqual({ kind: "merge", source: "customer" });
    setState({ chooser: null });
    actions.mergeInto("customer", "orders");
    const st = stackOf("customer")!;
    expect(st.children.map((c) => c.id).sort()).toEqual(["customer", "orders"]);
    expect(st.active).toBe("customer");
    expect(getState().view.focused).toBe("customer");
    // the stack is listed by its tab titles from the remaining pane
    actions.focus("order");
    expect(mergeTargets()[0]!.hint).toBe("2 tabs");
  });
  it("⌥⇧⌘T moves a tab out, to the right of its stack", () => {
    actions.preset("order-chain");
    actions.mergeInto("customer", "orders");
    actions.focus("customer");
    expect(press({ key: "T", code: "KeyT", altKey: true, shiftKey: true, ...modKey() })).toBe(true);
    expect(stackOf("customer")).toBeUndefined();
    const ids = allPanes().map((p) => p.id);
    expect(ids.indexOf("customer")).toBe(ids.indexOf("orders") + 1);
  });
  it("unmerge is disabled outside a stack; merge is disabled with one pane", () => {
    actions.preset("order-chain");
    actions.focus("orders");
    expect(runCommand("pane.unmerge")).toBe(false);
    actions.closeOthers("orders");
    expect(runCommand("pane.merge")).toBe(false);
  });
});

describe("new tab here", () => {
  it("adds a launcher as a new tab of a stack and focuses it", () => {
    actions.preset("order-chain");
    actions.mergeInto("customer", "orders");
    const st = stackOf("orders")!;
    const id = actions.newTab("orders")!;
    const after = stackOf(id)!;
    expect(after.id).toBe(st.id);
    expect(after.children).toHaveLength(3);
    expect(after.active).toBe(id);
    expect(getState().view.focused).toBe(id);
  });
  it("on a lone pane it makes a deliberate stack of two", () => {
    actions.preset("order-chain");
    actions.focus("order");
    expect(runCommand("stack.new-tab")).toBe(true);
    const st = stackOf("order")!;
    expect(st.origin).toBe("user");
    expect(st.children.map((c) => c.ref.kind)).toEqual(["record", "launcher"]);
  });
});

describe("drag preview label", () => {
  it("names the target and what the centre will do", () => {
    actions.preset("order-chain");
    expect(dropLabel("centre", "orders", "swap")).toBe("Swap with orders");
    expect(dropLabel("centre", "orders", "tab")).toBe("Add as tab to orders");
    expect(dropLabel("left", "orders", "tab")).toBe("Place left of orders");
    expect(dropLabel("top", "orders", "tab")).toBe("Place above orders");
    expect(dropLabel(undefined, undefined)).toBe("Esc cancels");
  });
});

describe("new commands", () => {
  it("have stable ids", () => {
    const ids = COMMANDS.map((c) => c.id);
    for (const id of ["pane.merge", "pane.unmerge", "stack.new-tab", "pane.split.auto"]) expect(ids).toContain(id);
  });
});
