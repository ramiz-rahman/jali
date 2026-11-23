/**
 * What the map draws, worked out from the plan and nothing else (no MapLibre, no DOM): the pins and their roles, the
 * routes as GeoJSON, the flight's arc, each city's badge, the places to frame for a day, the modes in its route key,
 * and whether it shows a card for the selected place.
 */
import { CITIES, CITY, cityModes, type CityId } from "../../trip/cities";
import { MODES, type Mode } from "../../trip/modes";
import { centroid } from "../../trip/nearby";
import { mustPlace, placeById, type Place } from "../../trip/places";
import { daysIn, type Day, type Plan } from "../../trip/plan";
import type { DaySummary, TripSummary } from "../../trip/summary";
import { dayColor } from "../../ui/colors";
import { WHOLE_TRIP } from "../../workspace/refs";

export type Theme = "light" | "dark";

export type PinRole = "stop" | "hotel" | "candidate" | "other-day" | "airport";

/** A pin: what the map draws for one place. */
export interface Pin {
  p: Place;
  role: PinRole;
  /** The day it is planned on. */
  day?: number;
  /** 1-based, for a planned stop. */
  order?: number;
}

/** Whether the map of `dayN` shows day `n` as its own (the whole trip shows every day). */
const showsDay = (dayN: number, n: number) => dayN === WHOLE_TRIP || dayN === n;

/**
 * Every pin for the map of `dayN`: each planned stop (the day's own, or another day's), the hotels, the airports,
 * and the candidates (Explore's results, or what is near the selected place), and the selected place itself.
 */
export function pinsFor(
  plan: Plan,
  dayN: number,
  candidates: readonly string[],
  selected: string | null,
): Pin[] {
  const pins = new Map<string, Pin>();
  for (const d of plan.days)
    d.stops.forEach((id, i) =>
      pins.set(id, {
        p: mustPlace(id),
        role: showsDay(dayN, d.n) ? "stop" : "other-day",
        day: d.n,
        order: i + 1,
      }),
    );
  for (const id of Object.values(plan.hotels)) pins.set(id, { p: mustPlace(id), role: "hotel" });
  for (const c of CITIES)
    pins.set(CITY[c].airport, { p: mustPlace(CITY[c].airport), role: "airport" });
  for (const id of candidates)
    if (!pins.has(id)) pins.set(id, { p: mustPlace(id), role: "candidate" });
  if (selected && !pins.has(selected) && placeById(selected))
    pins.set(selected, { p: mustPlace(selected), role: "candidate" });
  return Array.from(pins.values());
}

/** The flight as a gentle arc, not a ruler line across the gulf. */
function arc(a: Place, b: Place, steps = 48): [number, number][] {
  const [x1, y1, x2, y2] = [a.lng, a.lat, b.lng, b.lat];
  // The control point sits off the middle, to the west of the line.
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const [dx, dy] = [x2 - x1, y2 - y1];
  const [cx, cy] = [mx - dy * 0.18, my + dx * 0.18];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
  });
}

/** The routes of the day (or of every day) as lines, each with its mode and its day's colour. */
export function routesFor(summary: TripSummary, dayN: number, theme: Theme) {
  const features = summary.days
    .filter((d) => showsDay(dayN, d.day.n))
    .flatMap((d) =>
      d.totals.legs.map((l) => {
        const a = mustPlace(l.from);
        const b = mustPlace(l.to);
        return {
          type: "Feature" as const,
          properties: { mode: l.mode, color: dayColor(d.day.n, theme) },
          geometry: {
            type: "LineString" as const,
            coordinates:
              l.mode === "flight"
                ? arc(a, b)
                : [
                    [a.lng, a.lat],
                    [b.lng, b.lat],
                  ],
          },
        };
      }),
    );
  return { type: "FeatureCollection" as const, features };
}

/** "Days 1 to 3", "Day 4". */
function dayRange(days: readonly Day[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "No days";
  return first === last ? `Day ${first.n}` : `Days ${first.n} to ${last.n}`;
}

/** A city's badge, shown when the whole country is in view: its name, its days, and its part of the trip. */
export interface Badge {
  city: CityId;
  lat: number;
  lng: number;
  name: string;
  /** "Days 1 to 3, 23 stops". */
  sub: string;
  /** Its hotel and every stop on its days: what a click frames. */
  points: Place[];
}

export function badgesFor(plan: Plan): Badge[] {
  return CITIES.map((city) => {
    const days = daysIn(plan, city);
    const points = [plan.hotels[city], ...days.flatMap((d) => d.stops)].map(mustPlace);
    const stops = days.reduce((s, d) => s + d.stops.length, 0);
    return {
      city,
      ...centroid(points),
      name: CITY[city].name,
      sub: `${dayRange(days)}, ${stops} stops`,
      points,
    };
  });
}

/** The places to frame for a day: its own city's part of the route (on the transfer day, from the landing). */
export function framePoints(summary: TripSummary, dayN: number): Place[] {
  const { plan } = summary;
  if (dayN === WHOLE_TRIP)
    return [...Object.values(plan.hotels), ...plan.days.flatMap((d) => d.stops)].map(mustPlace);
  const d = summary.day(dayN);
  return d ? d.totals.route.places.filter((p) => p.city === d.day.city) : [];
}

/**
 * The modes the route key lists: a day within one city, that city's own; the whole trip or the transfer day, every
 * ride, and the flight.
 */
export function keyModes(day: Day | undefined): Mode[] {
  if (day && !day.from) return [...cityModes(day.city)];
  return [...MODES];
}

/**
 * The place the card under the map shows: the selected one, unless a place pane beside the map says it already, or
 * it is in the other city from the day shown (it stays selected, out of the way).
 */
export function cardFor(
  selected: string | null,
  day: DaySummary | undefined,
  shownBeside: boolean,
): Place | undefined {
  const p = selected ? placeById(selected) : undefined;
  if (!p || shownBeside) return undefined;
  return !day || day.day.city === p.city ? p : undefined;
}
