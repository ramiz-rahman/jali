/**
 * A command runs through the instance's actions (core review 22 Nov 2026, #4): `runCommand` says whether it ran as
 * the action says, the palette offers what the action would do, and a destroyed instance runs nothing.
 *
 * Before: after destroy(), runCommand(jali, "settings.centre_drop.toggle") returned true. With every close denied,
 * Close others was offered and runCommand returned true, while the action said "nothing-to-do".
 */
import { describe, expect, it } from "vite-plus/test";
import {
  listCommands,
  createJali,
  memoryStorage,
  pane,
  row,
  runCommand,
  type JaliOptions,
} from "@jali/core";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [item],
    layout: row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" }), pane(ref(3), { id: "c" })),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    ...o,
  });
const listed = (jali: ReturnType<typeof make>, id: string) =>
  listCommands(jali).find((c) => c.id === id);

describe("Close others", () => {
  it("with no other pane the app lets close, is not offered and doesn't run", () => {
    const jali = make({ allow: { close: false } });
    jali.actions.focus("a");
    expect(listed(jali, "pane.close_others")?.disabled).toBeTruthy();
    expect(runCommand(jali, "pane.close_others")).toBe(false);
    expect(jali.model().panes).toHaveLength(3);
  });

  it("with others to close, is offered and runs", () => {
    const jali = make();
    jali.actions.focus("a");
    expect(listed(jali, "pane.close_others")?.disabled).toBeFalsy();
    expect(runCommand(jali, "pane.close_others")).toBe(true);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
  });

  it("held for the host's beforeClose, ran", () => {
    const jali = make({ beforeClose: () => new Promise<boolean>(() => {}) });
    jali.actions.focus("a");
    expect(runCommand(jali, "pane.close_others")).toBe(true);
  });
});

describe("the centre drop setting", () => {
  it("changes and is announced in one change: subscribers hear it once", () => {
    const jali = make();
    let heard = 0;
    jali.subscribe(() => heard++);
    const was = jali.get().settings.centreDrop;
    expect(runCommand(jali, "settings.centre_drop.toggle")).toBe(true);
    expect(jali.get().settings.centreDrop).not.toBe(was);
    expect(heard).toBe(1);
  });
});

describe("after destroy()", () => {
  it.each(["settings.centre_drop.toggle", "pane.close", "pane.close_others"])(
    "%s doesn't run",
    (id) => {
      const jali = make();
      jali.actions.focus("a");
      const before = jali.get();
      let heard = 0;
      jali.subscribe(() => heard++);
      jali.destroy();
      expect(runCommand(jali, id)).toBe(false);
      expect(jali.get()).toBe(before);
      expect(heard).toBe(0);
    },
  );
});
