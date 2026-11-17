import { Link2 } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { useMemo } from "react";
import type { TableName } from "../../data/types";
import { TableGrid } from "./table";
import type { PaneComponentProps } from "../../ui/pane-kinds";

export function RelatedPane(p: PaneComponentProps) {
  const { table, column, value, label } = p.ref.params;
  const where = useMemo(() => ({ [String(column)]: value as string | number }), [column, value]);
  return <TableGrid {...p} table={String(table) as TableName} fixedWhere={where} label={String(label ?? "Related rows")} />;
}


export const relatedKind = definePaneKind({
  kind: "related", object: "related", ref: (params) => ({ kind: "related", params }),
  title: (ref) => String(ref.params.label ?? "Related"), minWidth: 360, comfortableWidth: 480, minHeight: 240, 
  icon: Link2, Component: RelatedPane,
});
