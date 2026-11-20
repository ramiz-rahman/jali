/**
 * Curated pages (profile.ts). Single mode shows one view, chosen from the tabs. Split view lays the views out
 * freely, starting from the profile's design; each view exists once, and closing one sends it back to the tabs.
 * Panes opened by following links form an investigation after the layout that "Back to <page>" clears.
 *
 * Opt-in: only `definePage` reaches this module. It puts the page's engine (`pageEngine`) on the page, and the
 * workspace runs the page through `env.page`, so an app without a page ships none of it.
 */
import * as core from "../layout";
import { endSide, treeSide } from "../layout/geometry/direction";
import { toLayout } from "../layout/build";
import type {
  Edge,
  Layout,
  LayoutContext,
  NodeId,
  ObjectRef,
  PaneNode,
  Rect,
  ViewState,
} from "../layout/types";
import {
  asItem,
  PAGE,
  roleOf,
  type BesidePreview,
  type Env,
  type ItemId,
  type OpenPage,
  type PageEngine,
  type ViewMode,
  type ProfileBase,
} from "../profile";
import type { CommandDef } from "../commands/registry";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { messagesOf, say, type Messages } from "../state/messages";
import { pageEn } from "../state/page-messages";
import type { PagePrefs } from "../state/page-prefs";
import type { PageState } from "../state/store";
import { pushUndo } from "../state/undo";
import { preset } from "./layout";

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

/** Every role shows `item`; opened panes keep what they show. */
function rebind(layout: Layout, p: ProfileBase, item: ItemId): Layout {
  const refs = p.bind(item);
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
    ref: p.bind(item)[r.id]!,
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

/** Who may open links beside (`full`) and who only peeks, in the page's words, else Jali's. */
export const viewerLabel = (
  profile: ProfileBase | null,
  full: boolean,
  words: Pick<Messages["page"], "viewerFull" | "viewerLimited">,
) =>
  (full ? profile?.viewers?.full : profile?.viewers?.limited) ??
  (full ? words.viewerFull : words.viewerLimited);

/** Open the curated page (or arrive at it from a link). A link with opened panes needs Split view to show them. */
export function openPage(x: Snapshot, o: OpenPage = {}): Outcome {
  const p = x.env.profile;
  if (!p) return refuse("unavailable");
  const prev = x.s.page;
  const canInvestigate = prev?.canInvestigate ?? true;
  // A limited viewer works in Single only, whatever the link or Back brings: its opened panes are left out.
  const opened = canInvestigate ? (o.investigation ?? []) : [];
  const page: PageState = {
    profile: p.id,
    before: undefined,
    item: o.item !== undefined ? asItem(o.item, p.firstItem) : (prev?.item ?? p.firstItem),
    tab: roleOf(p, o.tab)?.id ?? prev?.tab ?? p.home,
    mode: !canInvestigate ? "single" : opened.length ? "split" : (prev?.mode ?? x.s.prefs.mode),
    canInvestigate,
  };
  // Opened panes need Split view, but that is the link's need, not the person's choice: their mode stays theirs.
  const prefs = {
    ...keep(x, page.mode),
    mode: opened.length || !canInvestigate ? x.s.prefs.mode : page.mode,
  };
  const y = { ...x, s: { ...x.s, prefs } };
  const base =
    page.mode === "single"
      ? single(p, page.item, page.tab, x.ctx)
      : split(y, p, page.item, page.tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? page.tab, x.ctx);
  if (opened.length) page.before = base.layout;
  return {
    op: o.fromUrl ? "arrive" : "mode",
    layout,
    view: { ...view, ...o.view },
    msg: say(x).pageOpened(p.name, page.mode),
    patch: { page, prefs, peekSource: undefined, resizeMode: null },
    undo: [],
  };
}

/** Back to the free workspace: the person's own layout again. The page's mode and layout are kept for next time. */
export function leavePage(x: Snapshot): Outcome {
  // A page-only app has no free workspace to go back to.
  if (!x.env.presets.length) return refuse("unavailable");
  const studio = preset(x, x.s.presetId) as Change;
  return { ...studio, patch: { ...studio.patch, page: null, prefs: keep(x) }, undo: [] };
}

/** Single or Split view. Leaving Split view keeps its layout exactly, opened panes included, for coming back. */
export function setMode(x: Snapshot, mode: ViewMode): Outcome {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r) return refuse("unavailable");
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
  if (!r.canInvestigate) return refuse("not-allowed", say(x).singleOnly);
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
export function openTab(x: Snapshot, role: string): Outcome {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r) return refuse("unavailable");
  if (!roleOf(p, role)) return refuse("not-found");
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
  if (!slot) return null;
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
  if (!p || !r || !r.canInvestigate || !roleOf(p, role)) return undefined;
  const base =
    r.mode === "single"
      ? split(x, p, r.item, r.tab, true)
      : { layout: x.s.layout, view: unzoomed(x.s.view) };
  const target = besideTarget(base.layout, base.view, x.ctx);
  if (!target || target === role) return undefined;
  const placed = placeRole(base.layout, base.view, role, target, "right", x.ctx);
  return placed ? { base, target, placed } : undefined;
}

/** Where ⌥-click would put a view, and what else moves: the very placement the commit runs. Pure. */
export function besidePreview(x: Snapshot, role: string): BesidePreview | undefined {
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

/** Drop a view from the tabs onto a pane's edge, a side of the screen (or centre: as a tab of its group). From Single, this switches to
 *  Split view first: dragging a tab out is asking for two views at once. Room is made by sending the least recently
 *  used views back to the tabs (settleRoles), never by folding views into tab groups. */
export function placeTab(
  x: Snapshot,
  role: string,
  target: NodeId,
  zone: Edge | "centre",
): Outcome {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r || !roleOf(p, role)) return null;
  const place = (y: Snapshot): Outcome => {
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
      patch: { page: { ...y.s.page!, tab: role } },
      focusDom: role,
      msg: d.sent.length
        ? say(x).both(said, say(x).sentToTabs(d.sent.map((id) => label(p, id))))
        : said,
    };
  };
  if (r.mode === "single")
    return r.canInvestigate
      ? [setMode(x, "split"), place]
      : refuse("not-allowed", say(x).singleOnly);
  return place(x);
}

/** ⌥-click a tab: that view beside the one you're in (the same placement besidePreview shows). */
export function openTabBeside(x: Snapshot, role: string): Outcome {
  const r = x.s.page;
  if (!r) return null;
  const target = (y: Snapshot) =>
    besideTarget(y.s.layout, unzoomed(y.s.view), y.ctx) ?? y.s.page!.tab;
  if (r.mode === "single")
    return r.canInvestigate
      ? [setMode(x, "split"), (y: Snapshot) => placeTab(y, role, target(y), endSide(y.ctx.dir))]
      : refuse("not-allowed", say(x).singleOnly);
  return placeTab(x, role, target(x), endSide(x.ctx.dir));
}

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
      o && typeof o === "object" && !Array.isArray(o) && o.op !== "refused" && o.msg
        ? { ...o, msg: say(x).both(say(x).alreadyView(t), o.msg) }
        : o;
    return (y: Snapshot) => prefix(apply1(placeTab(y, role, from, endSide(y.ctx.dir)), y));
  }
  const o = openTab(x, role);
  if (!o || typeof o !== "object" || Array.isArray(o) || o.op === "refused" || o.op === "answer")
    return o;
  const t = label(p, role);
  return {
    ...o,
    msg: o.op === "page" ? say(x).both(say(x).alreadyView(t), o.msg ?? "") : say(x).alreadyOpen(t),
  };
}

/** Another item: every role shows it, in place, and the previous item's investigation closes. */
export function activate(x: Snapshot, item: ItemId): Outcome {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r) return refuse("unavailable");
  if (r.item === item) return null;
  const page = { ...r, item, before: undefined };
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

/** Close every pane opened by following links; the layout comes back as the person left it. Undo (⌘K ⌘Z) reopens them. */
export function backToPage(x: Snapshot): Outcome {
  const r = x.s.page;
  if (!r) return refuse("unavailable");
  const name = x.env.profile?.name ?? "page";
  const opened = investigation(x.m.panes);
  if (!opened.length) return refuse("nothing-to-do", say(x).notInvestigating);
  const view = unzoomed(x.s.view);
  const plain = withoutOpened(x.s.layout, x.ctx);
  // Exactly as before the investigation, unless the views were rearranged meanwhile (then: as they are now).
  const same =
    r.before &&
    core.tree.shape(r.before.root) === core.tree.shape(plain.root) &&
    String(r.before.overlay?.hidden ?? []) === String(plain.overlay?.hidden ?? []);
  const layout = same ? core.refit(r.before!, view, x.ctx) : plain;
  const focused = x.m.pane(view.focused)?.role
    ? view
    : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  const undo = { kind: "closeOthers" as const, before: { layout: x.s.layout, view: x.s.view } };
  return {
    op: "close",
    layout,
    view: focused,
    patch: { page: { ...r, before: undefined } },
    msg: say(x).backToPage(name, opened.length),
    toast: messagesOf(x).toasts.backToPage(name, opened.length),
    undo: pushUndo(x.s.undoStack, undo),
  };
}

/** Close a view in Split view: it leaves the screen and waits in the tabs. Never the last one on screen. */
export function hideRole(x: Snapshot, id: NodeId): Outcome {
  const p = x.env.profile,
    node = x.m.pane(id);
  if (!p || x.s.page?.mode !== "split" || !node?.role) return null;
  const r = core.hide(x.s.layout, unzoomed(x.s.view), id, x.ctx);
  if (!r.ok)
    return r.reason === "last"
      ? refuse("last-pane", say(x).lastView(label(p, node.role)))
      : refuse("blocked");
  return {
    op: "hide",
    layout: r.layout,
    view: r.view,
    msg: say(x).roleHidden(label(p, node.role)),
    focusDom: r.view.focused,
  };
}

/** Reset Split view to the design, dropping this person's layout. The investigation stays. */
export function resetPage(x: Snapshot): Outcome {
  const p = x.env.profile,
    r = x.s.page;
  if (!p || !r) return refuse("unavailable");
  if (r.mode !== "split") return refuse("single-view");
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
      page: { ...r, before: opened.length ? base.layout : undefined },
      prefs: { ...x.s.prefs, split: null },
    },
    undo: [],
  };
}

/** A role permission. The limited viewer (a loan officer) works in Single only, and links peek; the full one (a
 *  credit reviewer) may multiplex. The profile names both (`viewers`). */
export function setCanInvestigate(x: Snapshot, canInvestigate: boolean): Outcome {
  const { s } = x;
  if (!s.page) return refuse("unavailable");
  if (s.page.canInvestigate === canInvestigate) return null;
  const msg = say(x).permission(
    viewerLabel(x.env.profile, canInvestigate, messagesOf(x).page),
    canInvestigate,
  );
  if (canInvestigate || s.page.mode === "single")
    return { op: "permission", msg, patch: { page: { ...s.page, canInvestigate } } };
  // From Split view: the switch to Single and the permission are one change, so a switch held for unsaved work
  // holds the permission too, and Keep editing leaves both as they were.
  const toSingle = setMode(x, "single") as Change;
  return {
    ...toSingle,
    msg,
    patch: { ...toSingle.patch, page: { ...toSingle.patch!.page!, canInvestigate } },
  };
}

/** The page's commands, in the palette after the layout commands: back to the page, its modes, opening and leaving
 *  it, and the viewer it is seen as. */
function pageCommands(env: Env): CommandDef[] {
  const profile = env.profile;
  const { commands: t, commandGroups: g, page: words } = messagesOf(env);
  const full = viewerLabel(profile, true, words);
  const limited = viewerLabel(profile, false, words);
  return [
    {
      id: "page.back",
      title: t.pageBack(profile?.name),
      group: g.layout,
      check: ({ s, m }) =>
        s.page && m.panes.some((p) => !p.role) ? undefined : refuse("unavailable"),
      run: (u) => u.actions.backToPage(),
    },
    {
      id: "page.reset",
      title: t.pageReset,
      group: g.layout,
      check: ({ s }) => (s.page?.mode === "split" ? undefined : refuse("unavailable")),
      run: (u) => u.actions.resetPage(),
    },
    {
      id: "page.single",
      title: t.pageSingle,
      group: g.layout,
      check: ({ s }) => (s.page?.mode === "split" ? undefined : refuse("unavailable")),
      run: (u) => u.actions.setMode("single"),
    },
    {
      id: "page.split",
      title: t.pageSplit,
      group: g.layout,
      check: ({ s }) =>
        s.page?.mode === "single" && s.page.canInvestigate ? undefined : refuse("unavailable"),
      run: (u) => u.actions.setMode("split"),
    },
    {
      id: "page.open",
      title: t.pageOpen(profile?.name),
      group: g.layout,
      check: ({ s }) => (s.page || !profile ? refuse("unavailable") : undefined),
      run: (u) => u.actions.openPage(),
    },
    {
      id: "page.leave",
      title: t.pageLeave(env.name),
      group: g.layout,
      check: ({ s }) => (s.page && env.presets.length ? undefined : refuse("unavailable")),
      run: (u) => u.actions.leavePage(),
    },
    {
      id: "page.as_limited",
      title: t.viewAsLimited(limited),
      group: g.settings,
      check: ({ s }) => (s.page?.canInvestigate ? undefined : refuse("unavailable")),
      run: (u) => u.actions.setCanInvestigate(false),
    },
    {
      id: "page.as_full",
      title: t.viewAsFull(full),
      group: g.settings,
      check: ({ s }) => (s.page && !s.page.canInvestigate ? undefined : refuse("unavailable")),
      run: (u) => u.actions.setCanInvestigate(true),
    },
  ];
}

/** The curated page's engine: what `definePage` puts on a page. */
export const pageEngine: PageEngine = {
  openPage,
  leavePage,
  setMode,
  openTab,
  openTabBeside,
  placeTab,
  activate,
  backToPage,
  hideRole,
  resetPage,
  setCanInvestigate,
  goToRole,
  investigation,
  placeAfterArrangement,
  settleRoles,
  withoutOpened,
  besidePreview,
  commands: pageCommands,
  words: pageEn,
};

/**
 * Makes a curated page: one item at a time, its views as tabs. Pass the result to `createJali({ page })`. This is the
 * one way in to the page's code (`pageEngine`), so an app that never calls it ships none of it. Returns a copy of
 * `page` with its engine; the fields are `page`'s own. (@jali/react's `definePage` calls it, and types the rail and
 * header.)
 */
export function definePage<P extends ProfileBase<any, any>>(page: P): P {
  return { ...page, [PAGE]: pageEngine };
}
