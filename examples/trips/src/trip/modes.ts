/**
 * The ways to get about, and how the app words each one. The ferry across the Chao Phraya is a transit leg that
 * `leg()` marks `ferry`, so it is named for itself wherever a leg is described: one table, read by the day, the
 * place, the map's key and the chooser of modes.
 */
import { CITY, type CityId } from "./cities";

export const MODES = ["walk", "transit", "taxi", "scooter", "flight"] as const;

export type Mode = (typeof MODES)[number];

export const isMode = (v: unknown): v is Mode => MODES.includes(v as Mode);

interface Words {
  /** On the map's route key: "Train or boat". */
  key: string;
  /** After a leg's minutes: "12 min walk", "13 min by ferry". */
  leg: string;
  /** How a place is reached: "12 min on foot", "20 min by taxi". */
  by: string;
}

const WORDS: Record<Mode, Words> = {
  walk: { key: "Walk", leg: "walk", by: "on foot" },
  transit: { key: "Train or boat", leg: "by train", by: "by train or boat" },
  taxi: { key: "Taxi", leg: "by taxi", by: "by taxi" },
  scooter: { key: "Scooter", leg: "by scooter", by: "by scooter" },
  flight: { key: "Flight", leg: "flight", by: "by air" },
};

const FERRY: Words = { key: "River ferry", leg: "by ferry", by: "by ferry" };

/** A leg as it is worded: its mode, and whether that is the river ferry. */
export interface ModeOf {
  mode: Mode;
  ferry?: boolean;
}

/** Whether a leg is the river ferry: transit across the river. */
export const isFerry = ({ mode, ferry }: ModeOf) => !!ferry && mode === "transit";

/** The words for a leg's mode. */
export const wordsFor = (m: ModeOf): Words => (isFerry(m) ? FERRY : WORDS[m.mode]);

/** A mode's name where it is chosen ("BTS, MRT or boat", "River ferry"), in the city the leg is in. */
export function modeName(m: ModeOf, city: CityId): string {
  if (isFerry(m)) return FERRY.key;
  return CITY[city].modes.find((c) => c.mode === m.mode)?.label ?? WORDS[m.mode].key;
}
