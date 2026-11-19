import { describe, expect, it } from "vite-plus/test";
import { clampSize, snap, SNAP_IN, SNAP_OUT } from "../../packages/core/src/dividers/resize";
import { zoneFor, EDGE_ZONE } from "../../packages/core/src/workspace/dnd";
import { decodePeek, encodePeek } from "../../packages/core/src/url";
import { createKeyHandler } from "../../packages/core/src/commands/keyboard";
import { commandsOf, runCommand, shortcutLabel } from "../../packages/core/src/commands/registry";
import { formatChord, parseKeys } from "../../packages/core/src/commands/format";
import { mergeTargets } from "../../packages/core/src/actions/tabs";
import { openPaneFor } from "../../packages/core/src/actions/open";
import { dropText } from "../../packages/core/src/state/messages";
import { POLICY } from "../../packages/core/src/state/apply";
import { createLabStore } from "../lab";

const store = createLabStore();
const { actions } = store;
const getState = store.get;
const setState = store.set;
const allPanes = () => store.model().panes;
const findPane = (id: string) => store.model().pane(id);
const stackOf = (id: string) => store.model().stackOf(id);

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
    const ids = commandsOf(store).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "pane.focus.next",
      "pane.focus.previous",
      "pane.focus.left",
      "pane.move.up",
      "pane.zoom",
      "pane.tuck",
      "pane.putBack",
      "shelf.reveal",
      "pane.resize_mode",
      "pane.close",
      "pane.split.right",
      "pane.split.down",
      "pane.undo_close",
      "layout.reset",
    ])
      expect(ids).toContain(id);
  });
});

const keys = createKeyHandler(store);
const mac = () => store.keymap.platform === "mac";
const modKey = () => (mac() ? { metaKey: true } : { ctrlKey: true });
/** One keydown through both phases of the pane layer (no content in between). */
const press = (init: KeyboardEventInit & { code?: string }) => {
  const e = new KeyboardEvent("keydown", { cancelable: true, ...init });
  return keys.capture(e) || keys.bubble(e);
};
/** "Mod+K Mod+M": each chord as a keydown, as the person would press them. Returns whether the last was taken. */
const pressKeys = (text: string) => {
  let taken = false;
  for (const c of parseKeys(text)) {
    const named =
      !/^(Key|Digit)/.test(c.key) &&
      c.key.length > 1 &&
      !["Backslash", "BracketLeft", "BracketRight"].includes(c.key);
    const key = named
      ? c.key
      : (({ Backslash: "\\", BracketLeft: "[", BracketRight: "]" } as Record<string, string>)[
          c.key
        ] ?? c.key.replace(/^(Key|Digit)/, "").toLowerCase());
    taken = press({
      key,
      code: named ? undefined : c.key,
      shiftKey: !!c.shift,
      altKey: !!c.alt,
      ...(c.mod ? modKey() : {}),
    });
  }
  return taken;
};

describe("keyboard layer and close/undo", () => {
  it("F6 cycles focus, ⌘K ⌘⌫ closes, ⌘K ⌘Z restores", () => {
    setState({ area: { width: 1600, height: 900 } });
    actions.preset("order-chain");
    const first = getState().view.focused;
    expect(press({ key: "F6" })).toBe(true);
    expect(getState().view.focused).not.toBe(first);
    const before = allPanes().length;
    expect(pressKeys("Mod+K Mod+Backspace")).toBe(true);
    expect(getState().paletteOpen).toBe(false); // the chord closed the palette its prefix opened
    expect(allPanes().length).toBe(before - 1);
    expect(pressKeys("Mod+K Mod+Z")).toBe(true);
    expect(allPanes().length).toBe(before);
  });
  it("Esc leaves zoom", () => {
    actions.toggleZoom(allPanes()[0]!.id);
    expect(getState().view.zoomed).toBeTruthy();
    expect(press({ key: "Escape" })).toBe(true);
    expect(getState().view.zoomed).toBeUndefined();
  });
});
const kinds = () => allPanes().map((p) => p.ref.kind);

describe("split opens a launcher", () => {
  it("split right adds a launcher beside the focused pane and focuses it", () => {
    setState({ area: { width: 1600, height: 900 } });
    actions.preset("one-table");
    actions.focus("orders");
    expect(press({ key: "\\", code: "Backslash", ...modKey() })).toBe(true);
    const launcher = allPanes().find((p) => p.ref.kind === "launcher")!;
    expect(launcher).toBeTruthy();
    expect(getState().view.focused).toBe(launcher.id);
    expect(kinds().filter((k) => k === "table")).toHaveLength(1); // no copy of orders
  });
  it("split down and split auto open launchers too", () => {
    actions.preset("one-table");
    actions.focus("orders");
    expect(runCommand(store.jali, "pane.split.down")).toBe(true);
    expect(runCommand(store.jali, "pane.split.auto")).toBe(true);
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
    expect(
      store.env.kinds.sameObject(
        { kind: "record", params: { table: "customers", id: 1 } },
        { kind: "record", params: { table: "customers", id: "1" } },
      ),
    ).toBe(true);
    expect(
      store.env.kinds.sameObject(
        { kind: "query", params: { sql: "x" } },
        { kind: "query", params: { sql: "x" } },
      ),
    ).toBe(false);
    actions.preset("query-chart");
    expect(
      openPaneFor(store.model(), { kind: "query", params: { sql: "x", autorun: 1 } }),
    ).toBeUndefined();
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
    expect(getState().undoStack).toHaveLength(0); // no undo toast for a launcher
  });
  it("Recent keeps the last 8 objects, newest first, without launchers or repeats", () => {
    actions.preset("order-chain");
    for (let i = 1; i <= 10; i++)
      actions.openBeside("orders", { kind: "record", params: { table: "orders", id: i } });
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
    expect(mergeTargets(store.snapshot()).map((t) => t.id)).toEqual(["orders", "order"]);
  });
  it("⌘K ⌘G opens the chooser; mergeInto adds the pane as a tab", () => {
    actions.preset("order-chain");
    actions.focus("customer");
    expect(pressKeys("Mod+K Mod+G")).toBe(true);
    expect(getState().chooser).toEqual({ kind: "merge", source: "customer" });
    setState({ chooser: null });
    actions.mergeInto("customer", "orders");
    const st = stackOf("customer")!;
    expect(st.children.map((c) => c.id).sort()).toEqual(["customer", "orders"]);
    expect(st.active).toBe("customer");
    expect(getState().view.focused).toBe("customer");
    // the stack is listed by its tab titles from the remaining pane
    actions.focus("order");
    expect(mergeTargets(store.snapshot())[0]!.hint).toBe("2 tabs");
  });
  it("⌘K ⇧⌘G moves a tab out, to the right of its stack", () => {
    actions.preset("order-chain");
    actions.mergeInto("customer", "orders");
    actions.focus("customer");
    expect(pressKeys("Mod+K Shift+Mod+G")).toBe(true);
    expect(stackOf("customer")).toBeUndefined();
    const ids = allPanes().map((p) => p.id);
    expect(ids.indexOf("customer")).toBe(ids.indexOf("orders") + 1);
  });
  it("unmerge is disabled outside a stack; merge is disabled with one pane", () => {
    actions.preset("order-chain");
    actions.focus("orders");
    expect(runCommand(store.jali, "pane.unmerge")).toBe(false);
    actions.closeOthers("orders");
    expect(runCommand(store.jali, "pane.merge")).toBe(false);
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
    expect(runCommand(store.jali, "stack.new-tab")).toBe(true);
    const st = stackOf("order")!;
    expect(st.origin).toBe("user");
    expect(st.children.map((c) => c.ref.kind)).toEqual(["record", "launcher"]);
  });
});

describe("drag preview label", () => {
  it("names the target and what the centre will do", () => {
    expect(dropText("centre", "orders", "swap")).toBe("Swap with orders");
    expect(dropText("centre", "orders", "tab")).toBe("Add as tab to orders");
    expect(dropText("left", "orders", "tab")).toBe("Place left of orders");
    expect(dropText("top", "orders", "tab")).toBe("Place above orders");
  });
});

describe("new commands", () => {
  it("have stable ids", () => {
    const ids = commandsOf(store).map((c) => c.id);
    for (const id of ["pane.merge", "pane.unmerge", "stack.new-tab", "pane.split.auto"])
      expect(ids).toContain(id);
  });
});

describe("apply and the command registry", () => {
  const announced = () => getState().announcement.text;
  it("a refused key says why; a silent refusal still takes the key", () => {
    setState({ area: { width: 1600, height: 900 }, undoStack: [] });
    actions.preset("order-chain");
    setState({ undoStack: [] });
    expect(pressKeys("Mod+K Mod+Z")).toBe(true);
    expect(announced()).toBe("Nothing to restore");
    actions.closeOthers("orders");
    const seq = getState().announcement.seq;
    expect(pressKeys("Mod+K Mod+Backspace")).toBe(true);
    expect(getState().announcement.seq).toBe(seq);
    expect(allPanes()).toHaveLength(1);
  });
  it("announces only what happened: an unchanged layout says nothing", () => {
    actions.preset("order-chain");
    const seq = getState().announcement.seq;
    actions.resetDivider("r", 0);
    actions.resetDivider("r", 0);
    expect(getState().announcement.seq - seq).toBeLessThanOrEqual(1);
  });
  it("every op has a policy, and closes push history", () => {
    expect(POLICY.close.history).toBe("push");
    expect(POLICY.resize.history).toBe("debounce");
    expect(POLICY.focus.history).toBe("none");
  });
  it("prints shortcuts from the keymap for each platform", () => {
    expect(formatChord({ key: "KeyM", alt: true, shift: true, mod: true }, "mac")).toBe("⌥⇧⌘M");
    expect(formatChord({ key: "KeyM", alt: true, shift: true, mod: true }, "other")).toBe(
      "Ctrl+Alt+Shift+M",
    );
    expect(formatChord({ key: "Enter", shift: true, mod: true }, "mac")).toBe("⇧⌘↵");
    expect(shortcutLabel(store, "pane.focus.next")).toBe("F6");
    expect(store.keymap.sequences("pane.focus.left")[0]).toEqual([
      { key: "KeyK", mod: true },
      { key: "ArrowLeft", mod: true },
    ]);
  });
});
