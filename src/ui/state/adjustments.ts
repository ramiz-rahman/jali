/**
 * Personal adjustments to a designed arrangement: the sizes the person set by hand and which supporting roles they
 * hid. They belong to the person (saved per arrangement on this device), never to a link. Reset drops them.
 */
import * as core from "../../layout-core";
import type { Layout, NodeId, Size } from "../../layout-core/types";
import type { WorkspaceProfile } from "../profile";

export interface Adjustments { sizes: Record<NodeId, Size>; hidden: string[] }
export type AdjustmentBook = Record<string, Adjustments>;

const PREFIX = "pane-lab:adjust:";
export const adjustKey = (profile: string, arrangement: string) => `${profile}:${arrangement}`;

/** What the person changed: hand-set sizes of the designed nodes, and the hidden roles. */
export function adjustmentsOf(layout: Layout, p: WorkspaceProfile, item: number): Adjustments {
  const designed = new Set(core.tree.nodes(p.build(item).root).map((n) => n.id));
  const sizes: Record<NodeId, Size> = {};
  for (const n of core.tree.nodes(layout.root)) if (designed.has(n.id) && n.userSized) sizes[n.id] = n.size;
  const roles = new Set(p.roles.map((r) => r.id));
  return { sizes, hidden: (layout.overlay?.hidden ?? []).filter((id) => roles.has(id)) };
}

/** The arrangement with the person's adjustments on top. Unknown ids are ignored; the primary role always shows. */
export function withAdjustments(layout: Layout, a: Adjustments, p: WorkspaceProfile): Layout {
  const root = core.tree.map(layout.root, (n) => (a.sizes[n.id] ? { ...n, size: a.sizes[n.id]!, userSized: true } : n));
  const ids = new Set(core.tree.panes(root).map((n) => n.id));
  const hidden = a.hidden.filter((id) => ids.has(id) && p.roles.find((r) => r.id === id)?.priority === "supporting");
  const o = layout.overlay ?? { tucks: [], folds: [], shown: {} };
  const next: Layout = { ...layout, root };
  if (hidden.length) next.overlay = { ...o, hidden };
  return next;
}

export function loadAdjustments(): AdjustmentBook {
  const book: AdjustmentBook = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const v = JSON.parse(localStorage.getItem(k) ?? "null") as Adjustments | null;
      if (v && typeof v.sizes === "object" && Array.isArray(v.hidden)) book[k.slice(PREFIX.length)] = v;
    }
  } catch { /* private mode: nothing saved */ }
  return book;
}

export function saveAdjustments(key: string, a: Adjustments): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(a)); } catch { /* private mode */ }
}
