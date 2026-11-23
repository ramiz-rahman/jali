/**
 * An application assessed, once: how it qualifies, what to notice (the signals), the tone of each, the ratios it
 * qualifies on, and the borrower's mortgages and payments summed up. The header, Overview and the Application view
 * all read this, so the tone of a figure and the signal that explains it come from one place. Pure.
 */
import type { Case } from "./case";
import { ratiosOf, type Ratio } from "./ratios";
import { signalsOf, type Signal, type SignalId, type Tone } from "./signals";
import { bookOf, paidOf, qualify, type Book, type Paid, type Qualifying } from "./underwriting";

export interface Assessment {
  /** How it qualifies, once the borrower, the home and the borrower's mortgages have loaded. */
  qualifying?: Qualifying;
  /** What to notice, most severe first. */
  signals: Signal[];
  /** Each signal's tone, by id: what a figure for the same number is marked with. */
  tones: Partial<Record<SignalId, Tone>>;
  /** How many signals fail a guideline, and how many need a look. */
  tally: { risk: number; warn: number };
  /** LTV, DTI, credit score and reserves, each against its limit and toned as its signal. */
  ratios: Ratio[];
  /** The borrower's mortgages with us, summed up. */
  book?: Book;
  /** Their payments, summed up. */
  paid?: Paid;
}

/** Assesses a case: what has loaded of it is assessed, and what needs the rest waits for it. */
export function assess(theCase: Case): Assessment {
  const { app, borrower, property, mortgages, payments } = theCase;
  const qualifying =
    borrower && property && mortgages ? qualify(app, borrower, property, mortgages) : undefined;
  const signals = signalsOf(theCase, qualifying);
  const tones = Object.fromEntries(signals.map((s) => [s.id, s.tone]));
  return {
    qualifying,
    signals,
    tones,
    tally: {
      risk: signals.filter((s) => s.tone === "risk").length,
      warn: signals.filter((s) => s.tone === "warn").length,
    },
    ratios: ratiosOf(theCase, qualifying, tones),
    book: mortgages && bookOf(mortgages),
    paid: payments && paidOf(payments),
  };
}
