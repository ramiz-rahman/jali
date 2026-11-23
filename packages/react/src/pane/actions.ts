/**
 * A pane's actions, one model for both of its views. Its menu (TabMenu, from ⋯ or its tab) lists them, with the app's
 * items after Jali's. Its header (HeaderActions) reads Jali's own to know what a narrow header can move into ⋯, and
 * runs the same action from its button. The app's `tabMenu` runs only to build a menu, or when nothing else says
 * whether the header needs ⋯.
 */
import type { NodeId } from "@jali/core";
import {
  can,
  appMenuOf,
  paneMenuOf,
  type JaliStore,
  type PaneMenuId,
  type TabMenuItem,
} from "@jali/core/adapter";
import { popOutOf } from "./popped";

/** The ids of Jali's own items in a pane's menu, Pop out (the React feature's) among them. */
export type PaneActionId = PaneMenuId | "pop-out";

/** One of Jali's own items in a pane's menu. */
export interface PaneAction extends TabMenuItem {
  id: PaneActionId;
}

/**
 * Pop out where the browser can (`browser`; the header passes its hydration-safe answer) and the app allows it. While the
 * pane is out it is Bring back, which closes the window, offered whatever `allow` says now, as Restore and Exit full
 * screen are. Undefined without the `popOut()` feature.
 */
export function popOutItem(
  store: JaliStore,
  id: NodeId,
  browser = !!popOutOf(store)?.can(),
): PaneAction | undefined {
  const w = popOutOf(store);
  if (!w || !browser) return undefined;
  const out = w.pane(store) === id;
  // The browser's part is `browser`'s; the app's is the step's.
  if (!out && can(store, "popOut", id).reason === "not-allowed") return undefined;
  return out
    ? { id: "pop-out", title: store.messages.pane.bringBack, run: () => w.close(store) }
    : { id: "pop-out", title: store.messages.tabs.popOut, run: () => void w.open(store, id) };
}

/** Jali's own items for pane `id`'s menu, in groups, with Pop out beside Maximise and Full screen. No app code runs. */
export function paneActionsOf(store: JaliStore, id: NodeId, can?: boolean): PaneAction[][] {
  const groups: PaneAction[][] = paneMenuOf(store, id);
  const pop = popOutItem(store, id, can);
  if (pop) {
    const near = groups.find((g) => g.some((i) => i.id === "full-screen" || i.id === "zoom"));
    if (near) near.push(pop);
    else groups.push([pop]);
  }
  return groups;
}

/** Pane `id`'s whole menu: Jali's items, then the app's (`createJali({ tabMenu })`). */
export function paneMenu(store: JaliStore, id: NodeId): TabMenuItem[][] {
  const groups: TabMenuItem[][] = paneActionsOf(store, id);
  const app = appMenuOf(store, id);
  return app.length ? [...groups, app] : groups;
}
