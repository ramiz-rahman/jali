import type { Row, TableName } from "./types";

export interface StoredResult {
  rows: Row[];
  table?: TableName;
}
/** A run id this visit has no result for: from an earlier visit (a link, a reload), so its result is gone. */
export class UnknownRun extends Error {
  constructor(readonly runId: string) {
    super("This result was from an earlier visit: results are kept only while the page is open.");
    this.name = "UnknownRun";
  }
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
