/**
 * A pane's actions, built once for both of its views: its menu (TabMenu, from ⋯ or its tab) lists them, and its header
 * (HeaderActions) reads them to know what a narrow header can move into ⋯ and whether ⋯ shows. One builder, so an
 * action moved from a button into the menu is the same action there.
 */
import type { NodeId } from "@jali/core";
import { allows, tabMenuOf, type JaliStore, type TabMenuItem } from "@jali/core/adapter";
import { popOutOf } from "./popped";

/**
 * Pane `id`'s menu, in groups: its tab's menu (tabMenuOf), with Pop out beside Maximise and Full screen where the
 * browser can (`can`; the header passes its hydration-safe answer) and the app allows it. While the pane is out it is
 * Bring back, which closes the window, offered whatever `allow` says now, as Restore and Exit full screen are.
 */
export function paneActionsOf(
  store: JaliStore,
  id: NodeId,
  can = !!popOutOf(store)?.can(),
): TabMenuItem[][] {
  const g = tabMenuOf(store, id);
  const w = popOutOf(store);
  const out = w?.pane(store) === id;
  if (w && can && (out || allows(store.snapshot(), id, "popOut"))) {
    const item: TabMenuItem = out
      ? { id: "pop-out", title: store.messages.pane.bringBack, run: () => w.close(store) }
      : { id: "pop-out", title: store.messages.tabs.popOut, run: () => void w.open(store, id) };
    const near = g.find((group) => group.some((i) => i.id === "full-screen" || i.id === "zoom"));
    if (near) near.push(item);
    else g.push([item]);
  }
  return g;
}
