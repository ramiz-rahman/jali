/** A sample case for the model's tests: a first-time buyer's conventional purchase in Austin, and a first mortgage. */
import type { Application, Borrower, Mortgage, Payment, Property } from "./rows";
import type { PaymentStatus } from "./statuses";
import { monthlyPayment } from "./underwriting";

export const purchase: Application = {
  id: 1,
  borrower_id: 1,
  property_id: 1,
  loan_officer_id: 1,
  program: "Conventional",
  purpose: "Purchase",
  occupancy: "Primary residence",
  rate_type: { kind: "fixed" },
  amount_cents: 436_500_00,
  purchase_price_cents: 485_000_00,
  note_rate: 7.125,
  term_months: 360,
  submitted_at: "2026-11-02T09:00:00Z",
  status: "pending",
};
export const borrower: Borrower = {
  id: 1,
  name: "Emily Carter",
  co_borrower: "James Carter",
  employer: "Dell Technologies",
  job_title: "Product manager",
  years_employed: 6,
  annual_income_cents: 142_000_00,
  credit_score: 742,
  monthly_debts_cents: 650_00,
  liquid_assets_cents: 78_000_00,
  first_time_buyer: true,
  veteran: false,
  customer_since: "2026-10-04",
  loan_officer_id: 1,
};
export const home: Property = {
  id: 1,
  address: "4417 Oak Hollow Dr",
  city: "Austin",
  state: "TX",
  zip: "78704",
  property_type: "Single-family",
  year_built: 2004,
  value_cents: 490_000_00,
  annual_tax_cents: 9_310_00,
  annual_insurance_cents: 3_510_00,
  monthly_hoa_cents: 0,
  flood_zone: "X",
};
export const first = (over: Partial<Mortgage> = {}): Mortgage => ({
  id: 7,
  borrower_id: 1,
  property_id: 1,
  loan_officer_id: 1,
  program: "Conventional",
  lien_position: 1,
  rate_type: { kind: "fixed" },
  original_amount_cents: 560_000_00,
  note_rate: 2.875,
  term_months: 360,
  originated_on: "2021-04-02",
  balance_cents: 470_000_00,
  monthly_payment_cents: monthlyPayment(560_000_00, 2.875, 360),
  status: "current",
  closed_on: null,
  ...over,
});
export const paid = (...statuses: PaymentStatus[]): Payment[] =>
  statuses.map((status, i) => ({
    id: i + 1,
    mortgage_id: 7,
    due_on: "2026-01-01",
    paid_on: null,
    amount_cents: 0,
    status,
  }));
