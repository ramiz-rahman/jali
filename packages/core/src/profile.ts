/**
 * An instance profile: a curated page about one item (a loan application), with a list beside it (the queue), a
 * header, and a tab strip of views. A free layout has none: the person builds the layout.
 *
 * Two modes, the person's choice. Single (default): one view at a time, chosen from the tabs, like any web app; links
 * open as a peek. Split view: the tabs become a palette of views that can be dragged into split layouts with full
 * freedom; it starts from the profile's designed layout (Overview's sections as panes). Each view exists once: a view
 * that is closed goes back to the tabs. Following a link opens an "opened" pane after the layout.
 *
 * A link carries content only (item, focused view, opened panes); the mode and the split layout are personal.
 */
import type {
  Edge,
  Layout,
  LayoutContext,
  NodeId,
  ObjectRef,
  Rect,
  ViewState,
} from "./layout/types";
import type { LayoutInput } from "./layout/build";
import type { CommandDef } from "./commands/registry";
import type { MessageOverrides } from "./state/messages";
import type { Outcome, Snapshot } from "./state/apply";
import type { Placement } from "./layout/ops/open";
import type { UiState } from "./state/store";
import type { PagePrefs } from "./state/page-prefs";
import type { Env } from "./env";

/** One of a curated page's views. Adapters add its icon (@jali/react: RoleDef). */
export interface RoleBase {
  id: string;
  label: string;
  priority: "primary" | "supporting";
}

export type ViewMode = "single" | "split";

/** A curated page's item id: a number (`4`) or a string (a UUID, a slug). A link carries it as text; a profile whose
 *  `firstItem` is a number gets numbers back. */
export type ItemId = string | number;

/**
 * `id` as the page's item type, or undefined when it can't be one: a page whose items are numbers (its `firstItem` is
 * one) never gets text, so a `bind` written for numbers never sees `"abc"`.
 */
export function readItem(id: unknown, first: ItemId): ItemId | undefined {
  if (typeof id === "number") return Number.isFinite(id) ? id : undefined;
  if (typeof id !== "string") return undefined;
  if (typeof first !== "number") return id;
  const n = Number(id);
  return id.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function asItem(id: ItemId, first: ItemId): ItemId {
  if (typeof first !== "number" || typeof id === "number") return id;
  const n = Number(id);
  return id.trim() !== "" && Number.isFinite(n) ? n : id;
}

/**
 * Where a page from `definePage` keeps its engine: the code that runs a curated page. It is on the page, not in the
 * instance, so an app without a page never ships it.
 */
export const PAGE: unique symbol = /* @__PURE__ */ Symbol.for("jali.page");

/** A curated page, framework-free. Adapters add its rail and header (@jali/react: Page). Make one with
 *  `definePage`, which gives it its engine. */
export interface ProfileBase<R extends RoleBase = RoleBase, I extends ItemId = ItemId> {
  id: string;
  name: string;
  /** Singular noun for the active item ("application"). */
  itemNoun: string;
  /** The views, in tab order. A role's node id equals its role id. */
  roles: R[];
  /** The view Single mode opens on. */
  home: string;
  /** Split view's designed starting layout: every role is in the tree; those not shown are hidden. */
  build(item: I): LayoutInput;
  /** What each role shows for an item; another item swaps these in place. */
  bind(item: I): Record<string, ObjectRef>;
  /** The item the page opens on. Its type (number or string) is the type of every item id the page is given. */
  firstItem: I;
  /** Set by `definePage`: the code that runs the page. Never set it yourself. */
  readonly [PAGE]?: PageEngine;
}

/** Where the page opens (`jali.page.open`), and what a link brings with it (adapters). */
export interface OpenPage {
  item?: ItemId;
  tab?: string;
  investigation?: ObjectRef[];
  fromUrl?: boolean;
  view?: Partial<ViewState>;
}

/** Where ⌥-click would put a view (adapters: the preview over the panes). */
export interface BesidePreview {
  /** Where the view opens. */
  incoming: Rect;
  /** Other views whose rect changes, at their new rect. */
  moved: { id: NodeId; rect: Rect }[];
  /** Views that leave the screen (back to the tabs, or behind a tab). */
  leaving: NodeId[];
}

/**
 * The curated page's code (actions/page.ts), reached only through a page made with `definePage`: its steps, what the
 * free layout's own steps ask of it, its commands and its English words. Adapters reach it as
 * `store.env.page`; apps never do.
 */
export interface PageEngine {
  open(x: Snapshot, o?: OpenPage): Outcome;
  leave(x: Snapshot): Outcome;
  setMode(x: Snapshot, mode: ViewMode): Outcome;
  showView(x: Snapshot, role: string): Outcome;
  /** ⌥-click on a view's tab: the view opens beside the one in front. */
  showViewBeside(x: Snapshot, role: string): Outcome;
  placeTab(x: Snapshot, role: string, target: NodeId, zone: Edge | "centre"): Outcome;
  showItem(x: Snapshot, item: ItemId): Outcome;
  back(x: Snapshot): Outcome;
  hideRole(x: Snapshot, id: NodeId): Outcome;
  reset(x: Snapshot): Outcome;
  /** How a link from `source` opens while the page is open: `openBeside` asks, and does what it says. */
  opening(x: Snapshot, source: NodeId, ref: ObjectRef, edge?: Edge): PageOpening;
  /** Panes an undo put back (`keep`): views they would fold go back to the page tabs instead (`settleRoles`). */
  restored(
    x: Snapshot,
    placed: { layout: Layout; view: ViewState },
    keep: NodeId[],
  ): { layout: Layout; view: ViewState };
  /** What leaving the page for a layout keeps (a preset, `setLayout`, a link to a free layout). */
  leaving(x: Snapshot): Partial<UiState>;
  /** What the page saves for the person when the state went from `prev` to `s`; undefined when nothing it saves
   *  changed. */
  prefsToSave(s: UiState, prev: UiState, ctx: LayoutContext): PagePrefs | undefined;
  besidePreview(x: Snapshot, role: string): BesidePreview | undefined;
  /** The page's commands, listed after the layout commands. */
  commands(env: Env): CommandDef[];
  /** The page's English: the `page` area, and the announcements, command titles and toasts only a page uses. */
  words: MessageOverrides;
}

/**
 * How a link opens while a curated page is open (`PageEngine.opening`): `instead`, the page's own outcome (a peek,
 * the pane already showing the object); or how `openBeside` opens it: where the new pane goes, what opening it
 * starts, and, short of room, the tab it becomes instead.
 */
export type PageOpening =
  | { instead: Outcome }
  | {
      place?: Placement;
      patch?: Partial<UiState>;
      asTab(fromSelection: boolean): {
        layout: Layout;
        view: ViewState;
        opened: NodeId;
        sent: NodeId[];
      };
    };

/** The engine of the instance's page, if it has one. */
export const pageEngineOf = (p: ProfileBase | null | undefined): PageEngine | undefined =>
  p?.[PAGE];

export const roleOf = <R extends RoleBase>(
  p: ProfileBase<R, any>,
  id: string | undefined,
): R | undefined => p.roles.find((r) => r.id === id);
