/**
 * The budget: what each day costs (a night at that city's hotel, tickets, meals, transport and, on the transfer
 * day, the flight), against an even share of the trip's budget per day. Transport comes from the day's legs, so
 * changing a leg's mode or the order of the stops changes the budget.
 */
import { dayTotals, hotelOf, round2, type Plan } from "./plan";
import { mustPlace } from "./places";

export type BudgetCategory = "stay" | "sights" | "food" | "transport" | "flight";

export const BUDGET_CATEGORIES: readonly BudgetCategory[] = [
  "stay",
  "sights",
  "food",
  "transport",
  "flight",
];

export const BUDGET_LABEL: Record<BudgetCategory, string> = {
  stay: "Stay",
  sights: "Sights",
  food: "Food",
  transport: "Transport",
  flight: "Flight",
};

export interface DayBudget {
  n: number;
  byCategory: Record<BudgetCategory, number>;
  total: number;
  /** The day's share of the budget. */
  allowance: number;
  over: boolean;
}

export interface TripBudget {
  budget: number;
  days: DayBudget[];
  byCategory: Record<BudgetCategory, number>;
  total: number;
  /** Budget left; negative when the plan costs more than the budget. */
  left: number;
  overDays: number[];
}

export function dayBudget(plan: Plan, n: number): DayBudget {
  const day = plan.days.find((d) => d.n === n);
  if (!day) throw new Error(`No day ${n}`);
  const stops = day.stops;
  const t = dayTotals(plan, day);
  const sum = (cat: "sight" | "food") =>
    round2(stops.map(mustPlace).reduce((s, p) => s + (p.category === cat ? p.price : 0), 0));
  const byCategory = {
    stay: hotelOf(plan, day.city).price,
    sights: sum("sight"),
    food: sum("food"),
    transport: t.transport,
    flight: t.flight,
  };
  const total = round2(BUDGET_CATEGORIES.reduce((s, c) => s + byCategory[c], 0));
  const allowance = round2(plan.budget / plan.days.length);
  return { n, byCategory, total, allowance, over: total > allowance };
}

export function tripBudget(plan: Plan): TripBudget {
  const days = plan.days.map((d) => dayBudget(plan, d.n));
  const byCategory = Object.fromEntries(
    BUDGET_CATEGORIES.map((c) => [c, round2(days.reduce((s, d) => s + d.byCategory[c], 0))]),
  ) as Record<BudgetCategory, number>;
  const total = round2(days.reduce((s, d) => s + d.total, 0));
  return {
    budget: plan.budget,
    days,
    byCategory,
    total,
    left: round2(plan.budget - total),
    overDays: days.filter((d) => d.over).map((d) => d.n),
  };
}
