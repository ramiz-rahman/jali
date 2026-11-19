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
 * The pane contract (keys, pausing, unsaved work, commands) is in the docs: Guides, "Pane kinds".
 */
import type { ComponentType } from "react";
import type {
  ObjectRef,
  PaneDefinition,
  PaneKindBase,
  PaneKinds,
  PaneNode,
  PaneOptions,
  Params,
  ParamsOf,
  ParamTypes,
  Env,
  ProfileBase,
  RoleBase,
  ItemId,
} from "@jali/core/adapter";
import { defineKind } from "@jali/core/adapter";
import type { JaliIcon } from "./icons/types";

/** What a pane's component gets. `P` is the type of its params. */
export interface PaneProps<P = Params> {
  /** What the pane shows, typed by the kind's `params`. */
  params: P;
  /** The pane's node in the layout. In the peek sheet this is a node that is not in the layout. */
  node: PaneNode;
  /** Hidden (behind a tab, tucked, folded, behind a maximised pane): pause live work, keep state. */
  paused: boolean;
  /** This pane holds the workspace's focus. */
  focused: boolean;
  /** Rendered in the peek sheet rather than a pane. */
  inPeek: boolean;
  /** Open `ref` beside this pane. The selected item opens a following detail; another link replaces this pane's
   *  earlier link of the same kind. Focus stays here. */
  openBeside: (ref: ObjectRef) => void;
  /** Show `ref` in this pane instead. If it is open elsewhere, that pane is focused. */
  openHere: (ref: ObjectRef) => void;
  /** Open the peek sheet on `ref`, or close it with `null`. */
  peek: (ref: ObjectRef | null) => void;
  /** Report the item a list is on: an open peek and this pane's following detail follow it. `{ inResults: false }`:
   *  the filter no longer shows it, and the detail keeps it, noted. */
  select: (ref: ObjectRef | null, options?: { inResults?: boolean }) => void;
  /** Close this pane quietly, with no undo: for the launcher. */
  dismiss: () => void;
}

/** A pane kind for React: the options of any kind, plus its icon and component. */
export interface PaneOptionsReact<P = Params> extends PaneOptions<P> {
  /** For the header, tab and shelf: a Phosphor icon, or any `JaliIcon`. Default: the workspace's `defaultKind` icon. */
  icon?: JaliIcon;
  Component: ComponentType<PaneProps<P>>;
}

/** A kind as a React workspace keeps it. */
export interface PaneKindDef extends PaneKindBase {
  icon?: JaliIcon;
  // Each kind's component takes its own params; the workspace passes the ones it read for it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<PaneProps<any>>;
}

/** A pane kind, defined. Call it with params to name one of its objects. `Pane` alone is any kind, for lists. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Pane<P = any> = PaneDefinition<P, PaneKindDef>;

export function definePane<const T extends ParamTypes | undefined = undefined>(
  kind: string,
  options: PaneOptionsReact<ParamsOf<T>> & { params?: T },
): Pane<ParamsOf<T>> {
  return defineKind<ParamsOf<T>, PaneKindDef>({ ...options, kind } as unknown as PaneKindDef);
}

/** One of a curated page's views, with its tab icon. */
export interface PageView extends RoleBase {
  icon: JaliIcon;
}

/** A curated page: one item at a time, with a list beside it (the rail) and the item's header above its tabs. `I` is
 *  the item id's type (`number` or `string`), as in `firstItem`. */
export interface Page<I extends ItemId = any> extends ProfileBase<PageView, I> {
  Rail: ComponentType<{ item: I; activate: (item: I) => void }>;
  Header: ComponentType<{ item: I }>;
}

/** Gives a curated page its type: `definePage({ id, name, roles, ... })`. */
export function definePage(page: Page<number>): Page<number>;
export function definePage(page: Page<string>): Page<string>;
export function definePage(page: Page): Page {
  return page;
}

/** The env as a React workspace sees it: its kinds have components, its page a rail and header. */
export interface ReactEnv extends Env {
  kinds: PaneKinds<PaneKindDef>;
  profile: Page | null;
}
