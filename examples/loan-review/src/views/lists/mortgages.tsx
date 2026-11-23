/**
 * Mortgages as a list: a borrower's (what they borrowed and how they have paid, newest first), or a book of them, an
 * officer's or a property's (whose loans, and which are delinquent). Both lead with the book's totals.
 */
import { WarningIcon } from "@phosphor-icons/react";
import { Empty } from "@jali-examples/shared/panes/shared/states";
import { useBorrowerName, usePayments } from "../../data";
import type { Mortgage } from "../../model/rows";
import { isDelinquent } from "../../model/statuses";
import { bookOf, type Paid } from "../../model/underwriting";
import { monthYear, offTime, onTime, plural, usd } from "../../model/words";
import { mortgageCols as cols } from "../columns/mortgages";
import { BookTotals, Delinquent, Stat } from "../parts/figures";
import { Table, View, ViewHead } from "../parts/layout";
import type { ListProps } from ".";

export function BorrowerMortgages({ rows: loans, label }: ListProps<"mortgages">) {
  const { byMortgage, paid } = usePayments(loans);
  if (!loans.length) return <NoLoans label={label} />;
  const behind = loans.find(isDelinquent);
  return (
    <View label={label}>
      <ViewHead
        kicker="Mortgages with us"
        title={`${plural(loans.length, "mortgage")} since ${monthYear(loans.at(-1)!.originated_on)}`}
      />
      <dl className="rv-stats rv-stats-strip">
        <BookTotals book={bookOf(loans)} />
        <LastYear paid={paid} />
      </dl>
      {behind ? <DelinquentNote loan={behind} paid={paid} /> : null}
      <Table
        label={label || "Mortgages"}
        rows={loans}
        cols={[
          cols.loan,
          cols.program,
          cols.rate,
          cols.original,
          cols.balance,
          cols.status,
          { ...cols.payments(byMortgage), pri: 3 },
        ]}
      />
    </View>
  );
}

export function BookMortgages({ rows: loans, label }: ListProps<"mortgages">) {
  const name = useBorrowerName();
  if (!loans.length) return <NoLoans label={label} />;
  const b = bookOf(loans);
  return (
    <View label={label}>
      <ViewHead kicker="Mortgages" title={label} />
      <dl className="rv-stats rv-stats-strip">
        <BookTotals book={b} />
        <Delinquent book={b} />
      </dl>
      <Table
        label={label || "Mortgages"}
        rows={loans}
        cols={[
          cols.borrower(name),
          { ...cols.loan, pri: 2 },
          cols.program,
          cols.rate,
          cols.original,
          cols.balance,
          cols.status,
        ]}
      />
    </View>
  );
}

const NoLoans = ({ label }: { label: string }) => (
  <View label={label}>
    <Empty
      title="No mortgages with us"
      hint="A new customer: there is no payment history to read."
    />
  </View>
);

/** How the last twelve months' payments went; what wasn't on time in the warning colour. */
function LastYear({ paid }: { paid: Paid | undefined }) {
  const off = paid && paid.total !== paid.onTime;
  return (
    <Stat
      label="Last 12 months"
      value={paid ? (paid.total ? onTime(paid) : "No payments due") : "…"}
      note={off ? offTime(paid) : undefined}
      warn={off}
    />
  );
}

/** The delinquent loan, said in a sentence. */
const DelinquentNote = ({ loan, paid }: { loan: Mortgage; paid: Paid | undefined }) => (
  <p className="rv-alert" role="note">
    <WarningIcon size={14} aria-hidden />
    The {loan.program} loan from {monthYear(loan.originated_on)} is delinquent:{" "}
    {usd(loan.balance_cents)} owed
    {paid?.missed ? `, ${plural(paid.missed, "payment")} missed` : ""}.
  </p>
);
