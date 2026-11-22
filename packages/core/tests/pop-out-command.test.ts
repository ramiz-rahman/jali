/**
 * "Pop out pane" (`pane.pop_out`): the pane menu's Pop out, from ⌘K or a key the app binds. Only in a workspace that
 * turns pop out on (`allow: { popOut: true }`); it runs where the workspace's adapter can pop out (@jali/react's
 * floating window, given with its DOM port as `DomPort.popOut`) and
 * the focused pane allows it. No default key.
 */
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  commandsOf,
  createJali,
  listCommands,
  memoryStorage,
  pane,
  row,
  runCommand,
} from "@jali/core";
import { noDom, storeOf } from "@jali/core/adapter";

const note = { kind: "note", title: "Note" };
const fixed = { kind: "fixed", title: "Fixed", allow: { popOut: false } };
const make = (allow?: { popOut: boolean }) =>
  createJali({
    panes: [note, fixed],
    layout: row(
      pane({ kind: "note", params: {} }, { id: "a" }),
      pane({ kind: "fixed", params: {} }, { id: "b" }),
    ),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...(allow ? { allow } : {}),
  });

const ran: string[] = [];
const port = (can: boolean) => ({ can: () => can, run: (_: unknown, id: string) => ran.push(id) });
const listed = (jali: ReturnType<typeof make>) =>
  listCommands(jali).find((c) => c.id === "pane.pop_out");

afterEach(() => {
  ran.length = 0;
});
/** The workspace's own way to pop a pane out, as its adapter's DOM port gives it. */
const usePort = (jali: ReturnType<typeof make>, p: ReturnType<typeof port> | undefined) =>
  storeOf(jali).dom.use({ ...noDom, ...(p ? { popOut: p } : {}) });

describe("the Pop out pane command", () => {
  it("isn't there in a workspace that leaves pop out off", () => {
    expect(commandsOf(make()).some((c) => c.id === "pane.pop_out")).toBe(false);
    expect(commandsOf(make({ popOut: false })).some((c) => c.id === "pane.pop_out")).toBe(false);
  });

  it("pops the focused pane out, with no key of its own", () => {
    const jali = make({ popOut: true });
    usePort(jali, port(true));
    expect(commandsOf(jali).find((c) => c.id === "pane.pop_out")?.title).toBe("Pop out pane");
    jali.actions.focus("a");
    expect(listed(jali)).toMatchObject({ group: "Pane", keys: "", disabled: false });
    expect(runCommand(jali, "pane.pop_out")).toBe(true);
    expect(ran).toEqual(["a"]);
    expect(storeOf(jali).keymap.label("pane.pop_out")).toBe("");
  });

  it("can't run where the adapter can't pop out, or with no pane focused", () => {
    const jali = make({ popOut: true });
    usePort(jali, port(false));
    jali.actions.focus("a");
    expect(listed(jali)?.disabled).toBe(true);
    expect(runCommand(jali, "pane.pop_out")).toBe(false);
    usePort(jali, undefined);
    expect(runCommand(jali, "pane.pop_out")).toBe(false);
    expect(ran).toEqual([]);
  });

  it("says why for a pane whose kind doesn't allow it", () => {
    const jali = make({ popOut: true });
    usePort(jali, port(true));
    jali.actions.focus("b");
    expect(listed(jali)).toMatchObject({ disabled: true });
    expect(listed(jali)?.reason).toBeTruthy();
    expect(runCommand(jali, "pane.pop_out")).toBe(false);
    expect(ran).toEqual([]);
  });

  it("uses the workspace's own port, from its adapter's DOM port: one workspace's never runs another's", () => {
    const mine = make({ popOut: true }),
      other = make({ popOut: true });
    storeOf(mine).dom.use({ ...noDom, popOut: port(true) });
    for (const jali of [mine, other]) jali.actions.focus("a");
    expect(listed(mine)?.disabled).toBe(false);
    expect(listed(other)?.disabled).toBe(true);
    expect(runCommand(other, "pane.pop_out")).toBe(false);
    expect(runCommand(mine, "pane.pop_out")).toBe(true);
    expect(ran).toEqual(["a"]);
  });
});
