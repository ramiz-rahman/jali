/**
 * One derived Model: what is on screen, what is in each group, what is tucked. Every component and action
 * reads it instead of re-walking the tree or re-resolving. Memoised on what resolve depends on: layout, zoom, area,
 * the kind registry and the pane cap (focus is not part of it; the view only places the zoom overlay).
 */
import * as core from "../layout/engine";
import type {
  ObjectRef,
  Layout,
  LayoutContext,
  NodeId,
  PaneNode,
  Rect,
  ResolvedLayout,
  ShelfEntry,
  StackNode,
  TuckRecord,
  ViewState,
} from "../layout/types";
import { PHONE_BELOW, titleOf, type Env } from "../env";
import { foldPair, stackPair, type Hinge, type StackPair } from "../workspace/stack";
import { frames } from "../workspace/frames";
import { sameRef } from "../layout/ops/ref";
import { own } from "../own";
import { messagesOf } from "./messages";
import type { Selection } from "./store";

/** A tab group as the frame shows it: a deliberate stack, or a fold or tuck group made by resolve. */
export interface Group {
  id: NodeId;
  kind: "stack" | "fold" | "tuck";
  tabs: PaneNode[];
  active: NodeId;
}

/**
 * A pane as an app reads it (`jali.model().panes`): what it shows, its name, where it is and what it is linked to.
 * Read-only; the same object while none of these changed. `R` is the refs of the instance's kinds.
 */
export interface PaneOf<R extends ObjectRef = ObjectRef> {
  readonly id: NodeId;
  readonly ref: R;
  /** Its name: its role on a curated page, else the title its content set (`useTitle`), else its kind's title. */
  readonly title: string;
  /**
   * Where it is: `"shown"` (on screen, its content visible), `"tab"` (behind another tab, or another pane's turn while
   * one pane shows at a time), `"folded"` (folded for room, behind its place's "N folded" chip), `"tucked"` (the
   * person tucked it onto the shelf) or `"hidden"` (no slot: hidden by a curated page, behind a maximised pane, or
   * scrolled out of its row's window).
   */
  readonly where: "shown" | "tab" | "folded" | "tucked" | "hidden";
  /** It has focus. */
  readonly focused: boolean;
  /** Where it is while shown, in CSS pixels from the top left of the panes' area; null while it isn't shown. */
  readonly box: Readonly<Rect> | null;
  /** A list pane's selected item (`select`), when it has one. */
  readonly selected?: R;
  /** The pane it was opened from. */
  readonly linkedTo?: NodeId;
  /** It shows what its `linkedTo` list selects. */
  readonly follows: boolean;
  /** The person kept it: it never shows another object by itself. */
  readonly kept: boolean;
  /** Its tab is pinned. */
  readonly pinned: boolean;
}

/**
 * The layout as it is on screen (`jali.model()`, `useJaliModel`): every pane in tree order, with where each is.
 * Read-only; the same object while nothing in it changed. `R` is the refs of the instance's kinds.
 */
export interface JaliModel<R extends ObjectRef = ObjectRef> {
  /** Every pane in tree order: shown, tabbed, folded, tucked or hidden. */
  readonly panes: readonly PaneOf<R>[];
  /** A pane by id. */
  pane(id: NodeId | undefined): PaneOf<R> | undefined;
  /** The first pane showing the same object as `ref` (its kind's `shows` and identity), whatever its kind. A ref of
   *  a scratch kind matches none. */
  paneOf(ref: ObjectRef): PaneOf<R> | undefined;
}

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
  /** Tucked panes in tree order, each with the pane it sits behind: what the shelf lists. Folded panes are never
   *  here: they wait behind their strip's "N folded" chip. */
  shelf: TuckedEntry[];
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

/** A tucked pane on the shelf. */
export type TuckedEntry = ShelfEntry & { reason: "tucked" };

/** The model without its titles: where everything is. A pane's live title makes a new model that shares it, so what
 *  reads only this needn't hear a title change (`useGeometry`). */
export type ModelGeometry = Omit<Model, "title">;

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
  const shelf = panes.flatMap((p): TuckedEntry[] => {
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

const sameRect = (a: Readonly<Rect> | null, b: Readonly<Rect> | null) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

const samePane = (a: PaneOf, b: PaneOf) =>
  a.id === b.id &&
  (a.ref === b.ref || sameRef(a.ref, b.ref)) &&
  a.title === b.title &&
  a.where === b.where &&
  a.focused === b.focused &&
  sameRect(a.box, b.box) &&
  (a.selected === b.selected || sameRef(a.selected, b.selected)) &&
  a.linkedTo === b.linkedTo &&
  a.follows === b.follows &&
  a.kept === b.kept &&
  a.pinned === b.pinned;

/** What the public model is made from: the engine's model, focus, the selection and the room. */
export interface PublicInput {
  view: ViewState;
  selection: Readonly<Record<NodeId, Selection>>;
  area: { width: number; height: number };
}

/**
 * The public model (`jali.model()`), worked out again on every read and kept while nothing in it changed: each pane
 * keeps its object while its fields are the same, and the model its object while every pane does. Titles are read
 * each time, since a kind's title can read the app's own data.
 */
export function publicModel(env: Env) {
  let last: JaliModel | undefined;
  let from: unknown[] = [];
  return (m: Model, { view, selection, area }: PublicInput): JaliModel => {
    // Nothing it is made from changed: only a title can have (a kind's title reading the app's data).
    const key = [m, view.focused, view.zoomed, selection, area];
    if (
      last &&
      key.every((k, i) => k === from[i]) &&
      last.panes.every((p) => p.title === m.title(p.id))
    )
      return last;
    from = key;
    const was = new Map(last?.panes.map((p) => [p.id, p]));
    const boxes = new Map(m.resolved.panes.map((b) => [b.id, b]));
    const flat = new Map(m.flat.panes.map((b) => [b.id, b]));
    // One pane at a time: the frames the adapter draws say which show (stacked view and a fold too).
    const single = m.onePane
      ? new Map(frames(m, view, "single", area).map((f) => [f.node.id, f]))
      : undefined;
    const panes = m.panes.map((node): PaneOf => {
      const { id } = node;
      const b = boxes.get(id);
      const f = single?.get(id);
      const off = flat.get(id)?.hidden === "off";
      const box: Rect | null = off
        ? null
        : single
          ? f && !f.hidden
            ? f.rect
            : null
          : b && !b.hidden && !m.outOfView.has(id)
            ? view.zoomed === id
              ? { x: 0, y: 0, ...area }
              : b.rect
            : null;
      const where: PaneOf["where"] = off
        ? "hidden"
        : box
          ? "shown"
          : m.tuckOf(id)
            ? "tucked"
            : m.folded.includes(id)
              ? "folded"
              : single || flat.get(id)?.hidden === "tab"
                ? "tab"
                : "hidden";
      const selected = own(selection, id)?.ref;
      const p: PaneOf = Object.freeze({
        id,
        ref: node.ref,
        title: m.title(id),
        where,
        focused: view.focused === id,
        box: box && Object.freeze({ ...box }),
        ...(selected ? { selected } : {}),
        ...(node.linkedTo ? { linkedTo: node.linkedTo } : {}),
        follows: !!node.follows,
        kept: !!node.kept,
        pinned: !!node.pinned,
      });
      const before = was.get(id);
      return before && samePane(before, p) ? before : p;
    });
    if (last && last.panes.length === panes.length && panes.every((p, i) => p === last!.panes[i]))
      return last;
    const byId = new Map(panes.map((p) => [p.id, p]));
    return (last = Object.freeze({
      panes: Object.freeze(panes),
      pane: (id: NodeId | undefined) => (id ? byId.get(id) : undefined),
      paneOf: (ref: ObjectRef) => panes.find((p) => env.kinds.sameObject(p.ref, ref)),
    }));
  };
}
