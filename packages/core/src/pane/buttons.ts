/**
 * The buttons in a pane's header: shortcuts, not permissions. What may happen is `allow`'s to say, and everything
 * allowed is in the pane's menu (right-click, ⋯, Shift+F10) and ⌘K; the header shows a few of those as buttons.
 *
 * Leave `buttons` out and Jali chooses: Tuck, Maximise, Pop out and Close, with Full screen in Maximise's place where
 * there is nothing to maximise over (a lone pane). Pop out shows only where `allow.popOut` turns it on. An instance (`createJali({ buttons })`) and then a kind
 * (`definePane({ buttons })`) can replace the list, or adjust it with a function given the defaults. `allow` and Jali's
 * own rules still filter it, and the way out of a state (Restore, Exit full screen, Bring back) shows whatever the list
 * says.
 */
import type { NodeId, PaneNode } from "../layout/types";
import type { ViewMode } from "../profile";
import type { Snapshot } from "../state/apply";
import { refusalIn } from "../actions";
import type { Chrome } from "./chrome";

/** A button a pane's header can show. */
export type PaneButton = "tuck" | "maximise" | "fullScreen" | "popOut" | "close";

/** What a `buttons` function is told about the pane. */
export interface ButtonsContext {
  pane: PaneNode;
  /** The preset the layout came from, if it did. */
  presetId?: string;
  /** The curated page, while one is open. */
  page?: { mode: ViewMode; item?: string } | null;
}

/** A header's buttons, in order: a list, or a function that adjusts the defaults (`(d) => d.filter((b) => b !== "tuck")`). */
export type PaneButtons =
  | readonly PaneButton[]
  | ((defaults: readonly PaneButton[], ctx: ButtonsContext) => readonly PaneButton[]);

/** Jali's choice, where maximise is possible. Pop out is filtered out unless `allow.popOut` turns it on. */
export const DEFAULT_BUTTONS: readonly PaneButton[] = ["tuck", "maximise", "popOut", "close"];

/** What the pane is doing, as the header sees it. */
export interface ButtonsState {
  chrome: Chrome;
  zoomed: boolean;
  full: boolean;
  /** The header holds a tab strip (each tab has its own ×). */
  tabs: boolean;
  /** The pane is in a floating window: its way back (Bring back) shows, whatever `allow` says now. */
  popped?: boolean;
}

/** The buttons pane `id`'s header shows, in order: the defaults, the instance's, the kind's; then what is possible. */
export function buttonsOf(x: Snapshot, id: NodeId, st: ButtonsState): PaneButton[] {
  const pane = x.m.pane(id);
  if (!pane) return [];
  const { chrome, zoomed, full, tabs, popped = false } = st;
  // Where Maximise has nothing to do (a lone pane), Full screen takes its place.
  let list: readonly PaneButton[] =
    !chrome.zoomable && chrome.fullScreenable
      ? DEFAULT_BUTTONS.map((b) => (b === "maximise" ? "fullScreen" : b))
      : DEFAULT_BUTTONS;
  const ctx: ButtonsContext = {
    pane,
    ...(x.s.presetId ? { presetId: x.s.presetId } : {}),
    page: x.s.page
      ? { mode: x.s.page.mode, ...(x.s.page.item ? { item: String(x.s.page.item) } : {}) }
      : null,
  };
  for (const spec of [x.env.buttons, x.env.kinds.get(pane.ref.kind)?.buttons])
    if (spec) list = typeof spec === "function" ? spec(list, ctx) : spec;
  const out = [...new Set(list)];
  // The way out of a state always shows: Restore, Exit full screen.
  const way = (b: PaneButton) => {
    if (out.includes(b)) return;
    const close = out.indexOf("close");
    out.splice(close < 0 ? out.length : close, 0, b);
  };
  if (full) way("fullScreen");
  else if (zoomed) way("maximise");
  if (popped) way("popOut");
  return out.filter((b) => {
    switch (b) {
      // The header decides what it shows; whether the action can happen is its step's (`can`). A tuck the app
      // allows always shows: when it can't happen now, the header says why on a disabled button.
      case "tuck":
        return chrome.tuckable && !zoomed && refusalIn(x, "tuck", id)?.reason !== "not-allowed";
      case "maximise":
        return chrome.zoomable && !full && !refusalIn(x, "toggleZoom", id);
      case "fullScreen":
        return chrome.fullScreenable && !refusalIn(x, "toggleFullScreen", id);
      case "close":
        return (
          (chrome.closeWithTabs || !tabs) && refusalIn(x, "close", id)?.reason !== "not-allowed"
        );
      case "popOut":
        // The adapter says whether the browser can; here, whether the app allows it.
        return popped || refusalIn(x, "popOut", id)?.reason !== "not-allowed";
      default:
        return false;
    }
  });
}
