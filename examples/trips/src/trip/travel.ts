/**
 * Travel between two places, worked out offline and the same every time: the straight-line distance, times a
 * detour factor for streets and hills, at a speed and a fare rule per mode. No routing service is asked.
 *
 * The fares are made up for the example: a flat ride on public transport, and a taxi's flag fall plus a rate per km.
 */
import type { Place } from "./places";

export type Mode = "walk" | "transit" | "taxi";

export const MODES: readonly Mode[] = ["walk", "transit", "taxi"];

export const MODE_LABEL: Record<Mode, string> = {
  walk: "Walk",
  transit: "Transit",
  taxi: "Taxi",
};

interface ModeRule {
  /** Street distance over straight-line distance. */
  detour: number;
  kmh: number;
  /** Minutes added to every trip: waiting, walking to the stop, the taxi arriving. */
  fixedMin: number;
  fare(roadKm: number): number;
}

export const RULES: Record<Mode, ModeRule> = {
  walk: { detour: 1.3, kmh: 4.5, fixedMin: 0, fare: () => 0 },
  transit: { detour: 1.3, kmh: 16, fixedMin: 8, fare: () => 1.85 },
  taxi: { detour: 1.35, kmh: 20, fixedMin: 5, fare: (km) => roundTo(3.5 + 0.95 * km, 0.05) },
};

/** Straight-line distances up to this are walked unless the person says otherwise. */
export const WALK_UP_TO_KM = 1.2;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The great-circle distance between two points, in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The mode a leg gets until the person picks one: walk when it is short, else public transport. */
export const autoMode = (km: number): Mode => (km <= WALK_UP_TO_KM ? "walk" : "transit");

export interface Trip {
  mode: Mode;
  /** Along the streets, in km. */
  km: number;
  minutes: number;
  /** In euros. */
  cost: number;
}

/** How long one trip takes and what it costs, by `mode`. */
export function travel(km: number, mode: Mode): Trip {
  const rule = RULES[mode];
  const road = km * rule.detour;
  const minutes = km === 0 ? 0 : Math.max(1, Math.round(rule.fixedMin + (road / rule.kmh) * 60));
  return { mode, km: road, minutes, cost: km === 0 ? 0 : Math.round(rule.fare(road) * 100) / 100 };
}

/** The key a leg's chosen mode is kept under: the same both ways, so a reversed route keeps its modes. */
export const legKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface Leg extends Trip {
  from: string;
  to: string;
  /** The person chose the mode; otherwise it is `autoMode`'s. */
  chosen: boolean;
}

/** The leg from `a` to `b`, by the person's mode for it if they chose one. */
export function leg(a: Place, b: Place, modes: Readonly<Record<string, Mode>> = {}): Leg {
  const km = haversineKm(a, b);
  const chosen = modes[legKey(a.id, b.id)];
  return { from: a.id, to: b.id, chosen: !!chosen, ...travel(km, chosen ?? autoMode(km)) };
}
