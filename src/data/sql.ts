import type { TableInfo, TableName } from "./types";
export const ident = (s: string) => `"${s.replaceAll('"', '""')}"`;
export const condition = (fields: Record<string, string | number | null>, start = 1) => ({ sql: Object.keys(fields).map((c, i) => `${ident(c)} = $${i + start}`).join(' AND ') || 'TRUE', values: Object.values(fields) });
export const idFields = (primaryKeys: Map<TableName, string[]>, meta: TableInfo, id: string) => { const pk = (primaryKeys.get(meta.name) ?? []).map(name => meta.columns.find(c => c.name === name)!); const parts = id.split(':'); if (parts.length !== pk.length) throw new Error('Invalid primary key'); return Object.fromEntries(pk.map((c, i) => [c.name, parts[i]!])); };
