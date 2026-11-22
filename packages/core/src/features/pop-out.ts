/**
 * The framework-free half of `popOut()`: a pane in a floating window that stays on top. Core keeps what is the same
 * for any adapter (allowing it, "Pop out pane" in ⌘K, the words, closing the window when the workspace stops); the
 * adapter brings the window itself (`jali/pop-out` gives React's), which is the instance's own: one per workspace.
 */
import type { NodeId } from "../layout/types";
import { popOutEn } from "../state/feature-messages";
import { refuse } from "../state/apply";
import { also, needFocus } from "../commands/registry";
import type { JaliStore } from "../state/store";
import { featureCommand, type Feature } from "./feature";

/** How an adapter pops a pane of a workspace out, and brings it back. */
export interface PopOutWindow {
  /** Whether this browser can (Document Picture-in-Picture: Chrome and Edge on desktop). */
  can(): boolean;
  /** Pop pane `pane` of `store`'s workspace out. Resolves `false` when it can't or the browser refused. */
  open(store: JaliStore, pane: NodeId): Promise<boolean>;
  /** Bring the workspace's popped-out pane back, and close its window. Nothing when none is out. */
  close(store: JaliStore): void;
  /** The pane popped out of `store`'s workspace, if any. */
  pane(store: JaliStore): NodeId | undefined;
}

export const popOutFeature = (
  window: PopOutWindow,
  parts?: Readonly<Record<string, unknown>>,
): Feature => ({
  id: "popOut",
  words: popOutEn,
  commands: (env) => [
    featureCommand(
      "pane.pop_out",
      "pane.fullscreen",
      (m) => m.commands.popOut,
      "pane",
      (u) => {
        const id = u.get().view.focused;
        if (id) void window.open(u, id);
      },
      also((x) => needFocus(x) ?? (window.can() ? undefined : refuse("unavailable")), "popOut"),
    )(env),
  ],
  // The window closes when the workspace stops: unmounted, destroyed, or another workspace in its root's place.
  start: (store) => () => window.close(store),
  parts: { ...parts, popOutWindow: window },
});
