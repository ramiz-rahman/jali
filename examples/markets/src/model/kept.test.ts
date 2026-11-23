/** What the app keeps on this device is read back through each store's check: bad data falls back, never crashes. */
import { afterEach, describe, expect, it } from "vitest";
import { readKept, writeKept } from "@jali-examples/shared/store";
import { createSimulator } from "../market/sim";
import { createSavedLayouts, KEPT_LAYOUTS } from "../workspace/savedLayouts";
import { KEPT_LEDGER } from "./ledger-kept";
import { createLists, DEFAULT_LISTS, KEPT_LISTS } from "./lists";
import { createTrading } from "./trading";

afterEach(() => localStorage.clear());

const HOSTILE = [
  "{",
  "null",
  "42",
  '"text"',
  "[]",
  "{}",
  '{"v":1,"data":null}',
  '{"v":9,"data":[]}',
];

describe("kept data", () => {
  it("never crashes the stores, whatever is kept", () => {
    for (const raw of HOSTILE) {
      for (const key of [KEPT_LISTS.key, KEPT_LEDGER.key, KEPT_LAYOUTS.key])
        localStorage.setItem(key, raw);
      expect(createLists().get()).toEqual(DEFAULT_LISTS);
      expect(createTrading(createSimulator({ seed: 1 })).get()).toEqual(KEPT_LEDGER.fallback);
      expect(createSavedLayouts().get("rates")).toBeUndefined();
    }
  });

  it("reads lists kept before versions, and drops what this market doesn't have", () => {
    localStorage.setItem(
      KEPT_LISTS.key,
      JSON.stringify([
        { id: "core", name: "Core", symbols: ["LMNA", "NOPE", 7, "LMNA", "BTCUSD"] },
        { id: "fx", symbols: "EURUSD" },
        { id: "mine", name: "Mine", symbols: ["LMNA"] },
      ]),
    );
    const lists = readKept(KEPT_LISTS);
    expect(lists.find((l) => l.id === "core")?.symbols).toEqual(["LMNA", "BTCUSD"]);
    expect(lists.find((l) => l.id === "fx")).toEqual(DEFAULT_LISTS.find((l) => l.id === "fx"));
    expect(lists.map((l) => l.id)).toEqual(DEFAULT_LISTS.map((l) => l.id));
  });

  it("writes with its version, and reads it back", () => {
    const lists = createLists();
    lists.add("core", "BTCUSD");
    expect(JSON.parse(localStorage.getItem(KEPT_LISTS.key) ?? "")).toMatchObject({ v: 1 });
    expect(
      createLists()
        .get()
        .find((l) => l.id === "core")?.symbols,
    ).toContain("BTCUSD");
  });

  it("keeps only desks whose layout is an object; Jali checks the layout itself", () => {
    writeKept(KEPT_LAYOUTS, { rates: { root: {} }, fx: "x", constructor: 1 } as never);
    const layouts = createSavedLayouts();
    expect(layouts.get("rates")).toEqual({ root: {} });
    expect(layouts.get("fx")).toBeUndefined();
    expect(layouts.get("constructor")).toBeUndefined();
    expect(layouts.get("toString")).toBeUndefined();
  });
});
