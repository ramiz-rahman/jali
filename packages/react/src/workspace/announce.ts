/** What the panes say when the room changes them. */
import { useEffect, useRef } from "react";
import type { JaliStore, ModelGeometry } from "@jali/core/adapter";

/** Says which panes folded into tabs, or unfolded, when the room changed (not in single view, where nothing tiles).
 *  Only a change of room: an action that folds says so itself, in its own words. */
export function useFoldAnnouncements(
  store: JaliStore,
  m: ModelGeometry,
  area: { width: number; height: number },
) {
  const prev = useRef<{ folded: string[]; room: string } | null>(null);
  useEffect(() => {
    const room = `${area.width}x${area.height}`;
    if (prev.current !== null && area.width > 0 && !m.onePane && prev.current.room !== room) {
      const was = prev.current.folded,
        before = new Set(was),
        now = new Set(m.folded);
      const added = m.folded.filter((id) => !before.has(id)),
        removed = was.filter((id) => !now.has(id) && m.pane(id));
      const said = store.messages.announcements;
      // The names as they are now: the geometry has none of its own.
      const { title } = store.model();
      if (added.length) store.announce(said.folded(added.map(title)));
      else if (removed.length) store.announce(said.unfolded(removed.map(title)));
    }
    prev.current = { folded: m.folded, room };
  });
}
