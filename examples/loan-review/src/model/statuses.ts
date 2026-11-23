/**
 * Where an application, a mortgage or a payment stands, one table per kind of row: what a reader calls each status,
 * and what it means to the review. The rows' `status` is one of these (rows.ts). Pure.
 */

/** What every status says: its words, and whether it is marked with a warning sign. */
export interface StatusWords {
  label: string;
  warn?: boolean;
}

/** An application's decision, in the order the queue lists them: what waits for one first, what is cleared last. */
export const APPLICATION_STATUS = {
  pending: { label: "In review", waiting: true },
  conditions: { label: "Approved with conditions", waiting: false },
  suspended: { label: "Suspended", waiting: false },
  approved: { label: "Clear to close", waiting: false },
} as const satisfies Record<string, StatusWords & { waiting: boolean }>;

/** A mortgage's standing: open while it is still being paid. */
export const MORTGAGE_STATUS = {
  current: { label: "Current", open: true },
  delinquent: { label: "Delinquent", open: true, warn: true },
  "paid off": { label: "Paid off", open: false },
  refinanced: { label: "Refinanced", open: false },
} as const satisfies Record<string, StatusWords & { open: boolean }>;

/** How a payment was made. */
export const PAYMENT_STATUS = {
  "on time": { label: "On time" },
  late: { label: "Late" },
  missed: { label: "Missed" },
} as const satisfies Record<string, StatusWords>;

export type ApplicationStatus = keyof typeof APPLICATION_STATUS;
export type MortgageStatus = keyof typeof MORTGAGE_STATUS;
export type PaymentStatus = keyof typeof PAYMENT_STATUS;
/** Any row's status. The three kinds share no value, so a status alone says which it is. */
export type Status = ApplicationStatus | MortgageStatus | PaymentStatus;

const STATUS: Record<Status, StatusWords> = {
  ...APPLICATION_STATUS,
  ...MORTGAGE_STATUS,
  ...PAYMENT_STATUS,
};
/** What a status says, whichever kind of row it is from. */
export const statusWords = (status: Status): StatusWords => STATUS[status];

/** Each kind's statuses, in its table's order. */
const keys = <T extends string>(table: Record<T, unknown>) => Object.keys(table) as T[];
export const APPLICATION_STATUSES = keys(APPLICATION_STATUS);
export const MORTGAGE_STATUSES = keys(MORTGAGE_STATUS);
export const PAYMENT_STATUSES = keys(PAYMENT_STATUS);

/** Where an application sits in the queue: its status's place in the table, then its number. */
export const queueOrder = (
  a: { status: ApplicationStatus; id: number },
  b: { status: ApplicationStatus; id: number },
) => APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status) || a.id - b.id;

/** An application that waits for a decision. */
export const isWaiting = (app: { status: ApplicationStatus }) =>
  APPLICATION_STATUS[app.status].waiting;
/** A mortgage still being paid. */
export const isOpen = (m: { status: MortgageStatus }) => MORTGAGE_STATUS[m.status].open;
/** A mortgage behind on its payments. */
export const isDelinquent = (m: { status: MortgageStatus }) => m.status === "delinquent";
