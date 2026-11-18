import type { RowsQuery, TableName } from "./types";

export const keys = {
  catalog: () => ["catalog"] as const,
  rows: (table: TableName, opts: RowsQuery) => ["rows", table, opts] as const,
  record: (table: TableName, id: string) => ["record", table, id] as const,
  relations: (table: TableName, id: string) => ["relations", table, id] as const,
  result: (runId: string) => ["result", runId] as const,
  trackingKey: (queryKey: readonly unknown[]) =>
    queryKey[0] === "result" ? queryKey.slice(0, 2) : queryKey,
  resultPage: (runId: string, offset: number, limit: number) =>
    ["result", runId, offset, limit] as const,
};
