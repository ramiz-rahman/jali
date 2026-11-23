/**
 * The budget, as a traveller keeps one: the hotels and the flight are booked ahead, and what is left of the budget is
 * shared evenly between the days, to spend on the day (tickets, meals and getting around). A day is over when its
 * spending is more than that daily allowance, so the flight or a dearer hotel never makes a day look over; only what
 * the person can change on the day does. Transport comes from the day's legs, so changing a leg's mode or the order
 * of the stops changes it.
 */
import { cents } from "./money";
import { mustPlace, type Place } from "./places";
import {
  daysIn,
  dayTotals,
  hotelOf,
  transferDay,
  type Day,
  type DayTotals,
  type Plan,
} from "./plan";
import { FLIGHT } from "./travel";
import { CITIES, type CityId } from "./cities";

export type BudgetCategory = "stay" | "sights" | "food" | "transport" | "flight";

/** Booked ahead, for the whole trip. */
export const BOOKED: readonly BudgetCategory[] = ["stay", "flight"];
/** Spent on the day: what the daily allowance is for. */
export const SPENDING: readonly BudgetCategory[] = ["sights", "food", "transport"];
export const BUDGET_CATEGORIES: readonly BudgetCategory[] = [...BOOKED, ...SPENDING];

export const BUDGET_LABEL: Record<BudgetCategory, string> = {
  stay: "Hotels",
  sights: "Sights",
  food: "Food",
  transport: "Getting around",
  flight: "Flight",
};

export interface DayBudget {
  n: number;
  byCategory: Record<BudgetCategory, number>;
  /** What the day costs to spend on it: sights, food and getting around. */
  spend: number;
  /** The day's even share of what is left after the bookings. */
  allowance: number;
  over: boolean;
  /** How far the day's spending is over its allowance, 0 when it isn't. */
  overBy: number;
}

/** One thing booked ahead: a hotel for its nights in a city, or the flight. */
export type Booking =
  | { kind: "stay"; city: CityId; place: Place; nights: number; cost: number }
  | { kind: "flight"; day: number; from: CityId; to: CityId; cost: number };

export interface TripBudget {
  budget: number;
  days: DayBudget[];
  byCategory: Record<BudgetCategory, number>;
  total: number;
  /** The hotels and the flight. */
  bookings: Booking[];
  booked: number;
  /** Each day's allowance: what is left after the bookings, shared evenly. */
  allowance: number;
  /** Budget left; negative when the plan costs more than the budget. */
  left: number;
  overDays: number[];
}

/** The hotels (a night for each day, in the city the day ends in) and the flight, in the order they come. */
export function bookingsOf(plan: Plan): Booking[] {
  const stays = CITIES.map((city): Booking => {
    const nights = daysIn(plan, city).length;
    const place = hotelOf(plan, city);
    return { kind: "stay", city, place, nights, cost: cents(place.price * nights) };
  });
  const flight = transferDay(plan);
  // The flight goes between the cities' hotels, as the trip has them.
  if (!flight?.from) return stays;
  const booking: Booking = {
    kind: "flight",
    day: flight.n,
    from: flight.from,
    to: flight.city,
    cost: FLIGHT.cost,
  };
  return stays.toSpliced(1, 0, booking);
}

/** Each day's allowance: the budget less the bookings, shared evenly, never below nothing. */
export function allowanceOf(plan: Plan, bookings: readonly Booking[] = bookingsOf(plan)): number {
  const booked = bookings.reduce((s, b) => s + b.cost, 0);
  return cents(Math.max(0, plan.budget - booked) / plan.days.length);
}

/** A day's costs by category, and its spending against its allowance (worked out once, in summary.ts, and shared). */
export function dayBudget(
  plan: Plan,
  day: Day,
  totals: DayTotals = dayTotals(plan, day),
  allowance: number = allowanceOf(plan),
): DayBudget {
  const visits = day.stops.map(mustPlace);
  const sum = (cat: "sight" | "food") =>
    cents(visits.reduce((s, p) => s + (p.category === cat ? p.price : 0), 0));
  const byCategory = {
    stay: hotelOf(plan, day.city).price,
    sights: sum("sight"),
    food: sum("food"),
    transport: totals.transport,
    flight: totals.flight,
  };
  const spend = cents(SPENDING.reduce((s, c) => s + byCategory[c], 0));
  const overBy = Math.max(0, cents(spend - allowance));
  return { n: day.n, byCategory, spend, allowance, over: overBy > 0, overBy };
}

/** The whole trip's budget, from each day's. */
export function tripBudget(plan: Plan, days: readonly DayBudget[]): TripBudget {
  const byCategory = Object.fromEntries(
    BUDGET_CATEGORIES.map((c) => [c, cents(days.reduce((s, d) => s + d.byCategory[c], 0))]),
  ) as Record<BudgetCategory, number>;
  const total = cents(BUDGET_CATEGORIES.reduce((s, c) => s + byCategory[c], 0));
  const bookings = bookingsOf(plan);
  return {
    budget: plan.budget,
    days: [...days],
    byCategory,
    total,
    bookings,
    booked: cents(bookings.reduce((s, b) => s + b.cost, 0)),
    allowance: allowanceOf(plan, bookings),
    left: cents(plan.budget - total),
    overDays: days.filter((d) => d.over).map((d) => d.n),
  };
}
