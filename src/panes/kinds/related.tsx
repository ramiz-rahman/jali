import { Link2 } from "lucide-react";
import { definePane } from "@jali/react";
import { useMemo } from "react";
import type { TableName } from "../../data/types";
import { TableGrid } from "./table";
import type { PaneProps } from "@jali/react";

export function RelatedPane(p: PaneProps) {
  const { table, column, value, label } = p.params;
  const where = useMemo(() => ({ [String(column)]: value as string | number }), [column, value]);
  return <TableGrid {...p} table={String(table) as TableName} fixedWhere={where} label={String(label ?? "Related rows")} />;
}


export const relatedKind = definePane("related", {
  title: ({ label }) => String(label ?? "Related"),
  icon: Link2,
  width: { min: 360, comfortable: 480 },
  height: { min: 240 },
  Component: RelatedPane,
});
