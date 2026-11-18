import { History } from "lucide-react";
import { definePaneKind } from "@jali/react";
import type { Row } from "../../data/types";
import { entityTable } from "../../data/tables";
import type { PaneComponentProps } from "@jali/react";
import { recordRef } from "../shared/refs";
import { TableGrid } from "./table";

const COLUMNS = ["id", "entity_type", "entity_id", "action", "changed_at"];
function target(row: Row) {
  const table = entityTable(String(row.entity_type));
  return table && row.entity_id != null ? recordRef(table, String(row.entity_id)) : null;
}
export function AuditPane(props: PaneComponentProps) {
  return <TableGrid {...props} table="audit_log" label="Audit log" columns={COLUMNS} orderBy="id DESC" rowRef={target} audit />;
}


export const auditKind = definePaneKind({
  kind: "audit", ref: (params) => ({ kind: "audit", params }),
  title: (_ref) => "Audit log", minWidth: 360, comfortableWidth: 480, minHeight: 240, 
  icon: History, Component: AuditPane,
});
