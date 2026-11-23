/**
 * The plan's store: saved on this device, read back only after a check, with its own undo history of whole plans
 * (they are small). Every change goes through `change`.
 */
import { CITIES, type CityId } from "../trip/cities";
import { isMode, type Mode } from "../trip/modes";
import { isPlannableIn, placeById } from "../trip/places";
import { DEFAULT_PLAN, type Day, type Plan } from "../trip/plan";
import { createStore, type Store } from "./store";
import { isRecord, saved } from "./saved";

export interface PlanStore extends Store<Plan> {
  /** Make a change the person can undo. `label` says what it was ("Optimised Day 1"). */
  change(label: string, fn: (plan: Plan) => Plan): void;
  /** Undo the last change; returns what it was, or null when there is nothing to undo. */
  undo(): string | null;
  /** What Undo would undo, if anything. */
  undoLabel(): string | null;
  /** Back to the bundled plan (undoable). */
  reset(): void;
}

// Versioned: a plan saved by an older version of the example (the Lisbon trip) is never read back as this one.
const KEY = "trips:plan:v2";
const HISTORY = 40;

export function createPlanStore(persist = true, initial?: Plan): PlanStore {
  const store = createStore<Plan>(initial ?? (persist ? saved.read(KEY, readPlan) : DEFAULT_PLAN));
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const history: { label: string; plan: Plan }[] = [];

  const change = (label: string, fn: (plan: Plan) => Plan) => {
    const before = store.get();
    const after = fn(before);
    if (after === before || JSON.stringify(after) === JSON.stringify(before)) return;
    history.push({ label, plan: before });
    if (history.length > HISTORY) history.shift();
    store.set(after);
  };
  return {
    ...store,
    change,
    undo() {
      const last = history.pop();
      if (!last) return null;
      store.set(last.plan);
      return last.label;
    },
    undoLabel: () => history[history.length - 1]?.label ?? null,
    reset: () => change("Reset the trip", () => DEFAULT_PLAN),
  };
}

/**
 * A stored plan, checked: storage holds whatever an older version of the app, another tab or a hand edit left there,
 * so nothing in it is trusted. A plan of this version, with a hotel in each city and every day's stops known places
 * in that day's city, each planned once, is read back; anything else (an older plan, such as the Lisbon one, or a
 * damaged one) gives the bundled plan. The days' numbers, dates, titles and cities are the trip's, not the person's,
 * so they come from the bundled plan whatever was stored. A chosen mode that isn't a mode is dropped: that leg goes
 * back to its usual mode.
 */
export function readPlan(raw: unknown): Plan {
  if (!isRecord(raw) || raw.version !== 2) return DEFAULT_PLAN;
  const { name, budget, hotels, days, modes } = raw;
  if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) return DEFAULT_PLAN;
  if (!isRecord(hotels) || !isRecord(modes)) return DEFAULT_PLAN;
  const read = readHotels(hotels);
  if (!read) return DEFAULT_PLAN;
  if (!Array.isArray(days) || days.length !== DEFAULT_PLAN.days.length) return DEFAULT_PLAN;
  const planned = new Set<string>();
  const readDays: Day[] = [];
  for (const [i, bundled] of DEFAULT_PLAN.days.entries()) {
    const stops = isRecord(days[i]) ? days[i].stops : undefined;
    if (!Array.isArray(stops)) return DEFAULT_PLAN;
    for (const s of stops) {
      if (typeof s !== "string" || planned.has(s) || !isPlannableIn(s, bundled.city))
        return DEFAULT_PLAN;
      planned.add(s);
    }
    readDays.push({ ...bundled, stops: stops as string[] });
  }
  return {
    version: 2,
    name: typeof name === "string" && name.trim() ? name : DEFAULT_PLAN.name,
    budget: Math.round(budget),
    hotels: read,
    days: readDays,
    modes: Object.fromEntries(
      Object.entries(modes).filter((e): e is [string, Mode] => isMode(e[1])),
    ),
  };
}

/** A hotel in each city, each one a stay in that city; else undefined. */
function readHotels(hotels: Record<string, unknown>): Record<CityId, string> | undefined {
  const read: Partial<Record<CityId, string>> = {};
  for (const city of CITIES) {
    const id = hotels[city];
    const p = typeof id === "string" ? placeById(id) : undefined;
    if (p?.category !== "stay" || p.city !== city) return undefined;
    read[city] = p.id;
  }
  return read as Record<CityId, string>;
}
