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
import type { Direction, Layout, ObjectRef, PaneNode } from "./layout/types";
import type { LayoutInput } from "./layout/build";
import type { PaneKinds } from "./pane-kinds";
import type { Command } from "./commands/registry";

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
export function asItem(id: ItemId, first: ItemId): ItemId {
  if (typeof first !== "number" || typeof id === "number") return id;
  const n = Number(id);
  return id.trim() !== "" && Number.isFinite(n) ? n : id;
}

/** A curated page, framework-free. Adapters add its rail and header (@jali/react: WorkspaceProfile). */
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
}

export const roleOf = <R extends RoleBase>(
  p: ProfileBase<R, any>,
  id: string | undefined,
): R | undefined => p.roles.find((r) => r.id === id);

/** A pane's name: its role in a curated page ("Borrower"), else what it shows ("member 12"). */
export function titleOf(env: Env, node: PaneNode): string {
  const role = node.role && env.profile ? roleOf(env.profile, node.role) : undefined;
  return role?.label ?? env.kinds.title(node.ref);
}

/** A layout the person can switch to from the bar or ⌘K ("Layout: One table"). `build` returns a fresh layout. */
export interface Preset {
  id: string;
  label: string;
  build: () => Layout;
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
  /** The reading direction it was given (`createJali({ dir })`); unset, the workspace follows its page. */
  dir?: Direction;
}

export const presetById = (env: Pick<Env, "presets">, id: string | undefined): Preset | undefined =>
  env.presets.find((p) => p.id === id) ?? env.presets[0];

export const viewerLabel = (profile: ProfileBase | null, full: boolean) =>
  (full ? profile?.viewers?.full : profile?.viewers?.limited) ?? (full ? "investigator" : "viewer");
