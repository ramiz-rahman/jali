/**
 * The framework-free half of `popOut()`: a pane in a floating window that stays on top. Core keeps what is the same
 * for any adapter (allowing it, the words, closing the window when the instance stops; "Pop out pane" is in core's
 * commands, through the window); the
 * adapter brings the window itself (`jali-layout/pop-out` gives React's), which is the instance's own: one per instance.
 */
import type { NodeId } from "../layout/types";
import { popOutEn } from "../state/feature-messages";
import type { JaliStore } from "../state/store";
import type { AdapterParts, Feature } from "./feature";

/** How an adapter pops a pane of an instance out, and brings it back. */
export interface PopOutWindow {
  /** Whether this browser can (Document Picture-in-Picture: Chrome and Edge on desktop). */
  can(): boolean;
  /** Pop pane `pane` of `store`'s instance out. Resolves `false` when it can't or the browser refused. */
  open(store: JaliStore, pane: NodeId): Promise<boolean>;
  /** Bring the instance's popped-out pane back, and close its window. Nothing when none is out. */
  close(store: JaliStore): void;
  /** The pane popped out of `store`'s instance, if any. */
  pane(store: JaliStore): NodeId | undefined;
}

export const popOutFeature = (window: PopOutWindow, parts?: AdapterParts): Feature => ({
  id: "popOut",
  words: popOutEn,
  // The window closes when the instance stops: unmounted, destroyed, or another instance in its root's place.
  start: (store) => () => window.close(store),
  services: { popOutWindow: window },
  ...(parts ? { parts } : {}),
});
