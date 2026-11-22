import type { ViewState } from "@jali/core";
import type { Model } from "@jali/core/adapter";
import { useEffect, useRef } from "react";
import type { JaliStore } from "@jali/core/adapter";
import { restoreWide, snapshotWide, type WideSnapshot } from "@jali/core/adapter";

/**
 * Says when single view starts and ends, and restores the wide arrangement when it ends. The arrangement seen on the
 * last wide render is frozen when single view starts.
 */
export function useSingleView(store: JaliStore, m: Model, view: ViewState, measured: boolean) {
  const was = useRef<boolean | null>(null);
  const wide = useRef<WideSnapshot | null>(null);
  const frozen = useRef<WideSnapshot | null>(null);
  useEffect(() => {
    if (was.current !== null && was.current !== m.onePane) {
      if (m.onePane) frozen.current = wide.current;
      else if (frozen.current) {
        store.apply(restoreWide(store.snapshot(), frozen.current));
        frozen.current = null;
      }
      const said = store.messages.announcements;
      store.announce(m.onePane ? said.onePaneOn : said.onePaneOff);
    }
    was.current = m.onePane;
  }, [m.onePane, store]);
  useEffect(() => {
    if (!m.onePane && measured) wide.current = snapshotWide(m, view);
  });
}
