/**
 * What comes back from storage is checked: damaged edits, layouts and settings give their defaults, and never throw.
 */
import { afterEach, describe, expect, it } from "vitest";
import { channelOf, createEdits, readEdits } from "./edits";
import { createLayouts, readLayouts } from "./layouts";
import { saved } from "./store";

const SESSION = "apollo11-landing";

afterEach(() => localStorage.clear());

describe("edits read back from storage", () => {
  it("keep what is the right shape, field by field", () => {
    const edits = readEdits({
      [SESSION]: {
        corrections: { s01: "Houston, Tranquility Base here.", s02: 42 },
        speakerNames: null,
        notes: ["not", "a", "record"],
        markers: [{ id: "m1", time: 12, label: "Landing" }],
        mix: {
          good: { gain: -6, pan: 0.5, mute: false, solo: true },
          loud: { gain: 900, pan: -4, mute: true, solo: false },
          text: { gain: "loud", pan: 0, mute: false, solo: false },
        },
        masterGain: "max",
      },
    });
    const e = edits[SESSION]!;
    expect(e.corrections).toEqual({ s01: "Houston, Tranquility Base here." });
    expect(e.speakerNames).toEqual({});
    expect(e.notes).toEqual({});
    expect(e.markers).toEqual([{ id: "m1", time: 12, label: "Landing" }]);
    // A gain off the fader's travel is brought onto it; a gain that isn't a number is no channel.
    expect(e.mix).toEqual({
      good: { gain: -6, pan: 0.5, mute: false, solo: true },
      loud: { gain: 6, pan: -1, mute: true, solo: false },
    });
    expect(e.masterGain).toBe(0);
  });

  it("give the session's own markers for a list with a bad one in it", () => {
    const edits = readEdits({
      [SESSION]: { markers: [{ id: "m1", time: 12, label: "Landing" }, { id: "m2" }] },
    });
    expect(edits[SESSION]!.markers).toBeNull();
  });

  it("drop sessions the library doesn't have, and anything that isn't a record", () => {
    for (const raw of [undefined, null, 42, "edits", [], [{}]]) expect(readEdits(raw)).toEqual({});
    expect(Object.keys(readEdits({ nowhere: {}, __proto__: {}, [SESSION]: 7 }))).toEqual([SESSION]);
  });

  it("load into the store from hostile storage without throwing", () => {
    for (const raw of [
      "{nope",
      "null",
      "42",
      JSON.stringify({ [SESSION]: { mix: { a: null } } }),
    ]) {
      localStorage.setItem("studio:edits:v1", raw);
      const edits = createEdits();
      expect(channelOf(edits.of(SESSION), "a")).toEqual({
        gain: 0,
        pan: 0,
        mute: false,
        solo: false,
      });
    }
  });

  it("move from the unversioned key to the versioned one, checked on the way", () => {
    localStorage.setItem(
      "studio:edits",
      JSON.stringify({ [SESSION]: { notes: { s01: "Check", s02: 3 } } }),
    );
    const edits = createEdits();
    expect(edits.of(SESSION).notes).toEqual({ s01: "Check" });
    expect(localStorage.getItem("studio:edits")).toBeNull();
    expect(JSON.parse(localStorage.getItem("studio:edits:v1")!)[SESSION].notes).toEqual({
      s01: "Check",
    });
  });
});

describe("layouts read back from storage", () => {
  it("keep only objects, for Jali to check before it uses one", () => {
    for (const raw of [undefined, null, 42, "x", []]) expect(readLayouts(raw)).toEqual({});
    expect(readLayouts({ mix: { root: null }, edit: 3, review: null })).toEqual({
      mix: { root: null },
    });
  });

  it("never hand over a name from Object.prototype", () => {
    localStorage.setItem("studio:layouts:v1", "null");
    const layouts = createLayouts();
    expect(layouts.get("constructor")).toBeUndefined();
    expect(layouts.get("mix")).toBeUndefined();
  });
});

describe("saved.read", () => {
  it("hands parse undefined for nothing, and for text that isn't JSON", () => {
    expect(saved.read("studio:missing", (v) => v)).toBeUndefined();
    localStorage.setItem("studio:bad", "{");
    expect(saved.read("studio:bad", (v) => v)).toBeUndefined();
  });
});
