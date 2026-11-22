/**
 * What may happen to a pane: the app's rules, checked by the actions themselves, so every way in (a button, a key,
 * ⌘K, a tab's menu, a drag, the agent bridge) obeys the same answer, and the chrome only draws what is allowed.
 *
 * Each level can only take away: Jali's own rules (a lone pane has no maximise, a phone no drag), then the kind
 * (`definePane({ allow })`, what its content can handle), then the workspace (`createJali({ allow })`: defaults, or a
 * function for "it depends"). Everything is allowed by default; `popOut` needs its feature, `popOut()`.
 */
import * as core from "../layout/engine";
import type { NodeId, PaneNode } from "../layout/types";
import type { ViewMode } from "../profile";
import { refuse, type RefusalStep, type Snapshot } from "../state/apply";
import { say } from "../state/messages";

/** Things that can happen to a pane. `move` covers dragging it, the move keys, merging into tabs, pulling a tab out
 *  and reordering tabs; `resize` the dividers beside it. */
export type PaneControl =
  | "close"
  | "tuck"
  | "maximise"
  | "fullScreen"
  | "move"
  | "resize"
  | "pin"
  | "popOut";

export const PANE_CONTROLS: readonly PaneControl[] = [
  "close",
  "tuck",
  "maximise",
  "fullScreen",
  "move",
  "resize",
  "pin",
  "popOut",
];

/** `false` turns a control off; `true` (or leaving it out) leaves it to the other levels. */
export type PaneAllow = Partial<Record<PaneControl, boolean>>;

/** What a workspace's `allow` function is asked about. */
export interface AllowContext {
  action: PaneControl;
  pane: PaneNode;
  /** The preset the layout came from, if it did. */
  presetId?: string;
  /** The curated page, while one is open. */
  page?: { mode: ViewMode; item?: string } | null;
}

/** A workspace's rule: `false` refuses; `true` or nothing leaves it to the other levels. */
export type AllowRule = (ctx: AllowContext) => boolean | undefined | void;

/** A workspace's `allow`: its defaults, and `when` for "it depends" (a preset, a curated page, a role). */
export type WorkspaceAllow = PaneAllow & { when?: AllowRule };


/** Whether `action` may happen to pane `id`. */
export function allows(
  { s, m, env }: Snapshot,
  id: NodeId | undefined,
  action: PaneControl,
): boolean {
  const pane = id ? m.pane(id) : undefined;
  if (!pane) return true;
  if (env.kinds.get(pane.ref.kind)?.allow?.[action] === false) return false;
  const rule = env.allow;
  if (rule?.[action] === false) return false;
  // Pop out only where the workspace has it (the `popOut()` feature, which brings the window).
  if (action === "popOut" && !env.features?.some((f) => f.id === "popOut")) return false;
  if (!rule?.when) return true;
  const page = s.page
    ? { mode: s.page.mode, ...(s.page.item ? { item: String(s.page.item) } : {}) }
    : null;
  return (
    rule.when({ action, pane, ...(s.presetId ? { presetId: s.presetId } : {}), page }) !== false
  );
}

/** The refusal when `action` isn't allowed for `id`, said as the person hears it; undefined when it is. */
export function notAllowed(
  x: Snapshot,
  id: NodeId | undefined,
  action: PaneControl,
): RefusalStep | undefined {
  return allows(x, id, action)
    ? undefined
    : refuse("not-allowed", say(x).notAllowed(action, x.m.title(id)));
}

/** Whether a divider may move: every pane on both sides allows `resize`. The sides are the divider's on screen (a
 *  fold can put another pane beside it than the split's next child), whatever moves it: a drag, a key, a reset. */
export function dividerAllowed(x: Snapshot, parentId: NodeId, index: number): boolean {
  const shown = x.m.resolved.dividers.find((d) => d.parentId === parentId && d.index === index);
  if (shown?.neighbours) return shown.neighbours.flat().every((id) => allows(x, id, "resize"));
  const parent = core.tree.find(x.s.layout.root, parentId);
  if (!parent || parent.type === "pane" || parent.type === "stack") return true;
  const sides = [parent.children[index], parent.children[index + 1]];
  return sides.every((n) => !n || core.tree.panes(n).every((p) => allows(x, p.id, "resize")));
}
