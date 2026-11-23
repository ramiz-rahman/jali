/**
 * What each loan program means to the review, in one table: its guidelines (score, LTV, DTI, reserves), the fee a
 * purchase finances into it, its mortgage insurance and closing costs, where it sits against the conforming limit,
 * and what kind of loan it is. Call sites read these rules, never a program's name. Adding a program is one entry
 * here. Pure.
 *
 * The guidelines are the agencies' usual ones, simplified for a sample: Fannie Mae and Freddie Mac for conventional
 * loans, HUD for FHA, the VA and USDA for theirs, and a typical lender's for jumbo loans and second liens. They are
 * a reviewer's prompts, not an underwriting engine.
 */
import type { Application, Occupancy, Program, Purpose } from "./rows";

/** Which of a program's LTV limits a purpose falls under. */
type LtvLimit = "purchase" | "refinance" | "cashOut";

/** Mortgage insurance a year, as a share of the loan. */
export type Insurance =
  /** Conventional PMI: priced by LTV and score (underwriting.ts), until the loan pays down to `untilLtv`. */
  | { kind: "pmi"; untilLtv: number; label: string }
  /** A flat premium (FHA, USDA), for the life of the loan when it starts above `lifeAboveLtv`. */
  | { kind: "premium"; rate: number; label: string; lifeAboveLtv?: number };

/** Where a program sits against the conforming limit: conventional loans stay within it, jumbo loans go above. */
export type Conforming = "within" | "above";

export interface ProgramRules {
  /** The lowest credit score the program takes. */
  minScore: number;
  /** The highest loan-to-value (combined, for a second lien) by purpose. */
  maxLtv: Record<LtvLimit, number>;
  /** Where DTI starts to need compensating factors, and the most an automated approval allows. */
  dti: { soft: number; max: number };
  /** Months of the new housing payment the borrower should hold in reserve after closing. */
  reserves: number;
  /** The upfront fee a purchase finances into the loan, as a share of it. The LTV limit applies before it. */
  financedFee?: { rate: number; label: string };
  /** Mortgage insurance. None for the rest. */
  insurance?: Insurance;
  /** Closing costs, as a share of the loan. */
  closingCostRate: number;
  /** The conforming limit's policy, for the programs it decides. */
  conforming?: Conforming;
  /** What a reviewer calls the product before its term, when not the program's name. */
  productName?: string;
  /** A second lien: it stays behind the first mortgage, and qualifies on combined LTV. */
  secondLien: boolean;
  /**
   * A line of credit: drawn rather than borrowed, interest only for `drawYears`, then repaid over `repayYears`,
   * qualified on the full line.
   */
  draw?: { drawYears: number; repayYears: number };
}

/** PMI comes off once the loan pays down to this LTV. */
const PMI_UNTIL_LTV = 0.8;

const SECOND_LIEN = {
  minScore: 680,
  maxLtv: { purchase: 0.85, refinance: 0.85, cashOut: 0.85 },
  dti: { soft: 0.4, max: 0.45 },
  reserves: 0,
  closingCostRate: 0.01,
  secondLien: true,
} as const;

const RULES: Record<Program, ProgramRules> = {
  Conventional: {
    minScore: 620,
    maxLtv: { purchase: 0.97, refinance: 0.97, cashOut: 0.8 },
    dti: { soft: 0.45, max: 0.5 },
    reserves: 2,
    insurance: {
      kind: "pmi",
      untilLtv: PMI_UNTIL_LTV,
      label: `PMI until ${PMI_UNTIL_LTV * 100}% LTV`,
    },
    closingCostRate: 0.03,
    conforming: "within",
    secondLien: false,
  },
  FHA: {
    minScore: 580,
    maxLtv: { purchase: 0.965, refinance: 0.9775, cashOut: 0.8 },
    dti: { soft: 0.43, max: 0.57 },
    reserves: 1,
    financedFee: { rate: 0.0175, label: "upfront MIP" },
    insurance: {
      kind: "premium",
      rate: 0.0055,
      label: "FHA mortgage insurance",
      lifeAboveLtv: 0.9,
    },
    closingCostRate: 0.03,
    secondLien: false,
  },
  VA: {
    minScore: 620,
    maxLtv: { purchase: 1.0, refinance: 1.0, cashOut: 0.9 },
    dti: { soft: 0.41, max: 0.6 },
    reserves: 0,
    // First use, no down payment.
    financedFee: { rate: 0.0215, label: "funding fee" },
    closingCostRate: 0.03,
    secondLien: false,
  },
  USDA: {
    minScore: 640,
    maxLtv: { purchase: 1.0, refinance: 1.0, cashOut: 0 },
    dti: { soft: 0.41, max: 0.44 },
    reserves: 0,
    financedFee: { rate: 0.01, label: "guarantee fee" },
    insurance: { kind: "premium", rate: 0.0035, label: "USDA mortgage insurance" },
    closingCostRate: 0.03,
    secondLien: false,
  },
  Jumbo: {
    minScore: 700,
    maxLtv: { purchase: 0.8, refinance: 0.8, cashOut: 0.7 },
    dti: { soft: 0.38, max: 0.43 },
    reserves: 6,
    closingCostRate: 0.03,
    conforming: "above",
    secondLien: false,
  },
  HELOC: { ...SECOND_LIEN, draw: { drawYears: 10, repayYears: 20 } },
  "Home equity": { ...SECOND_LIEN, productName: "Home equity loan" },
};

/** A program's guidelines. */
export const guidelines = (program: Program): ProgramRules => RULES[program];

/** A second lien: a HELOC or a home equity loan, behind the first mortgage. */
export const isSecondLien = (x: { program: Program }) => RULES[x.program].secondLien;
/** A line of credit (a HELOC). */
export const isLine = (x: { program: Program }) => RULES[x.program].draw !== undefined;

const LTV_LIMIT: Record<Purpose, LtvLimit> = {
  Purchase: "purchase",
  "Rate-and-term refinance": "refinance",
  "Cash-out refinance": "cashOut",
  "Home equity line": "refinance",
  "Home equity loan": "refinance",
};
export const isPurchase = (app: Pick<Application, "purpose">) => app.purpose === "Purchase";
export const isRefinance = (app: Pick<Application, "purpose">) =>
  app.purpose === "Rate-and-term refinance" || app.purpose === "Cash-out refinance";

/** The most a home that isn't the borrower's own can borrow against (Fannie Mae's eligibility matrix, simplified). */
const OCCUPANCY_CAP: Record<Occupancy, number> = {
  "Primary residence": 1,
  "Second home": 0.9,
  Investment: 0.85,
};

/** The most the program lends against the home for this purpose and occupancy. */
export const maxLtv = (app: Application) =>
  Math.min(RULES[app.program].maxLtv[LTV_LIMIT[app.purpose]], OCCUPANCY_CAP[app.occupancy]);
