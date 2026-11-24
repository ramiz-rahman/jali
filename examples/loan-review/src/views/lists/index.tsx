/**
 * The review's list pane: the rows of a loan-book table where one column has one value, as a reviewer's table (the
 * columns a decision needs first, the rest as the view widens). Which list shows depends on what is listed and by
 * what (nav/refs.ts: `mortgagesOf`, `liensOn`, `loansBy`…): a borrower's mortgages read as their history, an
 * officer's or a property's as a book. A list without a design is Data Studio's grid.
 */
import type { ComponentType } from "react";
import type { PaneProps } from "jali-layout/react";
import { RelatedPane } from "@jali-examples/shared/panes/kinds/related";
import { MOST, Paused, useBookQuery } from "../../data";
import type { BookRows, BookTable } from "../../model/rows";
import type { ListColumn, listParams } from "../../nav/refs";
import { Loaded } from "../parts/gate";
import { Applications, BorrowerApplications } from "./applications";
import { BorrowerList } from "./borrowers";
import { BookMortgages, BorrowerMortgages } from "./mortgages";

/** What a list gets: its rows, read as their type, and its title. */
export interface ListProps<T extends BookTable> {
  rows: BookRows[T][];
  label: string;
}

type List<T extends BookTable> = ComponentType<ListProps<T>>;

/** A table's lists: how its rows are ordered, a list for some columns, and the one for any other. */
interface Design<T extends BookTable> {
  order: string;
  byColumn?: Partial<Record<ListColumn, List<T>>>;
  otherwise: List<T>;
}

const LISTS: { [T in BookTable]?: Design<T> } = {
  mortgages: {
    order: "originated_on DESC",
    byColumn: { borrower_id: BorrowerMortgages },
    otherwise: BookMortgages,
  },
  borrowers: { order: "name ASC", otherwise: BorrowerList },
  loan_applications: {
    order: "submitted_at DESC",
    byColumn: { borrower_id: BorrowerApplications },
    otherwise: Applications,
  },
};

export function ReviewListPane(p: PaneProps<typeof listParams>) {
  const table = p.params.table as BookTable;
  return LISTS[table] ? (
    <Paused value={p.paused}>
      <Designed {...p.params} table={table} />
    </Paused>
  ) : (
    <RelatedPane {...p} />
  );
}

/** A table's designed list (one `LISTS` has), given its rows read as their type once they load. */
function Designed<T extends BookTable>({
  table,
  column,
  value,
  label = "",
}: {
  table: T;
  column: string;
  value: string | number;
  label?: string;
}) {
  const design = LISTS[table]!;
  const List = design.byColumn?.[column as ListColumn] ?? design.otherwise;
  const query = useBookQuery(table, {
    where: { [column]: value },
    orderBy: design.order,
    limit: MOST.list,
  });
  return <Loaded query={query}>{(rows) => <List rows={rows} label={label} />}</Loaded>;
}
