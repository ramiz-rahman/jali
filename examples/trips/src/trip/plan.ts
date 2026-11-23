/**
 * The plan: a hotel in each city, which stops on which day and in what order, the mode of any leg the person chose,
 * and the budget. It is plain JSON, kept on this device. Every change goes through `PlanStore.change`, which keeps
 * an undo history of whole plans (they are small).
 *
 * Each day belongs to a city and starts and ends at that city's hotel. The transfer day starts at the hotel of the
 * city it leaves (`from`): a ride to the airport, the flight, then its stops in the new city and that city's hotel.
 * Stops are always in the day's city, so no leg but the flight crosses the country.
 *
 * The functions on a plan are pure, so tests and the optimiser use them without a store. Reading a stored plan back
 * is the store's (state/plan-store.ts).
 */
import { CITY, type CityId } from "./cities";
import { cents } from "./money";
import type { Mode } from "./modes";
import { isPlannableIn, mustPlace, placeById, type Place } from "./places";
import { leg, type Leg } from "./travel";

export interface Day {
  /** 1 to 7. */
  n: number;
  /** ISO date. */
  date: string;
  title: string;
  /** Where the day's stops are, and where it ends. */
  city: CityId;
  /** On the transfer day, the city it starts in: the day begins with the flight from there. */
  from?: CityId;
  /** Place ids, in visiting order. */
  stops: string[];
}

export interface Plan {
  version: 2;
  /** The trip's name ("Thailand"). */
  name: string;
  /** In US dollars, for the whole trip. */
  budget: number;
  /** Where the person sleeps in each city. */
  hotels: Record<CityId, string>;
  days: Day[];
  /** Modes the person chose, by `legKey`. */
  modes: Record<string, Mode>;
}

export const DEFAULT_PLAN: Plan = {
  version: 2,
  name: "Thailand",
  budget: 1150,
  hotels: { bkk: "h-riverside", hkt: "h-kata" },
  days: [
    {
      n: 1,
      date: "2027-02-11",
      title: "Temples of the old city",
      city: "bkk",
      // A first draft, not yet in the best order: "Optimise order" has something to do.
      stops: [
        "wat-arun",
        "grand-palace",
        "f-khaomangai",
        "wat-pho",
        "museum-siam",
        "pak-khlong",
        "f-thatien",
      ],
    },
    {
      n: 2,
      date: "2027-02-12",
      title: "Chinatown, silk and the park",
      city: "bkk",
      stops: [
        "wat-traimit",
        "talat-noi",
        "f-coffee",
        "jim-thompson",
        "erawan",
        "lumphini",
        "yaowarat",
        "f-noodle",
      ],
    },
    {
      n: 3,
      date: "2027-02-13",
      title: "Markets and the Golden Mount",
      city: "bkk",
      stops: [
        "chatuchak",
        "f-coconut",
        "marble-temple",
        "golden-mount",
        "f-goldenmount",
        "giant-swing",
        "khao-san",
        "f-phraathit",
      ],
    },
    {
      n: 4,
      date: "2027-02-14",
      title: "Fly to Phuket",
      city: "hkt",
      from: "bkk",
      stops: ["karon-beach", "f-katagrill"],
    },
    {
      n: 5,
      date: "2027-02-15",
      title: "Old Town and the temples",
      city: "hkt",
      stops: [
        "old-town",
        "f-dimsum",
        "khao-rang",
        "f-rang",
        "wat-chalong",
        "big-buddha",
        "f-chalong",
      ],
    },
    {
      n: 6,
      date: "2027-02-16",
      title: "Beaches of the south",
      city: "hkt",
      stops: ["promthep", "kata-beach", "nai-harn", "f-fruit", "kata-view"],
    },
    {
      n: 7,
      date: "2027-02-17",
      title: "The north: a waterfall and quiet bays",
      city: "hkt",
      stops: [
        "bang-pae",
        "f-bangpae",
        "surin",
        "kamala",
        "f-surin",
        "patong",
        "bangla",
        "f-patong",
      ],
    },
  ],
  // Day 5 is already on a hired scooter; Day 7 still goes by taxi, and is over its allowance for it.
  modes: {
    "h-kata|old-town": "scooter",
    "f-dimsum|khao-rang": "scooter",
    "f-rang|wat-chalong": "scooter",
    "big-buddha|wat-chalong": "scooter",
    "big-buddha|f-chalong": "scooter",
    "f-chalong|h-kata": "scooter",
  },
};

/** How many days the trip has: a link or a stored cursor naming another (an older, shorter trip's) is not read. */
export const DAY_COUNT = DEFAULT_PLAN.days.length;

/** A day's number from a link or storage: 1 to DAY_COUNT, else undefined. */
export function dayNumber(v: unknown): number | undefined {
  const n = Number(v);
  return typeof v !== "object" && Number.isInteger(n) && n >= 1 && n <= DAY_COUNT ? n : undefined;
}

export const dayOf = (plan: Plan, n: number): Day | undefined => plan.days.find((d) => d.n === n);

/** The day a place is planned on, if any. */
export const dayWith = (plan: Plan, id: string): Day | undefined =>
  plan.days.find((d) => d.stops.includes(id));

/** The days in a city: the days a place there can go on. */
export const daysIn = (plan: Plan, city: CityId) => plan.days.filter((d) => d.city === city);

/** The day that flies from one city to the other. */
export const transferDay = (plan: Plan): Day | undefined => plan.days.find((d) => d.from);

/** The city's hotel. */
export const hotelOf = (plan: Plan, city: CityId): Place => mustPlace(plan.hotels[city]);

/** Whether `id` is one of the plan's hotels. */
export const isHotel = (plan: Plan, id: string) => Object.values(plan.hotels).includes(id);

/** Every stop planned in a city, in day order. */
export const stopsIn = (plan: Plan, city: CityId): Place[] =>
  daysIn(plan, city).flatMap((d) => d.stops.map(mustPlace));

export interface Route {
  /** Every place the day passes, from its first hotel to its last. */
  places: Place[];
  /** The index in `places` of the first stop (after the hotel, or after the flight on the transfer day). */
  first: number;
}

/** A day's route: from the hotel (and, on the transfer day, by the airports), through the stops, to the hotel. */
export function routeOf(plan: Plan, day: Day, stops: readonly string[] = day.stops): Route {
  const start = day.from
    ? [
        hotelOf(plan, day.from),
        mustPlace(CITY[day.from].airport),
        mustPlace(CITY[day.city].airport),
      ]
    : [hotelOf(plan, day.city)];
  return {
    places: [...start, ...stops.map(mustPlace), hotelOf(plan, day.city)],
    first: start.length,
  };
}

/**
 * What a place is to a day's route: where it starts, the transfer day's airports (the one it leaves from, the one it
 * lands at), a stop, or where it ends (back at the hotel, or checking in at the new city's).
 */
export type StepRole = "start" | "airport" | "landing" | "stop" | "back" | "check-in";

/** One place on a day's route, in order: what it is to the day, the leg that reaches it, and when the person is there. */
export interface Step {
  place: Place;
  role: StepRole;
  /** The leg that reaches it; the start has none. */
  legIn?: Leg;
  /** Reached, in minutes after midnight. */
  arrive: number;
  /** Left: after its visit for a stop; a hotel or an airport keeps no one. */
  leave: number;
}

export interface DayTotals {
  route: Route;
  legs: Leg[];
  /** The route as the day lives it, from 09:00: each place with the leg to it and its times. */
  steps: Step[];
  travelMin: number;
  /** Fares within the city, in dollars (not the flight). */
  transport: number;
  /** The flight's fare, on the transfer day. */
  flight: number;
  /** Time at the stops, in minutes. */
  visitMin: number;
  /** Tickets and meals, in dollars. */
  spend: number;
  /** Back at the hotel. */
  endsAt: number;
}

export const DAY_START_MIN = 9 * 60;

/** The role of the place at `k` in a route of `count` places whose stops begin at `first`. */
function roleAt(day: Day, k: number, count: number, first: number): StepRole {
  if (k === 0) return "start";
  if (k === count - 1) return day.from ? "check-in" : "back";
  if (k < first) return k === first - 1 ? "landing" : "airport";
  return "stop";
}

export function dayTotals(plan: Plan, day: Day, stops: readonly string[] = day.stops): DayTotals {
  const route = routeOf(plan, day, stops);
  const { places, first } = route;
  const legs = places.slice(1).map((p, i) => leg(places[i]!, p, plan.modes));
  const sum = <T>(xs: readonly T[], of: (x: T) => number) => xs.reduce((s, x) => s + of(x), 0);
  const visits = stops.map(mustPlace);
  // Each place is reached after the leg to it; a stop then keeps the person for its visit.
  const steps: Step[] = [];
  let at = DAY_START_MIN;
  places.forEach((place, k) => {
    const legIn = legs[k - 1];
    const role = roleAt(day, k, places.length, first);
    const arrive = at + (legIn?.minutes ?? 0);
    at = arrive + (role === "stop" ? place.visitMin : 0);
    steps.push({ place, role, legIn, arrive, leave: at });
  });
  return {
    route,
    legs,
    steps,
    travelMin: sum(legs, (l) => l.minutes),
    transport: cents(sum(legs, (l) => (l.mode === "flight" ? 0 : l.cost))),
    flight: cents(sum(legs, (l) => (l.mode === "flight" ? l.cost : 0))),
    visitMin: sum(visits, (p) => p.visitMin),
    spend: cents(sum(visits, (p) => p.price)),
    endsAt: at,
  };
}

/** What a place is to the plan: a stop on a day (and which), one of the hotels, or not in it. */
export type Standing =
  | { kind: "stop"; day: Day; index: number }
  | { kind: "hotel" }
  | { kind: "unplanned" };

export function standingOf(plan: Plan, id: string): Standing {
  if (isHotel(plan, id)) return { kind: "hotel" };
  const day = dayWith(plan, id);
  return day ? { kind: "stop", day, index: day.stops.indexOf(id) } : { kind: "unplanned" };
}

/**
 * The day to offer a sight or a meal: `preferred` when it is in the place's city, else the day it is on, else its
 * city's first.
 */
export function dayToOffer(plan: Plan, p: Place, preferred?: number): Day | undefined {
  const shown = preferred === undefined ? undefined : dayOf(plan, preferred);
  if (shown?.city === p.city) return shown;
  return dayWith(plan, p.id) ?? daysIn(plan, p.city)[0];
}

// ---------- changes: each returns a new plan ----------

const withDay = (plan: Plan, n: number, fn: (stops: string[]) => string[]): Plan => ({
  ...plan,
  days: plan.days.map((d) => (d.n === n ? { ...d, stops: fn(d.stops) } : d)),
});

/** `stops` with `id` put in at `index`, kept within the list (the end when undefined). */
const insertAt = (stops: readonly string[], id: string, index = stops.length) => {
  const out = stops.slice();
  out.splice(Math.max(0, Math.min(out.length, index)), 0, id);
  return out;
};

/** Move the stop at `from` to `to` within day `n`. */
export function reorder(plan: Plan, n: number, from: number, to: number): Plan {
  return withDay(plan, n, (s) => {
    const id = s[from];
    return id === undefined ? s : insertAt(s.toSpliced(from, 1), id, to);
  });
}

/** Whether `id` may go on day `n`: a sight or a meal in that day's city. */
export function canPlan(plan: Plan, id: string, n: number): boolean {
  const day = dayOf(plan, n);
  return !!day && isPlannableIn(id, day.city);
}

export const removeStop = (plan: Plan, id: string): Plan => ({
  ...plan,
  days: plan.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s !== id) })),
});

/**
 * Move `id` to day `toDay` at `index` (default: the end), from whichever day had it; a place is planned once, so
 * this is also how one is added. Refused across cities.
 */
export function moveStop(plan: Plan, id: string, toDay: number, index?: number): Plan {
  if (!canPlan(plan, id, toDay)) return plan;
  return withDay(removeStop(plan, id), toDay, (s) => insertAt(s, id, index));
}

export const setStops = (plan: Plan, n: number, stops: string[]): Plan =>
  withDay(plan, n, () => stops);

export function setMode(plan: Plan, key: string, mode: Mode | null): Plan {
  const modes = { ...plan.modes };
  if (mode) modes[key] = mode;
  else delete modes[key];
  return { ...plan, modes };
}

/** Stay at `id`: the hotel for its own city. */
export function setHotel(plan: Plan, id: string): Plan {
  const p = placeById(id);
  return p?.category === "stay" ? { ...plan, hotels: { ...plan.hotels, [p.city]: id } } : plan;
}

export const setBudget = (plan: Plan, budget: number): Plan =>
  Number.isFinite(budget) && budget > 0 ? { ...plan, budget: Math.round(budget) } : plan;
