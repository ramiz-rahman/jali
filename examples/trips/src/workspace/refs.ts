/**
 * The pane kinds' names and the refs to what they show. Each pane is defined under its name here (`definePane(KIND.day,
 * …)`), and code that opens or selects something builds its ref here: the workspace's moves (hub.ts) and one pane
 * pointing at another never import a pane, so no pane imports another and nothing imports in a circle.
 */
import type { ObjectRef } from "jali";
import type { Category } from "../trip/places";

export const KIND = {
  trip: "trip",
  map: "map",
  day: "day",
  place: "place",
  explore: "explore",
  budget: "budget",
  launcher: "launcher",
} as const;

/** What the map shows for the whole trip, rather than one day. */
export const WHOLE_TRIP = 0;

export const tripRef = (): ObjectRef => ({ kind: KIND.trip, params: {} });
export const budgetRef = (): ObjectRef => ({ kind: KIND.budget, params: {} });
export const dayRef = (n: number): ObjectRef => ({ kind: KIND.day, params: { n } });
export const placeRef = (id: string): ObjectRef => ({ kind: KIND.place, params: { id } });
/** The map of day `day`, or of the whole trip. */
export const mapRef = (day: number = WHOLE_TRIP): ObjectRef => ({
  kind: KIND.map,
  params: { day },
});
export const exploreRef = (category?: Exclude<Category, "airport">): ObjectRef => ({
  kind: KIND.explore,
  params: category ? { category } : {},
});

/** The place a ref shows, if it is a place's. */
export const placeOf = (ref: ObjectRef | undefined): string | null =>
  ref?.kind === KIND.place ? String(ref.params.id) : null;

/** The day a ref shows, if it is a day's. */
export const dayNumberOf = (ref: ObjectRef | undefined): number | null =>
  ref?.kind === KIND.day ? Number(ref.params.n) : null;
