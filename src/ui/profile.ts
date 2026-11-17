/**
 * A workspace profile: a designed (curated) arrangement of panes for one kind of work. The product owns the
 * arrangement, the person owns their adjustments (sizes, hidden panes), and a link carries only the content
 * (the active item and the panes opened while investigating). Data Studio has no profile: the person builds the layout.
 *
 * Pane roles: a pane with a role fills a place in the arrangement. A primary role is always shown; a supporting role
 * can be hidden (it then lives as a toggle in the top bar) but never closed. Panes without a role were opened by the
 * person following links: they can be closed, tucked and moved like any Data Studio pane.
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

export interface ArrangementDef {
  id: string;
  label: string;
  /** Supporting roles hidden until the person shows them. */
  hidden: string[];
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  /** Singular noun for the active item ("application"). */
  itemNoun: string;
  roles: RoleDef[];
  arrangements: ArrangementDef[];
  /** The designed tree for an item. Role panes carry `role` and `priority`; their node id equals the role id. */
  build(item: number): Layout;
  /** What each role shows for an item; activating another item swaps these in place. */
  bind(item: number): Record<string, ObjectRef>;
  /** The role that opened panes are linked to when they arrive by link. */
  anchor: string;
  firstItem: number;
}

let current: WorkspaceProfile | null = null;
export function registerProfile(p: WorkspaceProfile): void { current = p; }
export function getProfile(): WorkspaceProfile | null { return current; }
export const roleOf = (p: WorkspaceProfile, id: string | undefined) => p.roles.find((r) => r.id === id);

/** A pane's name: its role in a curated arrangement ("Borrower"), else what it shows ("member 12"). */
export function titleOf(node: PaneNode): string {
  const role = node.role && current ? roleOf(current, node.role) : undefined;
  return role?.label ?? paneTitle(node.ref);
}
