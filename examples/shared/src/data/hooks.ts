import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import type { Row, TableName, RowsQuery } from "./types";
import { useDataLayer } from "./react";

type Pause = { paused?: boolean };
export type RowsOpts = RowsQuery;
/**
 * A paused read does no work but keeps listening: it never fetches (`enabled`), and it stays subscribed to its cache
 * entry, so an answer someone else fetched for the same key reaches it while it is out of sight. Its pane shows the
 * data when it comes back, with no fetch and no loading state, and a hidden pane is never left "loading" for a read
 * that already finished. A paused read with nothing cached yet is pending, not loading; it fetches once unpaused.
 */
const activity = (options?: Pause) => ({ enabled: !options?.paused });
export function useCatalog(options?: Pause) {
  const layer = useDataLayer();
  return useQuery(
    { queryKey: layer.keys.catalog(), queryFn: () => layer.api.catalog(), ...activity(options) },
    layer.queryClient,
  );
}
export function useRows(table: TableName, opts: RowsOpts = {}, options?: Pause) {
  const layer = useDataLayer();
  return useQuery(
    {
      queryKey: layer.keys.rows(table, opts),
      queryFn: () => layer.api.rows(table, opts),
      ...activity(options),
    },
    layer.queryClient,
  );
}
/** Several reads of one table at once, one per query, in order; each its own cache entry. */
export function useRowsMany(table: TableName, queries: RowsOpts[], options?: Pause) {
  const layer = useDataLayer();
  return useQueries(
    {
      queries: queries.map((opts) => ({
        queryKey: layer.keys.rows(table, opts),
        queryFn: () => layer.api.rows(table, opts),
        ...activity(options),
      })),
    },
    layer.queryClient,
  );
}
export function useRecord(table: TableName, id: string, options?: Pause) {
  const layer = useDataLayer();
  return useQuery(
    {
      queryKey: layer.keys.record(table, id),
      queryFn: () => layer.api.record(table, id),
      ...activity(options),
    },
    layer.queryClient,
  );
}
export function useRelations(table: TableName, id: string, row: Row, options?: Pause) {
  const layer = useDataLayer();
  return useQuery(
    {
      queryKey: layer.keys.relations(table, id),
      queryFn: () => layer.api.relations(table, row),
      ...activity(options),
    },
    layer.queryClient,
  );
}
export function useRun() {
  const layer = useDataLayer();
  return useMutation({ mutationFn: (sql: string) => layer.api.run(sql) }, layer.queryClient);
}
export function useResultRows(runId: string, offset: number, limit: number, options?: Pause) {
  const layer = useDataLayer();
  return useQuery(
    {
      queryKey: layer.keys.resultPage(runId, offset, limit),
      queryFn: () => layer.api.resultRows(runId, offset, limit),
      ...activity(options),
    },
    layer.queryClient,
  );
}
export function useUpdateRow() {
  const layer = useDataLayer();
  return useMutation(
    {
      mutationFn: ({ table, id, patch }: { table: TableName; id: string; patch: Row }) =>
        layer.api.updateRow(table, id, patch),
      onSuccess: (changed) => layer.invalidateEntities(changed),
    },
    layer.queryClient,
  );
}

export interface Q<T> {
  data: T | undefined;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  isFetching?: boolean;
}
export const isLoading = (q: Q<unknown>) => !!(q.isLoading ?? q.isPending) && q.data === undefined;
export const errorText = (q: { error?: unknown }) =>
  q.error ? (q.error instanceof Error ? q.error.message : String(q.error)) : null;
export function useTableInfo(table: TableName, paused: boolean) {
  const query = useCatalog({ paused });
  return { ...query, data: query.data?.find((item) => item.name === table) };
}
