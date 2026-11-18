/**
 * A workspace profile: a curated page about one item (a loan application), with a list beside it (the queue), a
 * header, and a tab strip of views. Data Studio has no profile: the person builds the layout.
 *
 * Two modes, the person's choice. Single (default): one view at a time, chosen from the tabs, like any web app; links
 * open as a peek. Multiplexed: the tabs become a palette of views that can be dragged into split layouts with full
 * freedom; it starts from the profile's designed layout (Overview's sections as panes). Each view exists once: a view
 * that is closed goes back to the tabs. Following a link opens an "opened" pane after the layout.
 *
 * A link carries content only (item, focused view, opened panes); the mode and the multiplexed layout are personal.
 */
import type { ComponentType } from "react";
import type { Layout, ObjectRef, PaneNode } from "../layout-core/types";
import type { PaneKinds } from "./pane-kinds";

export interface RoleDef {
  id: string;
  label: string;
  priority: "primary" | "supporting";
  icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
}

export type ViewMode = "single" | "multi";

export interface WorkspaceProfile {
  id: string;
  name: string;
  /** Singular noun for the active item ("application"). */
  itemNoun: string;
  /** Who works with full access (links open beside, Multiplexed available) and who works in Single with links as a
   *  peek, in the person's words: `{ full: "credit reviewer", limited: "loan officer" }`. */
  viewers?: { full: string; limited: string };
  /** The views, in tab order. A role's node id equals its role id. */
  roles: RoleDef[];
  /** The view Single mode opens on. */
  home: string;
  /** Multiplexed mode's designed starting layout: every role is in the tree; those not shown are hidden. */
  build(item: number): Layout;
  /** What each role shows for an item; another item swaps these in place. */
  bind(item: number): Record<string, ObjectRef>;
  firstItem: number;
  /** The list of items at the left (the queue) and the item's header above the tabs. */
  Rail: ComponentType<{ item: number; activate: (item: number) => void }>;
  Header: ComponentType<{ item: number }>;
}

export const roleOf = (p: WorkspaceProfile, id: string | undefined) => p.roles.find((r) => r.id === id);

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
  /** The curated page this workspace can show (`?app=review`); null for a workspace with none. */
  profile: WorkspaceProfile | null;
  /** Layouts to start from, in menu order. May be empty. */
  presets: readonly Preset[];
  /** The free workspace's name, where the person builds the layout ("Data Studio"). Default "Workspace". */
  name: string;
}

export const presetById = (env: Pick<Env, "presets">, id: string | undefined): Preset | undefined =>
  env.presets.find((p) => p.id === id) ?? env.presets[0];

export const viewerLabel = (profile: WorkspaceProfile | null, full: boolean) =>
  (full ? profile?.viewers?.full : profile?.viewers?.limited) ?? (full ? "investigator" : "viewer");
