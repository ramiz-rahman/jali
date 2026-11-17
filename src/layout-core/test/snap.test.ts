import { describe, expect, it } from "vitest";
import { snapToCentre } from "../index";

describe("centre snap hysteresis", () => {
  it.each([[490, false, 500], [510, false, 500], [489, false, 489], [511, false, 511], [484, true, 500], [516, true, 500], [483, true, 483], [517, true, 517], [500, false, 500]] as const)("snaps %s with previous state %s to %s", (value, snapped, expected) => {
    expect(snapToCentre(value, 500, snapped)).toBe(expected);
  });
});
