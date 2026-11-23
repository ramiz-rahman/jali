/** A mortgage: its terms, balance and every payment of the last year, with its borrower, home and officer. */
import { usePayments } from "../../data";
import { isLine } from "../../model/programs";
import type { Mortgage } from "../../model/rows";
import { day, lienWord, loanTerm, rate, rateKind, usd } from "../../model/words";
import {
  Columns,
  Facts,
  Pending,
  Section,
  Table,
  View,
  ViewHead,
  type Fact,
} from "../parts/layout";
import { paymentCols as cols } from "../columns/payments";
import { RecordLink, RelatedList } from "../parts/links";
import { Payments } from "../parts/marks";

export function MortgageView({ row: m }: { row: Mortgage }) {
  const rows = usePayments([m]).byMortgage.get(m.id);
  const line = isLine(m);
  return (
    <View label="Mortgage">
      <ViewHead
        kicker={
          <>
            Mortgage <span className="rv-num">#{m.id}</span> · {lienWord(m)} lien
          </>
        }
        title={`${usd(m.original_amount_cents)} ${m.program}${line ? "" : ` at ${rate(m.note_rate)}`}`}
        status={m.status}
      />
      <Columns
        main={
          <>
            <Section title="Loan">
              <Facts rows={loan(m)} />
            </Section>
            <Section title="Payments" aside={rows ? <Payments rows={rows} /> : undefined}>
              {rows ? (
                rows.length ? (
                  <Table
                    label="Payments"
                    rows={[...rows].reverse()}
                    cols={[cols.due, cols.amount, cols.status, cols.paid]}
                  />
                ) : (
                  <p className="rv-muted">Closed: no payments due.</p>
                )
              ) : (
                <Pending />
              )}
            </Section>
          </>
        }
        side={
          <Section title="Parties">
            <RelatedList>
              <RecordLink table="borrowers" id={m.borrower_id} avatar note={() => "Borrower"} />
              <RecordLink
                table="properties"
                id={m.property_id}
                note={(p) => (p ? `${p.city}, ${p.state}` : "Property")}
              />
              <RecordLink
                table="loan_officers"
                id={m.loan_officer_id}
                note={() => "Loan officer"}
              />
            </RelatedList>
          </Section>
        }
      />
    </View>
  );
}

/** The loan: what was lent and is owed (drawn, for a line), its rate, term and payment, and when it began and ended. */
function loan(m: Mortgage): Fact[] {
  const line = isLine(m);
  return [
    [line ? "Line" : "Original amount", usd(m.original_amount_cents)],
    [line ? "Drawn" : "Balance", m.balance_cents ? usd(m.balance_cents) : "Nothing"],
    ["Rate", rate(m.note_rate), rateKind(m)],
    ["Term", loanTerm(m, true)],
    [
      "Payment",
      `${usd(m.monthly_payment_cents)} a month`,
      line ? "interest only" : "principal and interest",
    ],
    ["Originated", day(m.originated_on)],
    ...(m.closed_on ? ([["Closed", day(m.closed_on)]] satisfies Fact[]) : []),
  ];
}
