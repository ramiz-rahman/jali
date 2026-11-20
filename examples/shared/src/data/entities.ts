import { TABLES, singular } from "./tables";
import { keys } from "./keys";
import { ident, condition, idFields } from "./sql";
import type { DataLayer, EntityKey, Relation, Row, TableInfo, TableName } from "./types";
import { UnknownRun, type createResultStore } from "./result-store";

export function createEntities(
  info: (table: TableName) => Promise<TableInfo>,
  primaryKeys: Map<TableName, string[]>,
) {
  const entity = (table: TableInfo, row: Row): EntityKey | undefined => {
    const pk = (primaryKeys.get(table.name) ?? []).map((name) =>
      table.columns.find((c) => c.name === name)!,
    );
    if (!pk.length || pk.some((c) => row[c.name] == null)) return;
    return { table: table.name, id: pk.map((c) => String(row[c.name])).join(":") };
  };
  const entities = async (table: TableName, rows: Row[]) => {
    const meta = await info(table);
    const out: EntityKey[] = [];
    for (const row of rows) {
      const own = entity(meta, row);
      if (own) out.push(own);
      for (const col of meta.columns)
        if (col.references && row[col.name] != null) {
          const target = await info(col.references.table);
          const pk = target.columns.filter((c) => c.primaryKey);
          if (pk.length === 1 && pk[0]!.name === col.references.column)
            out.push({ table: target.name, id: String(row[col.name]) });
        }
    }
    return out;
  };
  return { entity, entities };
}

type Call = <T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<{
  rows: T[];
  fields: { name: string }[];
}>;
export function createDataApi(deps: {
  ready: () => Promise<void>;
  catalog: DataLayer["api"]["catalog"];
  info: (table: TableName) => Promise<TableInfo>;
  call: Call;
  primaryKeys: Map<TableName, string[]>;
  entity: ReturnType<typeof createEntities>["entity"];
  entities: ReturnType<typeof createEntities>["entities"];
  track: (key: readonly unknown[], entities: EntityKey[]) => void;
  results: ReturnType<typeof createResultStore>;
  onCacheHit: () => void;
}): DataLayer["api"] {
  const { ready, catalog, info, call, primaryKeys, entity, entities, track, results, onCacheHit } =
    deps;
  const names: readonly TableName[] = TABLES;
  let nextRun = 0;
  // Results live in memory for this visit. A run id names its visit too, so an id from an earlier visit (in a link,
  // after a reload) never names a result of this one.
  const visit = Math.random().toString(36).slice(2, 8);
  return {
    ready,
    catalog,
    async rows(table, opts) {
      await ready();
      const meta = await info(table);
      const w = condition(opts.where ?? {});
      const sort = opts.orderBy?.match(/^([a-z_][a-z0-9_]*)(?:\s+(ASC|DESC))?$/i);
      if (opts.orderBy && (!sort || !meta.columns.some((c) => c.name === sort[1])))
        throw new Error("Invalid orderBy");
      const columns = sort
        ? [`${ident(sort[1]!)} ${sort[2]?.toUpperCase() ?? "ASC"}`]
        : (primaryKeys.get(table) ?? []).map((c) => `${ident(c)} ASC`);
      const order = columns.length ? ` ORDER BY ${columns.join(", ")}` : "";
      const result = await call<{ rows: Row[]; total: number }>(
        `SELECT (SELECT count(*)::int FROM ${ident(table)} WHERE ${w.sql}) AS total,
        COALESCE((SELECT json_agg(r) FROM (SELECT * FROM ${ident(table)} WHERE ${w.sql}${order}
        LIMIT $${w.values.length + 1} OFFSET $${w.values.length + 2}) r), '[]'::json) AS rows`,
        [...w.values, opts.limit ?? 100, opts.offset ?? 0],
      );
      const { rows, total } = result.rows[0]!;
      track(keys.rows(table, opts), await entities(table, rows));
      return { rows, total };
    },
    async record(table, id) {
      await ready();
      const meta = await info(table);
      const w = condition(idFields(primaryKeys, meta, id));
      const result = await call<Row>(`SELECT * FROM ${ident(table)} WHERE ${w.sql}`, w.values);
      track(keys.record(table, id), [...(await entities(table, result.rows)), { table, id }]);
      return result.rows[0] ?? null;
    },
    async relations(table, row) {
      const meta = await info(table);
      const own = entity(meta, row);
      const entries = await entities(table, [row]);
      const rel: Relation[] = [];
      const outgoing = new Map<TableName, Record<string, string | number>>();
      for (const c of meta.columns)
        if (c.references && row[c.name] != null) {
          const where = outgoing.get(c.references.table) ?? {};
          where[c.references.column] = row[c.name]!;
          outgoing.set(c.references.table, where);
        }
      for (const [target, where] of outgoing) {
        rel.push({
          label: singular(target).replace(/^./, (x) => x.toUpperCase()),
          table: target,
          where,
          count: 0,
        });
      }
      const incoming = new Map<TableName, Record<string, string | number>>();
      for (const ref of meta.referencedBy) {
        const target = await info(ref.table);
        const col = target.columns.find((c) => c.name === ref.column);
        const value = col?.references && row[col.references.column];
        if (value != null) {
          const where = incoming.get(ref.table) ?? {};
          where[ref.column] = value;
          incoming.set(ref.table, where);
        }
      }
      for (const [target, where] of incoming) {
        const name = target.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
        rel.push({
          label: `${name} ${target === "reviews" ? "of" : "by"} this ${singular(table)}`,
          table: target,
          where,
          count: 0,
        });
      }
      if (rel.length) {
        const values: (string | number)[] = [];
        const statements = rel.map((relation, i) => {
          const w = condition(relation.where, values.length + 1);
          values.push(...(w.values as (string | number)[]));
          return `SELECT ${i} AS idx, count(*)::int AS count FROM ${ident(relation.table)} WHERE ${w.sql}`;
        });
        const counts = await call<{ idx: number; count: number }>(
          statements.join(" UNION ALL "),
          values,
        );
        for (const count of counts.rows) rel[count.idx]!.count = Number(count.count);
      }
      if (own) track(keys.relations(table, own.id), entries);
      return rel;
    },
    async run(sql) {
      await ready();
      const start = performance.now();
      const result = await call<Row>(sql);
      const runId = `${visit}-${++nextRun}`;
      const match = /^\s*select\s+[\s\S]+?\s+from\s+"?(\w+)"?(?:\s|;|$)/i.exec(sql);
      const table = match && names.find((n) => n === match[1]?.toLowerCase());
      results.set(runId, { rows: result.rows, table: table || undefined });
      if (table) track(keys.result(runId), await entities(table, result.rows));
      return {
        runId,
        sql,
        columns: result.fields.map((f) => f.name),
        rowCount: result.rows.length,
        ms: performance.now() - start,
      };
    },
    resultRows(runId, offset, limit) {
      const result = results.get(runId);
      if (!result) throw new UnknownRun(runId);
      onCacheHit();
      return result.rows.slice(offset, offset + limit);
    },
    async updateRow(table, id, patch) {
      await ready();
      const meta = await info(table);
      const fields = Object.keys(patch);
      if (!fields.length) return [];
      if (
        fields.some(
          (c) =>
            !meta.columns.some((x) => x.name === c) ||
            meta.columns.some((x) => x.name === c && x.primaryKey),
        )
      ) {
        throw new Error("Invalid or primary key column");
      }
      const idWhere = idFields(primaryKeys, meta, id);
      const w = condition(idWhere, fields.length + 1);
      const previous =
        table === "products" && fields.includes("price_cents")
          ? await call<Row>(
              `SELECT price_cents FROM products WHERE ${condition(idWhere).sql}`,
              Object.values(idWhere),
            )
          : undefined;
      const assignments = fields.map((c, i) => `${ident(c)} = $${i + 1}`).join(", ");
      const updated = await call<Row>(
        `UPDATE ${ident(table)} SET ${assignments} WHERE ${w.sql} RETURNING *`,
        [...Object.values(patch), ...w.values],
      );
      if (!updated.rows.length) return [];
      const changed: EntityKey[] = [{ table, id }];
      if (previous?.rows[0] && previous.rows[0].price_cents !== updated.rows[0]!.price_cents) {
        const audit = await call<{ id: number }>(
          `SELECT id FROM audit_log WHERE entity_type='product' AND entity_id=$1
          AND action='price_changed' ORDER BY id DESC LIMIT 1`,
          [id],
        );
        if (audit.rows[0]) changed.push({ table: "audit_log", id: String(audit.rows[0].id) });
      }
      for (const result of results.values())
        if (result.table === table)
          result.rows = result.rows.map((row) => {
            if (entity(meta, row)?.id !== id) return row;
            const changes = Object.fromEntries(
              fields
                .filter((field) => field in row && row[field] !== updated.rows[0]![field])
                .map((field) => [field, updated.rows[0]![field]!]),
            );
            return Object.keys(changes).length ? { ...row, ...changes } : row;
          });
      return changed;
    },
  };
}
