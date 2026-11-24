/**
 * What the hero's side panel shows: the map, the JSON, both, or nothing. The reader's choice is remembered on this
 * device (the page works the same when storage is blocked); the tour can show a view for a while without changing it.
 */
import { useEffect, useRef, useState } from "react";
import { readStored, STORAGE_KEYS, writeStored } from "../../ui/lib/storage";

export type SideView = "map" | "json" | "both" | "closed";
const VIEWS: readonly string[] = ["map", "json", "both", "closed"];

export function useSidePanel() {
  const [view, setView] = useState<SideView>("map");
  const chosen = useRef<SideView>("map");
  // After hydration: the prerendered page shows the map, whatever this reader chose.
  useEffect(() => {
    const v = readStored(STORAGE_KEYS.treePanel);
    if (v && VIEWS.includes(v)) {
      chosen.current = v as SideView;
      setView(v as SideView);
    }
  }, []);
  return {
    view,
    /** The reader picks a view: shown and remembered. */
    choose(v: SideView) {
      chosen.current = v;
      setView(v);
      writeStored(STORAGE_KEYS.treePanel, v);
    },
    /** A view for a while (the tour), not remembered; `null` goes back to the reader's choice. */
    showFor(v: SideView | null) {
      setView(v ?? chosen.current);
    },
  };
}
