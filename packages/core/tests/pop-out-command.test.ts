/**
 * "Pop out pane" (`pane.pop_out`): the pane menu's Pop out, from ⌘K or a key the app binds. Only in a workspace with
 * the `popOut()` feature, whose window (the adapter's) pops the pane out; it runs where that window can and the
 * focused pane allows it. No default key.
 */
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, listCommands, memoryStorage, pane, row, runCommand } from "@jali/core";
import { commandDefsOf, popOutFeature, storeOf, type PopOutWindow } from "@jali/core/adapter";

const note = { kind: "note", title: "Note" };
const fixed = { kind: "fixed", title: "Fixed", allow: { popOut: false } };
const ran: string[] = [];
const window = (can: boolean): PopOutWindow => ({
  can: () => can,
  open: async (_store, id) => (ran.push(id), true),
  close: () => {},
  pane: () => undefined,
});
const make = (win?: PopOutWindow, allow?: { popOut: boolean }) =>
  createJali({
    panes: [note, fixed],
    layout: row(
      pane({ kind: "note", params: {} }, { id: "a" }),
      pane({ kind: "fixed", params: {} }, { id: "b" }),
    ),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...(win ? { features: [popOutFeature(win)] } : {}),
    ...(allow ? { allow } : {}),
  });

const listed = (jali: ReturnType<typeof make>) =>
  listCommands(jali).find((c) => c.id === "pane.pop_out");

afterEach(() => {
  ran.length = 0;
});

describe("the Pop out pane command", () => {
  it("isn't there without the feature", () => {
    expect(commandDefsOf(storeOf(make())).some((c) => c.id === "pane.pop_out")).toBe(false);
  });

  it("pops the focused pane out, with no key of its own, listed after Full screen", () => {
    const jali = make(window(true));
    const ids = commandDefsOf(storeOf(jali)).map((c) => c.id);
    expect(ids.indexOf("pane.pop_out")).toBe(ids.indexOf("pane.fullscreen") + 1);
    expect(commandDefsOf(storeOf(jali)).find((c) => c.id === "pane.pop_out")?.title).toBe(
      "Pop out pane",
    );
    jali.actions.focus("a");
    expect(listed(jali)).toMatchObject({ group: "Pane", keys: "", disabled: false });
    expect(runCommand(jali, "pane.pop_out")).toBe(true);
    expect(ran).toEqual(["a"]);
    expect(storeOf(jali).keymap.label("pane.pop_out")).toBe("");
  });

  it("can't run where the window can't pop out, or with no pane focused", () => {
    const jali = make(window(false));
    jali.actions.focus("a");
    expect(listed(jali)?.disabled).toBe(true);
    expect(runCommand(jali, "pane.pop_out")).toBe(false);
    expect(ran).toEqual([]);
  });

  it("says why for a pane whose kind doesn't allow it, or a workspace that turns it off", () => {
    const jali = make(window(true));
    jali.actions.focus("b");
    expect(listed(jali)).toMatchObject({ disabled: true });
    expect(listed(jali)?.reason).toBeTruthy();
    expect(runCommand(jali, "pane.pop_out")).toBe(false);
    const off = make(window(true), { popOut: false });
    off.actions.focus("a");
    expect(listed(off)?.disabled).toBe(true);
    expect(ran).toEqual([]);
  });

  it("closes the window when the workspace stops", () => {
    const closed: unknown[] = [];
    const jali = make({ ...window(true), close: (store) => closed.push(store) });
    const stop = jali.start();
    stop();
    expect(closed).toEqual([storeOf(jali)]);
  });
});
