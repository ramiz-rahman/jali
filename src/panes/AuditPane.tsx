import { Grid, type GridColumn } from "./Grid";
import { useCatalog, errorText, isLoading } from "../data/hooks";
import { formatCount, recordRef, tableInfoOf } from "./format";
import { ErrorState, Gone, Loading, Shell } from "./states";
import { useWindowRows } from "./useWindow";
import { useState } from "react";
import type { PaneComponentProps, } from "../ui/pane-kinds";
import { entityTable } from "../data/tables";
import type { Row } from "../data/types";

/** The audit_log feed, newest first. Entity links open the record that changed. */
export function AuditPane({ paused, focused, openBeside, peek, select }: PaneComponentProps) {
  const cat = useCatalog({ paused });
  const info = tableInfoOf(cat.data, "audit_log");
  const w = useWindowRows("audit_log", { orderBy: "id DESC" }, paused);
  const [sel, setSel] = useState<number | null>(null);
  if (isLoading(cat) || (w.q.isLoading && !w.rows.length)) return <Shell><Loading /></Shell>;
  if (cat.isError || w.q.isError) return <Shell><ErrorState message={errorText(cat) ?? errorText(w.q) ?? ""} /></Shell>;
  if (!info) return <Shell><Gone what="The audit log" /></Shell>;
  const refFor = (row: Row) => {
    const table = entityTable(String(row.entity_type));
    return table && row.entity_id != null ? recordRef(table, String(row.entity_id)) : null;
  };
  const target = (i: number) => { const row = w.rows[i - w.offset]; return row ? refFor(row) : null; };
  const columns: GridColumn[] = info.columns.filter((c) => c.name !== "payload_json").map((c) => ({
    name: c.name, type: c.type, badge: c.primaryKey ? "PK" : undefined,
    link: c.name === "entity_id" ? (_v, row) => refFor(row) : undefined,
  }));
  return (
    <Shell>
      <div className="pk-bar"><span className="grow pk-meta"><span className="pk-mono">{formatCount(w.total)}</span> events, newest first</span></div>
      <Grid label="Audit log" columns={columns} total={w.total} rows={w.rows} startOffset={w.offset} onRange={w.onRange}
        selected={sel} onSelect={(i) => { setSel(i); select(i === null ? null : target(i)); }} focused={focused}
        onPeek={(i) => { const t = target(i); if (t) peek(t); }} onOpen={(i) => { const t = target(i); if (t) openBeside(t); }} rowOpenLabel={(i) => { const t = target(i); return t ? `Open ${t.params.table} ${t.params.id} beside` : "Open the record"; }} onLink={openBeside} />
    </Shell>
  );
}
