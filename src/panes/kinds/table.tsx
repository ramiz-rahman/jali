import { Table2 } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { useMemo, useState } from "react";
import type { ObjectRef, Row, TableName, ColumnInfo } from "../../data/types";
import { Grid, type GridColumn } from "../grid/Grid";
import { useTableInfo, isLoading } from "../../data/hooks";
import { formatCount } from "../format";
import { foreignKeyRef, recordRef, rowId, singular } from "../shared/refs";
import { Loading, Shell } from "../shared/states";
import { useWindowRows } from "../grid/useWindow";
import { nextSort, orderByString, parseFilter, type SortState } from "../grid/grid-state";
import { PaneGate } from "../shared/PaneGate";
import type { PaneComponentProps } from "../../ui/pane-kinds";

/** A grid over one table, optionally pre-filtered by a relation (used by RelatedPane). */
export function TableGrid({ table, fixedWhere, paused, focused, openBeside, peek, select, label, columns: columnNames, orderBy, rowRef, audit = false }: Pick<PaneComponentProps, "paused" | "focused" | "openBeside" | "peek" | "select"> & { table: TableName; fixedWhere?: Record<string, string | number>; label: string; columns?: string[]; orderBy?: string; rowRef?: (row: Row) => ObjectRef | null; audit?: boolean }) {
  const cat = useTableInfo(table, paused);
  const info = cat.data;
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const where = useMemo(() => {
    const w: Record<string, string | number> = { ...fixedWhere };
    for (const c of info?.columns ?? []) { const v = parseFilter(c, filters[c.name] ?? ""); if (v !== null) w[c.name] = v; }
    return w;
  }, [fixedWhere, filters, info]);
  // Unsorted grids order by the primary key: Postgres moves an updated row to the end of an unordered scan, so an edit
  // would otherwise make the row jump out of its place in every table pane that shows it.
  const pkColumn = info?.columns.find((c) => c.primaryKey)?.name;
  const w = useWindowRows(table, { where, orderBy: orderByString(sort) ?? orderBy ?? (pkColumn ? `${pkColumn} ASC` : undefined) }, paused);

  if (isLoading(cat) || cat.isError || !info || w.q.isError) {
    return <PaneGate queries={[cat, w.q]} gone={!info ? `Table "${table}"` : undefined} />;
  }

  const columns: GridColumn[] = info.columns.filter(c => !columnNames || columnNames.includes(c.name)).map((c: ColumnInfo) => ({
    name: c.name, type: c.type, format: c.format, badge: c.primaryKey ? "PK" : c.references ? "FK" : undefined,
  }));
  const refFor = rowRef ?? ((row: Row) => recordRef(table, rowId(info.columns, row)));

  return (
    <Shell>
      <div className="pk-bar">
        <span className="grow pk-meta"><span className="pk-mono">{formatCount(w.total)}</span> {audit ? "events, newest first" : <>rows{Object.keys(where).length ? " (filtered)" : ""}</>}</span>
        {!audit && (sort || Object.values(filters).some(Boolean)) && <button className="pk-btn" onClick={() => { setSort(null); setFilters({}); }}>Clear</button>}
        {!audit && <span className="pk-meta">J/K move · Space peek · ⌥↵ open</span>}
      </div>
      {w.q.isLoading && !w.rows.length ? <Loading /> :
        <Grid label={label} columns={columns} total={w.total} rows={w.rows} startOffset={w.offset} onRange={w.onRange}
          selected={selected} onSelect={setSelected} focused={focused} rowRef={refFor} select={select} peek={peek} openBeside={openBeside}
          rowLabel={(ref) => audit ? `Open ${ref.params.table} ${ref.params.id} beside` : `Open ${singular(table)} ${ref.params.id} beside`}
          sort={sort} onSort={audit ? undefined : (c) => setSort((s) => nextSort(s, c))}
          filters={filters} onFilter={audit ? undefined : (c, t) => setFilters((f) => ({ ...f, [c]: t }))}
          link={(value, row, column) => {
            if (audit && column.name === "entity_id") return rowRef?.(row) ?? null;
            const infoColumn = info.columns.find(c => c.name === column.name);
            return infoColumn ? foreignKeyRef(infoColumn, value) : null;
          }} onLink={openBeside} />}
    </Shell>
  );
}

export function TablePane(p: PaneComponentProps) {
  const table = String(p.ref.params.table ?? "") as TableName;
  return <TableGrid {...p} table={table} label={`${table} rows`} />;
}


export const tableKind = definePaneKind({
  kind: "table", ref: (params) => ({ kind: "table", params }),
  title: (ref) => String(ref.params.table ?? "Table"), minWidth: 480, minHeight: 240, heavy: true,
  icon: Table2, Component: TablePane,
});
