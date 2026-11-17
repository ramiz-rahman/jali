import { columnFormat } from "./labels";
import { TABLES } from "./tables";
import { ident } from "./sql";
import type { ColumnInfo, TableInfo, TableName } from "./types";

const names: readonly TableName[] = TABLES;
type Call = <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
interface ColumnRow extends Record<string, unknown> {
  table_name: string; column_name: string; data_type: string; is_nullable: string; ordinal_position: number;
}
interface ConstraintRow extends Record<string, unknown> {
  table_name: string; column_name: string; constraint_type: string;
  foreign_table: string | null; foreign_column: string | null; ordinal_position: number;
}
export function createCatalog(ready: () => Promise<void>, call: Call, primaryKeys: Map<TableName, string[]>, onCacheHit: () => void) {
  let metadata: TableInfo[] | undefined;
  const catalog = async (): Promise<TableInfo[]> => {
    await ready();
    if (metadata) { onCacheHit(); return metadata; }
    const columns = await call<ColumnRow>(`SELECT table_name, column_name, data_type, is_nullable, ordinal_position
      FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
    const constraints = await call<ConstraintRow>(`SELECT tc.table_name, kcu.column_name, tc.constraint_type,
      ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, kcu.ordinal_position
      FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu
        ON tc.constraint_catalog=kcu.constraint_catalog AND tc.constraint_schema=kcu.constraint_schema
        AND tc.constraint_name=kcu.constraint_name
      LEFT JOIN information_schema.referential_constraints rc ON rc.constraint_catalog=tc.constraint_catalog
        AND rc.constraint_schema=tc.constraint_schema AND rc.constraint_name=tc.constraint_name
      LEFT JOIN information_schema.key_column_usage ccu ON ccu.constraint_catalog=rc.unique_constraint_catalog
        AND ccu.constraint_schema=rc.unique_constraint_schema AND ccu.constraint_name=rc.unique_constraint_name
        AND ccu.ordinal_position=kcu.position_in_unique_constraint
      WHERE tc.table_schema='public' AND tc.constraint_type IN ('PRIMARY KEY','FOREIGN KEY')`);
    const counts = await call<{ name: string; count: number }>(
      names.map(n => `SELECT '${n}' AS name, count(*)::int AS count FROM ${ident(n)}`).join(' UNION ALL '),
    );
    for (const name of names) {
      primaryKeys.set(name, constraints.rows.filter(c => c.table_name === name && c.constraint_type === 'PRIMARY KEY')
        .sort((a, b) => a.ordinal_position - b.ordinal_position).map(c => c.column_name));
    }
    metadata = names.map(name => ({
      name,
      rowCount: Number(counts.rows.find(r => r.name === name)?.count ?? 0),
      columns: columns.rows.filter(c => c.table_name === name).map(c => {
        const cs = constraints.rows.filter(x => x.table_name === name && x.column_name === c.column_name);
        const fk = cs.find(x => x.constraint_type === 'FOREIGN KEY');
        const col: ColumnInfo = {
          format: columnFormat(c.column_name), name: c.column_name, type: c.data_type,
          nullable: c.is_nullable === 'YES', primaryKey: cs.some(x => x.constraint_type === 'PRIMARY KEY'),
        };
        if (fk?.foreign_table && fk.foreign_column) col.references = { table: fk.foreign_table as TableName, column: fk.foreign_column };
        return col;
      }),
      referencedBy: constraints.rows.filter(c => c.foreign_table === name)
        .map(c => ({ table: c.table_name as TableName, column: c.column_name })),
    }));
    return metadata;
  };
  const info = async (table: TableName) => {
    if (!names.includes(table)) throw new Error(`Unknown table: ${table}`);
    return (await catalog()).find(t => t.name === table)!;
  };
  return { catalog, info };
}
