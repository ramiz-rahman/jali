import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import type { Row } from "../../../../shared/src/data/types";
import { entityTable } from "../../../../shared/src/data/tables";
import type { PaneProps } from "@jali/react";
import { recordRef } from "../../../../shared/src/panes/shared/refs";
import { TableGrid } from "../../../../shared/src/panes/kinds/table";

const COLUMNS = ["id", "entity_type", "entity_id", "action", "changed_at"];
function target(row: Row) {
  const table = entityTable(String(row.entity_type));
  return table && row.entity_id != null ? recordRef(table, String(row.entity_id)) : null;
}
export function AuditPane(props: PaneProps) {
  return (
    <TableGrid
      {...props}
      table="audit_log"
      label="Audit log"
      columns={COLUMNS}
      orderBy="id DESC"
      rowRef={target}
      audit
    />
  );
}

export const auditKind = definePane("audit", {
  title: "Audit log",
  icon: ClockCounterClockwiseIcon,
  width: { min: 360, comfortable: 480 },
  height: { min: 240 },
  Component: AuditPane,
});
