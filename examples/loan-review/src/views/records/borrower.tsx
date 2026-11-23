/** A borrower: who they are, their income, debts and assets, their record with us, and their files. */
import { useBookRows, useCount, useMortgagesOf, usePayments } from "../../data";
import type { Borrower, Payment } from "../../model/rows";
import { scoreBand } from "../../model/scores";
import { bookOf, type Book, type Paid } from "../../model/underwriting";
import { day, household, onTime, pct, usd } from "../../model/words";
import { applicationsBy, mortgagesOf } from "../../nav/refs";
import { Columns, Facts, Section, View, ViewHead, type Fact } from "../parts/layout";
import { CountLink, RecordLink, RelatedList } from "../parts/links";
import { Payments } from "../parts/marks";

export function BorrowerView({ row: b }: { row: Borrower }) {
  const mortgages = useMortgagesOf(b.id);
  const apps = useCount("loan_applications", { borrower_id: b.id });
  const payments = usePayments(mortgages);
  const book = mortgages && bookOf(mortgages);
  // The home their latest application is for: the one in review, usually.
  const latest = useBookRows("loan_applications", {
    where: { borrower_id: b.id },
    orderBy: "submitted_at DESC",
    limit: 1,
  })?.[0];
  return (
    <View label="Borrower">
      <ViewHead
        kicker={
          <>
            Borrower <span className="rv-num">#{b.id}</span>
            {b.veteran ? " · Veteran" : ""}
            {b.first_time_buyer ? " · First-time buyer" : ""}
          </>
        }
        title={household(b.name, b.co_borrower)}
      >
        {b.job_title}, {b.employer}
      </ViewHead>
      <Columns
        main={
          <>
            <Section title="Income and employment">
              <Facts rows={employment(b)} />
            </Section>
            <Section title="Credit, debts and assets">
              <Facts rows={credit(b)} />
            </Section>
            <Section title="Record with us">
              <Facts rows={record(b, book, payments)} />
            </Section>
          </>
        }
        side={
          <>
            <Section title="Property and officer">
              <RelatedList>
                {latest ? (
                  <RecordLink
                    table="properties"
                    id={latest.property_id}
                    note={(p) => p && `${latest.purpose} · ${p.city}, ${p.state}`}
                  />
                ) : null}
                <RecordLink
                  table="loan_officers"
                  id={b.loan_officer_id}
                  avatar
                  note={(o) => o && `${o.branch} · NMLS #${o.nmls_id}`}
                />
              </RelatedList>
            </Section>
            <Section title="Also on file">
              <RelatedList>
                <CountLink
                  to={mortgagesOf(b.id)}
                  count={mortgages?.length}
                  noun="mortgage"
                  note={book?.open ? `${usd(book.balance)} owed` : undefined}
                />
                <CountLink to={applicationsBy(b.id, b.name)} count={apps} noun="application" />
              </RelatedList>
            </Section>
          </>
        }
      />
    </View>
  );
}

const monthlyIncome = (b: Borrower) => b.annual_income_cents / 12;

/** Where they work and what they earn. */
const employment = (b: Borrower): Fact[] => [
  ["Employer", b.employer],
  ["Position", b.job_title, b.years_employed ? `${b.years_employed} years` : undefined],
  ["Gross income", `${usd(b.annual_income_cents)} a year`, `${usd(monthlyIncome(b))} a month`],
  ...(b.co_borrower ? ([["Co-borrower", b.co_borrower]] satisfies Fact[]) : []),
];

/** Their score, their debts against their income, and what they hold. */
const credit = (b: Borrower): Fact[] => [
  ["Credit score", String(b.credit_score), scoreBand(b.credit_score)],
  [
    "Monthly debts",
    usd(b.monthly_debts_cents),
    `${pct(b.monthly_debts_cents / monthlyIncome(b), 0)} of income, before housing`,
  ],
  ["Liquid assets", usd(b.liquid_assets_cents), "checking, savings, brokerage"],
];

/** Their record with us: how long, what they borrowed and owe, how they have paid. "…" while it loads. */
const record = (
  b: Borrower,
  book: Book | undefined,
  payments: { all?: Payment[]; paid?: Paid },
): Fact[] => [
  ["Customer since", day(b.customer_since)],
  ["Mortgages", book ? (book.loans ? `${book.loans} · ${book.open} open` : "None yet") : "…"],
  [
    "Owed now",
    book ? (book.balance ? usd(book.balance) : "Nothing") : "…",
    book?.delinquent ? <span className="rv-warn">{book.delinquent} delinquent</span> : undefined,
  ],
  [
    "Payments",
    payments.paid?.total ? onTime(payments.paid) : book && !book.open ? "No open loans" : "…",
    payments.paid?.total ? <Payments rows={payments.all} /> : undefined,
  ],
];
