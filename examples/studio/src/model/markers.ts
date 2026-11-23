/** Markers are kept in time order, everywhere: the list, the ruler's flags, the transcript's section headings. */
import type { MarkerData, SessionData } from "../sessions/types";

/** `markers` in time order, as a new list. */
export const byTime = (markers: readonly MarkerData[]): MarkerData[] =>
  [...markers].sort((a, b) => a.time - b.time);

/** A session's markers: the person's, once they have changed them, else the session's own, in time order. */
export const markersOf = (session: SessionData, edits: { markers: MarkerData[] | null }) =>
  edits.markers ?? byTime(session.markers);

/** `markers` with `marker` in its place: added, or put back over one with its id. */
export const withMarker = (markers: readonly MarkerData[], marker: MarkerData): MarkerData[] =>
  byTime([...markers.filter((m) => m.id !== marker.id), marker]);

/** The last marker at or before `time`, or -1. */
export function markerIndexAt(markers: readonly MarkerData[], time: number): number {
  let at = -1;
  markers.forEach((m, i) => {
    if (m.time <= time + 0.05) at = i;
  });
  return at;
}
