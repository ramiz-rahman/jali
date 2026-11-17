import { useMemo } from "react";
import type { TableName } from "../data/types";
import { TableGrid } from "./TablePane";
import type { PaneComponentProps } from "../ui/pane-kinds";

export function RelatedPane(p: PaneComponentProps) {
  const { table, column, value, label } = p.ref.params;
  const where = useMemo(() => ({ [String(column)]: value as string | number }), [column, value]);
  return <TableGrid {...p} table={String(table) as TableName} fixedWhere={where} label={String(label ?? "Related rows")} />;
}
