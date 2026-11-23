/** The queue's applications in order: what waits for a decision first (model/statuses.ts), then by number. */
import { useMemo } from "react";
import { useBookRows } from "../../data";
import { isWaiting, queueOrder } from "../../model/statuses";
import { MAX_APPLICATIONS } from "../../parties";

/** The queue's applications in order, and how many wait. */
export function useQueue() {
  const apps = useBookRows("loan_applications", { orderBy: "id ASC", limit: MAX_APPLICATIONS });
  return useMemo(() => {
    const rows = [...(apps ?? [])].sort(queueOrder);
    return { rows, waiting: rows.filter(isWaiting).length };
  }, [apps]);
}
