/**
 * A workspace profile: a curated page about one item (a loan application), with a list beside it (the queue), a
 * header, and a tab strip of views. A free workspace has none: the person builds the layout.
 *
 * Two modes, the person's choice. Single (default): one view at a time, chosen from the tabs, like any web app; links
 * open as a peek. Split view: the tabs become a palette of views that can be dragged into split layouts with full
 * freedom; it starts from the profile's designed layout (Overview's sections as panes). Each view exists once: a view
 * that is closed goes back to the tabs. Following a link opens an "opened" pane after the layout.
 *
 * A link carries content only (item, focused view, opened panes); the mode and the split layout are personal.
 */
import type { Direction, Layout, NodeId, ObjectRef, PaneNode } from "./layout/types";
import type { LayoutInput } from "./layout/build";
import type { PaneErrorInfo, PaneKinds } from "./pane-kinds";
import type { Command, CommandDef } from "./commands/registry";
import type { MessageOverrides, Messages } from "./state/messages";
import type { Outcome, Snapshot } from "./state/apply";
import type { Edge, LayoutContext, Rect, ViewState } from "./layout/types";
import type { Placement } from "./layout/ops/open";
import { own } from "./own";

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

/** An item id from a link or a caller, in the type the profile uses (`"4"` becomes `4` when `firstItem` is a number). */
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
 * workspace, so an app without a page never ships it.
 */
export const PAGE: unique symbol = /* @__PURE__ */ Symbol.for("jali.page");

/** A curated page, framework-free. Adapters add its rail and header (@jali/react: Page). Make one with
 *  `definePage`, which gives it its engine. */
export interface ProfileBase<R extends RoleBase = RoleBase, I extends ItemId = ItemId> {
  id: string;
  name: string;
  /** Singular noun for the active item ("application"). */
  itemNoun: string;
  /** Who works with full access (links open beside, Split view available) and who works in Single with links as a
   *  peek, in the person's words: `{ full: "credit reviewer", limited: "loan officer" }`. */
  viewers?: { full: string; limited: string };
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

/** Where `openPage` opens the curated page, and what a link brings with it (adapters). */
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
 * free workspace's own steps ask of it, its commands and its English words. Adapters reach it as
 * `store.env.page`; apps never do.
 */
export interface PageEngine {
  openPage(x: Snapshot, o?: OpenPage): Outcome;
  leavePage(x: Snapshot): Outcome;
  setMode(x: Snapshot, mode: ViewMode): Outcome;
  openTab(x: Snapshot, role: string): Outcome;
  openTabBeside(x: Snapshot, role: string): Outcome;
  placeTab(x: Snapshot, role: string, target: NodeId, zone: Edge | "centre"): Outcome;
  activate(x: Snapshot, item: ItemId): Outcome;
  backToPage(x: Snapshot): Outcome;
  hideRole(x: Snapshot, id: NodeId): Outcome;
  resetPage(x: Snapshot): Outcome;
  setCanInvestigate(x: Snapshot, canInvestigate: boolean): Outcome;
  /** A link to an object that is already one of the page's views goes to that view. */
  goToRole(x: Snapshot, role: string, from?: NodeId): Outcome;
  /** Panes the person opened by following links: everything without a role. */
  investigation(panes: PaneNode[]): PaneNode[];
  /** Where opened panes go: after the whole layout. */
  placeAfterArrangement(layout: Layout): Placement;
  /** Send role views back to the tabs until none is folded by a placement. */
  settleRoles(
    before: Layout,
    placed: { layout: Layout; view: ViewState },
    keep: readonly NodeId[],
    ctx: LayoutContext,
  ): { layout: Layout; view: ViewState; sent: NodeId[] };
  /** The layout without opened panes (what is saved). */
  withoutOpened(layout: Layout, ctx: LayoutContext): Layout;
  besidePreview(x: Snapshot, role: string): BesidePreview | undefined;
  /** The page's commands, listed after the layout commands. */
  commands(env: Env): CommandDef[];
  /** The page's English: the `page` area, and the announcements, command titles and toasts only a page uses. */
  words: MessageOverrides;
}

/** The engine of the workspace's page, if it has one. */
export const pageEngineOf = (p: ProfileBase | null | undefined): PageEngine | undefined =>
  p?.[PAGE];

export const roleOf = <R extends RoleBase>(
  p: ProfileBase<R, any>,
  id: string | undefined,
): R | undefined => p.roles.find((r) => r.id === id);

/** A pane's name: its role in a curated page ("Borrower"), else what it shows: the title its content set from its
 *  data (`titles`, useTitle), else its kind's title ("member 12"). */
export function titleOf(env: Env, node: PaneNode, titles?: Record<NodeId, string>): string {
  const role = node.role && env.profile ? roleOf(env.profile, node.role) : undefined;
  return role?.label ?? shownTitle(env, node, titles);
}

/** What a pane shows, by name: the title its content set (useTitle), else its kind's title. Ignores roles. */
export const shownTitle = (env: Env, node: PaneNode, titles?: Record<NodeId, string>): string =>
  own(titles, node.id) ?? env.kinds.title(node.ref);

/** A layout the person can switch to from the bar or ⌘K ("Layout: One table"). `build` returns a fresh layout. */
export interface Preset {
  id: string;
  label: string;
  build: () => Layout;
  /** The layout the person left it in, if the app kept one (`PresetOptions.saved`). */
  saved?: () => LayoutInput | undefined;
}

/** What a workspace is made of, beyond its state: its pane kinds, presets and (a curated page) its profile. One per store. */
export interface Env {
  kinds: PaneKinds;
  /** The curated page this workspace can show (`?page=<id>`); null for a workspace with none. */
  profile: ProfileBase | null;
  /** Layouts to start from, in menu order. May be empty. */
  presets: readonly Preset[];
  /** The host's own commands, after Jali's in the palette; the keymap can bind them (`createUiStore({ commands })`). */
  commands?: readonly Command[];
  /** The free workspace's name, where the person builds the layout ("Data Studio"). Default "Workspace". */
  name: string;
  /** The kind a split or a new tab opens until the person chooses what to show. Without one, there is no Split. */
  launcher?: string;
  /** False when the host shows Jali's commands in its own command menu (`palette: false`). */
  palette?: boolean;
  /** Every word the workspace shows or says (state/messages.ts). Default: English (`en`). */
  messages?: Messages;
  /** The curated page's engine, when `profile` is set (from `definePage`). */
  page?: PageEngine;
  /** Told when a pane's content throws while rendering (`createJali({ onPaneError })`). */
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void;
  /** The reading direction it was given (`createJali({ dir })`); unset, the workspace follows its page. */
  dir?: Direction;
  /** `"main"` when the panes are the page's main content (`createJali({ landmark })`); unset, a labelled region. */
  landmark?: "region" | "main";
  /** The workspace's name for assistive technology (`createJali({ label })`): its landmarks are named with it. */
  label?: string;
  /** `false` when the page keeps its own theme (`createJali({ pageTheme })`): Jali writes no `data-theme`. */
  pageTheme?: false;
  /** `false` when the app asks about unsaved work itself (`createJali({ confirmDiscard })`). */
  confirmDiscard?: false;
  /** The app's items for a tab's menu (`createJali({ tabMenu })`). */
  tabMenu?: import("./commands/tab-menu").TabMenu;
  /** Renaming a pane in place (`createJali({ rename })`). */
  rename?: import("./actions/rename").Rename;
  /** How the workspace behaves on a phone (`createJali({ phone })`). */
  phone?: PhoneOptions;
  /** What may happen to panes (`createJali({ allow })`). */
  allow?: import("./actions/allow").WorkspaceAllow;
  /** The buttons in a pane's header (`createJali({ buttons })`). */
  buttons?: import("./pane/buttons").PaneButtons;
  /** The gap between panes and the inset from the workspace's edges, in px (`createJali({ gap, inset })`). */
  spacing: import("./tokens").Spacing;
}

/** How the workspace behaves on a phone. */
export interface PhoneOptions {
  /**
   * Below this workspace width, in CSS pixels, the workspace shows Single view: one pane at a time, with a switcher.
   * Default 600, Android's compact width, which covers portrait phones. `0` leaves it to the panes' minimum widths
   * alone (Single view only when even one pane can't fit), as before 19 Nov 2026.
   */
  below?: number;
  /**
   * On a portrait phone, show two linked panes one above the other instead of one: the focused pane and the pane it
   * was opened from (a list above its detail), when both have room (each at least `stackFloor` tall, default 200,
   * and the workspace at least 480). Default false. A kind can stay out (`phone: { stack: false }`) or ask for its
   * half (`phone: { place: "top" }`).
   */
  stack?: boolean;
  /** The shortest a stacked pane may be, in CSS pixels. Default 200. */
  stackFloor?: number;
  /**
   * On a device whose screen folds into two (a half-open Fold, a Flip in flex mode, a dual-screen phone), put a pane
   * each side of the fold, so none straddles the hinge. Read from the browser's viewport segments (Chrome and Edge
   * 138 and later); elsewhere nothing changes. Default true.
   */
  fold?: boolean;
}

/** The phone width when none is given: Android's compact window width. */
export const PHONE_BELOW = 600;

export const presetById = (env: Pick<Env, "presets">, id: string | undefined): Preset | undefined =>
  env.presets.find((p) => p.id === id) ?? env.presets[0];
