/**
 * The sessions load when first wanted, once each, and a name that isn't a session never loads anything.
 */
import { describe, expect, it } from "vite-plus/test";
import { isSession, SESSION_IDS } from "./ids";
import { loadSession, sessionById } from "./load";

describe("loading a session", () => {
  it("has no data until it is asked for, then has it, from one load", async () => {
    expect(sessionById("dinner-party")).toBeUndefined();
    const [a, b] = await Promise.all([loadSession("dinner-party"), loadSession("dinner-party")]);
    expect(a).toBe(b);
    expect(sessionById("dinner-party")).toBe(a);
    expect(a.id).toBe("dinner-party");
    // The others are still not loaded.
    expect(sessionById("apollo11-landing")).toBeUndefined();
  });

  it("refuses a name that isn't a session, Object.prototype's included", async () => {
    for (const id of ["nowhere", "constructor", "__proto__", "toString"]) {
      expect(isSession(id)).toBe(false);
      await expect(loadSession(id)).rejects.toThrow(/no session/);
    }
  });

  it("lists the library in its order", () => {
    expect(SESSION_IDS).toEqual(["apollo11-landing", "light-caught-by-the-stone", "dinner-party"]);
  });
});
