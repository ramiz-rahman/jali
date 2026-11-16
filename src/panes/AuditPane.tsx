import { Grid, type GridColumn } from "./Grid";
import { useCatalog, errorText, isLoading } from "./data";
import { formatCount, recordRef, rowId, tableInfoOf } from "./format";
import { ErrorState, Gone, Loading, Shell } from "./states";
import { useWindowRows } from "./useWindow";
import { useState } from "react";
import type { PaneProps, } from "./props";
import type { TableName } from "../data/types";

/** The audit_log feed, newest first. Entity links open the record that changed. */
export function AuditPane({ paused, focused, openBeside, peek }: PaneProps) {
  const cat = useCatalog({ paused });
  const info = tableInfoOf(cat.data, "audit_log");
  const w = useWindowRows("audit_log", { orderBy: "id DESC" }, paused);
  const [sel, setSel] = useState<number | null>(null);
  if (isLoading(cat) || (w.q.isLoading && !w.rows.length)) return <Shell><Loading /></Shell>;
  if (cat.isError || w.q.isError) return <Shell><ErrorState message={errorText(cat) ?? errorText(w.q) ?? ""} /></Shell>;
  if (!info) return <Shell><Gone what="The audit log" /></Shell>;
  const target = (i: number) => {
    const r = w.rows[i - w.offset]; if (!r) return null;
    return recordRef(String(r.entity_type) as TableName, String(r.entity_id));
  };
  const columns: GridColumn[] = info.columns.filter((c) => c.name !== "payload_json").map((c) => ({
    name: c.name, type: c.type, badge: c.primaryKey ? "PK" : undefined,
    link: c.name === "entity_id" ? (v) => { const r = w.rows.find((x) => x.entity_id === v); return r ? recordRef(String(r.entity_type) as TableName, String(v)) : null; } : undefined,
  }));
  void rowId;
  return (
    <Shell>
      <div className="pk-bar"><span className="grow pk-meta"><span className="pk-mono">{formatCount(w.total)}</span> events, newest first</span></div>
      <Grid label="Audit log" columns={columns} total={w.total} rows={w.rows} startOffset={w.offset} onRange={w.onRange}
        selected={sel} onSelect={setSel} focused={focused}
        onPeek={(i) => { const t = target(i); if (t) peek(t); }} onOpen={(i) => { const t = target(i); if (t) openBeside(t); }} openLabel="Open the record" onLink={openBeside} />
    </Shell>
  );
}
