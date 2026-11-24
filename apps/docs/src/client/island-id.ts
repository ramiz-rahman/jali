/**
 * What the build and the browser agree on about islands (src/shell/island.tsx, src/client/islands.ts): their names,
 * when each hydrates, and the prefix of React's ids in each, so an island's `useId` values match on both sides.
 */
export type IslandName =
  | "TreeView"
  | "Hero"
  | "Frame"
  | "Spotlight"
  | "QuickstartApp"
  | "LinkDemo"
  | "FollowDemo"
  | "KeysDemo";

/** "visible": when it is about to scroll into view (the default). "load": at once. */
export type IslandWhen = "visible" | "load";

/** The prefix for React's ids in island `n`. */
export const islandPrefix = (n: number | string) => `i${n}-`;
