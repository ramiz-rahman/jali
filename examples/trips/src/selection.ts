/**
 * The place selected on the map, for any component to read and mark ("the place"): the map pane's selection in
 * Jali's state, so it changes with every pin, stop or result the person picks (actions.ts, `selectPlace`).
 */
import { useJali, useJaliState } from "@jali/react";

export function useCurrent(): string | null {
  const jali = useJali();
  return useJaliState((s) => {
    // The hub is the first map pane in the layout. Reading the model here is cheap: it is cached per change.
    const hub = jali.model().panes.find((p) => p.ref.kind === "map");
    const ref = hub ? s.selection[hub.id]?.ref : undefined;
    return ref?.kind === "place" ? String(ref.params.id) : null;
  });
}
