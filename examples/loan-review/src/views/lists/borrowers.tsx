/** Borrowers as a list: an officer's clients, with their job, income and score. */
import { borrowerCols as cols } from "../columns/borrowers";
import { Table, View, ViewHead } from "../parts/layout";
import type { ListProps } from ".";

export function BorrowerList({ rows, label }: ListProps<"borrowers">) {
  return (
    <View label={label}>
      <ViewHead kicker="Borrowers" title={label} />
      <Table label={label} rows={rows} cols={[cols.name, cols.job, cols.income, cols.score]} />
    </View>
  );
}
