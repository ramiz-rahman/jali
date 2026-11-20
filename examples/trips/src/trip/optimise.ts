/**
 * "Optimise order": the order of a day's stops that takes the least travel time, from where the day's stops begin
 * (the hotel, or the airport on the transfer day) to the hotel at the end. The stops are all in the day's city, so
 * it only ever weighs legs within one city.
 * Nearest neighbour gives a first order, and 2-opt improves it (reverse any stretch that makes the day shorter,
 * until none does). It is not always the best possible order, but for a day of a few stops it is close, and it is
 * the same every time.
 */
import { dayTotals, routeOf, type Day, type Plan } from "./plan";
import { leg } from "./travel";
import { mustPlace } from "./places";

export interface Optimised {
  stops: string[];
  beforeMin: number;
  afterMin: number;
  /** Minutes saved, 0 when the day is already in its best order. */
  savedMin: number;
  /** Transport cost saved, in euros (may be negative: a quicker day can cost a little more). */
  savedCost: number;
}

export function optimiseDay(plan: Plan, day: Day, stops: readonly string[] = day.stops): Optimised {
  const before = dayTotals(plan, day, stops);
  const n = stops.length;
  if (n < 2) return result(plan, day, stops, stops, before);

  // Travel minutes between any two of: where the stops begin (index 0), the stops (1..n), the hotel (n + 1).
  const route = routeOf(plan, day, stops);
  const start = route.places[route.first - 1]!;
  const end = route.places[route.places.length - 1]!;
  const places = [start, ...stops.map(mustPlace), end];
  const ids = places.map((p) => p.id);
  const cost = places.map((a, i) =>
    places.map((b, j) => (i === j ? 0 : leg(a, b, plan.modes).minutes)),
  );
  const length = (order: number[]) => {
    let total = 0;
    let at = 0;
    for (const i of order) {
      total += cost[at]![i]!;
      at = i;
    }
    return total + cost[at]![n + 1]!;
  };

  // Nearest neighbour from the hotel. Ties go to the stop planned earlier, so the result is stable.
  const left = new Set(stops.map((_, i) => i + 1));
  const order: number[] = [];
  let at = 0;
  while (left.size) {
    let best = -1;
    for (const i of left) if (best < 0 || cost[at]![i]! < cost[at]![best]!) best = i;
    order.push(best);
    left.delete(best);
    at = best;
  }

  // 2-opt: reverse order[i..j] whenever that shortens the round trip.
  let improved = true;
  let best = length(order);
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const next = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        const len = length(next);
        if (len < best) {
          order.splice(0, n, ...next);
          best = len;
          improved = true;
        }
      }
    }
  }

  const candidate = order.map((i) => ids[i]!);
  // Keep the person's order unless the new one is really quicker.
  return result(
    plan,
    day,
    stops,
    dayTotals(plan, day, candidate).travelMin < before.travelMin ? candidate : stops,
    before,
  );
}

function result(
  plan: Plan,
  day: Day,
  original: readonly string[],
  stops: readonly string[],
  before: ReturnType<typeof dayTotals>,
): Optimised {
  const after = stops === original ? before : dayTotals(plan, day, stops);
  return {
    stops: [...stops],
    beforeMin: before.travelMin,
    afterMin: after.travelMin,
    savedMin: before.travelMin - after.travelMin,
    savedCost: Math.round((before.transport - after.transport) * 100) / 100,
  };
}
