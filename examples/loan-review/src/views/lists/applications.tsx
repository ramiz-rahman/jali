/**
 * Applications as a list. One borrower's are told apart by number; anyone else's (a property's, an officer's) by
 * borrower. The application in review is tagged.
 */
import type { ReactNode } from "react";
import { useBorrowerName } from "../../data";
import type { Application } from "../../model/rows";
import { applicationCols as cols } from "../columns/applications";
import { Table, View, ViewHead } from "../parts/layout";
import type { ListProps } from ".";

/** One borrower's applications, by number. */
export function BorrowerApplications(p: ListProps<"loan_applications">) {
  return <ApplicationList {...p} head="Application" name={(a) => `#${a.id}`} />;
}

/** Applications from many borrowers, by borrower. */
export function Applications(p: ListProps<"loan_applications">) {
  const name = useBorrowerName();
  return <ApplicationList {...p} head="Borrower" name={(a) => name(a.borrower_id)} />;
}

function ApplicationList({
  rows,
  label,
  head,
  name,
}: ListProps<"loan_applications"> & { head: string; name: (a: Application) => ReactNode }) {
  return (
    <View label={label}>
      <ViewHead kicker="Applications" title={label} />
      <Table
        label={label}
        rows={rows}
        cols={[
          cols.app(head, name),
          cols.product,
          { ...cols.purpose, pri: 3 },
          cols.amount,
          cols.submitted,
          cols.status,
        ]}
      />
    </View>
  );
}
