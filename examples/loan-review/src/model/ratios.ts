/**
 * The ratios an application qualifies on (LTV, DTI, credit score, reserves), each against its program's limit and
 * said one way: the header's figures and the Qualifying gauges both draw these, so their names, limits and tones
 * never drift apart. Each ratio's tone is its signal's (signals/). Pure.
 */
import type { Case } from "./case";
import { guidelines, isSecondLien, maxLtv } from "./programs";
import { SCORE_SCALE, scoreBand } from "./scores";
import type { SignalId, Tone } from "./signals";
import type { Qualifying } from "./underwriting";
import { pct, usd } from "./words";

export type RatioId = Extract<SignalId, "ltv" | "dti" | "score" | "reserves">;

export interface Ratio {
  id: RatioId;
  /** Its name: "LTV", "Credit score". */
  label: string;
  /** Its name on the collapsed header's one line: "Score". */
  short: string;
  /** What it reads, as shown: "78.4%", "742"; "…" until what it needs has loaded. */
  value: string;
  /** Where it sits on its scale, in the scale's units; undefined until it has loaded. */
  at?: number;
  /** Where the program's limit sits, in the same units. */
  limit: number;
  /** The scale's ends. */
  scale: [min: number, max: number];
  /** The limit, said: "max 97%", "min 620", "need 2 mo". */
  limitLabel: string;
  /** Its signal's tone. */
  tone?: Tone;
  /** What it is read on: "on $485,000", "housing 28.1%". */
  note?: string;
  /** One of the numbers an underwriter reads first, which the header shows. */
  headline: boolean;
}

const WAITING = "…";

/** Each ratio of `theCase`, in reading order; what hasn't loaded reads "…". */
export function ratiosOf(
  { app, borrower }: Case,
  qualifying: Qualifying | undefined,
  tones: Partial<Record<SignalId, Tone>>,
): Ratio[] {
  const { dti, minScore, reserves } = guidelines(app.program);
  const cap = maxLtv(app);
  const secondLien = isSecondLien(app);
  const score = borrower?.credit_score;
  const months = qualifying?.reserveMonths;
  return [
    {
      id: "ltv",
      label: secondLien ? "CLTV" : "LTV",
      short: secondLien ? "CLTV" : "LTV",
      value: qualifying ? pct(qualifying.limitedLtv) : WAITING,
      at: qualifying?.limitedLtv,
      limit: cap,
      scale: [0, 1.1],
      limitLabel: `max ${pct(cap)}`,
      tone: tones.ltv,
      note: secondLien ? "with the first mortgage" : qualifying && `on ${usd(qualifying.basis)}`,
      headline: true,
    },
    {
      id: "dti",
      label: "DTI",
      short: "DTI",
      value: qualifying ? pct(qualifying.backDti) : WAITING,
      at: qualifying?.backDti,
      limit: dti.max,
      scale: [0, 0.7],
      limitLabel: `max ${pct(dti.max, 0)}`,
      tone: tones.dti,
      note: qualifying && `housing ${pct(qualifying.frontDti)}`,
      headline: true,
    },
    {
      id: "score",
      label: "Credit score",
      short: "Score",
      value: score === undefined ? WAITING : String(score),
      at: score,
      limit: minScore,
      scale: SCORE_SCALE,
      limitLabel: `min ${minScore}`,
      tone: tones.score,
      note: score === undefined ? undefined : scoreBand(score).toLowerCase(),
      headline: true,
    },
    {
      id: "reserves",
      label: "Reserves",
      short: "Reserves",
      value: months === undefined ? WAITING : months < 0 ? "Short" : `${months.toFixed(1)} mo`,
      at: months,
      limit: reserves,
      scale: [0, 12],
      limitLabel: reserves ? `need ${reserves} mo` : "none required",
      tone: tones.reserves,
      note: qualifying && `after ${usd(qualifying.cashToClose)} to close`,
      headline: false,
    },
  ];
}
