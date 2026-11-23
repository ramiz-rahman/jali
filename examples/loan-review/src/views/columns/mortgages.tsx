/**
 * The columns a table of mortgages is made of, so every table of them (a borrower's, a book, a property's liens,
 * Overview's) reads the same. A view picks the ones it needs, and spreads over one to change it
 * (`{ ...cols.loan, pri: 2 }`). What a dropped column says is its `brief` (parts/layout.tsx: `Table`).
 */
import type { ReactNode } from "react";
import type { Mortgage, Payment } from "../../model/rows";
import { isOpen } from "../../model/statuses";
import { lienLine, rate, usd } from "../../model/words";
import { recordRef } from "../../nav/refs";
import type { Col } from "../parts/layout";
import { RefLink } from "../parts/links";
import { Dash, Payments, StatusMark } from "../parts/marks";

const link = (m: Mortgage, children: ReactNode, className?: string) => (
  <RefLink to={recordRef("mortgages", m.id)} name={`mortgage ${m.id}`} className={className}>
    {children}
  </RefLink>
);

export const mortgageCols = {
  /** The lien and when it began, as the link to the mortgage. */
  loan: {
    key: "loan",
    head: "Loan",
    pri: 1,
    cell: (m) => link(m, lienLine(m), "rv-link rv-cycle"),
    brief: lienLine,
  },
  /** The lien and when it began, as text: where the view is already about this loan. */
  loanText: { key: "loan", head: "Loan", pri: 1, cell: lienLine, brief: lienLine },
  /** The borrower's name, as the link to the mortgage. */
  borrower: (name: (id: number) => string): Col<Mortgage> => ({
    key: "who",
    head: "Borrower",
    pri: 1,
    cell: (m) => link(m, name(m.borrower_id)),
  }),
  program: {
    key: "program",
    head: "Program",
    pri: 2,
    cell: (m) => m.program,
    brief: (m) => m.program,
  },
  rate: {
    key: "rate",
    head: "Rate",
    pri: 2,
    num: true,
    cell: (m) => rate(m.note_rate),
    brief: (m) => rate(m.note_rate),
  },
  original: {
    key: "original",
    head: "Original",
    pri: 3,
    num: true,
    cell: (m) => usd(m.original_amount_cents),
    brief: (m) => `${usd(m.original_amount_cents)} original`,
  },
  /** What is owed, for an open loan. */
  balance: {
    key: "balance",
    head: "Balance",
    pri: 1,
    num: true,
    cell: (m) => (isOpen(m) ? usd(m.balance_cents) : <Dash />),
  },
  status: { key: "status", head: "Status", pri: 1, cell: (m) => <StatusMark status={m.status} /> },
  /** The last twelve payments as dots. */
  payments: (byMortgage: Map<number, Payment[]>): Col<Mortgage> => ({
    key: "paid",
    head: "Last 12 months",
    pri: 2,
    cell: (m) => <Payments rows={byMortgage.get(m.id)} />,
  }),
} satisfies Record<string, Col<Mortgage> | ((...args: never[]) => Col<Mortgage>)>;
