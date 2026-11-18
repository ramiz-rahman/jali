/**
 * A pane kind for React: the framework-free definition (pane-kinds.ts) plus the component that renders it.
 *
 * A kind module exports `definePaneKind({...})`; the app passes its kinds to `createPaneKinds` and the store (`createUiStore({ kinds })`).
 *
 * Component rules:
 * - `ref` is the ObjectRef the pane shows (same as `node.ref`). React 19 passes `ref` to function components as a
 *   plain prop, so read it from props; do not use forwardRef.
 * - `paused` is true when the pane is hidden: tabbed away, tucked, folded, or covered by a zoomed pane.
 *   Pause live work while paused (TanStack Query: `subscribed: !paused` or `enabled: !paused`), keep state.
 * - Row keys inside list-like kinds: J/K or ↑/↓ move the selection and call `select(ref)`; Space calls `peek(ref)`
 *   (or `peek(null)` to close); ⌥↵ / ⌥-click call `openBeside(ref)`. The workspace keeps focus in the source pane
 *   after openBeside (founder decision 2) and makes an open peek, and a detail opened from the selection, follow
 *   `select` (actions/follow.ts). Report the selection before opening it, so the opened pane is linked to it.
 * - Data: your own. Jali never fetches: the component reads `ref.params` and loads the object itself.
 * - Keys: content first (commands/keyboard.ts). The pane layer listens on window in the bubble phase and leaves
 *   alone any key the content claimed with `event.preventDefault()`. Claim the keys you use (J/K, Space, Enter,
 *   ⌘Z for your own undo, the first Esc); let the rest bubble. Character keys must only act while your content has
 *   focus (WCAG 2.1.4). Content that needs every key (an editor) marks itself `data-pane-keys="content"`: the pane
 *   layer then only takes F6 / ⇧F6 there, so focus can always leave.
 * - Unsaved work: report it with `setUnsaved("an edited query that has not run")` and clear it with `null` once it is
 *   saved. Closing the pane, closing others, a preset or showing another object in it then asks the person first;
 *   a following detail keeps its object. Moving, tabbing, folding and tucking never ask: the content stays mounted.
 * - State the person expects back (a draft, a sort, a scroll position): `usePaneState(key, initial)` from
 *   @jali/react. The workspace keeps it through folds and reloads and drops it when the pane closes or
 *   shows another object. JSON values only.
 * - Commands: `setCommands([...])` in an effect lists them in ⌘K, first, while the pane is focused. Call it again
 *   when they change and with `null` on unmount.
 */
import type { ComponentType, ReactNode } from "react";
import type { ObjectRef, PaneNode, PaneActivity, PaneCommand, PaneKindBase, PaneKinds, Env, ItemId, ProfileBase, RoleBase } from "@jali/core/adapter";

export interface PaneComponentProps {
  /** The layout node. In the peek sheet this is a node that is not in the layout. */
  node: PaneNode;
  /** The object shown; equals node.ref. */
  ref: ObjectRef;
  /** Hidden (tab, tuck, fold, behind zoom): pause subscriptions and timers. */
  paused: boolean;
  /** This pane holds workspace focus (the accent edge). */
  focused: boolean;
  /** Open `ref` beside this pane. The selected item opens a following detail (pinned if one already follows); another
   *  link replaces this pane's earlier plain link of the same kind if there is one. */
  openBeside: (ref: ObjectRef) => void;
  /** Open (or move) the peek sheet to `ref`; `null` closes it. */
  peek: (ref: ObjectRef | null) => void;
  /**
   * Report the current selection; an open peek from this pane follows it, and so does this pane's following detail
   * once the selection rests. `{ inResults: false }`: the filter no longer shows `ref`; the detail keeps it, noted.
   */
  select: (ref: ObjectRef | null, opts?: { inResults?: boolean }) => void;
  /** Show `ref` in this same pane (same node, new ref). If it is already open elsewhere, that pane is focused instead. */
  openHere: (ref: ObjectRef) => void;
  /** Close this pane quietly (no undo toast): for transient panes such as the launcher. */
  dismiss: () => void;
  /** Report activity for the header, tab, shelf and status line. Optional to call. */
  setActivity: (activity: PaneActivity) => void;
  /**
   * Report unsaved work ("an unsaved query"), or `null` once it is saved or gone. While a pane has some, nothing
   * closes it, replaces its object or swaps it out without asking the person first; a following detail stays put.
   */
  setUnsaved: (what: string | null) => void;
  /** The commands this pane adds to ⌘K while focused; `null` removes them. Call again whenever they change. */
  setCommands: (commands: PaneCommand[] | null) => void;
  /** Workspace sources, given to transient kinds (the chooser a split opens). */
  recent?: ObjectRef[];
  isOpen?: (ref: ObjectRef) => boolean;
  KindIcon?: ComponentType<{ kind: string; size?: number }>;
  titleFor?: (ref: ObjectRef) => string;
  /** True when rendered inside the peek sheet rather than a pane. */
  inPeek: boolean;
}

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;

export interface PaneKindDef extends PaneKindBase {
  /** Kind icon for the header, tab and shelf (a lucide-react icon or any 16px component). */
  icon?: IconComponent;
  Component: (props: PaneComponentProps) => ReactNode;
}

export function definePaneKind(def: PaneKindDef): PaneKindDef { return def; }

/** A curated page's view, with its tab icon. */
export interface RoleDef extends RoleBase {
  icon: IconComponent;
}

/** A curated page (profile.ts), with the list beside it and the header above its tabs. */
export interface WorkspaceProfile<I extends ItemId = any> extends ProfileBase<RoleDef, I> {
  /** The list of items at the left (the queue) and the item's header above the tabs. `I` is the item id's type
   *  (`number` or `string`), as in `firstItem`. */
  Rail: ComponentType<{ item: I; activate: (item: I) => void }>;
  Header: ComponentType<{ item: I }>;
}

/** The env as a React workspace sees it: its kinds have components, its profile has a rail and header. */
export interface ReactEnv extends Env {
  kinds: PaneKinds<PaneKindDef>;
  profile: WorkspaceProfile | null;
}
