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
import { paneTitle } from "./pane-kinds";

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

let current: WorkspaceProfile | null = null;
export function registerProfile(p: WorkspaceProfile): void { current = p; }
export function getProfile(): WorkspaceProfile | null { return current; }
export const roleOf = (p: WorkspaceProfile, id: string | undefined) => p.roles.find((r) => r.id === id);

/** A pane's name: its role in a curated page ("Borrower"), else what it shows ("member 12"). */
export function titleOf(node: PaneNode): string {
  const role = node.role && current ? roleOf(current, node.role) : undefined;
  return role?.label ?? paneTitle(node.ref);
}
