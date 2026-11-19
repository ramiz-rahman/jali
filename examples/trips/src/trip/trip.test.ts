import { describe, expect, it } from "vite-plus/test";
import { createPlanStore } from "../store";
import { tripBudget, dayBudget } from "./budget";
import { optimiseDay } from "./optimise";
import { PLACES, mustPlace } from "./places";
import {
  DEFAULT_PLAN,
  dayOf,
  dayTotals,
  moveStop,
  readPlan,
  reorder,
  setHotel,
  setMode,
  type Plan,
} from "./plan";
import { autoMode, haversineKm, leg, legKey, travel } from "./travel";

const day = (plan: Plan, n: number) => dayOf(plan, n)!.stops;

describe("travel", () => {
  it("measures straight-line distance", () => {
    // Praça do Comércio to the castle: about 700 m as the crow flies.
    const km = haversineKm(mustPlace("comercio"), mustPlace("castelo"));
    expect(km).toBeGreaterThan(0.6);
    expect(km).toBeLessThan(0.8);
    expect(haversineKm(mustPlace("se"), mustPlace("se"))).toBe(0);
  });

  it("times and prices each mode by its rule", () => {
    expect(travel(1, "walk")).toEqual({ mode: "walk", km: 1.3, minutes: 17, cost: 0 });
    expect(travel(1, "transit")).toMatchObject({ minutes: 13, cost: 1.85 });
    // Flag fall 3.50 plus 0.95 a km over 1.35 km of streets, to the nearest 5 cents.
    expect(travel(1, "taxi")).toMatchObject({ minutes: 9, cost: 4.8 });
    expect(travel(0, "taxi")).toMatchObject({ minutes: 0, cost: 0 });
  });

  it("walks short legs and rides long ones, unless the person chose", () => {
    expect(autoMode(0.8)).toBe("walk");
    expect(autoMode(3)).toBe("transit");
    const a = mustPlace("torre-belem");
    const b = mustPlace("comercio");
    expect(leg(a, b).mode).toBe("transit");
    expect(leg(a, b, { [legKey(a.id, b.id)]: "taxi" })).toMatchObject({ mode: "taxi", chosen: true });
    // The same both ways.
    expect(legKey("a", "b")).toBe(legKey("b", "a"));
  });

  it("gives every place real-looking coordinates in Lisbon", () => {
    for (const p of PLACES) {
      expect(p.lat, p.id).toBeGreaterThan(38.68);
      expect(p.lat, p.id).toBeLessThan(38.78);
      expect(p.lng, p.id).toBeGreaterThan(-9.23);
      expect(p.lng, p.id).toBeLessThan(-9.08);
    }
    // Every business is made up; every sight is real.
    expect(PLACES.filter((p) => p.category !== "sight").every((p) => p.fictional)).toBe(true);
    expect(PLACES.filter((p) => p.category === "sight").some((p) => p.fictional)).toBe(false);
  });
});

describe("a day's totals", () => {
  it("starts and ends at the hotel", () => {
    const t = dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 1));
    expect(t.legs).toHaveLength(day(DEFAULT_PLAN, 1).length + 1);
    expect(t.legs[0]!.from).toBe(DEFAULT_PLAN.hotel);
    expect(t.legs.at(-1)!.to).toBe(DEFAULT_PLAN.hotel);
    expect(t.travelMin).toBe(t.legs.reduce((s, l) => s + l.minutes, 0));
  });

  it("follows a leg's chosen mode into the transport cost", () => {
    const stops = day(DEFAULT_PLAN, 2);
    const before = dayTotals(DEFAULT_PLAN, stops);
    const first = before.legs[0]!;
    const taxi = setMode(DEFAULT_PLAN, legKey(first.from, first.to), "taxi");
    const after = dayTotals(taxi, stops);
    expect(after.legs[0]!.mode).toBe("taxi");
    expect(after.transport).toBeGreaterThan(before.transport);
    expect(after.legs[0]!.minutes).toBeLessThan(first.minutes);
  });
});

describe("optimise", () => {
  it("finds a quicker order for the first draft of day 1, and says what it saved", () => {
    const r = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 1));
    expect(r.savedMin).toBeGreaterThan(0);
    expect(r.afterMin).toBe(dayTotals(DEFAULT_PLAN, r.stops).travelMin);
    expect([...r.stops].sort()).toEqual([...day(DEFAULT_PLAN, 1)].sort());
  });

  it("leaves a day that is already at its best alone", () => {
    const once = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 2));
    const twice = optimiseDay(DEFAULT_PLAN, once.stops);
    expect(twice.savedMin).toBe(0);
    expect(twice.stops).toEqual(once.stops);
  });

  it("is the same every time", () => {
    const a = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 3));
    const b = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 3));
    expect(a).toEqual(b);
  });

  it("handles tiny days", () => {
    expect(optimiseDay(DEFAULT_PLAN, []).stops).toEqual([]);
    expect(optimiseDay(DEFAULT_PLAN, ["se"]).savedMin).toBe(0);
  });
});

describe("changing the plan", () => {
  it("reorders, and moves a stop between days", () => {
    const r = reorder(DEFAULT_PLAN, 1, 0, 2);
    expect(day(r, 1)[2]).toBe(day(DEFAULT_PLAN, 1)[0]);
    const m = moveStop(DEFAULT_PLAN, "castelo", 3, 0);
    expect(day(m, 1)).not.toContain("castelo");
    expect(day(m, 3)[0]).toBe("castelo");
  });

  it("only takes a hotel as the hotel", () => {
    expect(setHotel(DEFAULT_PLAN, "castelo").hotel).toBe(DEFAULT_PLAN.hotel);
    expect(setHotel(DEFAULT_PLAN, "h-alfama").hotel).toBe("h-alfama");
  });

  it("undoes changes, newest first", () => {
    const store = createPlanStore(false);
    store.change("Moved the castle to Day 3", (p) => moveStop(p, "castelo", 3));
    store.change("Stay at Pátio das Gaivotas", (p) => setHotel(p, "h-alfama"));
    expect(store.undoLabel()).toBe("Stay at Pátio das Gaivotas");
    expect(store.undo()).toBe("Stay at Pátio das Gaivotas");
    expect(store.get().hotel).toBe(DEFAULT_PLAN.hotel);
    expect(store.undo()).toBe("Moved the castle to Day 3");
    expect(store.get()).toEqual(DEFAULT_PLAN);
    expect(store.undo()).toBeNull();
  });

  it("records no step for a change that changes nothing", () => {
    const store = createPlanStore(false);
    store.change("Nothing", (p) => p);
    store.change("Same hotel", (p) => setHotel(p, p.hotel));
    expect(store.undoLabel()).toBeNull();
  });

  it("reads back only a plan it understands", () => {
    expect(readPlan(null)).toBe(DEFAULT_PLAN);
    expect(readPlan({ ...DEFAULT_PLAN, hotel: "nowhere" })).toBe(DEFAULT_PLAN);
    const changed = moveStop(DEFAULT_PLAN, "se", 2);
    expect(readPlan(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
  });
});

describe("budget", () => {
  it("counts a night, the tickets, the meals and the legs for each day", () => {
    const d = dayBudget(DEFAULT_PLAN, 2);
    expect(d.byCategory.stay).toBe(mustPlace(DEFAULT_PLAN.hotel).price);
    expect(d.byCategory.sights).toBe(8 + 0 + 12 + 6 + 11);
    expect(d.byCategory.food).toBe(6 + 22);
    expect(d.byCategory.transport).toBe(dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 2)).transport);
    expect(d.allowance).toBe(DEFAULT_PLAN.budget / 5);
  });

  it("adds up to the trip and marks the days over their share", () => {
    const b = tripBudget(DEFAULT_PLAN);
    expect(b.total).toBeCloseTo(b.days.reduce((s, d) => s + d.total, 0), 2);
    expect(b.left).toBeCloseTo(b.budget - b.total, 2);
    expect(b.overDays).toEqual(b.days.filter((d) => d.total > d.allowance).map((d) => d.n));
    // The bundled trip has one day over: the aquarium day.
    expect(b.overDays).toEqual([5]);
  });

  it("puts every day over with a dearer hotel", () => {
    expect(tripBudget(setHotel(DEFAULT_PLAN, "h-avenida")).overDays).toEqual([1, 2, 3, 4, 5]);
  });
});
