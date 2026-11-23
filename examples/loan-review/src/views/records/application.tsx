/** An application: its terms, how it qualifies, what the payment is made of, and who and what it is for. */
import { useAssessment, useCount } from "../../data";
import { guidelines } from "../../model/programs";
import type { Application } from "../../model/rows";
import {
  AS_OF_YEAR,
  CONFORMING_LIMIT_CENTS,
  downPayment,
  financedFee,
} from "../../model/underwriting";
import {
  amountLabel,
  loanTerm,
  owed,
  pct,
  product,
  rate,
  rateKind,
  usd,
  when,
} from "../../model/words";
import { applicationsBy, mortgagesOf } from "../../nav/refs";
import { PaymentBreakdown, Qualifiers } from "../parts/figures";
import { Columns, Facts, Pending, Section, View, ViewHead, type Fact } from "../parts/layout";
import { CountLink, RecordLink, RelatedList } from "../parts/links";

export function ApplicationView({ row: app }: { row: Application }) {
  const { borrower, mortgages, assessment } = useAssessment(app.id);
  const apps = useCount("loan_applications", { borrower_id: app.borrower_id });
  const qualifying = assessment?.qualifying;
  const book = assessment?.book;
  return (
    <View label="Application">
      <ViewHead
        kicker={
          <>
            Application <span className="rv-num">#{app.id}</span> · {app.purpose}
          </>
        }
        title={`${usd(app.amount_cents)} ${product(app)}`}
        status={app.status}
      />
      <Columns
        main={
          <>
            <Section title="Terms">
              <Facts rows={terms(app)} />
            </Section>
            <Section title="Qualifying">
              {assessment?.qualifying && borrower ? (
                <Qualifiers ratios={assessment.ratios} />
              ) : (
                <Pending />
              )}
            </Section>
            <Section title="Monthly payment">
              {qualifying ? <PaymentBreakdown housing={qualifying.housing} /> : <Pending />}
            </Section>
          </>
        }
        side={
          <>
            <Section title="Parties">
              <RelatedList>
                <RecordLink
                  table="borrowers"
                  id={app.borrower_id}
                  avatar
                  note={(b) => (b ? `Borrower · ${b.job_title}` : "Borrower")}
                />
                <RecordLink
                  table="properties"
                  id={app.property_id}
                  note={(p) => (p ? `${p.city}, ${p.state} · ${p.property_type}` : "Property")}
                />
                <RecordLink
                  table="loan_officers"
                  id={app.loan_officer_id}
                  note={(o) => (o ? `Loan officer · NMLS #${o.nmls_id}` : "Loan officer")}
                />
              </RelatedList>
            </Section>
            <Section title="Also on file">
              <RelatedList>
                <CountLink
                  to={mortgagesOf(app.borrower_id)}
                  count={mortgages?.length}
                  noun="mortgage"
                  note={book?.loans ? (book.open ? owed(book) : "all paid off") : undefined}
                />
                <CountLink
                  to={applicationsBy(app.borrower_id, borrower?.name)}
                  count={apps === undefined ? undefined : apps - 1}
                  noun="other application"
                />
              </RelatedList>
            </Section>
          </>
        }
      />
    </View>
  );
}

/** The loan's terms: amount (and the fee financed into it), price and down payment, rate, term, limit. */
function terms(app: Application): Fact[] {
  const fee = financedFee(app);
  const price = app.purchase_price_cents;
  const down = downPayment(app);
  return [
    [
      amountLabel(app),
      usd(app.amount_cents),
      fee > 0
        ? `includes ${usd(fee)} financed ${guidelines(app.program).financedFee?.label}`
        : undefined,
    ],
    ...(price
      ? ([
          ["Purchase price", usd(price)],
          ["Down payment", usd(down), pct(down / price)],
        ] satisfies Fact[])
      : []),
    ["Note rate", rate(app.note_rate), rateKind(app)],
    ["Term", loanTerm(app)],
    ["Occupancy", app.occupancy],
    [
      "Loan limit",
      app.amount_cents > CONFORMING_LIMIT_CENTS ? "Jumbo" : "Conforming",
      `${AS_OF_YEAR} limit ${usd(CONFORMING_LIMIT_CENTS)}`,
    ],
    ["Submitted", when(app.submitted_at)],
  ];
}
