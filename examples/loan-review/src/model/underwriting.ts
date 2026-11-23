/**
 * The underwriting arithmetic: what an application costs a month, the ratios an underwriter qualifies it on (LTV,
 * CLTV, DTI, reserves), and a set of mortgages or payments summed up. Each program's rules are programs.ts. Pure.
 */
import { guidelines, isLine, isPurchase, isRefinance, isSecondLien } from "./programs";
import type { Application, Borrower, Mortgage, Payment, Property } from "./rows";
import { pmiRate } from "./scores";
import { isDelinquent, isOpen, type PaymentStatus } from "./statuses";

/** The year the sample's figures are for: rates, limits and fees as of November 2026. */
export const AS_OF_YEAR = 2026;

/** FHFA's 2026 baseline conforming loan limit for a one-unit home. Above it, a loan is jumbo. */
export const CONFORMING_LIMIT_CENTS = 832_750_00;

/** Ratios within this of a limit read as at it: an LTV of 80.04% is 80%. */
export const LIMIT_TOLERANCE = 0.0005;

/** A FEMA A or V zone: a special flood hazard area, where the lender requires flood insurance. */
export const inFloodZone = (p: Pick<Property, "flood_zone">) => /^[AV]/.test(p.flood_zone);

const sum = <T>(rows: T[], of: (row: T) => number) => rows.reduce((s, r) => s + of(r), 0);

/** The loan before the fee a purchase finances into it (programs.ts: `financedFee`). */
export const baseAmount = (app: Application) =>
  isPurchase(app)
    ? Math.round(app.amount_cents / (1 + (guidelines(app.program).financedFee?.rate ?? 0)))
    : app.amount_cents;

/** The fee financed into the loan, in cents: 0 for a program or purpose without one. */
export const financedFee = (app: Application) => app.amount_cents - baseAmount(app);

/**
 * A purchase's down payment, in cents; 0 for the rest. A financed fee (FHA's upfront premium, VA's funding fee)
 * lifts the loan above price less down, so it is floored at 0.
 */
export function downPayment(app: Application) {
  const price = app.purchase_price_cents;
  return price ? Math.max(0, price - baseAmount(app)) : 0;
}

/** A fully amortizing loan's monthly principal and interest, in cents. */
export function monthlyPayment(amountCents: number, ratePct: number, months: number) {
  const monthlyRate = ratePct / 100 / 12;
  if (monthlyRate === 0) return Math.round(amountCents / Math.max(1, months));
  return Math.round((amountCents * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

/** What the new loan costs a month. A line qualifies on interest on all of it, as its draw period charges. */
const newPayment = (app: Application) =>
  isLine(app)
    ? Math.round((app.amount_cents * app.note_rate) / 100 / 12)
    : monthlyPayment(app.amount_cents, app.note_rate, app.term_months);

/** Mortgage insurance a year, as a share of the loan: the program's premium, or conventional PMI while it applies. */
function insuranceRate(app: Application, ltv: number, score: number) {
  const insurance = guidelines(app.program).insurance;
  if (!insurance) return 0;
  if (insurance.kind === "premium") return insurance.rate;
  if (ltv <= insurance.untilLtv) return 0;
  const highLtv = ltv > 0.95 ? 0.0025 : ltv > 0.9 ? 0.0012 : 0;
  return pmiRate(score) + highLtv;
}

/** The new housing payment, line by line, in cents a month. */
export interface Housing {
  principalInterest: number;
  tax: number;
  insurance: number;
  mortgageInsurance: number;
  hoa: number;
  /** A second lien's first mortgage, which the borrower keeps paying. */
  firstLien: number;
  total: number;
}

/** Everything an underwriter qualifies the application on. */
export interface Qualifying {
  housing: Housing;
  /** Loan-to-value, before any financed fee: for a purchase, on the lower of price and appraisal. */
  ltv: number;
  /** Combined, with every lien left on the home. Equal to LTV for a first lien that pays the others off. */
  cltv: number;
  /** The ratio the program limits: CLTV for a second lien, LTV for the rest. */
  limitedLtv: number;
  /** The value the ratios use, in cents. */
  basis: number;
  /** Housing over gross monthly income. */
  frontDti: number;
  /** Housing and every other debt over gross monthly income. */
  backDti: number;
  /** Other debts a month, in cents: the borrower's, and mortgages on other homes. */
  otherDebts: number;
  /** Closing costs, in cents: the program's share of the loan (programs.ts: `closingCostRate`). */
  costs: number;
  /** What the borrower brings to closing, in cents: the down payment and closing costs, or a refinance's shortfall. */
  cashToClose: number;
  /** What a cash-out refinance hands the borrower, in cents, after the payoff and costs; 0 for the rest. */
  cashOut: number;
  /** Months of the housing payment left after closing. */
  reserveMonths: number;
  /** The liens this loan pays off (a refinance), and what they owe. */
  paysOff: Mortgage[];
  payoff: number;
  /** The liens it stays behind (a second lien), and what they owe. */
  staysBehind: Mortgage[];
  behind: number;
}

export function qualify(
  app: Application,
  borrower: Borrower,
  property: Property,
  mortgages: Mortgage[],
): Qualifying {
  const onHome = mortgages.filter((m) => isOpen(m) && m.property_id === property.id);
  const elsewhere = mortgages.filter((m) => isOpen(m) && m.property_id !== property.id);
  const secondLien = isSecondLien(app);
  // A refinance pays off every lien on the home; a second lien stays behind them; a purchase is a new home.
  const paysOff = isRefinance(app) ? onHome : [];
  const staysBehind = secondLien ? onHome : [];
  const basis =
    app.purchase_price_cents != null
      ? Math.min(app.purchase_price_cents, property.value_cents)
      : property.value_cents;
  const behind = sum(staysBehind, (m) => m.balance_cents);
  const payoff = sum(paysOff, (m) => m.balance_cents);
  const base = baseAmount(app);
  const ltv = base / Math.max(1, basis);
  const cltv = (base + behind) / Math.max(1, basis);

  const lines = {
    principalInterest: newPayment(app),
    tax: Math.round(property.annual_tax_cents / 12),
    insurance: Math.round(property.annual_insurance_cents / 12),
    mortgageInsurance: Math.round(
      (app.amount_cents * insuranceRate(app, ltv, borrower.credit_score)) / 12,
    ),
    hoa: property.monthly_hoa_cents,
    firstLien: sum(staysBehind, (m) => m.monthly_payment_cents),
  };
  const housing: Housing = { ...lines, total: sum(Object.values(lines), (v) => v) };

  const otherDebts = borrower.monthly_debts_cents + sum(elsewhere, (m) => m.monthly_payment_cents);
  const income = borrower.annual_income_cents / 12;
  const costs = Math.round(app.amount_cents * guidelines(app.program).closingCostRate);
  // A refinance pays its costs and the old liens from the new loan; only a shortfall is brought to closing.
  const cashToClose = isRefinance(app)
    ? Math.max(0, payoff + costs - app.amount_cents)
    : downPayment(app) + costs;
  return {
    housing,
    ltv,
    cltv,
    limitedLtv: secondLien ? cltv : ltv,
    basis,
    frontDti: housing.total / income,
    backDti: (housing.total + otherDebts) / income,
    otherDebts,
    costs,
    cashToClose,
    cashOut: app.purpose === "Cash-out refinance" ? app.amount_cents - payoff - costs : 0,
    reserveMonths: (borrower.liquid_assets_cents - cashToClose) / Math.max(1, housing.total),
    paysOff,
    payoff,
    staysBehind,
    behind,
  };
}

/** A set of mortgages summed up: how many are open, what is owed, what is behind. */
export interface Book {
  loans: number;
  open: number;
  delinquent: number;
  balance: number;
  delinquentBalance: number;
  monthly: number;
  originated: number;
  borrowers: number;
}

export function bookOf(mortgages: Mortgage[]): Book {
  const live = mortgages.filter(isOpen);
  const late = mortgages.filter(isDelinquent);
  return {
    loans: mortgages.length,
    open: live.length,
    delinquent: late.length,
    balance: sum(live, (m) => m.balance_cents),
    delinquentBalance: sum(late, (m) => m.balance_cents),
    monthly: sum(live, (m) => m.monthly_payment_cents),
    originated: sum(mortgages, (m) => m.original_amount_cents),
    borrowers: new Set(live.map((m) => m.borrower_id)).size,
  };
}

/** Payments summed up. */
export interface Paid {
  total: number;
  onTime: number;
  late: number;
  missed: number;
}

export function paidOf(payments: Payment[]): Paid {
  const count = (status: PaymentStatus) => payments.filter((p) => p.status === status).length;
  return {
    total: payments.length,
    onTime: count("on time"),
    late: count("late"),
    missed: count("missed"),
  };
}
