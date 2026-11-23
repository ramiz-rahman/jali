/**
 * Credit scores, in one place: the scale, how lenders band them, what PMI costs at each, and where a score reads
 * as close to a program's minimum or strong. Each program's own minimum is programs.ts. Pure.
 */

/** The range a score is drawn on: FICO runs from 300, but a mortgage borrower is almost never under 500. */
export const SCORE_SCALE: [min: number, max: number] = [500, 850];

/** A score's band, as lenders price them, best first: a score is in the first band it reaches. */
const BANDS = [
  { from: 760, label: "Excellent" },
  { from: 700, label: "Good" },
  { from: 640, label: "Fair" },
  { from: 0, label: "Poor" },
] as const;

/** Conventional PMI a year, as a share of the loan, by score, best first (a simplified rate card). */
const PMI_RATES = [
  { from: 760, rate: 0.0019 },
  { from: 720, rate: 0.0032 },
  { from: 680, rate: 0.0055 },
  { from: 0, rate: 0.0085 },
] as const;

/** A score within this many points above a program's minimum reads as close to it. */
export const NEAR_MINIMUM = 20;

/** A score from here up reads as strong. */
export const STRONG_SCORE = 740;

const bandOf = <T extends { from: number }>(bands: readonly T[], score: number) =>
  bands.find((b) => score >= b.from) ?? bands[bands.length - 1]!;

/** A credit score's band: "Excellent", "Good", "Fair", "Poor". */
export const scoreBand = (score: number) => bandOf(BANDS, score).label;

/** PMI's annual rate at a score, before the high-LTV add-on (underwriting.ts). */
export const pmiRate = (score: number) => bandOf(PMI_RATES, score).rate;
