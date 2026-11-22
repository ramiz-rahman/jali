/**
 * Defining a pane for React: what it shows (its params), its title and sizes, and the component that renders it.
 *
 *   export const note = definePane("note", {
 *     params: { id: Number },
 *     title: ({ id }) => `Note ${id}`,
 *     Component: ({ params }) => <h3>Note {params.id}</h3>,
 *   });
 *
 *   note({ id: 2 }) // the ref of note 2, to open, peek or put in a layout
 *
 * A component written apart from its kind takes the params' declaration, declared first:
 *
 *   const noteParams = { id: Number, tab: optional(String) };
 *   function NoteView({ params }: PaneProps<typeof noteParams>) { ... } // params: { id: number; tab?: string }
 *
 * The pane contract (keys, pausing, unsaved work, commands) is in the docs: Guides, "Pane kinds".
 */
import type {
  ActionResult,
  ObjectRef,
  OpenBesideOptions,
  PaneDefinition,
  PaneKindBase,
  PaneKinds,
  PaneNode,
  PaneOptions,
  ParamProblem,
  Params,
  ParamsOf,
  ParamTypes,
  Env,
  ProfileBase,
  RoleBase,
  ItemId,
} from "@jali/core";
import type { ComponentType } from "react";

import { defineKind, definePage as defineCorePage } from "@jali/core/adapter";
import type { JaliIcon } from "./icons/types";
import { pageParts, type PageParts } from "./chrome/PageBar";

/** Where a page from `definePage` keeps its React parts (chrome/PageBar.tsx). */
export const PAGE_PARTS: unique symbol = /* @__PURE__ */ Symbol.for("jali.react.page");

/** `P` as params: a declaration (`{ id: Number }`) is read as `ParamsOf` it; params' own type stays as it is. */
export type ParamsFrom<P> = [P] extends [ParamTypes] ? ParamsOf<P> : P;

/** What a pane's component gets. `P` is its params' declaration (`PaneProps<typeof orderParams>`) or their type
 *  (`PaneProps<{ id: number }>`). */
export interface PaneProps<P = Params> {
  /** What the pane shows, typed by the kind's `params`. */
  params: ParamsFrom<P>;
  /** The pane's node in the layout. In the peek sheet this is a node that is not in the layout. */
  node: PaneNode;
  /** Hidden (behind a tab, tucked, folded, behind a maximised pane): pause live work, keep state. */
  paused: boolean;
  /** This pane holds the workspace's focus. */
  focused: boolean;
  /** Rendered in the peek sheet rather than a pane. */
  inPeek: boolean;
  /** Open `ref` beside this pane. The selected item opens a following detail; another link replaces this pane's
   *  earlier link of the same kind. Focus stays here. Returns what `jali.actions.openBeside` does: `pane` is the pane
   *  that shows `ref`. `{ edge: "bottom" }` opens it below this pane (any edge, as on screen); default: after it. */
  openBeside: (ref: ObjectRef, options?: OpenBesideOptions) => ActionResult;
  /** Show `ref` in this pane instead. If it is open elsewhere, that pane is focused. In the peek sheet:
   *  `reason: "unavailable"`. */
  openHere: (ref: ObjectRef) => ActionResult;
  /** Open the peek sheet on `ref`, or close it with `null`. */
  peek: (ref: ObjectRef | null) => ActionResult;
  /** Report the item a list is on: an open peek and this pane's following detail follow it. `{ inResults: false }`:
   *  the filter no longer shows it, and the detail keeps it, noted. */
  select: (ref: ObjectRef | null, options?: { inResults?: boolean }) => ActionResult;
  /** Close this pane quietly, with no undo: for the launcher. */
  dismiss: () => void;
}

/**
 * What a kind's `Missing` gets: everything a pane's component does, with the params as the link gave them (a value
 * Jali couldn't read stays as it came), what was wrong with them, and a way to close the pane.
 */
export interface MissingProps extends PaneProps<Params> {
  /** Each param the link is missing (`value` undefined) or holds a value its type can't read. Empty when your own
   *  component renders `Missing` for params that read but name nothing. */
  problems: readonly ParamProblem[];
  /** Close the pane, with undo; in the peek sheet, close the peek. */
  close: () => void;
}

/** A pane kind for React: the options of any kind, plus its icon and component. */
export interface PaneOptionsReact<P = Params> extends PaneOptions<P> {
  /** For the header, tab and shelf: a Phosphor icon, or any `JaliIcon`. Default: the workspace's `defaultKind` icon. */
  icon?: JaliIcon;
  Component: ComponentType<PaneProps<P>>;
  /** Shown while `Component` suspends (it awaits data with `use()` or a Suspense query). Default: a quiet
   *  "Loading". The pane's activity reads "loading" meanwhile. */
  Loading?: ComponentType<PaneProps<P>>;
  /** Shown in place of `Component` when the link's params can't be read (a required one missing, a value of the
   *  wrong type), so the kind can explain in its own words and offer a way on (`openHere`, `close`). Render it from
   *  `Component` too, for params that read but name nothing. Default: Jali's own message. */
  Missing?: ComponentType<MissingProps>;
}

/** A kind as a React workspace keeps it. */
export interface PaneKindDef extends PaneKindBase {
  icon?: JaliIcon;
  // Each kind's component takes its own params; the workspace passes the ones it read for it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<PaneProps<any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Loading?: ComponentType<PaneProps<any>>;
  Missing?: ComponentType<MissingProps>;
}

/** A pane kind, defined. Call it with params to name one of its objects: a `Ref<K, P>`. `Pane` alone is any kind,
 *  for lists. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Pane<P = any, K extends string = string> = PaneDefinition<P, PaneKindDef, K>;

/** The params of a defined kind (`ParamsOfPane<typeof order>` is `{ id: number }`). */
export type ParamsOfPane<D> = D extends PaneDefinition<infer P, PaneKindBase, string> ? P : Params;

export function definePane<
  const K extends string,
  const T extends ParamTypes | undefined = undefined,
>(kind: K, options: PaneOptionsReact<ParamsOf<T>> & { params?: T }): Pane<ParamsOf<T>, K> {
  return defineKind<ParamsOf<T>, PaneKindDef, K>({ ...options, kind } as unknown as PaneKindDef & {
    kind: K;
  });
}

/** One of a curated page's views, with its tab icon. */
export interface PageView extends RoleBase {
  icon: JaliIcon;
}

/** A curated page: one item at a time, with a list beside it (the rail) and the item's header above its tabs. `I` is
 *  the item id's type (`number` or `string`), as in `firstItem`. */
export interface Page<I extends ItemId = any> extends ProfileBase<PageView, I> {
  /** The list of items at the left, which calls `showItem(item)` to show another (`jali.page.showItem`). Leave it out
   *  for a page that is about one item and has nothing to switch to: the header, tabs and panes then take the whole
   *  width. */
  Rail?: ComponentType<{ item: I; showItem: (item: I) => void }>;
  Header: ComponentType<{ item: I }>;
  /** Set by `definePage`: what the page renders. Never set it yourself. */
  readonly [PAGE_PARTS]?: PageParts;
}

/**
 * Makes a curated page: `definePage({ id, name, roles, ... })`, for `createJali({ page })`. It gives the page the code
 * that runs it (core's `definePage`) and the parts that render it, so an app that never calls it ships neither.
 */
export function definePage(page: Page<number>): Page<number>;
export function definePage(page: Page<string>): Page<string>;
export function definePage(page: Page): Page {
  return { ...defineCorePage(page), [PAGE_PARTS]: pageParts };
}

/** The env as a React workspace sees it: its kinds have components, its page a rail and header. */
export interface ReactEnv extends Env {
  kinds: PaneKinds<PaneKindDef>;
  profile: Page | null;
}
