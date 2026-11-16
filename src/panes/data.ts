/**
 * The one place WP4 touches WP2's hooks (src/data/hooks.ts), which take the DataLayer first.
 * Panes call these wrappers, which read the layer from context (WP3's useDataLayer).
 */
import { useQuery } from "@tanstack/react-query";
import * as raw from "../data/hooks";
import { useDataLayer } from "../ui/pane-kinds";
import type { Row, TableName } from "../data/types";

export interface Opts { paused?: boolean }
export interface RowsOpts { where?: Record<string, string | number>; orderBy?: string; limit?: number; offset?: number }
export interface Q<T> { data: T | undefined; isLoading?: boolean; isPending?: boolean; isError?: boolean; error?: unknown; isFetching?: boolean }

export function useCatalog(o?: Opts) { return raw.useCatalog(useDataLayer(), o); }
export function useRows(table: TableName, opts: RowsOpts, o?: Opts) { return raw.useRows(useDataLayer(), table, opts, o); }
export function useRecord(table: TableName, id: string, o?: Opts) { return raw.useRecord(useDataLayer(), table, id, o); }
export function useRelations(table: TableName, id: string, row: Row, o?: Opts) { return raw.useRelations(useDataLayer(), table, id, row, o); }
export function useRun() { return raw.useRun(useDataLayer()); }
/**
 * Same cache key as src/data/hooks.ts, but each row is copied. The result store patches stored rows in place after an
 * edit, so without the copy TanStack sees "no change" (same objects) and the grid never re-renders. See docs/FINDINGS.md.
 */
export function useResultRows(runId: string, offset: number, limit: number, o?: Opts) {
  const layer = useDataLayer();
  return useQuery({
    queryKey: [...layer.keys.result(runId), offset, limit],
    queryFn: () => layer.api.resultRows(runId, offset, limit).map((r) => ({ ...r })),
    enabled: !o?.paused,
    subscribed: !o?.paused,
  }, layer.queryClient);
}
export function useUpdateRow() { return raw.useUpdateRow(useDataLayer()); }

export const isLoading = (q: Q<unknown>) => !!(q.isLoading ?? q.isPending) && q.data === undefined;
export const errorText = (q: { error?: unknown }) => {
  const e = q.error; if (!e) return null;
  return e instanceof Error ? e.message : String(e);
};
