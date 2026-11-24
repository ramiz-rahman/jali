/**
 * The sample database: the data contract. Spec §18 of pane-interaction-spec.md:
 * panes declare needs by ObjectRef; one shared cache (TanStack Query) holds data keyed by entity;
 * the workspace coordinates and prefetches, never fetches; large results are shared by handle.
 * The coordinator wrote this file. Implementers may ADD to it; note any signature change in docs/DECISIONS.md.
 */
import type { QueryClient } from "@tanstack/react-query";

import type { TableName } from "./tables";
export type { TableName } from "./tables";

export type Row = Record<string, string | number | null>;

/** Entity identity used for cache keys and invalidation: every row is an entity. */
export interface EntityKey {
  table: TableName;
  id: string;
} // composite PKs joined, e.g. "789:2" for order_items

export type ColumnFormat = "money" | "json";
export interface ColumnInfo {
  format?: ColumnFormat;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  references?: { table: TableName; column: string };
}
export interface TableInfo {
  name: TableName;
  rowCount: number;
  columns: ColumnInfo[];
  referencedBy: { table: TableName; column: string }[];
}

export interface Relation {
  label: string;
  table: TableName;
  where: Record<string, string | number>;
  count: number;
} // e.g. "Orders by this customer"

/** A query run's results live in a result store by handle; grid, chart and inspector share the handle, never a copy. */
export interface ResultHandle {
  runId: string;
  sql: string;
  columns: string[];
  rowCount: number;
  ms: number;
}

export interface RowsQuery {
  where?: Record<string, string | number>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface DataApi {
  /** Starts PGlite in the browser and loads the sample (sampleDatabaseStatements("postgres")). Idempotent. */
  ready(): Promise<void>;
  catalog(): Promise<TableInfo[]>;
  rows(table: TableName, opts: RowsQuery): Promise<{ rows: Row[]; total: number }>;
  record(table: TableName, id: string): Promise<Row | null>;
  relations(table: TableName, row: Row): Promise<Relation[]>;
  run(sql: string): Promise<ResultHandle>;
  resultRows(runId: string, offset: number, limit: number): Row[];
  /** Mutations write to PGlite and return the entity keys they changed, for invalidation. */
  updateRow(table: TableName, id: string, patch: Row): Promise<EntityKey[]>;
}

/** Query-key factory: every key that contains an entity can be invalidated by that entity. */
export interface Keys {
  catalog(): readonly unknown[];
  rows(table: TableName, opts: RowsQuery): readonly unknown[];
  record(table: TableName, id: string): readonly unknown[];
  relations(table: TableName, id: string): readonly unknown[];
  result(runId: string): readonly unknown[];
  resultPage(runId: string, offset: number, limit: number): readonly unknown[];
}

export interface DataLayer {
  api: DataApi;
  keys: Keys;
  queryClient: QueryClient;
  /** After a mutation: invalidate every cached query that contains any of these entities (rows lists, records, relations, result sets that include them). */
  invalidateEntities(keys: EntityKey[]): Promise<void>;
  /** Count of network-equivalent fetches (PGlite calls), for proving "no extra request" in the demo. */
  stats(): { fetches: number; cacheHits: number };
}

/** Shared object reference used by pane consumers. */
export type { ObjectRef } from "jali-layout";
