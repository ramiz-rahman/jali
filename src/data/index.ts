import { PGlite } from '@electric-sql/pglite';
import { QueryClient, hashKey } from '@tanstack/react-query';
import { sampleDatabaseStatements } from './sample-sql';
import { TABLES, singular } from './tables';
import type { ColumnInfo, DataLayer, EntityKey, Relation, Row, RowsQuery, TableInfo, TableName } from './types';
export type * from './types';

const names: readonly TableName[] = TABLES;
const ident = (s: string) => `"${s.replaceAll('"', '""')}"`;
const key = (e: EntityKey) => `${e.table}:${e.id}`;
const keys = {
  catalog: () => ['catalog'] as const,
  rows: (table: TableName, opts: RowsQuery) => ['rows', table, opts] as const,
  record: (table: TableName, id: string) => ['record', table, id] as const,
  relations: (table: TableName, id: string) => ['relations', table, id] as const,
  result: (runId: string) => ['result', runId] as const,
  resultPage: (runId: string, offset: number, limit: number) => ['result', runId, offset, limit] as const,
};

export function createDataLayer(): DataLayer {
  const db = new PGlite();
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  let fetches = 0, cacheHits = 0, init: Promise<void> | undefined, metadata: TableInfo[] | undefined, nextRun = 0;
  const index = new Map<string, Set<string>>();
  const primaryKeys = new Map<TableName, string[]>();
  const results = new Map<string, { rows: Row[]; table?: TableName }>();
  const call = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => { fetches++; return db.query<T>(sql, params); };
  const ready = () => init ??= (async () => { fetches++; await db.exec(sampleDatabaseStatements('postgres').join('\n')); })();
  const catalog = async (): Promise<TableInfo[]> => {
    await ready();
    if (metadata) { cacheHits++; return metadata; }
    const columns = await call<{ table_name: string; column_name: string; data_type: string; is_nullable: string; ordinal_position: number }>(`SELECT table_name, column_name, data_type, is_nullable, ordinal_position FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
    const constraints = await call<{ table_name: string; column_name: string; constraint_type: string; foreign_table: string | null; foreign_column: string | null; ordinal_position: number }>(`SELECT tc.table_name, kcu.column_name, tc.constraint_type, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, kcu.ordinal_position
      FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_catalog=kcu.constraint_catalog AND tc.constraint_schema=kcu.constraint_schema AND tc.constraint_name=kcu.constraint_name
      LEFT JOIN information_schema.referential_constraints rc ON rc.constraint_catalog=tc.constraint_catalog AND rc.constraint_schema=tc.constraint_schema AND rc.constraint_name=tc.constraint_name
      LEFT JOIN information_schema.key_column_usage ccu ON ccu.constraint_catalog=rc.unique_constraint_catalog AND ccu.constraint_schema=rc.unique_constraint_schema AND ccu.constraint_name=rc.unique_constraint_name AND ccu.ordinal_position=kcu.position_in_unique_constraint
      WHERE tc.table_schema='public' AND tc.constraint_type IN ('PRIMARY KEY','FOREIGN KEY')`);
    const counts = await call<{ name: string; count: number }>(names.map(n => `SELECT '${n}' AS name, count(*)::int AS count FROM ${ident(n)}`).join(' UNION ALL '));
    for (const name of names) primaryKeys.set(name, constraints.rows.filter(c => c.table_name === name && c.constraint_type === 'PRIMARY KEY').sort((a, b) => a.ordinal_position - b.ordinal_position).map(c => c.column_name));
    metadata = names.map(name => ({ name, rowCount: Number(counts.rows.find(r => r.name === name)?.count ?? 0), columns: columns.rows.filter(c => c.table_name === name).map(c => {
      const cs = constraints.rows.filter(x => x.table_name === name && x.column_name === c.column_name);
      const fk = cs.find(x => x.constraint_type === 'FOREIGN KEY');
      const col: ColumnInfo = { name: c.column_name, type: c.data_type, nullable: c.is_nullable === 'YES', primaryKey: cs.some(x => x.constraint_type === 'PRIMARY KEY') };
      if (fk?.foreign_table && fk.foreign_column) col.references = { table: fk.foreign_table as TableName, column: fk.foreign_column };
      return col;
    }), referencedBy: constraints.rows.filter(c => c.foreign_table === name).map(c => ({ table: c.table_name as TableName, column: c.column_name })) }));
    return metadata;
  };
  const info = async (table: TableName) => { if (!names.includes(table)) throw new Error(`Unknown table: ${table}`); return (await catalog()).find(t => t.name === table)!; };
  const entity = (table: TableInfo, row: Row): EntityKey | undefined => { const pk = (primaryKeys.get(table.name) ?? []).map(name => table.columns.find(c => c.name === name)!); if (!pk.length || pk.some(c => row[c.name] == null)) return; return { table: table.name, id: pk.map(c => String(row[c.name])).join(':') }; };
  const entities = async (table: TableName, rows: Row[]) => {
    const meta = await info(table); const out: EntityKey[] = [];
    for (const row of rows) {
      const own = entity(meta, row); if (own) out.push(own);
      for (const col of meta.columns) if (col.references && row[col.name] != null) {
        const target = await info(col.references.table); const pk = target.columns.filter(c => c.primaryKey);
        if (pk.length === 1 && pk[0]!.name === col.references.column) out.push({ table: target.name, id: String(row[col.name]) });
      }
    }
    return out;
  };
  const track = (queryKey: readonly unknown[], entries: EntityKey[]) => index.set(hashKey(queryKey), new Set(entries.map(key)));
  const condition = (fields: Record<string, string | number | null>, start = 1) => ({ sql: Object.keys(fields).map((c, i) => `${ident(c)} = $${i + start}`).join(' AND ') || 'TRUE', values: Object.values(fields) });
  const idFields = (meta: TableInfo, id: string) => { const pk = (primaryKeys.get(meta.name) ?? []).map(name => meta.columns.find(c => c.name === name)!); const parts = id.split(':'); if (parts.length !== pk.length) throw new Error('Invalid primary key'); return Object.fromEntries(pk.map((c, i) => [c.name, parts[i]!])); };
  const api: DataLayer['api'] = {
    ready, catalog,
    async rows(table, opts) {
      await ready();
      const meta = await info(table);
      const w = condition(opts.where ?? {});
      const sort = opts.orderBy?.match(/^([a-z_][a-z0-9_]*)(?:\s+(ASC|DESC))?$/i);
      if (opts.orderBy && (!sort || !meta.columns.some(c => c.name === sort[1]))) throw new Error('Invalid orderBy');
      const columns = sort ? [`${ident(sort[1]!)} ${sort[2]?.toUpperCase() ?? 'ASC'}`] : (primaryKeys.get(table) ?? []).map(c => `${ident(c)} ASC`);
      const order = columns.length ? ` ORDER BY ${columns.join(', ')}` : '';
      const result = await call<{ rows: Row[]; total: number }>(`SELECT (SELECT count(*)::int FROM ${ident(table)} WHERE ${w.sql}) AS total, COALESCE((SELECT json_agg(r) FROM (SELECT * FROM ${ident(table)} WHERE ${w.sql}${order} LIMIT $${w.values.length+1} OFFSET $${w.values.length+2}) r), '[]'::json) AS rows`, [...w.values, opts.limit ?? 100, opts.offset ?? 0]);
      const { rows, total } = result.rows[0]!;
      track(keys.rows(table, opts), await entities(table, rows));
      return { rows, total };
    },
    async record(table, id) { await ready(); const meta = await info(table); const w = condition(idFields(meta,id)); const result = await call<Row>(`SELECT * FROM ${ident(table)} WHERE ${w.sql}`, w.values); track(keys.record(table,id), [...await entities(table,result.rows), {table,id}]); return result.rows[0] ?? null; },
    async relations(table, row) { const meta = await info(table); const own = entity(meta,row); const entries = await entities(table,[row]); const rel: Relation[] = [];
      const outgoing = new Map<TableName, Record<string, string | number>>();
      for (const c of meta.columns) if (c.references && row[c.name] != null) { const where = outgoing.get(c.references.table) ?? {}; where[c.references.column] = row[c.name]!; outgoing.set(c.references.table, where); }
      for (const [target, where] of outgoing) rel.push({ label: singular(target).replace(/^./, x => x.toUpperCase()), table: target, where });
      const incoming = new Map<TableName, Record<string, string | number>>();
      for (const ref of meta.referencedBy) { const target = await info(ref.table); const col = target.columns.find(c => c.name === ref.column); const value = col?.references && row[col.references.column]; if (value != null) { const where = incoming.get(ref.table) ?? {}; where[ref.column] = value; incoming.set(ref.table, where); } }
      for (const [target, where] of incoming) rel.push({label: `${target.replaceAll('_',' ').replace(/^./, x => x.toUpperCase())} ${target === 'reviews' ? 'of' : 'by'} this ${singular(table)}`, table: target, where});
      if (own) track(keys.relations(table, own.id), entries); return rel; },
    async run(sql) { await ready(); const start = performance.now(); const result = await call<Row>(sql); const runId = String(++nextRun); const match = /^\s*select\s+[\s\S]+?\s+from\s+"?(\w+)"?(?:\s|;|$)/i.exec(sql); const table = match && names.find(n => n === match[1]?.toLowerCase()); results.set(runId, { rows: result.rows, table: table || undefined }); if (table) track(keys.result(runId), await entities(table,result.rows)); return { runId, sql, columns: result.fields.map(f => f.name), rowCount: result.rows.length, ms: performance.now()-start }; },
    resultRows(runId, offset, limit) { const result = results.get(runId); if (!result) throw new Error(`Unknown run: ${runId}`); cacheHits++; return result.rows.slice(offset,offset+limit); },
    async updateRow(table, id, patch) { await ready(); const meta = await info(table); const fields = Object.keys(patch); if (!fields.length) return []; if (fields.some(c => !meta.columns.some(x => x.name === c) || meta.columns.some(x => x.name === c && x.primaryKey))) throw new Error('Invalid or primary key column'); const w = condition(idFields(meta,id), fields.length+1); const previous = table === 'products' && fields.includes('price_cents') ? await call<Row>(`SELECT price_cents FROM products WHERE ${condition(idFields(meta,id)).sql}`, Object.values(idFields(meta,id))) : undefined; const updated = await call<Row>(`UPDATE ${ident(table)} SET ${fields.map((c,i) => `${ident(c)} = $${i+1}`).join(', ')} WHERE ${w.sql} RETURNING *`, [...Object.values(patch), ...w.values]); if (!updated.rows.length) return []; const changed: EntityKey[] = [{ table,id }]; if (previous?.rows[0] && previous.rows[0].price_cents !== updated.rows[0]!.price_cents) { const audit = await call<{ id: number }>(`SELECT id FROM audit_log WHERE entity_type='product' AND entity_id=$1 AND action='price_changed' ORDER BY id DESC LIMIT 1`, [id]); if (audit.rows[0]) changed.push({table:'audit_log',id:String(audit.rows[0].id)}); }
      for (const result of results.values()) if (result.table === table) result.rows = result.rows.map(row => {
        if (entity(meta, row)?.id !== id) return row;
        const changes = Object.fromEntries(fields.filter(field => field in row && row[field] !== updated.rows[0]![field]).map(field => [field, updated.rows[0]![field]!]));
        return Object.keys(changes).length ? { ...row, ...changes } : row;
      });
      return changed; },
  };
  queryClient.getQueryCache().subscribe(event => { if (event.type === 'removed') index.delete(event.query.queryHash); if (event.type === 'observerAdded' && event.query.state.data !== undefined) cacheHits++; });
  return { api, keys, queryClient, async invalidateEntities(changed) { const ids = new Set(changed.map(key)); const tables = new Set(changed.map(e => e.table)); for (const e of changed) for (const ref of (await info(e.table)).referencedBy) tables.add(ref.table); await queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] === 'rows' && tables.has(q.queryKey[1] as TableName)) || [...(index.get(q.queryKey[0] === 'result' ? hashKey(keys.result(String(q.queryKey[1]))) : q.queryHash) ?? [])].some(e => ids.has(e)) }); }, stats: () => ({fetches,cacheHits}) };
}
