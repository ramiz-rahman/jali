import { LinkSimpleHorizontalIcon } from "@phosphor-icons/react";
import type { Params } from "jali";
import { definePane, type PaneProps } from "jali/react";
import { useMemo } from "react";
import type { TableName } from "../../data/types";
import { TableGrid } from "./table";

export function RelatedPane(p: PaneProps) {
  const { table, column, value, label } = p.params;
  const where = useMemo(() => ({ [String(column)]: value as string | number }), [column, value]);
  return (
    <TableGrid
      {...p}
      table={String(table) as TableName}
      fixedWhere={where}
      label={String(label ?? "Related rows")}
    />
  );
}

/**
 * Which rows a related list is: its table and where clause. Its `label` is only what it is called ("Orders by this
 * customer", Loan review's "Loan history"), so a link that names the same rows another way goes to the pane already
 * showing them. Every kind that `shows: "related"` uses this, so they still match across kinds.
 */
export const relatedIdentity = ({ table, column, value }: Params) => [
  String(table),
  String(column),
  String(value),
];

export const relatedKind = definePane("related", {
  title: ({ label }) => String(label ?? "Related"),
  identity: relatedIdentity,
  icon: LinkSimpleHorizontalIcon,
  width: { min: 360, comfortable: 480 },
  height: { min: 240 },
  Component: RelatedPane,
});
