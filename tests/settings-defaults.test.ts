/** `createJali({ settings })`: what a first visit starts with. Saved settings win, and nothing is saved until the
 *  person changes something. */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, type StoragePort } from "@jali/core";

const note = { kind: "note", title: "Note" };
const make = (storage: StoragePort, settings?: Parameters<typeof createJali>[0]["settings"]) =>
  createJali({
    panes: [note],
    layout: { kind: "note", params: {} },
    url: false,
    storage,
    moveFocus: false,
    ...(settings ? { settings } : {}),
  });

describe("default settings", () => {
  it("a first visit starts with the app's settings over Jali's", () => {
    const jali = make(memoryStorage(), { theme: "dark", paneCap: 4 });
    expect(jali.get().settings).toMatchObject({ theme: "dark", paneCap: 4, centreDrop: "swap" });
  });

  it("are not saved: a visit after the app changes its defaults gets the new ones", () => {
    const storage = memoryStorage();
    make(storage, { theme: "dark" });
    expect(storage.get("settings")).toBeNull();
    expect(make(storage, { theme: "light" }).get().settings.theme).toBe("light");
  });

  it("saved settings win, key by key", () => {
    const storage = memoryStorage();
    storage.set("settings", JSON.stringify({ theme: "light" }));
    const jali = make(storage, { theme: "dark", paneCap: 4 });
    expect(jali.get().settings).toMatchObject({ theme: "light", paneCap: 4 });
  });

  it("what the person changes is saved and wins next time", () => {
    const storage = memoryStorage();
    const jali = make(storage, { theme: "dark" });
    const stop = jali.start();
    jali.actions.changeSettings({ theme: "light" });
    stop();
    expect(make(storage, { theme: "dark" }).get().settings.theme).toBe("light");
  });

  it("without them, Jali's defaults as before", () => {
    expect(make(memoryStorage()).get().settings).toEqual({
      centreDrop: "swap",
      paneCap: 8,
      theme: "system",
      boundary: "tint",
    });
  });
});
