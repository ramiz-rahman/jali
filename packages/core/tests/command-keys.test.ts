/**
 * An app command's own keys and check (`Command.keys`, `Command.disabled`): its keys go into the keymap under the
 * app's `keyboard.keymap`, the palette prints them, and a command that can't run is greyed out with its reason and
 * its key only says the reason.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { listCommands } from "@jali/core";
import { installKeyboard } from "../src/commands/keyboard";
import type { Command } from "../src/commands/registry";
import { createTestStore } from "./fixtures/workspace";
import type { JaliStore } from "../src/state/store";

let off = () => {};
afterEach(() => off());

const ranWith = vi.fn();
function setup(
  commands: Command[],
  keyboard: NonNullable<NonNullable<Parameters<typeof createTestStore>[0]>["keyboard"]> = {},
) {
  ranWith.mockReset();
  const store = createTestStore({
    commands,
    keyboard: { platform: "mac", ...keyboard },
    initial: { area: { width: 1600, height: 900 } },
  });
  off = installKeyboard(store);
  return store;
}
/** ⌘B, as a browser sends it on a Mac. */
const pressModB = () => {
  const e = new KeyboardEvent("keydown", {
    key: "b",
    code: "KeyB",
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(e);
  return e;
};
const listed = (store: JaliStore, id: string) => listCommands(store.jali).find((c) => c.id === id)!;
const queue = (o: Partial<Command> = {}): Command => ({
  id: "app.queue",
  title: "Collapse the queue",
  group: "View",
  run: ranWith,
  keys: "Mod+B",
  ...o,
});

describe("an app command's keys", () => {
  it("run it, and the palette prints them", () => {
    const store = setup([queue()]);
    expect(listed(store, "app.queue").keys).toBe("⌘B");
    expect(pressModB().defaultPrevented).toBe(true);
    expect(ranWith).toHaveBeenCalledTimes(1);
  });

  it("are the app's keymap's to rebind or unbind", () => {
    const rebound = setup([queue()], { keymap: { "app.queue": "Mod+K Mod+B" } });
    expect(listed(rebound, "app.queue").keys).toBe("⌘K ⌘B");
    pressModB();
    expect(ranWith).not.toHaveBeenCalled();
    off();

    const unbound = setup([queue()], { keymap: { "app.queue": null } });
    expect(listed(unbound, "app.queue").keys).toBe("");
    expect(pressModB().defaultPrevented).toBe(false);
    expect(ranWith).not.toHaveBeenCalled();
  });

  it("that Jali already uses are refused and reported, and Jali's command keeps them", () => {
    const onInvalid = vi.fn();
    const store = setup([queue({ keys: "Mod+\\" })], { onInvalid });
    expect(onInvalid).toHaveBeenCalledWith(
      "app.queue",
      "Mod+\\",
      "⌘\\ already runs pane.split.right",
    );
    expect(listed(store, "app.queue").keys).toBe("");
    expect(listed(store, "pane.split.right").keys).toBe("⌘\\");
  });

  it("go with the command: one that repeats a Jali id is dropped, keys and all", () => {
    const store = setup([queue({ id: "pane.zoom" })]);
    expect(listed(store, "pane.zoom").title).not.toBe("Collapse the queue");
    pressModB();
    expect(ranWith).not.toHaveBeenCalled();
  });
});

describe("an app command's check", () => {
  it("greys it out with its reason, and its key only says the reason, until it can run", () => {
    let narrow = true;
    const store = setup([queue({ disabled: () => narrow && "Only on a wider window" })]);
    const announce = vi.spyOn(store, "announce");
    expect(listed(store, "app.queue")).toMatchObject({
      disabled: true,
      reason: "Only on a wider window",
      keys: "⌘B",
    });
    pressModB();
    expect(ranWith).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("Only on a wider window");

    listed(store, "app.queue").run();
    expect(ranWith).not.toHaveBeenCalled();

    narrow = false;
    expect(listed(store, "app.queue")).toMatchObject({ disabled: false });
    expect(listed(store, "app.queue").reason).toBeUndefined();
    pressModB();
    expect(ranWith).toHaveBeenCalledTimes(1);
  });

  it("can say only that it can't run: true greys it out with no reason", () => {
    const store = setup([queue({ disabled: () => true })]);
    expect(listed(store, "app.queue")).toMatchObject({ disabled: true });
    expect(listed(store, "app.queue").reason).toBeUndefined();
  });

  it("is given the instance, as run is", () => {
    const check = vi.fn(() => false);
    const store = setup([queue({ disabled: check })]);
    listed(store, "app.queue");
    expect(check).toHaveBeenCalledWith(store.jali);
  });
});
