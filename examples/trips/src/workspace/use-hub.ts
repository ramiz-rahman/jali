/**
 * The hub (hub.ts) for components: the place selected on the map, and the day the map shows, each re-rendering only
 * when it changes. Reading the model inside a state selector is cheap: Jali caches it per change.
 */
import { useJali, useJaliState } from "jali/react";
import { hubOf, selectedPlace } from "./hub";
import { WHOLE_TRIP } from "./refs";

/** The place selected on the map ("the place"), if any. */
export function useSelectedPlace(): string | null {
  const jali = useJali();
  return useJaliState((s) => selectedPlace(s, jali.model()));
}

/**
 * The day the map shows, for "the day's centre": its own day; Day 1 while it shows the whole trip, which has no one
 * centre (or while there is no map).
 */
export function useMapDay(): number {
  const jali = useJali();
  const day = useJaliState(() => Number(hubOf(jali.model())?.ref.params.day ?? WHOLE_TRIP));
  return day === WHOLE_TRIP ? 1 : day;
}
