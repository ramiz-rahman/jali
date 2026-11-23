/**
 * What an underwriter should notice before deciding, grouped by the three Cs of underwriting (credit, capacity,
 * collateral) and the loan itself. Each area's check is its own module; this one names the areas and sorts what
 * they find, most severe first. Pure.
 */
import type { Case } from "../case";
import type { Qualifying } from "../underwriting";
import { capacity } from "./capacity";
import { collateral } from "./collateral";
import { credit } from "./credit";
import { loan } from "./loan";

export type Tone = "ok" | "warn" | "risk" | "info";
export type Area = "credit" | "capacity" | "collateral" | "loan";
export type SignalId =
  | "score"
  | "history"
  | "dti"
  | "reserves"
  | "employment"
  | "ltv"
  | "appraisal"
  | "flood"
  | "condo"
  | "mi"
  | "limit"
  | "benefit"
  | "cashout"
  | "second"
  | "occupancy"
  | "arm";

/** What one area's check finds. The area is the check's. */
export interface Finding {
  id: SignalId;
  tone: Tone;
  text: string;
  detail?: string;
}
export interface Signal extends Finding {
  area: Area;
}

/** One area's check: what it finds in a case, given how it qualifies (undefined until that loads). */
export type AreaCheck = (theCase: Case, qualifying: Qualifying | undefined) => Finding[];

export const AREAS: { id: Area; label: string; check: AreaCheck }[] = [
  { id: "credit", label: "Credit", check: credit },
  { id: "capacity", label: "Capacity", check: capacity },
  { id: "collateral", label: "Collateral", check: collateral },
  { id: "loan", label: "Loan", check: loan },
];

const SEVERITY: Record<Tone, number> = { risk: 0, warn: 1, info: 2, ok: 3 };

/** Every area's signals, most severe first. */
export const signalsOf = (theCase: Case, qualifying: Qualifying | undefined): Signal[] =>
  AREAS.flatMap(({ id, check }) =>
    check(theCase, qualifying).map((finding) => ({ ...finding, area: id })),
  ).sort((x, y) => SEVERITY[x.tone] - SEVERITY[y.tone]);
