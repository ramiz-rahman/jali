/**
 * Travel between two places, worked out offline and the same every time: the straight-line distance, times a
 * detour factor for streets, at a speed and a fare rule per mode and per city. No routing service is asked.
 *
 * Each city has its own modes. Bangkok walks short hops, rides the BTS, MRT or river boats further, and takes a taxi
 * or tuk-tuk; a place across the river is reached by ferry. Phuket is spread out and has little public transport:
 * a taxi, or a hired scooter, and walking only between neighbours. The one way between the cities is the flight.
 *
 * Fares are in US dollars and made up for the example, at levels plausible for Thailand.
 */
import { AIRPORT, type CityId, type Place } from "./places";

export type Mode = "walk" | "transit" | "taxi" | "scooter" | "flight";

/** The modes a person can pick from for a leg within each city. */
export const CITY_MODES: Record<CityId, readonly Mode[]> = {
  bkk: ["walk", "transit", "taxi"],
  hkt: ["walk", "taxi", "scooter"],
};

const LABELS: Record<CityId, Partial<Record<Mode, string>>> = {
  bkk: { walk: "Walk", transit: "BTS, MRT or boat", taxi: "Taxi or tuk-tuk" },
  hkt: { walk: "Walk", taxi: "Taxi", scooter: "Scooter" },
};

export const modeLabel = (mode: Mode, city: CityId | "between" = "bkk"): string =>
  mode === "flight" ? "Flight" : city === "between" ? mode : (LABELS[city][mode] ?? mode);

interface ModeRule {
  /** Street distance over straight-line distance. */
  detour: number;
  /** km/h along the streets; a function when longer trips go faster (expressways). */
  kmh: number | ((roadKm: number) => number);
  /** Minutes added to every trip: waiting, walking to the station, the taxi arriving. */
  fixedMin: number;
  fare(roadKm: number): number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export const RULES: Record<CityId, Partial<Record<Mode, ModeRule>>> = {
  bkk: {
    walk: { detour: 1.3, kmh: 4, fixedMin: 0, fare: () => 0 },
    // A ride on the BTS or MRT: a little per km, capped like the real fares. Longer rides (the Airport Rail Link)
    // run faster between stations.
    transit: {
      detour: 1.3,
      kmh: (km) => (km < 10 ? 22 : 40),
      fixedMin: 12,
      fare: (km) => Math.min(1.8, cents(0.5 + 0.1 * km)),
    },
    // Traffic in town; the expressway beyond about 10 km.
    taxi: { detour: 1.35, kmh: (km) => (km < 10 ? 14 : 32), fixedMin: 6, fare: (km) => cents(1 + 0.25 * km) },
  },
  hkt: {
    walk: { detour: 1.3, kmh: 4.5, fixedMin: 0, fare: () => 0 },
    // Phuket's roads are slow through the towns and quicker along the main road up the island.
    taxi: { detour: 1.4, kmh: (km) => (km < 15 ? 30 : 40), fixedMin: 8, fare: (km) => cents(3 + 0.8 * km) },
    // A hired scooter: fuel and a share of the day's hire, by the km.
    scooter: { detour: 1.4, kmh: (km) => (km < 15 ? 28 : 36), fixedMin: 3, fare: (km) => cents(0.12 * km) },
  },
};

/** The cross-river ferry to the Thonburi bank. */
const FERRY: ModeRule = { detour: 1, kmh: 8, fixedMin: 10, fare: () => 0.2 };

/** Bangkok to Phuket: 1h 25m in the air, and about two hours at the airports. */
export const FLIGHT = { airMin: 85, airportMin: 120, cost: 70 };

/** Straight-line distances up to this are walked unless the person says otherwise. */
export const WALK_UP_TO_KM: Record<CityId, number> = { bkk: 1.0, hkt: 0.7 };

/** "Nearby", for a place's neighbours: on foot in Bangkok, a short ride in Phuket. */
export const NEARBY_KM: Record<CityId, number> = { bkk: 1.2, hkt: 4 };

/** The great-circle distance between two points, in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A leg that crosses the Chao Phraya to or from the Thonburi bank. */
export const crossesRiver = (a: Place, b: Place) => a.city === "bkk" && b.city === "bkk" && !!a.acrossRiver !== !!b.acrossRiver;

/** The flight between the two airports. */
export const isFlight = (a: Place, b: Place) => a.city !== b.city && a.id === AIRPORT[a.city] && b.id === AIRPORT[b.city];

/** The modes a person can choose between for this leg. */
export function modesFor(a: Place, b: Place): readonly Mode[] {
  if (isFlight(a, b)) return ["flight"];
  if (a.city !== b.city) return [];
  // Over the river, by the ferry (shown as transit) or a long way round by taxi.
  if (crossesRiver(a, b)) return ["transit", "taxi"];
  return CITY_MODES[a.city];
}

/** The mode a leg gets until the person picks one. */
export function autoMode(a: Place, b: Place, km = haversineKm(a, b)): Mode {
  if (isFlight(a, b)) return "flight";
  if (crossesRiver(a, b)) return "transit";
  if (km <= WALK_UP_TO_KM[a.city]) return "walk";
  return a.city === "bkk" ? "transit" : "taxi";
}

export interface Trip {
  mode: Mode;
  /** Along the way, in km. */
  km: number;
  minutes: number;
  /** In dollars. */
  cost: number;
}

/** How long one trip of `km` (straight line) takes and what it costs, by `mode`, in `city`. */
export function travel(km: number, mode: Mode, city: CityId, { ferry = false } = {}): Trip {
  if (mode === "flight") return { mode, km, minutes: FLIGHT.airMin + FLIGHT.airportMin, cost: FLIGHT.cost };
  const rule = ferry && mode === "transit" ? FERRY : RULES[city][mode];
  if (!rule) throw new Error(`No ${mode} in ${city}`);
  if (km === 0) return { mode, km: 0, minutes: 0, cost: 0 };
  const road = km * rule.detour;
  const kmh = typeof rule.kmh === "function" ? rule.kmh(road) : rule.kmh;
  const minutes = Math.max(1, Math.round(rule.fixedMin + (road / kmh) * 60));
  return { mode, km: road, minutes, cost: cents(rule.fare(road)) };
}

/** The key a leg's chosen mode is kept under: the same both ways, so a reversed route keeps its modes. */
export const legKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface Leg extends Trip {
  from: string;
  to: string;
  /** The city whose rules it follows, or "between" for the flight. */
  city: CityId | "between";
  /** The person chose the mode; otherwise it is `autoMode`'s. */
  chosen: boolean;
  /** The modes the person could choose instead. */
  options: readonly Mode[];
}

/** The leg from `a` to `b`, by the person's mode for it if they chose one (and it is allowed). */
export function leg(a: Place, b: Place, modes: Readonly<Record<string, Mode>> = {}): Leg {
  const km = haversineKm(a, b);
  const options = modesFor(a, b);
  if (!options.length) throw new Error(`No way from ${a.id} in one city to ${b.id} in another but the flight`);
  const wanted = modes[legKey(a.id, b.id)];
  const chosen = wanted && options.includes(wanted) ? wanted : undefined;
  const mode = chosen ?? autoMode(a, b, km);
  const city = isFlight(a, b) ? "between" : a.city;
  const trip = travel(km, mode, a.city, { ferry: crossesRiver(a, b) });
  return { from: a.id, to: b.id, city, chosen: !!chosen, options, ...trip };
}
