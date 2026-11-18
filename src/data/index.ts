import { PGlite } from "@electric-sql/pglite";
import { QueryClient, hashKey } from "@tanstack/react-query";
import { sampleDatabaseStatements } from "./sample-sql";
import { createResultStore } from "./result-store";
import { createCatalog } from "./catalog";
import { createDataApi, createEntities } from "./entities";
import { keys } from "./keys";
import type { DataLayer, EntityKey, TableName } from "./types";
export type * from "./types";

const key = (e: EntityKey) => `${e.table}:${e.id}`;

export function createDataLayer(): DataLayer {
  const db = new PGlite();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  let fetches = 0,
    cacheHits = 0,
    init: Promise<void> | undefined;
  const index = new Map<string, Set<string>>();
  const primaryKeys = new Map<TableName, string[]>();
  const results = createResultStore();
  const call = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    fetches++;
    return db.query<T>(sql, params);
  };
  const ready = () =>
    (init ??= (async () => {
      fetches++;
      await db.exec(sampleDatabaseStatements("postgres").join("\n"));
    })());
  const { catalog, info } = createCatalog(ready, call, primaryKeys, () => {
    cacheHits++;
  });
  const { entity, entities } = createEntities(info, primaryKeys);
  const track = (queryKey: readonly unknown[], entries: EntityKey[]) =>
    index.set(hashKey(queryKey), new Set(entries.map(key)));
  const api = createDataApi({
    ready,
    catalog,
    info,
    call,
    primaryKeys,
    entity,
    entities,
    track,
    results,
    onCacheHit: () => {
      cacheHits++;
    },
  });
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed") index.delete(event.query.queryHash);
    if (event.type === "observerAdded" && event.query.state.data !== undefined) cacheHits++;
  });
  return {
    api,
    keys,
    queryClient,
    async invalidateEntities(changed) {
      const ids = new Set(changed.map(key));
      const tables = new Set(changed.map((e) => e.table));
      for (const e of changed)
        for (const ref of (await info(e.table)).referencedBy) tables.add(ref.table);
      await queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] === "rows" && tables.has(q.queryKey[1] as TableName)) ||
          [...(index.get(hashKey(keys.trackingKey(q.queryKey))) ?? [])].some((e) => ids.has(e)),
      });
    },
    stats: () => ({ fetches, cacheHits }),
  };
}
