import { describe, expect, it } from "vite-plus/test";
import { createPlanStore } from "../store";
import { tripBudget, dayBudget } from "./budget";
import { optimiseDay } from "./optimise";
import { AIRPORT, PLACES, mustPlace } from "./places";
import {
  canPlan,
  DEFAULT_PLAN,
  dayOf,
  dayTotals,
  moveStop,
  readPlan,
  reorder,
  routeOf,
  setHotel,
  setMode,
  type Plan,
} from "./plan";
import { autoMode, FLIGHT, haversineKm, leg, legKey, modesFor, travel } from "./travel";

const day = (plan: Plan, n: number) => dayOf(plan, n)!;
const stops = (plan: Plan, n: number) => day(plan, n).stops;

describe("travel", () => {
  it("measures straight-line distance, about 680 km between the two cities", () => {
    const km = haversineKm(mustPlace("grand-palace"), mustPlace("wat-pho"));
    expect(km).toBeGreaterThan(0.3);
    expect(km).toBeLessThan(0.5);
    const between = haversineKm(mustPlace(AIRPORT.bkk), mustPlace(AIRPORT.hkt));
    expect(between).toBeGreaterThan(600);
    expect(between).toBeLessThan(750);
  });

  it("times and prices each mode by its city's rule, in dollars", () => {
    expect(travel(1, "walk", "bkk")).toEqual({ mode: "walk", km: 1.3, minutes: 20, cost: 0 });
    // A BTS ride: a little per km, never more than $1.80.
    expect(travel(3, "transit", "bkk")).toMatchObject({ minutes: 23, cost: 0.89 });
    expect(travel(40, "transit", "bkk").cost).toBe(1.8);
    // A short taxi in Bangkok is a few dollars; in Phuket it costs more.
    expect(travel(3, "taxi", "bkk").cost).toBeCloseTo(2.01, 2);
    expect(travel(3, "taxi", "hkt").cost).toBeCloseTo(6.36, 2);
    expect(travel(10, "scooter", "hkt").cost).toBeCloseTo(1.68, 2);
    expect(travel(0, "taxi", "hkt")).toMatchObject({ minutes: 0, cost: 0 });
    // Phuket has no metro to pick.
    expect(() => travel(3, "transit", "hkt")).toThrow();
  });

  it("walks short legs and rides long ones, by the city's habits, unless the person chose", () => {
    const palace = mustPlace("grand-palace");
    const pho = mustPlace("wat-pho");
    const chatuchak = mustPlace("chatuchak");
    expect(autoMode(palace, pho)).toBe("walk");
    expect(autoMode(palace, chatuchak)).toBe("transit");
    expect(autoMode(mustPlace("kata-beach"), mustPlace("old-town"))).toBe("taxi");
    expect(leg(palace, chatuchak, { [legKey(palace.id, chatuchak.id)]: "taxi" })).toMatchObject({
      mode: "taxi",
      chosen: true,
    });
    // A mode the city doesn't have is ignored.
    const kata = mustPlace("kata-beach");
    const town = mustPlace("old-town");
    expect(leg(kata, town, { [legKey(kata.id, town.id)]: "transit" })).toMatchObject({
      mode: "taxi",
      chosen: false,
    });
    expect(modesFor(kata, town)).toEqual(["walk", "taxi", "scooter"]);
    expect(legKey("a", "b")).toBe(legKey("b", "a"));
  });

  it("crosses the river to Wat Arun by ferry", () => {
    const arun = mustPlace("wat-arun");
    const pho = mustPlace("wat-pho");
    expect(modesFor(pho, arun)).toEqual(["transit", "taxi"]);
    expect(leg(pho, arun)).toMatchObject({ mode: "transit", cost: 0.2 });
  });

  it("flies between the airports, and never takes any other leg across the country", () => {
    const f = leg(mustPlace(AIRPORT.bkk), mustPlace(AIRPORT.hkt));
    expect(f).toMatchObject({
      mode: "flight",
      cost: FLIGHT.cost,
      minutes: FLIGHT.airMin + FLIGHT.airportMin,
    });
    expect(() => leg(mustPlace("grand-palace"), mustPlace("kata-beach"))).toThrow();
  });

  it("gives every place real-looking coordinates in its city", () => {
    for (const p of PLACES) {
      if (p.city === "bkk") {
        expect(p.lat, p.id).toBeGreaterThan(13.6);
        expect(p.lat, p.id).toBeLessThan(13.85);
        expect(p.lng, p.id).toBeGreaterThan(100.45);
        expect(p.lng, p.id).toBeLessThan(100.8);
      } else {
        expect(p.lat, p.id).toBeGreaterThan(7.7);
        expect(p.lat, p.id).toBeLessThan(8.2);
        expect(p.lng, p.id).toBeGreaterThan(98.25);
        expect(p.lng, p.id).toBeLessThan(98.45);
      }
    }
    // Every business is made up; every sight is real.
    expect(
      PLACES.filter((p) => p.category === "food" || p.category === "stay").every(
        (p) => p.fictional,
      ),
    ).toBe(true);
    expect(PLACES.filter((p) => p.category === "sight").some((p) => p.fictional)).toBe(false);
  });
});

describe("a day's route and totals", () => {
  it("starts and ends at the hotel of the day's city", () => {
    const t = dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 1));
    expect(t.legs).toHaveLength(stops(DEFAULT_PLAN, 1).length + 1);
    expect(t.legs[0]!.from).toBe(DEFAULT_PLAN.hotels.bkk);
    expect(t.legs.at(-1)!.to).toBe(DEFAULT_PLAN.hotels.bkk);
    expect(t.travelMin).toBe(t.legs.reduce((s, l) => s + l.minutes, 0));
    const p = dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 6));
    expect(p.legs[0]!.from).toBe(DEFAULT_PLAN.hotels.hkt);
    expect(p.legs.at(-1)!.to).toBe(DEFAULT_PLAN.hotels.hkt);
  });

  it("begins the transfer day at the Bangkok hotel, flies, and ends at the Phuket hotel", () => {
    const d = day(DEFAULT_PLAN, 4);
    const route = routeOf(DEFAULT_PLAN, d);
    expect(route.places.map((p) => p.id).slice(0, 3)).toEqual([
      DEFAULT_PLAN.hotels.bkk,
      AIRPORT.bkk,
      AIRPORT.hkt,
    ]);
    expect(route.first).toBe(3);
    expect(route.places.at(-1)!.id).toBe(DEFAULT_PLAN.hotels.hkt);
    const t = dayTotals(DEFAULT_PLAN, d);
    expect(t.legs.filter((l) => l.mode === "flight")).toHaveLength(1);
    expect(t.flight).toBe(FLIGHT.cost);
    expect(t.transport).toBeGreaterThan(0);
    // Every other leg is within one city.
    for (const l of t.legs.filter((l) => l.mode !== "flight"))
      expect(mustPlace(l.from).city, `${l.from} to ${l.to}`).toBe(mustPlace(l.to).city);
  });

  it("follows a leg's chosen mode into the transport cost", () => {
    const d = day(DEFAULT_PLAN, 6);
    const before = dayTotals(DEFAULT_PLAN, d);
    const first = before.legs[0]!;
    const scooter = setMode(DEFAULT_PLAN, legKey(first.from, first.to), "scooter");
    const after = dayTotals(scooter, day(scooter, 6));
    expect(after.legs[0]!.mode).toBe("scooter");
    expect(after.transport).toBeLessThan(before.transport);
  });

  it("times each arrival from 09:00, adding legs and visits", () => {
    const t = dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 1));
    expect(t.arrive[0]).toBe(9 * 60);
    expect(t.arrive[1]).toBe(9 * 60 + t.legs[0]!.minutes);
    expect(t.endsAt).toBe(9 * 60 + t.travelMin + t.visitMin);
  });
});

describe("optimise", () => {
  it("finds a quicker order for the first draft of day 1, and says what it saved", () => {
    const r = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 1));
    expect(r.savedMin).toBeGreaterThan(0);
    expect(r.afterMin).toBe(dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 1), r.stops).travelMin);
    expect([...r.stops].sort()).toEqual([...stops(DEFAULT_PLAN, 1)].sort());
  });

  it("orders a spread-out Phuket day, from the hotel and back", () => {
    const r = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 6));
    expect(r.savedMin).toBeGreaterThan(10);
    expect(r.savedCost).toBeGreaterThan(0);
  });

  it("keeps the transfer day's flight first, and orders only what comes after it", () => {
    const d = {
      ...day(DEFAULT_PLAN, 4),
      stops: ["promthep", "karon-beach", "f-katagrill", "big-buddha"],
    };
    const r = optimiseDay(DEFAULT_PLAN, d);
    const route = routeOf(DEFAULT_PLAN, d, r.stops);
    expect(route.places.slice(0, 3).map((p) => p.id)).toEqual([
      DEFAULT_PLAN.hotels.bkk,
      AIRPORT.bkk,
      AIRPORT.hkt,
    ]);
    expect([...r.stops].sort()).toEqual([...d.stops].sort());
    expect(r.afterMin).toBeLessThanOrEqual(r.beforeMin);
  });

  it("leaves a day that is already at its best alone, and is the same every time", () => {
    const once = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 2));
    const twice = optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 2), once.stops);
    expect(twice.savedMin).toBe(0);
    expect(twice.stops).toEqual(once.stops);
    expect(optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 3))).toEqual(
      optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 3)),
    );
  });

  it("handles tiny days", () => {
    expect(optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 1), []).stops).toEqual([]);
    expect(optimiseDay(DEFAULT_PLAN, day(DEFAULT_PLAN, 1), ["wat-pho"]).savedMin).toBe(0);
  });
});

describe("changing the plan", () => {
  it("reorders, and moves a stop between days of the same city", () => {
    const r = reorder(DEFAULT_PLAN, 1, 0, 2);
    expect(stops(r, 1)[2]).toBe(stops(DEFAULT_PLAN, 1)[0]);
    const m = moveStop(DEFAULT_PLAN, "golden-mount", 2, 0);
    expect(stops(m, 3)).not.toContain("golden-mount");
    expect(stops(m, 2)[0]).toBe("golden-mount");
  });

  it("never puts a place on a day in the other city", () => {
    expect(canPlan(DEFAULT_PLAN, "wat-pho", 6)).toBe(false);
    expect(moveStop(DEFAULT_PLAN, "wat-pho", 6)).toBe(DEFAULT_PLAN);
    expect(canPlan(DEFAULT_PLAN, "patong", 4)).toBe(true);
    expect(canPlan(DEFAULT_PLAN, AIRPORT.hkt, 5)).toBe(false);
  });

  it("sets each city's hotel on its own", () => {
    expect(setHotel(DEFAULT_PLAN, "wat-pho")).toBe(DEFAULT_PLAN);
    const p = setHotel(DEFAULT_PLAN, "h-naiharn");
    expect(p.hotels).toEqual({ bkk: DEFAULT_PLAN.hotels.bkk, hkt: "h-naiharn" });
    expect(dayTotals(p, day(p, 6)).legs[0]!.from).toBe("h-naiharn");
  });

  it("undoes changes, newest first", () => {
    const store = createPlanStore(false);
    store.change("Moved the Golden Mount to Day 2", (p) => moveStop(p, "golden-mount", 2));
    store.change("Stay at Silom Lantern Hotel", (p) => setHotel(p, "h-silom"));
    expect(store.undoLabel()).toBe("Stay at Silom Lantern Hotel");
    expect(store.undo()).toBe("Stay at Silom Lantern Hotel");
    expect(store.get().hotels.bkk).toBe(DEFAULT_PLAN.hotels.bkk);
    expect(store.undo()).toBe("Moved the Golden Mount to Day 2");
    expect(store.get()).toEqual(DEFAULT_PLAN);
    expect(store.undo()).toBeNull();
  });

  it("records no step for a change that changes nothing", () => {
    const store = createPlanStore(false);
    store.change("Nothing", (p) => p);
    store.change("Same hotel", (p) => setHotel(p, p.hotels.bkk));
    expect(store.undoLabel()).toBeNull();
  });

  it("reads back only a plan it understands: an old Lisbon plan gives the bundled trip", () => {
    expect(readPlan(null)).toBe(DEFAULT_PLAN);
    const lisbon = {
      version: 1,
      city: "Lisbon",
      budget: 950,
      hotel: "h-ribeira",
      days: [],
      modes: {},
    };
    expect(readPlan(lisbon)).toBe(DEFAULT_PLAN);
    expect(readPlan({ ...DEFAULT_PLAN, hotels: { bkk: "h-kata", hkt: "h-kata" } })).toBe(
      DEFAULT_PLAN,
    );
    const changed = moveStop(DEFAULT_PLAN, "wat-pho", 2);
    expect(readPlan(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
  });
});

describe("budget", () => {
  it("counts a night at the city's hotel, the tickets, the meals and the legs for each day", () => {
    const d = dayBudget(DEFAULT_PLAN, 1);
    expect(d.byCategory.stay).toBe(mustPlace(DEFAULT_PLAN.hotels.bkk).price);
    expect(d.byCategory.sights).toBe(6 + 15 + 9 + 6 + 0);
    expect(d.byCategory.food).toBe(2.5 + 14);
    expect(d.byCategory.transport).toBe(dayTotals(DEFAULT_PLAN, day(DEFAULT_PLAN, 1)).transport);
    expect(d.byCategory.flight).toBe(0);
    expect(dayBudget(DEFAULT_PLAN, 6).byCategory.stay).toBe(
      mustPlace(DEFAULT_PLAN.hotels.hkt).price,
    );
    expect(d.allowance).toBeCloseTo(DEFAULT_PLAN.budget / 7, 2);
  });

  it("puts the flight on the transfer day, as its own line", () => {
    expect(dayBudget(DEFAULT_PLAN, 4).byCategory.flight).toBe(FLIGHT.cost);
    expect(tripBudget(DEFAULT_PLAN).byCategory.flight).toBe(FLIGHT.cost);
  });

  it("adds up to the trip and marks the days over their share", () => {
    const b = tripBudget(DEFAULT_PLAN);
    expect(b.total).toBeCloseTo(
      b.days.reduce((s, d) => s + d.total, 0),
      2,
    );
    expect(b.left).toBeCloseTo(b.budget - b.total, 2);
    // The bundled trip fits the budget, but the flight day and two days of Phuket taxis are over their share.
    expect(b.left).toBeGreaterThan(0);
    expect(b.overDays).toEqual([4, 5, 7]);
  });

  it("brings a Phuket day under its share with a scooter instead of taxis", () => {
    let p = DEFAULT_PLAN;
    for (const l of dayTotals(p, day(p, 7)).legs)
      if (l.options.includes("scooter")) p = setMode(p, legKey(l.from, l.to), "scooter");
    expect(dayBudget(p, 7).over).toBe(false);
  });
});
