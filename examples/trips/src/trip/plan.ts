/**
 * The plan: which hotel, which stops on which day and in what order, the mode of any leg the person chose, and the
 * budget. It is plain JSON, kept on this device. Every change goes through `PlanStore.change`, which keeps an undo
 * history of whole plans (they are small).
 *
 * The functions on a plan are pure, so tests and the optimiser use them without a store.
 */
import { leg, type Leg, type Mode } from "./travel";
import { mustPlace, placeById, type Place } from "./places";

export interface Day {
  /** 1 to 5. */
  n: number;
  /** ISO date. */
  date: string;
  title: string;
  /** Place ids, in visiting order. */
  stops: string[];
}

export interface Plan {
  version: 1;
  city: string;
  /** In euros, for the whole trip. */
  budget: number;
  /** Where the person sleeps every night: each day starts and ends there. */
  hotel: string;
  days: Day[];
  /** Modes the person chose, by `legKey`. */
  modes: Record<string, Mode>;
}

export const DEFAULT_PLAN: Plan = {
  version: 1,
  city: "Lisbon",
  budget: 950,
  hotel: "h-ribeira",
  days: [
    {
      n: 1,
      date: "2027-04-15",
      title: "Baixa and the castle",
      // A first draft, not yet in the best order: "Optimise order" has something to do.
      stops: ["comercio", "castelo", "f-bica", "arco-augusta", "se", "santa-luzia", "f-pombo"],
    },
    {
      n: 2,
      date: "2027-04-16",
      title: "Belém by the river",
      stops: ["torre-belem", "lx-factory", "jeronimos", "f-forno", "padrao", "maat", "f-cais"],
    },
    {
      n: 3,
      date: "2027-04-17",
      title: "Hills and viewpoints",
      stops: ["santa-justa", "carmo", "sao-pedro", "f-lanterna", "senhora-monte", "graca", "f-graca"],
    },
    {
      n: 4,
      date: "2027-04-18",
      title: "Alfama, tiles and the market",
      stops: ["feira-ladra", "panteao", "fado-museu", "azulejo", "f-azulejo", "ribeira", "f-brasa"],
    },
    {
      n: 5,
      date: "2027-04-19",
      title: "Gardens and the ocean",
      stops: ["gulbenkian", "f-cantina", "eduardo-vii", "oceanario", "f-doca"],
    },
  ],
  modes: {},
};

export const dayOf = (plan: Plan, n: number): Day | undefined => plan.days.find((d) => d.n === n);

/** The day a place is planned on, if any. */
export const dayWith = (plan: Plan, id: string): Day | undefined =>
  plan.days.find((d) => d.stops.includes(id));

/** A day's route: from the hotel, through the stops, back to the hotel. */
export function routeOf(plan: Plan, stops: readonly string[]): Place[] {
  const hotel = mustPlace(plan.hotel);
  return [hotel, ...stops.map(mustPlace), hotel];
}

export interface DayTotals {
  legs: Leg[];
  travelMin: number;
  transport: number;
  /** Time at the stops, in minutes. */
  visitMin: number;
  /** Tickets and meals, in euros. */
  spend: number;
  /** Straight after breakfast at 09:00: when the person is back at the hotel. */
  endsAt: number;
}

export const DAY_START_MIN = 9 * 60;

export function dayTotals(plan: Plan, stops: readonly string[]): DayTotals {
  const route = routeOf(plan, stops);
  const legs = route.slice(1).map((p, i) => leg(route[i]!, p, plan.modes));
  const travelMin = legs.reduce((s, l) => s + l.minutes, 0);
  const transport = round2(legs.reduce((s, l) => s + l.cost, 0));
  const places = stops.map(mustPlace);
  const visitMin = places.reduce((s, p) => s + p.visitMin, 0);
  const spend = round2(places.reduce((s, p) => s + p.price, 0));
  return { legs, travelMin, transport, visitMin, spend, endsAt: DAY_START_MIN + travelMin + visitMin };
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

/** Move `id` to day `toDay` at `index` (default: the end), from whichever day had it. */
export function moveStop(plan: Plan, id: string, toDay: number, index?: number): Plan {
  if (!dayOf(plan, toDay)) return plan;
  const removed = { ...plan, days: plan.days.map((d) => ({ ...d, stops: d.stops.filter((s) => s !== id) })) };
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

export const setStops = (plan: Plan, n: number, stops: string[]): Plan => withDay(plan, n, () => stops);

export function setMode(plan: Plan, key: string, mode: Mode | null): Plan {
  const modes = { ...plan.modes };
  if (mode) modes[key] = mode;
  else delete modes[key];
  return { ...plan, modes };
}

export function setHotel(plan: Plan, id: string): Plan {
  const p = placeById(id);
  return p?.category === "stay" ? { ...plan, hotel: id } : plan;
}

export const setBudget = (plan: Plan, budget: number): Plan =>
  Number.isFinite(budget) && budget > 0 ? { ...plan, budget: Math.round(budget) } : plan;

/** A stored plan we can still read: every place known, every day there. Anything else gives the default. */
export function readPlan(raw: unknown): Plan {
  const p = raw as Plan | null;
  const ok =
    p?.version === 1 &&
    typeof p.budget === "number" &&
    placeById(p.hotel)?.category === "stay" &&
    Array.isArray(p.days) &&
    p.days.length === DEFAULT_PLAN.days.length &&
    p.days.every((d) => Array.isArray(d.stops) && d.stops.every((s) => !!placeById(s))) &&
    typeof p.modes === "object";
  return ok ? p : DEFAULT_PLAN;
}
