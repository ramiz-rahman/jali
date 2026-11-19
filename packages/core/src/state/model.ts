/**
 * One derived JaliModel: what is on screen, what is in each group, what is tucked. Every component and action
 * reads it instead of re-walking the tree or re-resolving. Memoised on what resolve depends on: layout, zoom, area,
 * the kind registry and the pane cap (focus is not part of it; the view only places the zoom overlay).
 */
import * as core from "../layout";
import type {
  Layout,
  LayoutContext,
  NodeId,
  PaneNode,
  ResolvedLayout,
  ShelfEntry,
  StackNode,
  TuckRecord,
  ViewState,
} from "../layout/types";
import { PHONE_BELOW, titleOf, type Env } from "../profile";
import { stackPair, type StackPair } from "../workspace/stack";
import { messagesOf } from "./messages";

/** A tab group as the frame shows it: a deliberate stack, or a fold or tuck group made by resolve. */
export interface Group {
  id: NodeId;
  kind: "stack" | "fold" | "tuck";
  tabs: PaneNode[];
  active: NodeId;
}

export interface JaliModel {
  /** The pane kinds and profile it was built with. */
  env: Env;
  layout: Layout;
  /** Boxes, dividers, groups and shelf, zoom-aware. */
  resolved: ResolvedLayout;
  /** The same layout as if nothing were zoomed: focus keys move on from a zoomed pane with it. */
  flat: ResolvedLayout;
  /** Every pane in tree order. */
  panes: PaneNode[];
  pane(id: NodeId | undefined): PaneNode | undefined;
  /** The pane's name: its role, the title its content set (useTitle), else its kind's title; "pane" for none. */
  title(id: NodeId | undefined): string;
  /** Panes on screen, reading order (zoom-aware). */
  visible: NodeId[];
  /** Panes on screen, reading order, as if nothing were zoomed. */
  flatVisible: NodeId[];
  groups: Map<NodeId, Group>;
  /** The deliberate (tree) stack holding a pane. Fold and tuck groups exist only in `groups`. */
  stackOf(id: NodeId | undefined): StackNode | undefined;
  tuckOf(id: NodeId | undefined): TuckRecord | undefined;
  /** The pane on screen in the same group as `id` (itself when shown), ignoring zoom. */
  shownWith(id: NodeId): NodeId;
  /** Tucked panes in tree order, each with the pane it sits behind: what the shelf lists. */
  shelf: ShelfEntry[];
  folded: NodeId[];
  /** Panes hidden by the overlay: no slot and no tab (a curated workspace's hidden roles). */
  off: NodeId[];
  /** Every pane except hidden ones, in tree order: what single view switches between. */
  onScreen: PaneNode[];
  /** Phone rule: under the phone width, or even one pane's minimum overflows it, so one pane shows at a time. */
  single: boolean;
  /** In Single view on a portrait phone with `phone.stack`: the two linked panes shown one above the other. */
  stacked?: StackPair;
}

export interface ModelInput {
  layout: Layout;
  view: ViewState;
  area: { width: number; height: number };
  ctx: LayoutContext;
  env: Env;
  /** Titles panes set from their data (useTitle). */
  titles?: Record<NodeId, string>;
}

export function buildModel({ layout, view, area, ctx, env, titles }: ModelInput): JaliModel {
  const resolved = core.resolve(layout, view, ctx);
  const flat = view.zoomed ? core.resolve(layout, core.tree.unzoom(view), ctx) : resolved;
  const panes = core.tree.panes(layout.root);
  const byId = new Map(panes.map((p) => [p.id, p]));
  const shown = (r: ResolvedLayout) => r.panes.filter((b) => !b.hidden).map((b) => b.id);
  const tucks = layout.overlay?.tucks ?? [];
  const tuckOf = (id: NodeId | undefined) => tucks.find((t) => t.pane === id);
  const stackOf = (id: NodeId | undefined) => (id ? core.tree.stackOf(layout.root, id) : undefined);
  const title = (id: NodeId | undefined) => {
    const p = id ? byId.get(id) : undefined;
    return p ? titleOf(env, p, titles) : messagesOf(env).pane.untitled;
  };

  const groups = new Map<NodeId, Group>();
  for (const box of resolved.panes) {
    const id = box.stackId;
    if (!id || groups.has(id)) continue;
    const projected = resolved.stacks.find((g) => g.id === id);
    const tree = projected ? undefined : core.tree.find(layout.root, id);
    if (tree?.type === "stack") {
      groups.set(id, { id, kind: "stack", tabs: tree.children, active: tree.active });
      continue;
    }
    const members = resolved.panes.filter((b) => b.stackId === id);
    const active = members.find((b) => !b.hidden)?.id ?? members[0]!.id;
    groups.set(id, {
      id,
      kind: projected?.kind ?? "fold",
      tabs: members.flatMap((b) => byId.get(b.id) ?? []),
      active,
    });
  }

  const offscreen = new Map(resolved.shelf.map((e) => [e.paneId, e]));
  const shelf = panes.flatMap((p): ShelfEntry[] => {
    const t = tuckOf(p.id);
    if (!t) return [];
    const e = offscreen.get(p.id);
    const homeId = byId.has(t.home) ? t.home : (e?.homeId ?? t.home);
    return [
      { paneId: p.id, homeId, stackId: e?.stackId ?? stackOf(p.id)?.id ?? "", reason: "tucked" },
    ];
  });

  const model: JaliModel = {
    layout,
    env,
    resolved,
    flat,
    panes,
    title,
    tuckOf,
    stackOf,
    shelf,
    groups,
    pane: (id) => (id ? byId.get(id) : undefined),
    visible: shown(resolved),
    flatVisible: shown(flat),
    shownWith(id) {
      const box = flat.panes.find((b) => b.id === id);
      return (
        (box?.hidden &&
          box.stackId &&
          flat.panes.find((b) => b.stackId === box.stackId && !b.hidden)?.id) ||
        id
      );
    },
    folded: resolved.shelf.filter((e) => e.reason === "folded").map((e) => e.paneId),
    off: flat.panes.filter((b) => b.hidden === "off").map((b) => b.id),
    onScreen: panes.filter((p) => !flat.panes.some((b) => b.id === p.id && b.hidden === "off")),
    // Phone width (env.phone.below, default 600), or a pane that can't fit even folded.
    single:
      area.width > 0 &&
      (area.width < (env.phone?.below ?? PHONE_BELOW) ||
        resolved.panes.some((b) => !b.hidden && b.rect.x + b.rect.width > area.width + 0.5)),
  };
  if (model.single) {
    const current =
      view.focused && byId.has(view.focused) && !model.off.includes(view.focused)
        ? view.focused
        : model.onScreen[0]?.id;
    const pair = stackPair({ env, view, area, onScreen: model.onScreen, current });
    if (pair) model.stacked = pair;
  }
  return model;
}

/** A one-entry cache: the same inputs give the same model object, so components can compare by identity. */
export function modelCache() {
  let last: { key: unknown[]; model: JaliModel } | null = null;
  return (input: ModelInput): JaliModel => {
    const key = [
      input.layout,
      input.view.zoomed,
      input.area.width,
      input.area.height,
      input.env.kinds.version(),
      input.env.profile,
      input.env.phone?.below,
      // Stacked view pairs the focused pane: only then does focus change the model.
      input.env.phone?.stack ? input.view.focused : undefined,
      input.ctx.paneCap,
      input.titles,
      input.ctx.dir,
    ];
    if (last && key.every((k, i) => k === last!.key[i])) return last.model;
    last = { key, model: buildModel(input) };
    return last.model;
  };
}
