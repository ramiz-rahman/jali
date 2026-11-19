import type { Row, TableName } from "./types";

export interface StoredResult {
  rows: Row[];
  table?: TableName;
}
export function createResultStore() {
  const results = new Map<string, StoredResult>();
  return {
    set(runId: string, result: StoredResult) {
      results.set(runId, result);
    },
    get(runId: string) {
      return results.get(runId);
    },
    values() {
      return results.values();
    },
  };
}
