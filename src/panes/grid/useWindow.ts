import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataLayer } from "../../data/react";
import type { Row, RowsQuery, TableName } from "../../data/types";

export const PAGE = 200;
const STEP = PAGE / 2;

export function useWindow(
  source: {
    key: string;
    queryKey(offset: number): readonly unknown[];
    fetch(offset: number): Promise<{ rows: Row[]; total: number } | Row[]>;
    total?: number;
  },
  paused: boolean,
) {
  const layer = useDataLayer();
  const [position, setPosition] = useState({ key: source.key, start: 0 });
  const start = position.key === source.key ? position.start : 0;
  const onRange = useCallback(
    (s: number) =>
      setPosition((current) => {
        const next = Math.floor(s / STEP) * STEP;
        return current.key === source.key && current.start === next
          ? current
          : { key: source.key, start: next };
      }),
    [source.key],
  );
  const select = useCallback(
    (data: { rows: Row[]; total: number } | Row[]) =>
      Array.isArray(data) ? { rows: data, total: source.total ?? data.length } : data,
    [source.total],
  );
  const q = useQuery(
    {
      queryKey: source.queryKey(start),
      queryFn: () => source.fetch(start),
      select,
      enabled: !paused,
      subscribed: !paused,
    },
    layer.queryClient,
  );
  const last = useRef<{ key: string; rows: Row[]; offset: number; total: number } | null>(null);
  if (q.data)
    last.current = { key: source.key, rows: q.data.rows, offset: start, total: q.data.total };
  const data = last.current?.key === source.key ? last.current : null;
  return { q, rows: data?.rows ?? [], offset: data?.offset ?? 0, total: data?.total ?? 0, onRange };
}

export function useWindowRows(
  table: TableName,
  base: Omit<RowsQuery, "limit" | "offset">,
  paused: boolean,
) {
  const layer = useDataLayer();
  return useWindow(
    {
      key: JSON.stringify([table, base]),
      queryKey: (offset) => layer.keys.rows(table, { ...base, limit: PAGE, offset }),
      fetch: (offset) => layer.api.rows(table, { ...base, limit: PAGE, offset }),
    },
    paused,
  );
}

export function useResultWindow(runId: string, total: number, paused: boolean) {
  const layer = useDataLayer();
  return useWindow(
    {
      key: runId,
      queryKey: (offset) => layer.keys.resultPage(runId, offset, PAGE),
      fetch: async (offset) => layer.api.resultRows(runId, offset, PAGE),
      total,
    },
    paused,
  );
}
