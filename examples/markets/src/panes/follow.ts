/**
 * One watchlist, several followers. Jali moves a list's following detail when the list selects a ref of that
 * detail's kind: the watchlist selects `quote({ symbol })`, so its following quote moves by itself. The chart, book,
 * trades and news that follow it catch up here: each reads the list's selection and asks Jali to show the same
 * symbol in it, after the pause Jali uses itself, so holding J doesn't redraw every row on the way.
 *
 * Unpinning a follower makes it follow again, and this catches it up with the list at once.
 */
import { useEffect } from "react";
import type { ObjectRef } from "@jali/core";
import { useJali, useJaliState, usePane } from "@jali/react";

const REST_MS = 150;

export function useFollowSymbol(
  kind: (params: { symbol: string }) => ObjectRef,
  symbol: string | undefined,
) {
  const { node, inPeek } = usePane();
  const jali = useJali();
  const source = node.follows && !inPeek ? node.linkedTo : undefined;
  const selected = useJaliState((s) =>
    source ? s.selection[source]?.ref.params.symbol : undefined,
  );

  useEffect(() => {
    if (!source || typeof selected !== "string" || selected === symbol) return;
    const timer = setTimeout(
      () => jali.actions.follow(source, kind({ symbol: selected })),
      REST_MS,
    );
    return () => clearTimeout(timer);
  }, [jali, kind, source, selected, symbol]);
}
