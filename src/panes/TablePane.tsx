import { useMemo, useState } from "react";
import type { TableName } from "../data/types";
import { Grid, type GridColumn } from "./Grid";
import { useCatalog, errorText, isLoading } from "./data";
import { foreignKeyRef, formatCount, nextSort, orderByString, parseFilter, recordRef, rowId, tableInfoOf, type SortState } from "./format";
import { ErrorState, Gone, Loading, Shell } from "./states";
import { useWindowRows } from "./useWindow";
import type { PaneProps } from "./props";

/** A grid over one table, optionally pre-filtered by a relation (used by RelatedPane). */
export function TableGrid({ table, fixedWhere, paused, focused, openBeside, peek, select, label }: Pick<PaneProps, "paused" | "focused" | "openBeside" | "peek" | "select"> & { table: TableName; fixedWhere?: Record<string, string | number>; label: string }) {
  const cat = useCatalog({ paused });
  const info = tableInfoOf(cat.data, table);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const where = useMemo(() => {
    const w: Record<string, string | number> = { ...fixedWhere };
    for (const c of info?.columns ?? []) { const v = parseFilter(c, filters[c.name] ?? ""); if (v !== null) w[c.name] = v; }
    return w;
  }, [fixedWhere, filters, info]);
  const w = useWindowRows(table, { where, orderBy: orderByString(sort) }, paused);

  if (isLoading(cat)) return <Shell><Loading /></Shell>;
  if (cat.isError) return <Shell><ErrorState message={errorText(cat) ?? ""} /></Shell>;
  if (!info) return <Shell><Gone what={`Table "${table}"`} /></Shell>;
  if (w.q.isError) return <Shell><ErrorState message={errorText(w.q) ?? ""} /></Shell>;

  const columns: GridColumn[] = info.columns.map((c) => ({
    name: c.name, type: c.type, badge: c.primaryKey ? "PK" : c.references ? "FK" : undefined,
    link: c.references ? (v) => foreignKeyRef(c, v) : undefined,
  }));
  const refAt = (i: number) => { const r = w.rows[i - w.offset]; return r ? recordRef(table, rowId(info.columns, r)) : null; };
  const pick = (i: number) => { setSelected(i); const r = refAt(i); if (r) select(r); };

  return (
    <Shell>
      <div className="pk-bar">
        <span className="grow pk-meta"><span className="pk-mono">{formatCount(w.total)}</span> rows{Object.keys(where).length ? " (filtered)" : ""}</span>
        {(sort || Object.values(filters).some(Boolean)) && <button className="pk-btn" onClick={() => { setSort(null); setFilters({}); }}>Clear</button>}
        <span className="pk-meta">J/K move · Space peek · ⌥↵ open</span>
      </div>
      {w.q.isLoading && !w.rows.length ? <Loading /> :
        <Grid label={label} columns={columns} total={w.total} rows={w.rows} startOffset={w.offset} onRange={w.onRange}
          selected={selected} onSelect={pick} focused={focused}
          onPeek={(i) => { const r = refAt(i); if (r) peek(r); }} onOpen={(i) => { const r = refAt(i); if (r) openBeside(r); }}
          sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))}
          filters={filters} onFilter={(c, t) => setFilters((f) => ({ ...f, [c]: t }))}
          onLink={openBeside} />}
    </Shell>
  );
}

export function TablePane(p: PaneProps) {
  const table = String(p.ref.params.table ?? "") as TableName;
  return <TableGrid {...p} table={table} label={`${table} rows`} />;
}
