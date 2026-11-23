/**
 * The trip's two cities and everything that differs between them: the name, the airport, the modes a leg can take
 * and what each is called there, and the distances that read as "a walk" or "nearby". Code that would otherwise ask
 * `city === "bkk"` reads the city's own entry here.
 *
 * Bangkok is compact and walked, with trains and river boats; Phuket is spread out and driven.
 */
import type { Mode } from "./modes";

export type CityId = "bkk" | "hkt";

export interface City {
  name: string;
  /** The airport it flies from and to (a place id). */
  airport: string;
  /** The modes a person can pick for a leg within the city, in order, each with its name there. */
  modes: readonly { mode: Mode; label: string }[];
  /** The mode a leg too long to walk gets until the person picks one. */
  ride: Mode;
  /** Straight-line distances up to this are walked unless the person says otherwise. */
  walkUpToKm: number;
  /** "Nearby", for a place's neighbours: on foot in Bangkok, a short ride in Phuket. */
  nearbyKm: number;
  /** The heading over a place's neighbours. */
  nearbyTitle: string;
  /** How far round the selected place the map shows unplanned candidates. */
  candidatesKm: number;
  /** The closest the map comes when it brings a place into view. */
  focusZoom: number;
}

export const CITY: Record<CityId, City> = {
  bkk: {
    name: "Bangkok",
    airport: "bkk-airport",
    modes: [
      { mode: "walk", label: "Walk" },
      { mode: "transit", label: "BTS, MRT or boat" },
      { mode: "taxi", label: "Taxi or tuk-tuk" },
    ],
    ride: "transit",
    walkUpToKm: 1.0,
    nearbyKm: 1.2,
    nearbyTitle: "Nearby",
    candidatesKm: 0.9,
    focusZoom: 14,
  },
  hkt: {
    name: "Phuket",
    airport: "hkt-airport",
    modes: [
      { mode: "walk", label: "Walk" },
      { mode: "taxi", label: "Taxi" },
      { mode: "scooter", label: "Scooter" },
    ],
    ride: "taxi",
    walkUpToKm: 0.7,
    nearbyKm: 4,
    nearbyTitle: "Nearby by road",
    candidatesKm: 3,
    focusZoom: 13,
  },
};

/** The cities in the trip's order: Bangkok, then Phuket. */
export const CITIES: readonly CityId[] = ["bkk", "hkt"];

export const isCity = (v: unknown): v is CityId => CITIES.includes(v as CityId);

/** The modes a person can pick for a leg within `city`. */
export const cityModes = (c: CityId): readonly Mode[] => CITY[c].modes.map((m) => m.mode);
