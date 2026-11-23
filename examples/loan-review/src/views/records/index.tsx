/**
 * The review's record pane: one designed view per loan-book table, each in plain words (application, borrower,
 * property, loan officer, mortgage). A table without one is Data Studio's record.
 */
import type { ComponentType } from "react";
import type { PaneProps } from "jali/react";
import { recordParams, RecordPane } from "@jali-examples/shared/panes/kinds/record";
import { Paused, useBookRecordQuery } from "../../data";
import type { BookRows, BookTable } from "../../model/rows";
import { TABLES } from "../../nav/refs";
import { Loaded } from "../parts/gate";
import { ApplicationView } from "./application";
import { BorrowerView } from "./borrower";
import { MortgageView } from "./mortgage";
import { OfficerView } from "./officer";
import { PropertyView } from "./property";

/** The designed views, each given its row read as its type. */
const VIEWS: { [T in BookTable]?: ComponentType<{ row: BookRows[T] }> } = {
  loan_applications: ApplicationView,
  borrowers: BorrowerView,
  properties: PropertyView,
  loan_officers: OfficerView,
  mortgages: MortgageView,
};

export function ReviewRecordPane(p: PaneProps<typeof recordParams>) {
  const table = p.params.table as BookTable;
  return VIEWS[table] ? (
    <Paused value={p.paused}>
      <Designed table={table} id={String(p.params.id)} />
    </Paused>
  ) : (
    <RecordPane {...p} />
  );
}

/** A table's designed view (one `VIEWS` has), given its row read as its type once it loads. */
function Designed<T extends BookTable>({ table, id }: { table: T; id: string }) {
  const View: ComponentType<{ row: BookRows[T] }> = VIEWS[table]!;
  return (
    <Loaded query={useBookRecordQuery(table, id)} gone={`${TABLES[table].noun} ${id}`}>
      {(row) => <View row={row} />}
    </Loaded>
  );
}
