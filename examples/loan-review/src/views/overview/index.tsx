/**
 * Overview: the designed page. It answers "can we make this loan?" the way an underwriter reads a file: what to check
 * (credit, capacity, collateral and the loan itself), the ratios against the program's limits, what the new payment
 * is made of, the borrower's mortgages with us, and who and what stands behind the loan. Each card leads to its
 * view. What it reads is the application assessed (data.ts: `useAssessment`, as the header and the Application view
 * read it) and the officer's book beside it.
 */
import type { PaneProps } from "jali-layout/react";
import { Loading } from "@jali-examples/shared/panes/shared/states";
import { Paused, useAssessment, useOfficerBook } from "../../data";
import { inFloodZone } from "../../model/underwriting";
import {
  cityLine,
  historyLine,
  household,
  owed,
  product,
  rate,
  tenure,
  usd,
} from "../../model/words";
import { mortgageCols as cols } from "../columns/mortgages";
import { BookStats, PaymentBreakdown, Qualifiers } from "../parts/figures";
import { Facts, Table, View } from "../parts/layout";
import { OverviewCard as Card } from "./card";
import { Checks } from "./checks";

export function OverviewPane({ params, paused }: PaneProps<{ item: number }>) {
  return (
    <Paused value={paused}>
      <Overview item={params.item} />
    </Paused>
  );
}

function Overview({ item }: { item: number }) {
  const { app, borrower, property, officer, mortgages, byMortgage, assessment } =
    useAssessment(item);
  const officerBook = useOfficerBook(officer?.id);
  if (!app || !assessment)
    return (
      <View label="Overview">
        <Loading />
      </View>
    );
  const { qualifying, book, paid } = assessment;

  return (
    <View label="Overview">
      <div className="ov">
        <Checks signals={assessment.signals} tally={assessment.tally} />

        <Card title="Qualifying" view="application" area="qualify">
          {qualifying && borrower ? <Qualifiers ratios={assessment.ratios} /> : <Loading />}
        </Card>

        <Card
          title="Monthly payment"
          view="application"
          area="payment"
          lead={qualifying ? usd(qualifying.housing.total) : "…"}
          note={`${product(app)} at ${rate(app.note_rate)}`}
        >
          {qualifying ? <PaymentBreakdown housing={qualifying.housing} /> : null}
        </Card>

        <Card
          title="Mortgages with us"
          view="mortgages"
          area="history"
          warn={!!book?.delinquent}
          lead={book ? owed(book) : "…"}
          note={book && historyLine(book, paid)}
        >
          {mortgages?.length ? (
            <Table
              label="Mortgages, newest first"
              rows={mortgages}
              cols={[
                cols.loanText,
                cols.program,
                cols.rate,
                cols.balance,
                cols.status,
                cols.payments(byMortgage),
              ]}
            />
          ) : null}
        </Card>

        <Card
          title="Borrower"
          view="borrower"
          area="borrower"
          lead={borrower ? household(borrower.name, borrower.co_borrower) : "…"}
          note={borrower && `${borrower.job_title}, ${borrower.employer}`}
        >
          {borrower ? (
            <Facts
              cols={1}
              rows={[
                ["Income", `${usd(borrower.annual_income_cents)} a year`],
                ["Other debts", `${usd(borrower.monthly_debts_cents)} a month`],
                ["Assets", usd(borrower.liquid_assets_cents)],
                [
                  "With us",
                  book?.loans
                    ? tenure(borrower.customer_since, app.submitted_at)
                    : borrower.first_time_buyer
                      ? "First-time buyer"
                      : "New customer",
                ],
              ]}
            />
          ) : null}
        </Card>

        <Card
          title="Property"
          view="property"
          area="property"
          lead={property ? property.address : "…"}
          note={property && cityLine(property)}
        >
          {property ? (
            <Facts
              cols={1}
              rows={[
                [
                  app.purchase_price_cents ? "Appraised" : "Value",
                  usd(property.value_cents),
                  app.purchase_price_cents ? `price ${usd(app.purchase_price_cents)}` : undefined,
                ],
                ["Type", `${property.property_type}, built ${property.year_built}`],
                ["Taxes", `${usd(property.annual_tax_cents)} a year`],
                [
                  "Flood zone",
                  property.flood_zone,
                  inFloodZone(property) ? (
                    <span className="rv-warn">insurance required</span>
                  ) : (
                    "minimal risk"
                  ),
                ],
              ]}
            />
          ) : null}
        </Card>

        <Card
          title="Loan officer"
          view="officer"
          area="officer"
          lead={officer ? officer.name : "…"}
          note={officer && `NMLS #${officer.nmls_id} · ${officer.branch}`}
        >
          {officerBook.book ? (
            <BookStats book={officerBook.book} pipeline={officerBook.pipeline?.length} />
          ) : null}
        </Card>
      </div>
    </View>
  );
}
