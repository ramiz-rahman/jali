/**
 * The actions an app calls: `jali.actions`, `jali.page` (with a curated page) and `jali.dialogs`. One convention for
 * all of them (docs/DECISIONS.md, 19 Nov 2026):
 *
 *  - The pane comes first. An action that acts on a pane takes it as its first argument: a pane id, or the object
 *    it shows (a ref, such as `order({ id: 7 })`), which means the pane showing that object. The pane is optional
 *    (the focused pane) only when nothing required follows it.
 *  - What the action uses comes next (`openBeside(pane, ref)`); options come last, in an object.
 *  - Every action returns an `ActionResult`: `{ ok: true, pane }` when it happened, or `{ ok: false, reason }` when it
 *    did not. Announcements are unchanged: a refusal that is read out today still is, and `message` is that text.
 *  - Nothing it is given makes it throw. A ref is checked once, before any step sees it: a kind the instance doesn't
 *    have, or params that aren't text, numbers or flags, is `"invalid"`, with what is wrong as `message`. A pane named
 *    by something that is neither an id nor a ref is `"invalid"` too.
 *
 * Each is a step of the one table (actions/index.ts), committed once. `R` is the refs of the instance's kinds
 * (`createJali` infers it), so a ref of a kind it doesn't have is a type error.
 */
import type { Edge, NodeId, ObjectRef } from "../layout/types";
import type { ItemId, ViewMode } from "../profile";
import type { ActionResult, Snapshot } from "../state/apply";
import type { Settings } from "../state/settings";
import { sameRef } from "./follow";
import { openPaneFor, type OpenBesideOptions } from "./open";
import type { ChooseOptions } from "./choose";
import { checkRef } from "../pane-kinds";

/** A pane, by its id or by the object it shows. */
export type PaneTarget<R extends ObjectRef = ObjectRef> = NodeId | R;

/** Where `jali.page.open` opens the curated page. */
export interface OpenPageOptions<I extends ItemId = ItemId> {
  /** The item it shows. Default: the one it showed last, else the page's `firstItem`. */
  item?: I;
  /** The view (a role id) Single view shows. Default: the last one, else the page's home view. */
  tab?: string;
}

/** `R`: the refs of the instance's kinds. */
export interface JaliActions<R extends ObjectRef = ObjectRef> {
  // ---------- focus ----------
  /** Focus a pane, and show it: a pane that is folded, tucked or behind another tab has its tab chosen (nothing else
   *  moves), and while another pane is maximised, this one is maximised instead. */
  focus(pane: PaneTarget<R>): ActionResult;
  /** Maximise a pane (default: the focused one), or restore it. */
  toggleZoom(pane?: PaneTarget<R>): ActionResult;
  /** Put a pane (default: the focused one) on the whole screen: maximised, with the page in the browser's full
   *  screen where it allows. Again, or Escape, puts it back. Where the browser has no full screen (an iPhone), the
   *  pane still covers the page. */
  toggleFullScreen(pane?: PaneTarget<R>): ActionResult;

  // ---------- open ----------
  /** Open `ref` beside `pane`. Focus stays in `pane`. If `ref` is already open, that pane is shown instead.
   *  `edge`: the side of `pane` it opens on, as on screen (`"bottom"`: below it). Default: after `pane`. */
  openBeside(pane: PaneTarget<R>, ref: R, options?: OpenBesideOptions): ActionResult;
  /** Show `ref` in `pane`, in place. If `ref` is open elsewhere, that pane is focused instead. */
  openHere(pane: PaneTarget<R>, ref: R): ActionResult;
  /** Show `ref` in the peek sheet, for `pane`. Its following detail shows it instead, when one is on screen. */
  peek(pane: PaneTarget<R>, ref: R): ActionResult;
  /** Close the peek sheet. */
  closePeek(): ActionResult;
  /** The item selected in a list `pane` (`null`: none). Its following detail and an open peek follow it. */
  select(pane: PaneTarget<R>, ref: R | null, options?: { inResults?: boolean }): ActionResult;
  /** Keep a linked detail on what it shows (`true`), or make it follow its list again (`false`). */
  setKept(pane: PaneTarget<R>, kept: boolean): ActionResult;
  /** A new pane beside `pane` (default: the focused one) with the launcher in it. `direction` default: right for a
   *  wide pane, below for a tall one. */
  split(pane?: PaneTarget<R>, direction?: "right" | "bottom"): ActionResult;
  /** The launcher as a new tab of `pane` (default: the focused one). */
  newTab(pane?: PaneTarget<R>): ActionResult;
  /** `ref` as a new tab of `pane`'s tabs, shown and focused. If `ref` is already open, that pane is shown instead. */
  addTab(pane: PaneTarget<R>, ref: R): ActionResult;

  // ---------- close ----------
  /** Close a pane (default: the focused one). Undo brings it back. */
  close(pane?: PaneTarget<R>): ActionResult;
  /** Close every pane but `pane` (default: the focused one). */
  closeOthers(pane?: PaneTarget<R>): ActionResult;
  /** Close the other tabs of `pane`'s group, or the tabs after it in reading order: one change, one Undo. */
  closeTabs(pane: PaneTarget<R>, which: "others" | "after"): ActionResult;
  /** Undo the last close or tuck. */
  undo(): ActionResult;
  /** Remove a pane whose object the app closed elsewhere: quietly, with no undo, and without asking (`beforeClose`
   *  and the unsaved-work question are not asked). The last pane becomes the launcher; without one it stays
   *  (`"last-pane"`). */
  remove(pane: PaneTarget<R>): ActionResult;

  // ---------- tuck, tabs and moving ----------
  /** Tuck a pane (default: the focused one) into its neighbour as a tab. */
  tuck(pane?: PaneTarget<R>): ActionResult;
  /** Put a tucked pane back where it was (default: the most recently tucked one). */
  putBack(pane?: PaneTarget<R>): ActionResult;
  /** Move a pane one step towards an edge. */
  move(pane: PaneTarget<R>, direction: Edge): ActionResult;
  /** Swap a pane (default: the focused one) with the next pane on screen. */
  swapWithNext(pane?: PaneTarget<R>): ActionResult;
  /**
   * Take a pane (default: the focused one) out of the row that scrolls holding it, beside the row on the side the
   * pane is nearer on screen. Nothing happens for a pane in no such row.
   */
  moveOutOfRow(pane?: PaneTarget<R>): ActionResult;
  /** Make `pane` a tab of `target` (or of `target`'s tabs). */
  mergeInto(pane: PaneTarget<R>, target: PaneTarget<R>): ActionResult;
  /** Move a tab (default: the focused pane) out of its tabs, to their right. */
  unmerge(pane?: PaneTarget<R>): ActionResult;
  /** Move a tab to position `index` (from 0) among its group's tabs, clamped. Its group keeps its place and size. */
  moveTab(pane: PaneTarget<R>, index: number): ActionResult;
  /** Pin a pane's tab, or unpin it: first in its group, and left open by Close other tabs and Close tabs to the right. */
  setPinned(pane: PaneTarget<R>, pinned: boolean): ActionResult;
  /** Open the rename field on a pane's tab or title (default: the focused pane). `"unavailable"` without
   *  `createJali({ rename })`, or when `rename.can` says no. */
  startRename(pane?: PaneTarget<R>): ActionResult;

  // ---------- layouts ----------
  /** Switch to the preset with this id: its `saved` layout if it has one, else its own. */
  preset(id: string): ActionResult;
  /** Rebuild the preset last chosen, as written (never its `saved` layout). */
  resetLayout(): ActionResult;
  /** Arrange every pane from the room there is and each kind's size hints: columns at the kinds' comfortable widths,
   *  a second row when the height allows, the rest as tabs beside the pane they were opened from. The same panes, so
   *  nothing reloads; Back returns to the arrangement before. `"unavailable"` on a curated page, `"nothing-to-do"`
   *  with one pane. */
  autoLayout(): ActionResult;

  // ---------- settings ----------
  /** Change the person's settings (saved on this device). */
  changeSettings(patch: Partial<Settings>): ActionResult;
}

/**
 * The curated page's actions: `jali.page`, there (and typed) only when `createJali({ page })` was given one. `I` is the
 * page's item type (its `firstItem`'s).
 */
export interface JaliPage<I extends ItemId = ItemId> {
  /** Open the curated page. */
  open(options?: OpenPageOptions<I>): ActionResult;
  /** Leave the curated page for the free layout. */
  leave(): ActionResult;
  /** Single view or Split view. */
  setMode(mode: ViewMode): ActionResult;
  /** Show one of the page's views (a role id), as a click on its tab does. */
  showView(view: string): ActionResult;
  /** Show another item: every view shows it. */
  showItem(item: I): ActionResult;
  /** Close the panes opened from the page's views. Undo reopens them. */
  back(): ActionResult;
  /** Put Split view back to the page's design. */
  reset(): ActionResult;
  /**
   * What following a link on the page does for this person: `"open"` opens a pane beside the views (Split view is
   * theirs to use), `"peek"` only peeks, in Single view. For a viewer who may look but not rearrange. Leaving the page
   * and coming back never widens it. `createJali({ linkMode })` sets the first.
   */
  setLinkMode(mode: LinkMode): ActionResult;
}

/** What following a link on a curated page does: open a pane beside the views, or only peek. */
export type LinkMode = "open" | "peek";

/** Jali's dialogs: `jali.dialogs`. */
export interface JaliDialogs {
  /** Ask the person for one item from `items`, in Jali's chooser (search, arrows, Enter, Esc). `onChoose` gets it once
   *  the chooser closes. For a command that needs an argument: "Open chart for…". */
  choose<T>(options: ChooseOptions<T>): ActionResult;
  /** Open ⌘K's command palette (with `palette: false`, the app's own menu shows the commands instead). */
  openPalette(): ActionResult;
  closePalette(): ActionResult;
  /** Open the settings panel. */
  openSettings(): ActionResult;
  closeSettings(): ActionResult;
}

/**
 * An action by its name: in `jali.actions` (`"resetLayout"`), in a group (`"page.showView"`, `"dialogs.openPalette"`),
 * or `"setLayout"`. The `layout` event names the one that made a change, whether the app called it or the person ran
 * it from Jali's buttons, menus, keys or ⌘K.
 */
export type ActionName =
  | keyof JaliActions
  | `page.${keyof JaliPage}`
  | `dialogs.${keyof JaliDialogs}`
  | "setLayout";

/** The pane `target` names: an id of a pane in the layout, or the pane showing that object (the focused one first). */
export function paneFor(x: Snapshot, target: PaneTarget): NodeId | undefined {
  const { s, m } = x;
  if (typeof target === "string") return m.pane(target) ? target : undefined;
  if (checkRef(m.env.kinds, target, { known: false })) return undefined;
  const focused = m.pane(s.view.focused);
  const shows = (ref: ObjectRef) =>
    sameRef(ref, target) ||
    (m.env.kinds.identityOf(target) !== undefined && m.env.kinds.sameObject(ref, target));
  if (focused && shows(focused.ref)) return focused.id;
  return (openPaneFor(m, target) ?? m.panes.find((p) => sameRef(p.ref, target)))?.id;
}
