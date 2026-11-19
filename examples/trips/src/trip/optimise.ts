/**
 * "Optimise order": the order of a day's stops that takes the least travel time, starting and ending at the hotel.
 * Nearest neighbour gives a first order, and 2-opt improves it (reverse any stretch that makes the day shorter,
 * until none does). It is not always the best possible order, but for a day of a few stops it is close, and it is
 * the same every time.
 */
import { dayTotals, type Plan } from "./plan";
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

export function optimiseDay(plan: Plan, stops: readonly string[]): Optimised {
  const before = dayTotals(plan, stops);
  const n = stops.length;
  if (n < 2) return result(plan, stops, stops, before);

  // Travel minutes between any two of the hotel (index 0) and the stops (1..n).
  const ids = [plan.hotel, ...stops];
  const places = ids.map(mustPlace);
  const cost = places.map((a) => places.map((b) => (a === b ? 0 : leg(a, b, plan.modes).minutes)));
  const length = (order: number[]) => {
    let total = 0;
    let at = 0;
    for (const i of order) {
      total += cost[at]![i]!;
      at = i;
    }
    return total + cost[at]![0]!;
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
        const next = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
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
  return result(plan, stops, dayTotals(plan, candidate).travelMin < before.travelMin ? candidate : stops, before);
}

function result(
  plan: Plan,
  original: readonly string[],
  stops: readonly string[],
  before: ReturnType<typeof dayTotals>,
): Optimised {
  const after = stops === original ? before : dayTotals(plan, stops);
  return {
    stops: [...stops],
    beforeMin: before.travelMin,
    afterMin: after.travelMin,
    savedMin: before.travelMin - after.travelMin,
    savedCost: Math.round((before.transport - after.transport) * 100) / 100,
  };
}
