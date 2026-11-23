/**
 * Explore's filters: what they can be, what they start as, how they are read back from storage, and the search
 * itself, pure, so the pane only shows its result. Distances are only ever measured within the city shown.
 */
import { CITIES, CITY, isCity, type CityId } from "../../trip/cities";
import type { Point } from "../../trip/nearby";
import { PLACES, type Category, type Place } from "../../trip/places";
import { haversineKm, travel } from "../../trip/travel";
import { isNumber, isRecord, stringIn } from "../../state/saved";

export type Near = "place" | "day" | "anywhere";
export type ExploreCategory = Exclude<Category, "airport">;

/** Any distance: the "Within" choice that doesn't filter. */
export const ANY_DISTANCE = 0;
/** Any price: the "Price" choice that doesn't filter. */
export const ANY_PRICE = -1;

export interface Filters {
  city: CityId;
  category: ExploreCategory | "all";
  text: string;
  near: Near;
  /** km, or ANY_DISTANCE. */
  within: number;
  /** Dollars, or ANY_PRICE. */
  maxPrice: number;
}

// Bangkok is compact and walked; Phuket is spread out and driven, so its distances are longer.
export const WITHIN: Record<CityId, readonly { value: number; label: string }[]> = {
  bkk: [
    { value: 0.6, label: "600 m" },
    { value: 1.2, label: "1.2 km" },
    { value: 3, label: "3 km" },
    { value: ANY_DISTANCE, label: "Any" },
  ],
  hkt: [
    { value: 2, label: "2 km" },
    { value: 5, label: "5 km" },
    { value: 15, label: "15 km" },
    { value: ANY_DISTANCE, label: "Any" },
  ],
};

/** "Nearby" in a city: the distance a filter starts on, the second choice. */
export const nearbyIn = (city: CityId) => WITHIN[city][1]!.value;

export const PRICES = [
  { value: ANY_PRICE, label: "Any" },
  { value: 0, label: "Free" },
  { value: 5, label: "Up to $5" },
  { value: 15, label: "Up to $15" },
  { value: 60, label: "Up to $60" },
  { value: 100, label: "Up to $100" },
] as const;

export const NEAR: readonly { value: Near; label: string }[] = [
  { value: "place", label: "The selected place" },
  { value: "day", label: "The day's centre" },
  { value: "anywhere", label: "Anywhere" },
];

/** The filters a pane starts with: in `city`; a pane for stays searches the whole city, any other near the place. */
export function startFilters(city: CityId, category?: ExploreCategory): Filters {
  const stays = category === "stay";
  return {
    city,
    category: category ?? "all",
    text: "",
    near: stays ? "anywhere" : "place",
    within: stays ? ANY_DISTANCE : nearbyIn(city),
    maxPrice: ANY_PRICE,
  };
}

/** Each named filter in ⌘K: what it sets. */
export const PRESET_FILTERS = {
  stays: (): Partial<Filters> => ({ category: "stay", near: "anywhere", within: ANY_DISTANCE }),
  food: (f: Filters): Partial<Filters> => ({
    category: "food",
    near: "place",
    within: nearbyIn(f.city),
  }),
  clear: (): Partial<Filters> => ({
    text: "",
    maxPrice: ANY_PRICE,
    within: ANY_DISTANCE,
    near: "anywhere",
    category: "all",
  }),
};

/** Another city: its own distances, still "nearby" if the filter was. */
export const inCity = (f: Filters, city: CityId): Partial<Filters> => ({
  city,
  within: f.within === ANY_DISTANCE ? ANY_DISTANCE : nearbyIn(city),
});

/** The other city of the two, for "Explore Phuket" from Bangkok and back. */
export const otherCity = (city: CityId) => CITIES.find((c) => c !== city)!;

/** Filters read back from storage: each field one the pane offers, or the whole set starts afresh. */
export function readFilters(v: unknown): Filters | undefined {
  if (!isRecord(v)) return undefined;
  const city = isCity(v.city) ? v.city : undefined;
  const category = stringIn<Filters["category"]>("all", "sight", "food", "stay")(v.category);
  const near = stringIn<Near>("place", "day", "anywhere")(v.near);
  const { text, within, maxPrice } = v;
  if (!city || !category || !near || typeof text !== "string") return undefined;
  if (!isNumber(within) || !WITHIN[city].some((w) => w.value === within)) return undefined;
  if (!isNumber(maxPrice) || !PRICES.some((p) => p.value === maxPrice)) return undefined;
  return { city, category, near, text, within, maxPrice };
}

/** A result: the place, and how far it is from the anchor when there is one. */
export interface Result {
  p: Place;
  km: number | null;
  /** The walk from the anchor, in minutes, when it is short enough to be said as a walk. */
  walkMin: number | null;
}

/** A short way is said as a walk (a little past the city's walking distance); anything further as a distance. */
const walkMin = (p: Place, km: number | null) =>
  km !== null && km <= CITY[p.city].walkUpToKm * 1.5 ? travel(km, "walk", p.city).minutes : null;

/**
 * The places that pass the filters, in the filters' city: nearest the anchor first (then by name), or by name when
 * there is no anchor. `exclude` is the selected place, when the search is round it.
 */
export function search(f: Filters, anchor: Point | null, exclude: string | null): Result[] {
  const text = f.text.trim().toLowerCase();
  return PLACES.filter((p) => p.city === f.city && p.category !== "airport")
    .filter((p) => f.category === "all" || p.category === f.category)
    .filter((p) => !text || `${p.name} ${p.area} ${p.kind}`.toLowerCase().includes(text))
    .filter((p) => f.maxPrice === ANY_PRICE || p.price <= f.maxPrice)
    .filter((p) => p.id !== exclude)
    .map((p) => ({ p, km: anchor ? haversineKm(anchor, p) : null }))
    .filter((r) => r.km === null || f.within === ANY_DISTANCE || r.km <= f.within)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.p.name.localeCompare(b.p.name))
    .map((r) => ({ ...r, walkMin: walkMin(r.p, r.km) }));
}
