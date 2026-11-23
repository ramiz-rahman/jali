/** The columns of a table of borrowers: an officer's clients, with their job, income and score. */
import type { Borrower } from "../../model/rows";
import { usdShort } from "../../model/words";
import { recordRef } from "../../nav/refs";
import type { Col } from "../parts/layout";
import { RefLink } from "../parts/links";

const employment = (b: Borrower) => `${b.job_title}, ${b.employer}`;

export const borrowerCols = {
  name: {
    key: "name",
    head: "Name",
    pri: 1,
    cell: (b) => (
      <RefLink to={recordRef("borrowers", b.id)} name={b.name}>
        {b.name}
      </RefLink>
    ),
  },
  job: { key: "job", head: "Employment", pri: 2, cell: employment, brief: employment },
  income: {
    key: "income",
    head: "Income",
    pri: 1,
    num: true,
    cell: (b) => usdShort(b.annual_income_cents),
  },
  score: { key: "score", head: "Score", pri: 1, num: true, cell: (b) => b.credit_score },
} satisfies Record<string, Col<Borrower>>;
