/** A loan officer: how to reach them, their pipeline in underwriting, and the book of loans they originated. */
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { useBorrowerName, useCount, useOfficerBook } from "../../data";
import type { Officer } from "../../model/rows";
import { counted } from "../../model/words";
import { applicationsFrom, clientsOf, loansBy } from "../../nav/refs";
import { applicationCols as cols } from "../columns/applications";
import { BookStats } from "../parts/figures";
import { Columns, Facts, Pending, Section, Table, View, ViewHead } from "../parts/layout";
import { CountLink, RelatedList } from "../parts/links";

export function OfficerView({ row: o }: { row: Officer }) {
  const { mortgages, book, pipeline } = useOfficerBook(o.id);
  const name = useBorrowerName();
  const clients = useCount("borrowers", { loan_officer_id: o.id });
  return (
    <View label="Loan officer">
      <ViewHead kicker={`Loan officer · NMLS #${o.nmls_id}`} title={o.name}>
        <span className="rv-contact">
          <a className="rv-tel" href={`tel:${o.phone.replace(/\D/g, "")}`}>
            <PhoneIcon size={12} aria-hidden /> {o.phone}
          </a>
          <a className="rv-tel" href={`mailto:${o.email}`}>
            <EnvelopeSimpleIcon size={12} aria-hidden /> {o.email}
          </a>
        </span>
      </ViewHead>
      <Columns
        main={
          <>
            <Section title="Officer">
              <Facts
                rows={[
                  ["Branch", o.branch],
                  ["NMLS ID", o.nmls_id, "Nationwide Multistate Licensing System"],
                  ["Phone", o.phone],
                ]}
              />
            </Section>
            <Section title="Book">
              {book ? <BookStats book={book} pipeline={pipeline?.length} /> : <Pending />}
            </Section>
            <Section title="Pipeline">
              {pipeline ? (
                <Table
                  label="Applications in underwriting"
                  rows={pipeline}
                  cols={[
                    cols.app("Borrower", (a) => name(a.borrower_id)),
                    cols.program,
                    { ...cols.purpose, pri: 3 },
                    cols.amountShort,
                    { ...cols.submitted, pri: 3 },
                    cols.status,
                  ]}
                />
              ) : (
                <Pending />
              )}
            </Section>
          </>
        }
        side={
          <Section title="Originated">
            <RelatedList>
              <CountLink
                to={loansBy(o.id, o.name)}
                count={mortgages?.length}
                noun="loan"
                label={book ? counted(book.open, "open loan") : undefined}
                note={book ? `${book.loans} in all` : undefined}
              />
              <CountLink
                to={applicationsFrom(o.id, o.name)}
                count={pipeline?.length}
                noun="application"
              />
              <CountLink to={clientsOf(o.id, o.name)} count={clients} noun="borrower" />
            </RelatedList>
          </Section>
        }
      />
    </View>
  );
}
