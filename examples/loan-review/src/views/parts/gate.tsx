/**
 * A designed view's gate: while its read loads or fails, the pane says so (`PaneGate`, with a retry) and reports its
 * activity; once the data is there, the view renders with it.
 */
import type { ReactNode } from "react";
import { useActivity } from "jali-layout/react";
import { PaneGate } from "@jali-examples/shared/panes/shared/PaneGate";
import type { Read } from "../../data";

export function Loaded<T>({
  query,
  gone,
  children,
}: {
  query: Read<T | null>;
  /** What a record that isn't there is called ("Borrower 4"). */
  gone?: string;
  /** The view, given the data. */
  children: (data: T) => ReactNode;
}) {
  useActivity(query.isLoading ? "loading" : query.isError ? "error" : "idle");
  if (query.isLoading || query.isError || query.data == null)
    return (
      <PaneGate
        queries={[query]}
        gone={gone}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return children(query.data);
}
