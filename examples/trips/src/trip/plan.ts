/**
 * The plan: a hotel in each city, which stops on which day and in what order, the mode of any leg the person chose,
 * and the budget. It is plain JSON, kept on this device. Every change goes through `PlanStore.change`, which keeps
 * an undo history of whole plans (they are small).
 *
 * Each day belongs to a city and starts and ends at that city's hotel. The transfer day starts at the hotel of the
 * city it leaves (`from`): a ride to the airport, the flight, then its stops in the new city and that city's hotel.
 * Stops are always in the day's city, so no leg but the flight crosses the country.
 *
 * The functions on a plan are pure, so tests and the optimiser use them without a store.
 */
import { leg, type Leg, type Mode } from "./travel";
import { AIRPORT, mustPlace, placeById, type CityId, type Place } from "./places";

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
  modes: {},
};

export const dayOf = (plan: Plan, n: number): Day | undefined => plan.days.find((d) => d.n === n);

/** The day a place is planned on, if any. */
export const dayWith = (plan: Plan, id: string): Day | undefined =>
  plan.days.find((d) => d.stops.includes(id));

/** The days a place can go on: the days in its city. */
export const daysIn = (plan: Plan, city: CityId) => plan.days.filter((d) => d.city === city);

/** The city's hotel. */
export const hotelOf = (plan: Plan, city: CityId): Place => mustPlace(plan.hotels[city]);

/** Whether `id` is one of the plan's hotels. */
export const isHotel = (plan: Plan, id: string) => Object.values(plan.hotels).includes(id);

export interface Route {
  /** Every place the day passes, from its first hotel to its last. */
  places: Place[];
  /** The index in `places` of the first stop (after the hotel, or after the flight on the transfer day). */
  first: number;
}

/** A day's route: from the hotel (and, on the transfer day, by the airports), through the stops, to the hotel. */
export function routeOf(plan: Plan, day: Day, stops: readonly string[] = day.stops): Route {
  const start = day.from
    ? [hotelOf(plan, day.from), mustPlace(AIRPORT[day.from]), mustPlace(AIRPORT[day.city])]
    : [hotelOf(plan, day.city)];
  return {
    places: [...start, ...stops.map(mustPlace), hotelOf(plan, day.city)],
    first: start.length,
  };
}

export interface DayTotals {
  route: Route;
  legs: Leg[];
  travelMin: number;
  /** Fares within the city, in dollars (not the flight). */
  transport: number;
  /** The flight's fare, on the transfer day. */
  flight: number;
  /** Time at the stops, in minutes. */
  visitMin: number;
  /** Tickets and meals, in dollars. */
  spend: number;
  /** When each place is reached, in minutes after midnight, from 09:00. */
  arrive: number[];
  /** Back at the hotel. */
  endsAt: number;
}

export const DAY_START_MIN = 9 * 60;

export function dayTotals(plan: Plan, day: Day, stops: readonly string[] = day.stops): DayTotals {
  const route = routeOf(plan, day, stops);
  const { places } = route;
  const legs = places.slice(1).map((p, i) => leg(places[i]!, p, plan.modes));
  const travelMin = legs.reduce((s, l) => s + l.minutes, 0);
  const flight = round2(legs.reduce((s, l) => s + (l.mode === "flight" ? l.cost : 0), 0));
  const transport = round2(legs.reduce((s, l) => s + (l.mode === "flight" ? 0 : l.cost), 0));
  const visits = stops.map(mustPlace);
  const visitMin = visits.reduce((s, p) => s + p.visitMin, 0);
  const spend = round2(visits.reduce((s, p) => s + p.price, 0));
  let clock = DAY_START_MIN;
  const arrive = [clock];
  places.slice(1).forEach((p, i) => {
    clock += legs[i]!.minutes;
    arrive.push(clock);
    clock += i + 1 >= route.first && i + 1 < places.length - 1 ? p.visitMin : 0;
  });
  return {
    route,
    legs,
    travelMin,
    transport,
    flight,
    visitMin,
    spend,
    arrive,
    endsAt: arrive[arrive.length - 1]!,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- changes: each returns a new plan ----------

const withDay = (plan: Plan, n: number, fn: (stops: string[]) => string[]): Plan => ({
  ...plan,
  days: plan.days.map((d) => (d.n === n ? { ...d, stops: fn(d.stops) } : d)),
});

/** Move the stop at `from` to `to` within day `n`. */
export function reorder(plan: Plan, n: number, from: number, to: number): Plan {
  return withDay(plan, n, (s) => {
    const out = s.slice();
    const [id] = out.splice(from, 1);
    if (id === undefined) return s;
    out.splice(Math.max(0, Math.min(out.length, to)), 0, id);
    return out;
  });
}

/** Whether `id` may go on day `n`: a sight or a meal in that day's city. */
export function canPlan(plan: Plan, id: string, n: number): boolean {
  const p = placeById(id);
  const day = dayOf(plan, n);
  return !!p && !!day && (p.category === "sight" || p.category === "food") && p.city === day.city;
}

/** Move `id` to day `toDay` at `index` (default: the end), from whichever day had it. Refused across cities. */
export function moveStop(plan: Plan, id: string, toDay: number, index?: number): Plan {
  if (!canPlan(plan, id, toDay)) return plan;
  const removed = {
    ...plan,
    days: plan.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s !== id) })),
  };
  return withDay(removed, toDay, (s) => {
    const out = s.slice();
    out.splice(index === undefined ? out.length : Math.max(0, Math.min(out.length, index)), 0, id);
    return out;
  });
}

/** Add a place to a day: the same as moving it there, since a place is planned once. */
export const addStop = moveStop;

export const removeStop = (plan: Plan, id: string): Plan => ({
  ...plan,
  days: plan.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s !== id) })),
});

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

/**
 * A stored plan we can still read: this version, every place known and in its day's city, a hotel in each city.
 * Anything else (an older plan, such as the Lisbon one, or a damaged one) gives the bundled plan.
 */
export function readPlan(raw: unknown): Plan {
  const p = raw as Plan | null;
  const ok =
    p?.version === 2 &&
    typeof p.budget === "number" &&
    placeById(p.hotels?.bkk)?.city === "bkk" &&
    placeById(p.hotels?.bkk)?.category === "stay" &&
    placeById(p.hotels?.hkt)?.city === "hkt" &&
    placeById(p.hotels?.hkt)?.category === "stay" &&
    Array.isArray(p.days) &&
    p.days.length === DEFAULT_PLAN.days.length &&
    p.days.every(
      (d, i) =>
        d.city === DEFAULT_PLAN.days[i]!.city &&
        Array.isArray(d.stops) &&
        d.stops.every((s) => placeById(s)?.city === d.city),
    ) &&
    typeof p.modes === "object";
  return ok ? p : DEFAULT_PLAN;
}
