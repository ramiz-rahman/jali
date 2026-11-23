/**
 * What is close to what: the one module that measures "nearby" for the place pane, the map's candidates, a day's
 * suggestions and Explore's centre. Distances are only ever measured within one city; each city says how far
 * "nearby" reaches (cities.ts).
 */
import { CITY, type CityId } from "./cities";
import { isPlannable, mustPlace, PLACES, type Place } from "./places";
import { dayWith, hotelOf, stopsIn, type Day, type Plan } from "./plan";
import { haversineKm, leg, type Leg } from "./travel";

export interface Point {
  lat: number;
  lng: number;
}

/** The middle of some places (their average position). */
export function centroid(points: readonly Point[]): Point {
  const sum = (of: (p: Point) => number) => points.reduce((s, p) => s + of(p), 0) / points.length;
  return { lat: sum((p) => p.lat), lng: sum((p) => p.lng) };
}

/** The other places in `p`'s city (no airports), each with its distance from `p`, nearest first. */
function around(p: Place): { q: Place; km: number }[] {
  return PLACES.filter((q) => q.id !== p.id && q.city === p.city && q.category !== "airport")
    .map((q) => ({ q, km: haversineKm(p, q) }))
    .sort((a, b) => a.km - b.km);
}

/** A place's neighbours, within its city's "nearby", nearest first, with the way there. */
export const neighbours = (p: Place): { q: Place; km: number; way: Leg }[] =>
  around(p)
    .filter((x) => x.km <= CITY[p.city].nearbyKm)
    .map((x) => ({ ...x, way: leg(p, x.q) }));

/** What the map offers round the selected place: up to ten places near it not yet in the plan. */
export const candidatesNear = (plan: Plan, p: Place): string[] =>
  PLACES.filter(
    (q) =>
      q.id !== p.id &&
      q.city === p.city &&
      q.category !== "airport" &&
      !dayWith(plan, q.id) &&
      haversineKm(p, q) <= CITY[p.city].candidatesKm,
  )
    .slice(0, 10)
    .map((q) => q.id);

/** A suggestion for a day: an unplanned place, the stop it is closest to (or the hotel), and the way from there. */
export interface Suggestion {
  q: Place;
  by: Place;
  way: Leg;
}

/** The three unplanned sights and meals in the day's city that are quickest to reach from one of its stops. */
export function closeToDay(plan: Plan, day: Day): Suggestion[] {
  const anchors = day.stops.length ? day.stops.map(mustPlace) : [hotelOf(plan, day.city)];
  return plannableIn(day.city)
    .filter((q) => !dayWith(plan, q.id))
    .map((q) => {
      const by = anchors.reduce((a, b) => (haversineKm(a, q) <= haversineKm(b, q) ? a : b));
      return { q, by, way: leg(by, q) };
    })
    .sort((a, b) => a.way.minutes - b.way.minutes)
    .slice(0, 3);
}

/** The sights and meals in a city: what any day there may hold. */
export const plannableIn = (city: CityId): Place[] =>
  PLACES.filter((q) => q.city === city && isPlannable(q));

/** The centre of a day: the middle of its stops, or its city's hotel for an empty day. */
export function dayCentre(plan: Plan, day: Day): Point & { city: CityId } {
  const stops = day.stops.map(mustPlace);
  return stops.length ? { ...centroid(stops), city: day.city } : hotelOf(plan, day.city);
}

/** The average trip, in minutes, from a hotel to each stop planned in its city: how central it is to this plan. */
export function minutesToStops(plan: Plan, hotel: Place): number | null {
  const stops = stopsIn(plan, hotel.city);
  if (!stops.length) return null;
  return Math.round(stops.reduce((s, q) => s + leg(hotel, q).minutes, 0) / stops.length);
}
