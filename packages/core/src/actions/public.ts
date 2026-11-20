/**
 * The actions an app calls: `jali.actions`. One convention for all of them (docs/DECISIONS.md, 19 Nov 2026):
 *
 *  - The pane comes first. An action that acts on a pane takes it as its first argument: a pane id, or the object
 *    it shows (a ref, such as `order({ id: 7 })`), which means the pane showing that object. The pane is optional
 *    (the focused pane) only when nothing required follows it.
 *  - What the action uses comes next (`openBeside(pane, ref)`); options come last, in an object.
 *  - Every action returns an `ActionResult`: `{ ok: true, pane }` when it happened, or `{ ok: false, reason }` when it
 *    did not. Announcements are unchanged: a refusal that is read out today still is, and `message` is that text.
 *  - Nothing it is given makes it throw. A ref is checked here, once, before any step sees it (`checkRef`): a kind the
 *    workspace doesn't have, or params that aren't text, numbers or flags, is `"invalid"`, with what is wrong as
 *    `message`. A pane named by something that is neither an id nor a ref is `"invalid"` too.
 *
 * Each action is the engine's own step (actions/*.ts), committed once. The engine's other steps (drags, keys, what a
 * pane reports) are in `@jali/core/adapter`, for adapters.
 */
import type { Edge, NodeId, ObjectRef } from "../layout/types";
import type { ItemId, ViewMode } from "../profile";
import { refuse, type ActionResult, type Outcome, type Snapshot } from "../state/apply";
import type { Settings } from "../state/settings";
import { close, closeOthers, closeTabs, remove, undo } from "./close";
import { focusShown, toggleFullScreen, toggleZoom } from "./focus";
import { sameRef, setKept } from "./follow";
import {
  changeSettings,
  closePalette,
  closeSettings,
  openPalette,
  openSettings,
  preset,
  resetLayout,
  autoLayout,
} from "./layout";
import { moveDirection, moveOutOfRow, swapWithNext } from "./move";
import {
  addTab,
  newTab,
  openBeside,
  openHere,
  openPaneFor,
  split,
  type OpenBesideOptions,
} from "./open";
import { pageStep } from "./index";
import { peek, select } from "./peek";
import { mergeInto, moveTab, setPinned, unmerge } from "./tabs";
import { startRename } from "./rename";
import { choose, type ChooseOptions } from "./choose";
import { putBack, tuck } from "./tuck";
import { checkRef } from "../pane-kinds";
import { say } from "../state/messages";

/** A pane, by its id or by the object it shows. */
export type PaneTarget = NodeId | ObjectRef;

/** Where `openPage` opens the curated page. */
export interface OpenPageOptions {
  /** The item it shows. Default: the one it showed last, else the page's `firstItem`. */
  item?: ItemId;
  /** The view (a role id) Single view shows. Default: the last one, else the page's home view. */
  tab?: string;
}

export interface JaliActions {
  // ---------- focus ----------
  /** Focus a pane, and show it: a pane that is folded, tucked or behind another tab has its tab chosen (nothing else
   *  moves), and while another pane is maximised, this one is maximised instead. */
  focus(pane: PaneTarget): ActionResult;
  /** Maximise a pane (default: the focused one), or restore it. */
  toggleZoom(pane?: PaneTarget): ActionResult;
  /** Put a pane (default: the focused one) on the whole screen: maximised, with the page in the browser's full
   *  screen where it allows. Again, or Escape, puts it back. Where the browser has no full screen (an iPhone), the
   *  pane still covers the page. */
  toggleFullScreen(pane?: PaneTarget): ActionResult;

  // ---------- open ----------
  /** Open `ref` beside `pane`. Focus stays in `pane`. If `ref` is already open, that pane is shown instead.
   *  `edge`: the side of `pane` it opens on, as on screen (`"bottom"`: below it). Default: after `pane`. */
  openBeside(pane: PaneTarget, ref: ObjectRef, options?: OpenBesideOptions): ActionResult;
  /** Show `ref` in `pane`, in place. If `ref` is open elsewhere, that pane is focused instead. */
  openHere(pane: PaneTarget, ref: ObjectRef): ActionResult;
  /** Show `ref` in the peek sheet, for `pane`. Its following detail shows it instead, when one is on screen. */
  peek(pane: PaneTarget, ref: ObjectRef): ActionResult;
  /** Close the peek sheet. */
  closePeek(): ActionResult;
  /** The item selected in a list `pane` (`null`: none). Its following detail and an open peek follow it. */
  select(pane: PaneTarget, ref: ObjectRef | null, options?: { inResults?: boolean }): ActionResult;
  /** Keep a linked detail on what it shows (`true`), or make it follow its list again (`false`). */
  setKept(pane: PaneTarget, kept: boolean): ActionResult;
  /** A new pane beside `pane` (default: the focused one) with the launcher in it. `direction` default: right for a
   *  wide pane, below for a tall one. */
  split(pane?: PaneTarget, direction?: "right" | "bottom"): ActionResult;
  /** The launcher as a new tab of `pane` (default: the focused one). */
  newTab(pane?: PaneTarget): ActionResult;
  /** `ref` as a new tab of `pane`'s tabs, shown and focused. If `ref` is already open, that pane is shown instead. */
  addTab(pane: PaneTarget, ref: ObjectRef): ActionResult;

  // ---------- close ----------
  /** Close a pane (default: the focused one). Undo brings it back. */
  close(pane?: PaneTarget): ActionResult;
  /** Close every pane but `pane` (default: the focused one). */
  closeOthers(pane?: PaneTarget): ActionResult;
  /** Close the other tabs of `pane`'s group, or the tabs after it in reading order: one change, one Undo. */
  closeTabs(pane: PaneTarget, which: "others" | "after"): ActionResult;
  /** Undo the last close or tuck. */
  undo(): ActionResult;
  /** Remove a pane whose object the app closed elsewhere: quietly, with no undo, and without asking (`beforeClose`
   *  and the unsaved-work question are not asked). The last pane becomes the launcher; without one it stays
   *  (`"last-pane"`). */
  remove(pane: PaneTarget): ActionResult;

  // ---------- tuck, tabs and moving ----------
  /** Tuck a pane (default: the focused one) into its neighbour as a tab. */
  tuck(pane?: PaneTarget): ActionResult;
  /** Put a tucked pane back where it was (default: the most recently tucked one). */
  putBack(pane?: PaneTarget): ActionResult;
  /** Move a pane one step towards an edge. */
  move(pane: PaneTarget, direction: Edge): ActionResult;
  /** Swap a pane (default: the focused one) with the next pane on screen. */
  swapWithNext(pane?: PaneTarget): ActionResult;
  /**
   * Take a pane (default: the focused one) out of the row that scrolls holding it, beside the row on the side the
   * pane is nearer on screen. Nothing happens for a pane in no such row.
   */
  moveOutOfRow(pane?: PaneTarget): ActionResult;
  /** Make `pane` a tab of `target` (or of `target`'s tabs). */
  mergeInto(pane: PaneTarget, target: PaneTarget): ActionResult;
  /** Move a tab (default: the focused pane) out of its tabs, to their right. */
  unmerge(pane?: PaneTarget): ActionResult;
  /** Move a tab to position `index` (from 0) among its group's tabs, clamped. Its group keeps its place and size. */
  moveTab(pane: PaneTarget, index: number): ActionResult;
  /** Pin a pane's tab, or unpin it: first in its group, and left open by Close other tabs and Close tabs to the right. */
  setPinned(pane: PaneTarget, pinned: boolean): ActionResult;
  /** Open the rename field on a pane's tab or title (default: the focused pane). `"unavailable"` without
   *  `createJali({ rename })`, or when `rename.can` says no. */
  startRename(pane?: PaneTarget): ActionResult;

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

  // ---------- the curated page ----------
  /** Open the curated page. */
  openPage(options?: OpenPageOptions): ActionResult;
  /** Leave the curated page for the free workspace. */
  leavePage(): ActionResult;
  /** Single view or Split view. */
  setMode(mode: ViewMode): ActionResult;
  /** Show one of the page's views (a role id), as a click on its tab does. */
  openTab(tab: string): ActionResult;
  /** Show another item: every view shows it. */
  activate(item: ItemId): ActionResult;
  /** Close the panes opened from the page's views. Undo reopens them. */
  backToPage(): ActionResult;
  /** Put Split view back to the page's design. */
  resetPage(): ActionResult;
  /** Whether this person may open panes from the page's views (`false`: links only peek, Single view only). */
  setCanInvestigate(canInvestigate: boolean): ActionResult;

  // ---------- dialogs and settings ----------
  /** Ask the person for one item from `items`, in Jali's chooser (search, arrows, Enter, Esc). `onChoose` gets it once
   *  the chooser closes. For a command that needs an argument: "Open chart for…". */
  choose<T>(options: ChooseOptions<T>): ActionResult;
  openPalette(): ActionResult;
  closePalette(): ActionResult;
  openSettings(): ActionResult;
  closeSettings(): ActionResult;
  /** Change the person's settings (saved on this device). */
  changeSettings(patch: Partial<Settings>): ActionResult;
}

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

type Run = (o: Outcome | ((x: Snapshot) => Outcome)) => ActionResult;

/** An action that uses no ref. */
const NO_REF: unique symbol = /* @__PURE__ */ Symbol();

/** What is wrong with `ref`, in the workspace's words; undefined when nothing is. `known: false`: any kind will do. */
function refProblem(x: Snapshot, ref: unknown, known = true): string | undefined {
  if (checkRef(x.env.kinds, ref, { known: false })) return say(x).invalidRef;
  return known && checkRef(x.env.kinds, ref)
    ? say(x).unknownKind((ref as ObjectRef).kind)
    : undefined;
}

const EDGES: readonly unknown[] = ["left", "right", "top", "bottom"];
/** An `edge` that was given and is not one. */
const badEdge = (edge: unknown) => edge !== undefined && !EDGES.includes(edge);
/** Only the options openBeside reads, whatever else came with them. */
const edgeOf = (options?: OpenBesideOptions): OpenBesideOptions =>
  options?.edge ? { edge: options.edge } : {};

/** `jali.actions` for a store's `apply`. */
export function publicActions(run: Run): JaliActions {
  /** A ref the action uses, or a pane named by something other than an id, that can't be one: refused as invalid. */
  const invalid = (x: Snapshot, target: PaneTarget | undefined, ref?: unknown) => {
    const problem =
      (target !== undefined && typeof target !== "string"
        ? refProblem(x, target, false)
        : undefined) ?? (ref === NO_REF ? undefined : refProblem(x, ref));
    return problem ? refuse("invalid", problem) : undefined;
  };
  /** Run `step` on the pane `target` names; with `optional`, no target means the step's own default. `ref`: the ref
   *  the action uses, checked first. */
  const on = (
    target: PaneTarget | undefined,
    step: (x: Snapshot, id: NodeId) => Outcome,
    optional = false,
    ref: unknown = NO_REF,
  ): ActionResult => {
    let acted: NodeId | undefined;
    const r = run((x) => {
      const bad = invalid(x, target, ref);
      if (bad) return bad;
      if (target === undefined && optional) {
        acted = x.s.view.focused;
        return step(x, undefined as unknown as NodeId);
      }
      acted = target === undefined ? undefined : paneFor(x, target);
      return acted ? step(x, acted) : refuse("not-found");
    });
    return r.ok && r.pane === undefined && acted ? { ok: true, pane: acted } : r;
  };
  const opt = (target: PaneTarget | undefined, step: (x: Snapshot, id?: NodeId) => Outcome) =>
    on(target, step, true);
  const both = (
    a: PaneTarget,
    b: PaneTarget,
    step: (x: Snapshot, a: NodeId, b: NodeId) => Outcome,
  ) =>
    on(a, (x, id) => {
      const other = paneFor(x, b);
      return other ? step(x, id, other) : refuse("not-found");
    });

  return {
    focus: (pane) => on(pane, focusShown),
    toggleZoom: (pane) => opt(pane, (x, id) => toggleZoom(x, id)),
    toggleFullScreen: (pane) => opt(pane, (x, id) => toggleFullScreen(x, id)),

    openBeside: (pane, ref, options) =>
      badEdge(options?.edge)
        ? run(() => refuse("invalid"))
        : on(pane, (x, id) => openBeside(x, id, ref, edgeOf(options)), false, ref),
    openHere: (pane, ref) => on(pane, (x, id) => openHere(x, id, ref), false, ref),
    peek: (pane, ref) => on(pane, (x, id) => peek(x, ref, id), false, ref),
    closePeek: () => run((x) => (x.s.view.peek ? peek(x, null) : null)),
    select: (pane, ref, options) =>
      on(pane, (x, id) => select(x, id, ref, options), false, ref === null ? NO_REF : ref),
    setKept: (pane, kept) =>
      on(pane, (x, id) =>
        x.m.pane(id)?.linkedTo ? setKept(x, id, kept) : refuse("nothing-to-do"),
      ),
    split: (pane, direction) =>
      opt(pane, (x, id) => {
        const target = id ?? x.s.view.focused;
        const box = x.m.resolved.panes.find((b) => b.id === target);
        const dir = direction ?? (box && box.rect.height > box.rect.width ? "bottom" : "right");
        return target ? split(x, dir, target) : refuse("not-found");
      }),
    newTab: (pane) => opt(pane, (x, id) => newTab(x, id ?? x.s.view.focused)),
    addTab: (pane, ref) => on(pane, (x, id) => addTab(x, id, ref), false, ref),

    close: (pane) =>
      opt(pane, (x, id) => ((id ?? x.s.view.focused) ? close(x, id) : refuse("not-found"))),
    closeOthers: (pane) => opt(pane, (x, id) => closeOthers(x, id)),
    closeTabs: (pane, which) => on(pane, (x, id) => closeTabs(x, id, which)),
    undo: () => run(undo),
    remove: (pane) => on(pane, remove),

    tuck: (pane) => opt(pane, (x, id) => tuck(x, id)),
    putBack: (pane) => opt(pane, (x, id) => putBack(x, id)),
    move: (pane, direction) => on(pane, (x, id) => moveDirection(x, direction, id)),
    swapWithNext: (pane) => opt(pane, (x, id) => swapWithNext(x, id)),
    moveOutOfRow: (pane) => opt(pane, (x, id) => moveOutOfRow(x, id)),
    mergeInto: (pane, target) => both(pane, target, mergeInto),
    unmerge: (pane) => opt(pane, (x, id) => unmerge(x, id)),
    moveTab: (pane, index) => on(pane, (x, id) => moveTab(x, id, index)),
    setPinned: (pane, pinned) => on(pane, (x, id) => setPinned(x, id, pinned)),
    startRename: (pane) => opt(pane, (x, id) => startRename(x, id)),

    preset: (id) =>
      run((x) =>
        !x.env.presets.length
          ? refuse("unavailable")
          : x.env.presets.some((p) => p.id === id)
            ? preset(x, id)
            : refuse("not-found"),
      ),
    resetLayout: () => run((x) => (x.env.presets.length ? resetLayout(x) : refuse("unavailable"))),
    autoLayout: () => run(autoLayout),

    openPage: (options = {}) =>
      run((x) => pageStep("openPage")(x, { item: options.item, tab: options.tab })),
    leavePage: () => run((x) => (x.s.page ? pageStep("leavePage")(x) : null)),
    setMode: (mode) => run((x) => pageStep("setMode")(x, mode)),
    openTab: (tab) => run((x) => pageStep("openTab")(x, tab)),
    activate: (item) => run((x) => pageStep("activate")(x, item)),
    backToPage: () => run(pageStep("backToPage")),
    resetPage: () => run(pageStep("resetPage")),
    setCanInvestigate: (can) => run((x) => pageStep("setCanInvestigate")(x, can)),

    choose: (options) => run((x) => choose(x, options as ChooseOptions<unknown>)),
    openPalette: () => run(openPalette()),
    closePalette: () => run(closePalette()),
    openSettings: () => run(openSettings()),
    closeSettings: () => run(closeSettings()),
    changeSettings: (patch) => run((x) => changeSettings(x, patch)),
  };
}
