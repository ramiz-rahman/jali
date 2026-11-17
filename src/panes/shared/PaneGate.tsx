import type { ReactNode } from "react";
import { errorText, isLoading, type Q } from "../../data/hooks";
import { ErrorState, Gone, Loading, Shell } from "./states";

export function PaneGate({ queries, gone, onRetry, children }: {
  queries: Q<unknown>[]; gone?: string; onRetry?: () => void; children?: ReactNode;
}) {
  if (queries.some(isLoading)) return <Shell><Loading /></Shell>;
  const failure = queries.find(q => q.isError);
  if (failure) return <Shell><ErrorState message={errorText(failure) ?? ""} onRetry={onRetry} /></Shell>;
  if (gone) return <Shell><Gone what={gone} /></Shell>;
  return children ?? null;
}
