import { useMutation, useQuery } from '@tanstack/react-query';
import type { DataLayer, Row, TableName } from './types';

type Pause = { paused?: boolean };
type RowsOptions = { where?: Record<string, string | number>; orderBy?: string; limit?: number; offset?: number };
const activity = (options?: Pause) => ({ enabled: !options?.paused, subscribed: !options?.paused });
export function useCatalog(layer: DataLayer, options?: Pause) {
  return useQuery({ queryKey: layer.keys.catalog(), queryFn: () => layer.api.catalog(), ...activity(options) }, layer.queryClient);
}
export function useRows(layer: DataLayer, table: TableName, opts: RowsOptions = {}, options?: Pause) {
  return useQuery({ queryKey: layer.keys.rows(table, opts), queryFn: () => layer.api.rows(table, opts), ...activity(options) }, layer.queryClient);
}
export function useRecord(layer: DataLayer, table: TableName, id: string, options?: Pause) {
  return useQuery({ queryKey: layer.keys.record(table, id), queryFn: () => layer.api.record(table, id), ...activity(options) }, layer.queryClient);
}
export function useRelations(layer: DataLayer, table: TableName, id: string, row: Row, options?: Pause) {
  return useQuery({ queryKey: layer.keys.relations(table, id), queryFn: () => layer.api.relations(table, row), ...activity(options) }, layer.queryClient);
}
export function useRun(layer: DataLayer) {
  return useMutation({ mutationFn: (sql: string) => layer.api.run(sql) }, layer.queryClient);
}
export function useResultRows(layer: DataLayer, runId: string, offset: number, limit: number, options?: Pause) {
  return useQuery({ queryKey: [...layer.keys.result(runId), offset, limit], queryFn: () => layer.api.resultRows(runId, offset, limit), ...activity(options) }, layer.queryClient);
}
export function useUpdateRow(layer: DataLayer) {
  return useMutation({ mutationFn: ({ table, id, patch }: { table: TableName; id: string; patch: Row }) => layer.api.updateRow(table, id, patch), onSuccess: changed => layer.invalidateEntities(changed) }, layer.queryClient);
}
