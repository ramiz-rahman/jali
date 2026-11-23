/**
 * Everything worked out from a plan, once per plan: each day's route, legs and times, its budget, and its quickest
 * order; and the trip's budget. A plan is immutable (each change makes a new one), so the summary is cached by the
 * plan itself, and every pane, the map and ⌘K read the same numbers instead of working them out again.
 */
import { allowanceOf, dayBudget, tripBudget, type DayBudget, type TripBudget } from "./budget";
import { optimiseDay, type Optimised } from "./optimise";
import { dayTotals, type Day, type DayTotals, type Plan } from "./plan";

export interface DaySummary {
  day: Day;
  totals: DayTotals;
  budget: DayBudget;
  /** The quickest order found ("Optimise the order"), worked out the first time it is asked for. */
  readonly best: Optimised;
}

export interface TripSummary {
  /** The plan it was worked out from. */
  plan: Plan;
  days: readonly DaySummary[];
  budget: TripBudget;
  /** Day `n`'s summary, if the trip has that day. */
  day(n: number): DaySummary | undefined;
}

const cache = new WeakMap<Plan, TripSummary>();

export function summarise(plan: Plan): TripSummary {
  const hit = cache.get(plan);
  if (hit) return hit;
  const allowance = allowanceOf(plan);
  const days = plan.days.map((day) => summariseDay(plan, day, allowance));
  const byN = new Map(days.map((d) => [d.day.n, d]));
  const summary: TripSummary = {
    plan,
    days,
    budget: tripBudget(
      plan,
      days.map((d) => d.budget),
    ),
    day: (n) => byN.get(n),
  };
  cache.set(plan, summary);
  return summary;
}

function summariseDay(plan: Plan, day: Day, allowance: number): DaySummary {
  const totals = dayTotals(plan, day);
  let best: Optimised | undefined;
  return {
    day,
    totals,
    budget: dayBudget(plan, day, totals, allowance),
    get best() {
      return (best ??= optimiseDay(plan, day, totals));
    },
  };
}
