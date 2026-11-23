/**
 * The columns a table of applications is made of: a borrower's list, anyone else's, and an officer's pipeline all
 * read the same. A view picks the ones it needs, and spreads over one to change it (`{ ...cols.purpose, pri: 3 }`).
 * What a dropped column says is its `brief` (parts/layout.tsx: `Table`).
 */
import type { ReactNode } from "react";
import type { Application } from "../../model/rows";
import { day, product, usd, usdShort } from "../../model/words";
import { recordRef } from "../../nav/refs";
import type { Col } from "../parts/layout";
import { RefLink } from "../parts/links";
import { InReviewTag, StatusMark } from "../parts/marks";

export const applicationCols = {
  /** The application, named by `name` (its number, or its borrower), as the link to it; tagged when in review. */
  app: (head: string, name: (a: Application) => ReactNode): Col<Application> => ({
    key: "app",
    head,
    pri: 1,
    cell: (a) => (
      <>
        <RefLink to={recordRef("loan_applications", a.id)} name={`application ${a.id}`}>
          {name(a)}
        </RefLink>
        <InReviewTag id={a.id} />
      </>
    ),
  }),
  product: { key: "product", head: "Product", pri: 2, cell: product, brief: product },
  program: {
    key: "program",
    head: "Program",
    pri: 2,
    cell: (a) => a.program,
    brief: (a) => a.program,
  },
  purpose: {
    key: "purpose",
    head: "Purpose",
    pri: 2,
    cell: (a) => a.purpose,
    brief: (a) => a.purpose,
  },
  amount: { key: "amount", head: "Amount", pri: 1, num: true, cell: (a) => usd(a.amount_cents) },
  /** The amount in short, for a narrow table. */
  amountShort: {
    key: "amount",
    head: "Amount",
    pri: 1,
    num: true,
    cell: (a) => usdShort(a.amount_cents),
  },
  submitted: {
    key: "submitted",
    head: "Submitted",
    pri: 2,
    cell: (a) => day(a.submitted_at),
    brief: (a) => day(a.submitted_at),
  },
  status: { key: "status", head: "Status", pri: 1, cell: (a) => <StatusMark status={a.status} /> },
} satisfies Record<string, Col<Application> | ((...args: never[]) => Col<Application>)>;
