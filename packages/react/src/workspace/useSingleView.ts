import { useEffect, useRef } from "react";
import type { ViewState, WorkspaceModel, UiStore } from "@jali/core/adapter";
import { msg, restoreWide, snapshotWide, type WideSnapshot } from "@jali/core/adapter";

/**
 * Says when single view starts and ends, and restores the wide arrangement when it ends. The arrangement seen on the
 * last wide render is frozen when single view starts.
 */
export function useSingleView(store: UiStore, m: WorkspaceModel, view: ViewState, measured: boolean) {
  const was = useRef<boolean | null>(null);
  const wide = useRef<WideSnapshot | null>(null);
  const frozen = useRef<WideSnapshot | null>(null);
  useEffect(() => {
    if (was.current !== null && was.current !== m.single) {
      if (m.single) frozen.current = wide.current;
      else if (frozen.current) {
        store.apply(restoreWide(store.snapshot(), frozen.current));
        frozen.current = null;
      }
      store.announce(m.single ? msg.singleOn : msg.singleOff);
    }
    was.current = m.single;
  }, [m.single, store]);
  useEffect(() => {
    if (!m.single && measured) wide.current = snapshotWide(m, view);
  });
}
