/**
 * Curated pages (profile.ts). Single mode shows one view, chosen from the tabs. Split view lays the views out
 * freely, starting from the profile's design; each view exists once, and closing one sends it back to the tabs.
 * Panes opened by following links form an investigation after the layout that "Back to <page>" clears.
 *
 * Opt-in: only `definePage` reaches this module. It puts the page's engine (`pageEngine`) on the page, and the
 * instance runs the page through `env.page`, so an app without a page ships none of it.
 */
import { copyIn } from "../state/ingress";
import { UNSAFE_IDS } from "../layout/codec/validate";
import * as core from "../layout/engine";
import { endSide, treeSide } from "../layout/geometry/direction";
import { toLayout } from "../layout/build";
import { zoomable } from "../layout/fit/overlay";
import type {
  Edge,
  Layout,
  LayoutContext,
  LayoutNode,
  NodeId,
  ObjectRef,
  PaneNode,
  Rect,
  ViewState,
} from "../layout/types";
import {
  readItem,
  PAGE,
  roleOf,
  type BesidePreview,
  type ItemId,
  type OpenPage,
  type PageClosing,
  type PageEngine,
  type PageOpening,
  type ViewMode,
  type ProfileBase,
} from "../profile";
import { type Env } from "../env";
import type { CommandDef } from "../commands/registry";
import { isChange, refuse, type Outcome, type Snapshot } from "../state/apply";
import { messagesOf, say } from "../state/messages";
import { pageEn } from "../state/page-messages";
import type { PagePrefs } from "../state/page-prefs";
import type { PageState, UiState } from "../state/store";
import { openPaneFor } from "./open";
import { peekSheet } from "./peek";
import { closeMany } from "../layout/ops/close";
import { closed } from "./close";
import { keepOwnRef } from "../pane-kinds";
import { preset } from "./layout";
import { refusalOf, type ControlUse, type Step } from "./step";

const unzoomed = core.tree.unzoom;

/** Panes the person opened by following links: everything without a role. */
export const investigation = (panes: PaneNode[]) => panes.filter((p) => !p.role);

/** Opened panes go after the whole layout, so the investigation stays one region at the right. */
export function placeAfterArrangement(layout: Layout): core.Placement {
  const root = layout.root;
  return { target: root.type === "row" ? root.children.at(-1)!.id : root.id, edge: "right" };
}

interface Placed {
  layout: Layout;
  view: ViewState;
}

/** What the page binds `item` to, copied: the app may cache its refs, and what Jali keeps is its own. */
const bound = (p: ProfileBase, item: ItemId) => copyIn(p.bind(item));

/** Every role shows `item`; opened panes keep what they show. */
function rebind(layout: Layout, p: ProfileBase, item: ItemId): Layout {
  const refs = bound(p, item);
  const root = core.tree.map(layout.root, (n) =>
    n.type === "pane" && n.role && refs[n.role] ? { ...n, ref: refs[n.role]! } : n,
  );
  return root === layout.root ? layout : { ...layout, root };
}

/** The layout without opened panes (what is saved, and what another item starts from). */
export function withoutOpened(layout: Layout, ctx: LayoutContext): Layout {
  let next = layout,
    view: ViewState = { focusHistory: [] };
  for (const o of investigation(core.tree.panes(layout.root)))
    ({ layout: next, view } = core.close(next, view, o.id, ctx));
  return next;
}

/** A saved layout is usable if it still holds every role exactly once. */
function usable(layout: Layout | null, p: ProfileBase): layout is Layout {
  if (!layout) return false;
  const roles = core.tree.panes(layout.root).flatMap((n) => (n.role ? [n.role] : []));
  return roles.length === p.roles.length && p.roles.every((r) => roles.includes(r.id));
}

/** Single mode: one pane, the chosen view. */
function single(p: ProfileBase, item: ItemId, tab: string, ctx: LayoutContext): Placed {
  const r = roleOf(p, tab) ?? roleOf(p, p.home)!;
  const view: ViewState = { focused: r.id, focusHistory: [r.id] };
  const node: PaneNode = {
    id: r.id,
    type: "pane",
    size: { weight: 1 },
    ref: bound(p, item)[r.id]!,
    role: r.id,
    priority: r.priority,
  };
  return { layout: core.resetLayout({ version: 1, root: node }, view, ctx), view };
}

/** Put a role on screen and focus it: shown from hidden (its own place), or its tab chosen if it is behind another. */
function onScreen(layout: Layout, view: ViewState, role: NodeId, ctx: LayoutContext): Placed {
  if (layout.overlay?.hidden?.includes(role)) {
    const r = core.show(layout, view, role, ctx);
    if (r.ok) return r;
  }
  return { layout: core.reveal(layout, role, ctx), view: core.focus(view, role, ctx) };
}

/** Split view: the person's own layout (with or without the investigation it had), else the design. */
function split(
  x: Snapshot,
  p: ProfileBase,
  item: ItemId,
  tab: string,
  keepOpened: boolean,
): Placed {
  const { ctx } = x;
  const saved = x.s.prefs.split;
  let layout = usable(saved, p)
    ? rebind(keepOpened ? saved : withoutOpened(saved, ctx), p, item)
    : toLayout(p.build(item));
  // Coming from the home view (Overview), its sections are the panes now: focus the first one rather than adding it.
  const hidden = layout.overlay?.hidden ?? [];
  const focus =
    tab === p.home && hidden.includes(tab)
      ? (p.roles.find((r) => !hidden.includes(r.id))?.id ?? tab)
      : tab;
  const view: ViewState = { focused: focus, focusHistory: [focus] };
  layout = core.refit(layout, view, ctx);
  return onScreen(layout, view, focus, ctx);
}

/** Reopen opened panes after the layout; focus stays on `tab`. */
function reopen(
  { layout, view }: Placed,
  refs: ObjectRef[],
  tab: NodeId,
  ctx: LayoutContext,
): Placed {
  for (const ref of refs)
    ({ layout, view } = core.open(
      layout,
      view,
      tab,
      "right",
      ref,
      ctx,
      false,
      placeAfterArrangement(layout),
    ));
  return { layout, view: core.focus(view, tab, ctx) };
}

/** The role the person is working in: the focused pane's, else the most recent one focused. */
function currentRole({ s, m }: Snapshot): string | undefined {
  return [s.view.focused, ...s.view.focusHistory].map((id) => m.pane(id)?.role).find(Boolean);
}

/** What the person keeps when the split layout leaves the screen. */
function keep(x: Snapshot, mode?: ViewMode): PagePrefs {
  const r = x.s.page;
  return {
    mode: mode ?? r?.mode ?? x.s.prefs.mode,
    split: r?.mode === "split" ? x.s.layout : x.s.prefs.split,
  };
}

const label = (p: ProfileBase, id: string | undefined) => roleOf(p, id)?.label ?? id ?? "";
/** A role's name in the page's tabs. */
export const roleLabel = (p: ProfileBase | null, id: string) => (p ? label(p, id) : id);

export type { BesidePreview, OpenPage };

/** Open the curated page (or arrive at it from a link). A link with opened panes needs Split view to show them. Asked
 *  for the page already open, with nothing else, there is nothing to do. */
const openPageStep: Step<[OpenPage?]> = {
  check(x, o = {}) {
    const p = x.env.profile;
    if (!p) return refuse("unavailable");
    // An item the page can't take: a link's falls back to the item before (or the first); an app's call is refused.
    if (o.item !== undefined && readItem(o.item, p.firstItem) === undefined && !o.fromUrl)
      return refuse("invalid");
    const asked =
      o.fromUrl || o.item !== undefined || o.tab !== undefined || o.investigation?.length;
    return x.s.page && !asked ? refuse("nothing-to-do") : undefined;
  },
  run: (x, o) => openPage(x, o),
};

function openPage(x: Snapshot, o: OpenPage = {}): Outcome {
  const p = x.env.profile!;
  const prev = x.s.page;
  const item = o.item === undefined ? undefined : readItem(o.item, p.firstItem);
  // What the address doesn't hold (`appOnly` and `link: false` params) stays on an opened pane still on screen.
  const kinds = x.env.kinds.registry();
  const onScreen = core.tree.panes(x.s.layout.root).map((n) => n.ref);
  const opened = (o.investigation ?? []).map((ref) =>
    o.fromUrl ? keepOwnRef(kinds, ref, onScreen) : ref,
  );
  const page: PageState = {
    profile: p.id,
    item: item ?? prev?.item ?? p.firstItem,
    tab: roleOf(p, o.tab)?.id ?? prev?.tab ?? p.home,
    mode: opened.length ? "split" : (prev?.mode ?? x.s.prefs.mode),
  };
  // Opened panes need Split view, but that is the link's need, not the person's choice: their mode stays theirs.
  const prefs = {
    ...keep(x, page.mode),
    mode: opened.length ? x.s.prefs.mode : page.mode,
  };
  const y = { ...x, s: { ...x.s, prefs } };
  const base =
    page.mode === "single"
      ? single(p, page.item, page.tab, x.ctx)
      : split(y, p, page.item, page.tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? page.tab, x.ctx);
  // A link's maximised pane, if the page's layout shows it (in Single view, only the view on screen).
  const { zoomed, ...given } = o.view ?? {};
  return {
    op: o.fromUrl ? "arrive" : "mode",
    layout,
    view: { ...view, ...given, ...(zoomable(layout, zoomed) ? { zoomed } : {}) },
    msg: say(x).pageOpened(p.name, page.mode),
    patch: { page, prefs, peekSource: undefined, resizeMode: null },
    undo: [],
  };
}

/** Back to the free layout: the person's own layout again. The page's mode and layout are kept for next time. */
const leavePage: Step<[]> = {
  // A page-only app has no free layout to go back to.
  check: ({ s, env }) =>
    !s.page ? refuse("nothing-to-do") : !env.presets.length ? refuse("unavailable") : undefined,
  // The preset closes the page, as any way into the free layout does (`intoFreeLayout`).
  run: (x) => preset(x, x.s.presetId),
};

/** The page's steps that need it open, and its profile. */
const needPage = ({ s, env }: Snapshot) =>
  env.profile && s.page ? undefined : refuse("unavailable");

/** Single or Split view. Leaving Split view keeps its layout exactly, opened panes included, for coming back. */
const setModeStep: Step<[ViewMode]> = {
  check: (x, mode) =>
    needPage(x) ?? (x.s.page!.mode === mode ? refuse("nothing-to-do") : undefined),
  run: (x, mode) => setMode(x, mode),
};

function setMode(x: Snapshot, mode: ViewMode): Outcome {
  const p = x.env.profile!,
    r = x.s.page!;
  if (r.mode === mode) return null;
  if (mode === "single") {
    const tab = currentRole(x) ?? r.tab;
    const { layout, view } = single(p, r.item, tab, x.ctx);
    return {
      op: "mode",
      layout,
      view,
      msg: say(x).modeSingle(label(p, tab)),
      patch: { page: { ...r, mode, tab }, prefs: keep(x, mode), peekSource: undefined },
      undo: [],
    };
  }
  const { layout, view } = split(x, p, r.item, r.tab, true);
  return {
    op: "mode",
    layout,
    view,
    msg: say(x).modeSplit,
    patch: { page: { ...r, mode }, prefs: { ...x.s.prefs, mode } },
    undo: [],
    focusDom: view.focused,
  };
}

/** The view the person is working in, on screen: where a tab click puts another view. */
function slotFor({ s, m }: Snapshot): NodeId | undefined {
  return [s.view.focused, ...s.view.focusHistory, ...m.visible].find(
    (id) => m.pane(id)?.role && m.visible.includes(id!),
  );
}

/**
 * A tab click never reshapes the layout (layout stability, state/apply.ts). Single: that view replaces the one shown.
 * Split view: on screen, it is focused; behind another tab, its tab is chosen; off screen, it takes the place of the
 * view you're in, at exactly that size, and that view goes back to the tabs. Placing a view beside is a drag or ⌥-click.
 */
const showView: Step<[string]> = {
  check: (x, role) =>
    needPage(x) ?? (roleOf(x.env.profile!, role) ? undefined : refuse("not-found")),
  run: (x, role) => openTab(x, role),
};

function openTab(x: Snapshot, role: string): Outcome {
  const p = x.env.profile!,
    r = x.s.page!;
  const patch = { page: { ...r, tab: role } };
  if (r.mode === "single") {
    if (r.tab === role) return null;
    const { layout, view } = single(p, r.item, role, x.ctx);
    return {
      op: "page",
      layout,
      view,
      msg: say(x).viewing(label(p, role)),
      patch: { ...patch, peekSource: undefined },
    };
  }
  const view = unzoomed(x.s.view);
  if (!x.m.pane(role)) return refuse("not-found");
  if (x.m.visible.includes(role))
    return { op: "focus", view: core.focus(view, role, x.ctx), patch, focusDom: role };
  if (!x.m.off.includes(role))
    return {
      op: "reveal",
      layout: core.reveal(x.s.layout, role, x.ctx),
      view: core.focus(view, role, x.ctx),
      msg: say(x).viewing(label(p, role)),
      patch,
      focusDom: role,
    };
  const slot = slotFor(x);
  // One view is always on screen (closing): a tab click never succeeds without doing something.
  if (!slot) return refuse("blocked");
  const rep = core.replace(x.s.layout, view, slot, role, x.ctx);
  return {
    op: "page",
    layout: rep.layout,
    view: rep.view,
    patch,
    focusDom: role,
    msg: rep.reshaped
      ? say(x).replacedNeedsRoom(label(p, role), label(p, slot))
      : say(x).replaced(label(p, role), label(p, slot)),
    ...(rep.reshaped ? { geometry: "reshape" as const } : {}),
  };
}

/**
 * Curated pages: a role view never folds into a tab group because of something placed (that would repeat page tabs
 * inside a pane). When placing a view leaves roles folded that were not before, the least recently used role views
 * (never `keep` or the focused one; supporting before primary) go back to the page tabs until none is folded. A view
 * that frees enough room on its own goes first. Pure.
 */
export function settleRoles(
  before: Layout,
  placed: Placed,
  keep: readonly NodeId[],
  ctx: LayoutContext,
): Placed & { sent: NodeId[] } {
  const role = (l: Layout, id: NodeId) =>
    (core.tree.find(l.root, id) as PaneNode | undefined)?.role;
  const stacked = (l: Layout, v: ViewState) =>
    new Set(
      core
        .resolve(l, v, ctx)
        .stacks.filter((g) => g.kind === "fold")
        .flatMap((g) => g.paneIds.filter((id) => id !== g.homeId)),
    );
  const was = stacked(before, placed.view);
  const fresh = (l: Layout, v: ViewState) =>
    [...stacked(l, v)].filter((id) => !was.has(id) && role(l, id));
  let { layout, view } = placed;
  const sent: NodeId[] = [];
  while (fresh(layout, view).length) {
    const boxes = core.resolve(layout, view, ctx).panes;
    const recency = (id: NodeId) => {
      const i = view.focusHistory.indexOf(id);
      return i < 0 ? Infinity : i;
    };
    const at = (id: NodeId) => boxes.findIndex((b) => b.id === id);
    const candidates = boxes
      .filter(
        (b) =>
          b.hidden !== "off" && role(layout, b.id) && !keep.includes(b.id) && b.id !== view.focused,
      )
      .map((b) => core.tree.find(layout.root, b.id) as PaneNode)
      .sort(
        (a, b) =>
          Number(a.priority === "primary") - Number(b.priority === "primary") ||
          recency(b.id) - recency(a.id) ||
          at(b.id) - at(a.id),
      );
    const hidden = candidates
      .map((c) => ({ c, r: core.hide(layout, view, c.id, ctx) }))
      .filter((h) => h.r.ok);
    const tier = hidden.filter((h) => h.c.priority === hidden[0]?.c.priority);
    const pick = tier.find((h) => h.r.ok && !fresh(h.r.layout, h.r.view).length) ?? tier[0];
    if (!pick || !pick.r.ok) break;
    ({ layout, view } = pick.r);
    sent.push(pick.c.id);
  }
  return { layout, view, sent };
}

/** Put `role` at `zone` of `target`, then settle the roles. Pure: the ⌥ preview and the commit both run it. */
function placeRole(
  layout: Layout,
  view: ViewState,
  role: string,
  target: NodeId,
  zone: Edge | "centre",
  ctx: LayoutContext,
) {
  const d = core.drop(layout, view, role, target, zone, "tab", ctx);
  if (d.layout === layout) return null;
  const settled = settleRoles(
    layout,
    { layout: d.layout, view: core.focus(d.view, role, ctx) },
    [role, target],
    ctx,
  );
  return { ...settled, view: core.focus(settled.view, role, ctx) };
}

/** The view ⌥-click puts another beside: the focused pane if it is on screen, else the role in use on screen. */
function besideTarget(layout: Layout, view: ViewState, ctx: LayoutContext): NodeId | undefined {
  const boxes = core.resolve(layout, view, ctx).panes;
  const shown = (id?: NodeId) => !!id && boxes.some((b) => b.id === id && !b.hidden);
  return (
    [view.focused, ...view.focusHistory].find(shown) ??
    boxes.find((b) => !b.hidden && (core.tree.find(layout.root, b.id) as PaneNode).role)?.id
  );
}

/** What ⌥-click on a tab does, as layouts: where it starts (from Single, the split layout setMode shows), the
 *  view it goes beside, and the result. One function for the preview and the commit, so they cannot drift. */
function beside(x: Snapshot, role: string) {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r || !roleOf(p, role)) return undefined;
  const base =
    r.mode === "single"
      ? split(x, p, r.item, r.tab, true)
      : { layout: x.s.layout, view: unzoomed(x.s.view) };
  const target = besideTarget(base.layout, base.view, x.ctx);
  if (!target || target === role) return undefined;
  const placed = placeRole(base.layout, base.view, role, target, "right", x.ctx);
  return placed ? { base, target, placed } : undefined;
}

/** Where ⌥-click would put a view, and what else moves: the very placement the commit runs, and nothing where the
 *  commit is refused (its check and controls: `showViewBeside`). Pure. */
export function besidePreview(x: Snapshot, role: string): BesidePreview | undefined {
  if (refusalOf(x, showViewBeside, [role])) return undefined;
  const b = beside(x, role);
  if (!b) return undefined;
  const shown = (l: Layout, v: ViewState) =>
    new Map(
      core
        .resolve(l, v, x.ctx)
        .panes.filter((p) => !p.hidden)
        .map((p) => [p.id, p.rect]),
    );
  const now = shown(x.s.layout, unzoomed(x.s.view)),
    next = shown(b.placed.layout, b.placed.view);
  const incoming = next.get(role);
  if (!incoming) return undefined;
  const same = (a: Rect, c: Rect) =>
    [a.x - c.x, a.y - c.y, a.width - c.width, a.height - c.height].every((d) => Math.abs(d) < 0.5);
  const moved = [...next]
    .filter(([id, rect]) => id !== role && !(now.has(id) && same(now.get(id)!, rect)))
    .map(([id, rect]) => ({ id, rect }));
  return { incoming, moved, leaving: [...now.keys()].filter((id) => !next.has(id)) };
}

/**
 * A view coming in as a new pane needs `open` from the pane it is placed by (it is opened from there). Worked out on
 * the page as it is: from Single view no other view is on screen, so every view comes in, even one Split view's design
 * would show once the mode switches. The switch (`setMode`) is part of the placement, never a way past this.
 */
function placing(
  { s, m }: Snapshot,
  role: string,
  target: NodeId | undefined,
): readonly ControlUse[] {
  if (!s.page || !target || role === target) return [];
  return s.page.mode === "single" || m.off.includes(role) || !m.pane(role)
    ? [["open", target]]
    : [];
}

/** A view of this page, while it is open. */
const viewCheck = (x: Snapshot, role: string) =>
  needPage(x) ?? (roleOf(x.env.profile!, role) ? undefined : refuse("not-found"));

/** A view of this page placed by `target`: never by itself, which places nothing (and switches no mode). */
const placeCheck = (x: Snapshot, role: string, target: NodeId | undefined) =>
  viewCheck(x, role) ?? (role === target ? refuse("nothing-to-do") : undefined);

/** Drop a view from the tabs onto a pane's edge, a side of the screen (or centre: as a tab of its group). From Single,
 *  this switches to Split view first: dragging a tab out is asking for two views at once. Room is made by sending the
 *  least recently used views back to the tabs (settleRoles), never by folding views into tab groups. */
const placeTab: Step<[string, NodeId, Edge | "centre"]> = {
  check: (x, role, target) => placeCheck(x, role, target),
  control: (x, role, target) => placing(x, role, target),
  run: (x, role, target, zone) => place(x, role, target, zone),
};

function place(x: Snapshot, role: string, target: NodeId, zone: Edge | "centre"): Outcome {
  const p = x.env.profile!,
    r = x.s.page!;
  const at = (y: Snapshot): Outcome => {
    if (role === target || !y.m.pane(target)) return openTab(y, role);
    const d = placeRole(y.s.layout, y.s.view, role, target, treeSide(zone, y.ctx.dir), y.ctx);
    if (!d) return openTab(y, role);
    const said =
      zone === "centre"
        ? say(x).addedToTabsOf(label(p, role), y.m.title(target))
        : say(x).placed(label(p, role), zone, y.m.title(target));
    return {
      op: "drop",
      layout: d.layout,
      view: d.view,
      ...(y.s.page ? { patch: { page: { ...y.s.page, tab: role } } } : {}),
      focusDom: role,
      msg: d.sent.length
        ? say(x).both(said, say(x).sentToTabs(d.sent.map((id) => label(p, id))))
        : said,
    };
  };
  return r.mode === "single" ? [setMode(x, "split"), at] : at(x);
}

/** The pane ⌥-click on a view's tab places it beside: in Split view the one in front, in Single view the one view on
 *  screen (from which Split view's own target is worked out once the mode switches). */
const besideFrom = (x: Snapshot): NodeId | undefined =>
  x.s.page?.mode === "single"
    ? x.s.view.focused
    : (besideTarget(x.s.layout, unzoomed(x.s.view), x.ctx) ?? x.s.page?.tab);

/** ⌥-click a tab: that view beside the one you're in (the same placement besidePreview shows). */
const showViewBeside: Step<[string]> = {
  check: (x, role) => placeCheck(x, role, besideFrom(x)),
  control: (x, role) => placing(x, role, besideFrom(x)),
  run(x, role) {
    const r = x.s.page!;
    const target = (y: Snapshot) =>
      besideTarget(y.s.layout, unzoomed(y.s.view), y.ctx) ?? y.s.page?.tab ?? r.tab;
    if (r.mode === "single")
      return [setMode(x, "split"), (y: Snapshot) => place(y, role, target(y), endSide(y.ctx.dir))];
    return place(x, role, target(x), endSide(x.ctx.dir));
  },
};

/**
 * A link to an object that is already a view on this page goes to that view instead of opening it again: focused if on
 * screen, its tab chosen if behind another. Off screen, it is placed beside the pane the link is in: following a link
 * never takes away the pane you followed it from.
 */
/** Resolve one step of an outcome that may be a function of the snapshot. */
const apply1 = (o: Outcome, y: Snapshot): Outcome =>
  typeof o === "function" ? apply1(o(y), y) : o;

export function goToRole(x: Snapshot, role: string, from?: NodeId): Outcome {
  const p = x.env.profile;
  if (!p) return null;
  if (from && x.m.off.includes(role) && x.m.visible.includes(from)) {
    const t = label(p, role);
    const prefix = (o: Outcome): Outcome =>
      isChange(o) && o.msg ? { ...o, msg: say(x).both(say(x).alreadyView(t), o.msg) } : o;
    return (y: Snapshot) => prefix(apply1(place(y, role, from, endSide(y.ctx.dir)), y));
  }
  const o = openTab(x, role);
  if (!isChange(o)) return o;
  const t = label(p, role);
  return {
    ...o,
    msg: o.op === "page" ? say(x).both(say(x).alreadyView(t), o.msg ?? "") : say(x).alreadyOpen(t),
  };
}

/** Another item: every role shows it, in place, and the previous item's investigation closes. */
const showItem: Step<[ItemId]> = {
  check: (x, given) =>
    needPage(x) ??
    (readItem(given, x.env.profile!.firstItem) === undefined ? refuse("invalid") : undefined),
  run: (x, given) => activate(x, given),
};

function activate(x: Snapshot, given: ItemId): Outcome {
  const p = x.env.profile!,
    r = x.s.page!;
  const item = readItem(given, p.firstItem)!;
  if (r.item === item) return null;
  const page = { ...r, item };
  const saved = x.s.prefs.split;
  const prefs = {
    ...x.s.prefs,
    split: saved && r.mode === "single" ? withoutOpened(saved, x.ctx) : saved,
  };
  if (r.mode === "single") {
    const { layout, view } = single(p, item, r.tab, x.ctx);
    return {
      op: "activate",
      layout,
      view,
      msg: say(x).activated(p.itemNoun, item, 0),
      patch: { page, prefs, peekSource: undefined },
      undo: [],
    };
  }
  const dropped = investigation(x.m.panes).length;
  const view = unzoomed(x.s.view);
  const layout = core.refit(rebind(withoutOpened(x.s.layout, x.ctx), p, item), view, x.ctx);
  const focused = x.m.pane(view.focused)?.role
    ? view
    : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  return {
    op: "activate",
    layout,
    view: focused,
    msg: say(x).activated(p.itemNoun, item, dropped),
    patch: { page, prefs, peekSource: undefined },
    undo: [],
    ...(dropped ? { geometry: "reshape" as const } : {}),
  };
}

/**
 * Close every pane opened by following links, as one close: the views stay as they are now, with what the person did
 * to them meanwhile (a resize, Keep, where they put them). Undo (⌘K ⌘Z) reopens only those panes, in their slots.
 */
const back: Step<[]> = {
  check: (x) =>
    x.s.page
      ? investigation(x.m.panes).length
        ? undefined
        : refuse("nothing-to-do", say(x).nothingOpened)
      : refuse("unavailable"),
  // It closes every opened pane: one the app keeps (`allow` close false) keeps the investigation, as `close` would.
  control: (x) => investigation(x.m.panes).map((p) => ["close", p.id] as const),
  run(x) {
    const r = x.s.page!;
    const name = x.env.profile?.name ?? "page";
    const opened = investigation(x.m.panes).map((p) => p.id);
    // The views keep their sizes, a resize made meanwhile included: none takes an opened pane's room as its own.
    const plan = closing(x, opened, "closeOthers", true);
    if ("op" in plan) return plan;
    const view = x.m.pane(x.s.view.focused)?.role
      ? plan.view
      : core.focus(plan.view, currentRole(x) ?? r.tab, x.ctx);
    return closed(
      x,
      { ...plan, view },
      "close",
      say(x).backToPage(name, opened.length),
      messagesOf(x).toasts.backToPage(name, opened.length),
    );
  },
};

/**
 * Closing panes on the page, for every close (`close`, Close other tabs, Back): its views go back to the page tabs,
 * never closed for good, and the other panes close, as one change with one undo entry. One view stays on screen,
 * whatever opened panes are beside it; Single view has no layout to take a view out of. Both are found before anything
 * changes, so a check that asks gets the refusal the action would give.
 */
function closing(
  x: Snapshot,
  ids: readonly NodeId[],
  kind: "close" | "closeOthers",
  keepSizes?: boolean,
): PageClosing {
  const { m, ctx } = x;
  const views = ids.filter((id) => m.pane(id)?.role);
  const names = views.map((id) => label(x.env.profile!, m.pane(id)!.role));
  if (views.length && x.s.page?.mode === "single")
    return refuse("single-view", say(x).singleNoLayout);
  // Views first: what closes is recorded where it is once they are out, so Undo never puts it beside a hidden view.
  let layout = x.s.layout,
    view = unzoomed(x.s.view);
  for (const id of views) {
    const r = core.hide(layout, view, id, ctx);
    if (!r.ok)
      return r.reason === "last"
        ? refuse("last-pane", say(x).lastView(names[0]!))
        : refuse("blocked");
    ({ layout, view } = r);
  }
  const others = ids.filter((id) => !views.includes(id));
  const { undo, ...r } = closeMany(layout, view, others, ctx, kind, { keepSizes });
  ({ layout, view } = r);
  // Checked on what the close leaves: a view on screen, in front (one behind another pane's tab doesn't count).
  const isView = (id: NodeId) => (core.tree.find(layout.root, id) as PaneNode | undefined)?.role;
  if (views.length && !core.resolve(layout, view, ctx).panes.some((b) => !b.hidden && isView(b.id)))
    return refuse("last-pane", say(x).lastView(names[0]!));
  return {
    layout,
    view,
    undo,
    sent: names.length ? say(x).roleHidden(names.join(", ")) : undefined,
  };
}

/** Reset Split view to the design, dropping this person's layout. The investigation stays. */
const reset: Step<[]> = {
  check: (x) => needPage(x) ?? (x.s.page!.mode === "split" ? undefined : refuse("single-view")),
  run: (x) => resetPage(x),
};

function resetPage(x: Snapshot): Outcome {
  const p = x.env.profile!,
    r = x.s.page!;
  const tab = currentRole(x) ?? r.tab;
  const opened = investigation(x.m.panes).map((o) => o.ref);
  const y = { ...x, s: { ...x.s, prefs: { ...x.s.prefs, split: null } } };
  const base = split(y, p, r.item, tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? tab, x.ctx);
  return {
    op: "preset",
    layout,
    view,
    msg: say(x).pageReset,
    patch: {
      page: r,
      prefs: { ...x.s.prefs, split: null },
    },
    undo: [],
  };
}

/** The page's commands, in the palette after the layout commands: back to the page, its modes, opening and leaving
 *  it. */
function pageCommands(env: Env): CommandDef[] {
  const profile = env.profile;
  const { commands: t, commandGroups: g } = messagesOf(env);
  const group = g.layout;
  return [
    { id: "page.back", title: t.pageBack(profile?.name), group, step: "page.back" },
    { id: "page.reset", title: t.pageReset, group, step: "page.reset" },
    { id: "page.single", title: t.pageSingle, group, step: "page.setMode", args: () => ["single"] },
    { id: "page.split", title: t.pageSplit, group, step: "page.setMode", args: () => ["split"] },
    { id: "page.open", title: t.pageOpen(profile?.name), group, step: "page.open" },
    { id: "page.leave", title: t.pageLeave(env.name, profile?.name), group, step: "page.leave" },
  ];
}

/**
 * A pane opened from one of a curated page's views goes to the investigation, after the page's views. With an `edge`
 * (a tree side), it opens on that side of the investigation's last part; the first opened pane starts the
 * investigation after the views whatever the edge, so the views never share a column with an opened pane.
 */
function investigationPlace(layout: Layout, after: core.Placement, edge?: Edge): core.Placement {
  if (!edge) return after;
  const target = core.tree.find(layout.root, after.target);
  const hasRole = (n: LayoutNode): boolean =>
    n.type === "pane" ? !!n.role : n.children.some(hasRole);
  return target && !hasRole(target) ? { target: after.target, edge } : after;
}

/**
 * How a link from `source` opens while the page is open (`openBeside` asks): Single view peeks;
 * an object already on the page is shown where it is; otherwise the opened pane goes to the investigation, and short
 * of room it opens as a tab of its source, sending views back to the page tabs rather than folding them.
 */
function opening(x: Snapshot, source: NodeId, ref: ObjectRef, edge?: Edge): PageOpening {
  const { s, m, ctx } = x;
  const page = s.page;
  if (!page) return { instead: refuse("unavailable") };
  const title = m.env.kinds.title(ref);
  if (page.mode === "single")
    return { instead: { ...peekSheet(x, ref, source), msg: say(x).peekSingle(title) } };
  // One object, one pane: a link to what is already on the page goes there (a view, whatever kind shows it).
  const dup = openPaneFor(m, ref);
  if (dup?.role) return { instead: goToRole(x, dup.role, source) };
  if (dup)
    return {
      instead: {
        op: "focusExisting",
        layout: core.reveal(s.layout, dup.id, ctx),
        view: core.focus(unzoomed(s.view), dup.id, ctx),
        msg: say(x).alreadyOpen(m.title(dup.id)),
        result: dup.id,
      },
    };
  return {
    ...(m.pane(source)?.role
      ? { place: investigationPlace(s.layout, placeAfterArrangement(s.layout), edge) }
      : {}),
    asTab(fromSelection) {
      // No room beside: a tab of the source, in the source's slot at its size, shown and focused (the source is behind
      // it now). If even that needs more room, views go back to the page tabs; they never fold into a tab group.
      const t = core.addTab(s.layout, unzoomed(s.view), source, ref, ctx);
      const linked = {
        ...t.layout,
        root: core.tree.map(t.layout.root, (n) =>
          n.id === t.opened && n.type === "pane"
            ? {
                ...n,
                linkedTo: source,
                ...(fromSelection ? core.selectionLink(s.layout, source, ref.kind) : {}),
              }
            : n,
        ),
      };
      const settled = settleRoles(
        s.layout,
        { layout: linked, view: t.view },
        [source, t.opened],
        ctx,
      );
      return { ...settled, opened: t.opened };
    },
  };
}

/** What leaving the page for a layout keeps (a preset, `setLayout`, a link to a free layout): the page closes, and the
 *  person's mode and Split view layout stay theirs for next time. */
function leaving(x: Snapshot): Partial<UiState> {
  return x.s.page ? { page: null, prefs: keep(x) } : {};
}

/** What the page saves for the person when the state went from `prev` to `s`: their mode and Split view layout, opened
 *  panes left out. Undefined when nothing it saves changed. */
function prefsToSave(s: UiState, prev: UiState, ctx: LayoutContext): PagePrefs | undefined {
  const live = s.page?.mode === "split" && s.layout !== prev.layout;
  if (!live && s.prefs === prev.prefs) return undefined;
  const layout = s.page?.mode === "split" ? s.layout : s.prefs.split;
  return { mode: s.prefs.mode, split: layout ? withoutOpened(layout, ctx) : null };
}

/** The curated page's engine: what `definePage` puts on a page. */
export const pageEngine: PageEngine = {
  open: openPageStep,
  leave: leavePage,
  setMode: setModeStep,
  showView,
  showViewBeside,
  placeTab,
  showItem,
  back,
  closing,
  restored: (x, placed, keep) => settleRoles(x.s.layout, placed, keep, x.ctx),
  reset,
  opening,
  leaving,
  prefsToSave,
  besidePreview,
  commands: pageCommands,
  words: pageEn,
};

/**
 * Gives a curated page its engine, the code that runs it, for a framework adapter's own `definePage` (@jali/react's
 * calls it, and adds the parts that render the page). Apps use their adapter's `definePage`: a page made with this
 * alone renders no rail, header or tabs. Returns a copy of `page`; the fields are `page`'s own.
 */
export function definePageEngine<P extends ProfileBase<any, any>>(page: P): P {
  // A role's id is its pane's id, so it can't be one that names something on every object.
  for (const r of page.roles)
    if (UNSAFE_IDS.has(r.id))
      throw new Error(`Jali: "${r.id}" can't be a page role (it can't be a pane id).`);
  return { ...page, [PAGE]: pageEngine };
}
