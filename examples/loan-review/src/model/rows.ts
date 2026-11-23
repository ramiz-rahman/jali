/**
 * The loan book's rows, typed. The data layer hands back untyped rows (`Row`); the review reads each one here, once,
 * so the views and the model work with numbers and strings named as the database names them.
 */
import type { Row } from "@jali-examples/shared/data/types";
import {
  APPLICATION_STATUSES,
  MORTGAGE_STATUSES,
  PAYMENT_STATUSES,
  type ApplicationStatus,
  type MortgageStatus,
  type PaymentStatus,
} from "./statuses";

export const PROGRAMS = [
  "Conventional",
  "FHA",
  "VA",
  "USDA",
  "Jumbo",
  "HELOC",
  "Home equity",
] as const;
export const PURPOSES = [
  "Purchase",
  "Rate-and-term refinance",
  "Cash-out refinance",
  "Home equity line",
  "Home equity loan",
] as const;
export const OCCUPANCIES = ["Primary residence", "Second home", "Investment"] as const;

/** The loan program: what its guidelines are (programs.ts). */
export type Program = (typeof PROGRAMS)[number];
/** What the loan is for. */
export type Purpose = (typeof PURPOSES)[number];
/** Whether the borrower lives in the home. */
export type Occupancy = (typeof OCCUPANCIES)[number];

/** How the rate moves: fixed for the term, variable (a HELOC), or an ARM, fixed for its first years. */
export type RateType =
  | { kind: "fixed" }
  | { kind: "variable" }
  | { kind: "arm"; fixedYears: number; adjustsMonths: number };

export interface Application {
  id: number;
  borrower_id: number;
  property_id: number;
  loan_officer_id: number;
  program: Program;
  purpose: Purpose;
  occupancy: Occupancy;
  /** Stored as "Fixed", "Variable" (a HELOC) or an ARM's "7/6 ARM". */
  rate_type: RateType;
  amount_cents: number;
  purchase_price_cents: number | null;
  /** The note rate, in percent: 7.125. */
  note_rate: number;
  term_months: number;
  submitted_at: string;
  status: ApplicationStatus;
}

export interface Borrower {
  id: number;
  name: string;
  co_borrower: string | null;
  employer: string;
  job_title: string;
  years_employed: number;
  annual_income_cents: number;
  credit_score: number;
  /** Monthly debts other than housing: cars, cards, student loans. */
  monthly_debts_cents: number;
  liquid_assets_cents: number;
  first_time_buyer: boolean;
  veteran: boolean;
  customer_since: string;
  loan_officer_id: number;
}

export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  property_type: string;
  year_built: number;
  value_cents: number;
  annual_tax_cents: number;
  annual_insurance_cents: number;
  monthly_hoa_cents: number;
  /** FEMA flood zone: X is minimal risk; A and V zones need flood insurance. */
  flood_zone: string;
}

export interface Officer {
  id: number;
  name: string;
  nmls_id: string;
  branch: string;
  phone: string;
  email: string;
}

export interface Mortgage {
  id: number;
  borrower_id: number;
  property_id: number;
  loan_officer_id: number;
  program: Program;
  /** 1 for a first mortgage, 2 for a second lien. */
  lien_position: number;
  rate_type: RateType;
  original_amount_cents: number;
  note_rate: number;
  term_months: number;
  originated_on: string;
  balance_cents: number;
  monthly_payment_cents: number;
  status: MortgageStatus;
  closed_on: string | null;
}

export interface Payment {
  id: number;
  mortgage_id: number;
  due_on: string;
  paid_on: string | null;
  amount_cents: number;
  status: PaymentStatus;
}

/** Each loan-book table's row type. */
export interface BookRows {
  loan_applications: Application;
  borrowers: Borrower;
  properties: Property;
  loan_officers: Officer;
  mortgages: Mortgage;
  payments: Payment;
}
export type BookTable = keyof BookRows;

const num = (v: Row[string] | undefined) => Number(v ?? 0);
const str = (v: Row[string] | undefined) => (v == null ? "" : String(v));
const opt = (v: Row[string] | undefined) => (v == null ? null : String(v));
const bool = (v: Row[string] | undefined) => Number(v) === 1;
/** One of `values`; the first for anything else (the sample has nothing else). */
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: Row[string] | undefined): T =>
    values.find((x) => x === v) ?? values[0]!;
const program = oneOf(PROGRAMS);
const purpose = oneOf(PURPOSES);
const occupancy = oneOf(OCCUPANCIES);
const applicationStatus = oneOf(APPLICATION_STATUSES);
const mortgageStatus = oneOf(MORTGAGE_STATUSES);
const paymentStatus = oneOf(PAYMENT_STATUSES);

/** "7/6 ARM" is fixed 7 years, then adjusts every 6 months; "Variable" is a line's; anything else is fixed. */
export function rateType(v: Row[string] | undefined): RateType {
  const arm = /^(\d+)\/(\d+) ARM$/.exec(str(v));
  if (arm) return { kind: "arm", fixedYears: Number(arm[1]), adjustsMonths: Number(arm[2]) };
  return { kind: v === "Variable" ? "variable" : "fixed" };
}

/** Reads a row of each table as its type. */
export const parse: { [T in BookTable]: (r: Row) => BookRows[T] } = {
  loan_applications: (r) => ({
    id: num(r.id),
    borrower_id: num(r.borrower_id),
    property_id: num(r.property_id),
    loan_officer_id: num(r.loan_officer_id),
    program: program(r.program),
    purpose: purpose(r.purpose),
    occupancy: occupancy(r.occupancy),
    rate_type: rateType(r.rate_type),
    amount_cents: num(r.amount_cents),
    purchase_price_cents: r.purchase_price_cents == null ? null : num(r.purchase_price_cents),
    note_rate: num(r.note_rate),
    term_months: num(r.term_months),
    submitted_at: str(r.submitted_at),
    status: applicationStatus(r.status),
  }),
  borrowers: (r) => ({
    id: num(r.id),
    name: str(r.name),
    co_borrower: opt(r.co_borrower),
    employer: str(r.employer),
    job_title: str(r.job_title),
    years_employed: num(r.years_employed),
    annual_income_cents: num(r.annual_income_cents),
    credit_score: num(r.credit_score),
    monthly_debts_cents: num(r.monthly_debts_cents),
    liquid_assets_cents: num(r.liquid_assets_cents),
    first_time_buyer: bool(r.first_time_buyer),
    veteran: bool(r.veteran),
    customer_since: str(r.customer_since),
    loan_officer_id: num(r.loan_officer_id),
  }),
  properties: (r) => ({
    id: num(r.id),
    address: str(r.address),
    city: str(r.city),
    state: str(r.state),
    zip: str(r.zip),
    property_type: str(r.property_type),
    year_built: num(r.year_built),
    value_cents: num(r.value_cents),
    annual_tax_cents: num(r.annual_tax_cents),
    annual_insurance_cents: num(r.annual_insurance_cents),
    monthly_hoa_cents: num(r.monthly_hoa_cents),
    flood_zone: str(r.flood_zone),
  }),
  loan_officers: (r) => ({
    id: num(r.id),
    name: str(r.name),
    nmls_id: str(r.nmls_id),
    branch: str(r.branch),
    phone: str(r.phone),
    email: str(r.email),
  }),
  mortgages: (r) => ({
    id: num(r.id),
    borrower_id: num(r.borrower_id),
    property_id: num(r.property_id),
    loan_officer_id: num(r.loan_officer_id),
    program: program(r.program),
    lien_position: num(r.lien_position),
    rate_type: rateType(r.rate_type),
    original_amount_cents: num(r.original_amount_cents),
    note_rate: num(r.note_rate),
    term_months: num(r.term_months),
    originated_on: str(r.originated_on),
    balance_cents: num(r.balance_cents),
    monthly_payment_cents: num(r.monthly_payment_cents),
    status: mortgageStatus(r.status),
    closed_on: opt(r.closed_on),
  }),
  payments: (r) => ({
    id: num(r.id),
    mortgage_id: num(r.mortgage_id),
    due_on: str(r.due_on),
    paid_on: opt(r.paid_on),
    amount_cents: num(r.amount_cents),
    status: paymentStatus(r.status),
  }),
};
