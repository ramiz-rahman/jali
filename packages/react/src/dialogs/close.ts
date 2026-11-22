/**
 * How a dialog ends with a choice (⌘K's command, the chooser's item): it closes, and what was chosen runs once the
 * dialog has unmounted and given focus back to where it found it, on the next task, so a command that reads or moves
 * focus acts on the pane. The choice is the person's: it still runs if the instance only unmounted meanwhile, and is
 * dropped if the instance ended (`destroy()`), which nothing can act on any more.
 */
import type { JaliStore } from "@jali/core/adapter";

export function closeThen(store: JaliStore, close: () => void, run: () => void): void {
  close();
  setTimeout(() => {
    if (!store.ended()) run();
  }, 0);
}
