/**
 * One derived Model: what is on screen, what is in each group, what is tucked. Every component and action
 * reads it instead of re-walking the tree or re-resolving. Memoised on what resolve depends on: layout, zoom, area,
 * the kind registry and the pane cap (focus is not part of it; the view only places the zoom overlay).
 */
import * as core from "../layout/engine";
import type {
  DeepReadonly,
  ObjectRef,
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
import { foldPair, stackPair, type Hinge, type StackPair } from "../workspace/stack";
import { messagesOf } from "./messages";

/** A tab group as the frame shows it: a deliberate stack, or a fold or tuck group made by resolve. */
export interface Group {
  id: NodeId;
  kind: "stack" | "fold" | "tuck";
  tabs: PaneNode[];
  active: NodeId;
}

/** A pane as an app reads it: read-only, with its ref typed by the instance's kinds. */
export type PaneOf<R extends ObjectRef = ObjectRef> = DeepReadonly<Omit<PaneNode, "ref">> & {
  readonly ref: R;
};

/**
 * The layout as it is on screen (`jali.model()`, `useJaliModel`): panes, their boxes and titles, the groups and the
 * shelf. Read-only. `R` is the refs of the workspace's kinds.
 */
export type JaliModel<R extends ObjectRef = ObjectRef> = DeepReadonly<
  Omit<Model, "env" | "panes" | "pane" | "onScreen">
> & {
  /** The pane kinds and profile it was built with. */
  readonly env: Env;
  /** Every pane in tree order. */
  readonly panes: readonly PaneOf<R>[];
  pane(id: NodeId | undefined): PaneOf<R> | undefined;
  /** Every pane except hidden ones, in tree order: what the pane switcher lists while one pane shows at a time. */
  readonly onScreen: readonly PaneOf<R>[];
};

/** The model as the engine and adapters read it. */
export interface Model {
  /** The pane kinds and profile it was built with. */
  env: Env;
  layout: Layout;
  /** Boxes, dividers, groups and shelf, zoom-aware, with each row that scrolls at its scroll position. */
  resolved: ResolvedLayout;
  /** The same, unscrolled: each strip's panes along its content (what `offsetToShow` measures against). */
  content: ResolvedLayout;
  /** Panes in a row that scrolls, scrolled out of its window: on screen in the layout, but not to be seen. */
  outOfView: ReadonlySet<NodeId>;
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
  /** Panes hidden by the overlay: no slot and no tab (a curated page's hidden roles). */
  off: NodeId[];
  /** Every pane except hidden ones, in tree order: what the pane switcher lists while one pane shows at a time. */
  onScreen: PaneNode[];
  /** Phone rule: under the phone width, or even one pane's minimum overflows it, so one pane shows at a time. */
  onePane: boolean;
  /** One pane at a time on a portrait phone with `phone.stack`: the two linked panes shown one above the other. */
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
  /** A fold that splits the layout in two (the browser's viewport segments). */
  hinge?: Hinge;
}

export function buildModel({ layout, view, area, ctx, env, titles, hinge }: ModelInput): Model {
  const content = core.resolve(layout, view, ctx);
  const offsets = view.scroll ?? {};
  const resolved = core.scrolled(content, offsets, ctx.dir);
  const flat = view.zoomed
    ? core.scrolled(core.resolve(layout, core.tree.unzoom(view), ctx), offsets, ctx.dir)
    : resolved;
  const outOfView = new Set(
    resolved.panes
      .filter((b) => b.clip && !b.hidden && !core.inWindow(b.rect, b.clip))
      .map((b) => b.id),
  );
  const panes = core.tree.panes(layout.root);
  const byId = new Map(panes.map((p) => [p.id, p]));
  const shown = (r: ResolvedLayout) => r.panes.filter((b) => !b.hidden).map((b) => b.id);
  const tucks = layout.overlay?.tucks ?? [];
  const tuckOf = (id: NodeId | undefined) => tucks.find((t) => t.pane === id);
  const stackOf = (id: NodeId | undefined) => (id ? core.tree.stackOf(layout.root, id) : undefined);
  const title = titleFn(env, (id) => byId.get(id), titles);

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

  const model: Model = {
    layout,
    env,
    resolved,
    content,
    outOfView,
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
    onePane:
      area.width > 0 &&
      (area.width < (env.phone?.below ?? PHONE_BELOW) ||
        // A pane in a row that scrolls runs past the edge by design: it is cut to its strip, not too wide.
        resolved.panes.some(
          (b) => !b.hidden && !b.clip && b.rect.x + b.rect.width > area.width + 0.5,
        )),
  };
  const current = () =>
    view.focused && byId.has(view.focused) && !model.off.includes(view.focused)
      ? view.focused
      : model.onScreen[0]?.id;
  // A fold splits the layout: a pane each side of it, presented as the one-pane chrome with two panes.
  const across =
    hinge && env.phone?.fold !== false
      ? foldPair({ env, hinge, onScreen: model.onScreen, current: current() })
      : undefined;
  if (across) {
    model.onePane = true;
    model.stacked = across;
  } else if (model.onePane) {
    const pair = stackPair({ env, view, area, onScreen: model.onScreen, current: current() });
    if (pair) model.stacked = pair;
  }
  return model;
}

/** A pane's name, from the titles panes set (useTitle) over its kind's. */
const titleFn =
  (env: Env, pane: (id: NodeId) => PaneNode | undefined, titles: ModelInput["titles"]) =>
  (id: NodeId | undefined) => {
    const p = id ? pane(id) : undefined;
    return p ? titleOf(env, p, titles) : messagesOf(env).pane.untitled;
  };

/**
 * A one-entry cache: the same inputs give the same model object, so components can compare by identity. Titles are an
 * overlay on the geometry: a title a pane sets (a live one too) makes a new model that shares everything resolve
 * made, so it never resolves the layout again.
 */
export function modelCache() {
  let last: {
    key: unknown[];
    geometry: Model;
    titles: ModelInput["titles"];
    model: Model;
  } | null = null;
  return (input: ModelInput): Model => {
    const key = [
      input.layout,
      input.view.zoomed,
      input.view.scroll,
      input.area.width,
      input.area.height,
      input.env.kinds.version(),
      input.env.profile,
      input.env.phone?.below,
      // Stacked view pairs the focused pane: only then does focus change the model.
      input.env.phone?.stack || input.hinge ? input.view.focused : undefined,
      input.hinge?.axis,
      input.hinge?.start,
      input.hinge?.size,
      input.ctx.paneCap,
      input.ctx.dir,
    ];
    if (last && key.every((k, i) => k === last!.key[i])) {
      if (last.titles !== input.titles) {
        const { geometry } = last;
        last.titles = input.titles;
        last.model = { ...geometry, title: titleFn(input.env, geometry.pane, input.titles) };
      }
      return last.model;
    }
    const model = buildModel(input);
    last = { key, geometry: model, titles: input.titles, model };
    return last.model;
  };
}
