/**
 * Curated pages (ui/profile.ts). Single mode shows one view, chosen from the tabs. Multiplexed mode lays the views out
 * freely, starting from the profile's design; each view exists once, and closing one sends it back to the tabs.
 * Panes opened by following links form an investigation after the layout that "Back to <page>" clears.
 */
import * as core from "../layout";
import type { Edge, Layout, LayoutContext, NodeId, ObjectRef, PaneNode, Rect, ViewState } from "../layout/types";
import { roleOf, viewerLabel, type ViewMode, type ProfileBase } from "../profile";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { msg, toasts } from "../state/messages";
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

interface Placed { layout: Layout; view: ViewState }

/** Every role shows `item`; opened panes keep what they show. */
function rebind(layout: Layout, p: ProfileBase, item: number): Layout {
  const refs = p.bind(item);
  const root = core.tree.map(layout.root, (n) => (n.type === "pane" && n.role && refs[n.role] ? { ...n, ref: refs[n.role]! } : n));
  return root === layout.root ? layout : { ...layout, root };
}

/** The layout without opened panes (what is saved, and what another item starts from). */
export function withoutOpened(layout: Layout, ctx: LayoutContext): Layout {
  let next = layout, view: ViewState = { focusHistory: [] };
  for (const o of investigation(core.tree.panes(layout.root))) ({ layout: next, view } = core.close(next, view, o.id, ctx));
  return next;
}

/** A saved layout is usable if it still holds every role exactly once. */
function usable(layout: Layout | null, p: ProfileBase): layout is Layout {
  if (!layout) return false;
  const roles = core.tree.panes(layout.root).flatMap((n) => (n.role ? [n.role] : []));
  return roles.length === p.roles.length && p.roles.every((r) => roles.includes(r.id));
}

/** Single mode: one pane, the chosen view. */
function single(p: ProfileBase, item: number, tab: string, ctx: LayoutContext): Placed {
  const r = roleOf(p, tab) ?? roleOf(p, p.home)!;
  const view: ViewState = { focused: r.id, focusHistory: [r.id] };
  const node: PaneNode = { id: r.id, type: "pane", size: { weight: 1 }, ref: p.bind(item)[r.id]!, role: r.id, priority: r.priority };
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

/** Multiplexed mode: the person's own layout (with or without the investigation it had), else the design. */
function multi(x: Snapshot, p: ProfileBase, item: number, tab: string, keepOpened: boolean): Placed {
  const { ctx } = x;
  const saved = x.s.prefs.multi;
  let layout = usable(saved, p) ? rebind(keepOpened ? saved : withoutOpened(saved, ctx), p, item) : p.build(item);
  // Coming from the home view (Overview), its sections are the panes now: focus the first one rather than adding it.
  const hidden = layout.overlay?.hidden ?? [];
  const focus = tab === p.home && hidden.includes(tab) ? p.roles.find((r) => !hidden.includes(r.id))?.id ?? tab : tab;
  const view: ViewState = { focused: focus, focusHistory: [focus] };
  layout = core.refit(layout, view, ctx);
  return onScreen(layout, view, focus, ctx);
}

/** Reopen opened panes after the layout; focus stays on `tab`. */
function reopen({ layout, view }: Placed, refs: ObjectRef[], tab: NodeId, ctx: LayoutContext): Placed {
  for (const ref of refs) ({ layout, view } = core.open(layout, view, tab, "right", ref, ctx, false, placeAfterArrangement(layout)));
  return { layout, view: core.focus(view, tab, ctx) };
}

/** The role the person is working in: the focused pane's, else the most recent one focused. */
function currentRole({ s, m }: Snapshot): string | undefined {
  return [s.view.focused, ...s.view.focusHistory].map((id) => m.pane(id)?.role).find(Boolean);
}

/** What the person keeps when the multiplexed layout leaves the screen. */
function keep(x: Snapshot, mode?: ViewMode): PagePrefs {
  const r = x.s.page;
  return { mode: mode ?? r?.mode ?? x.s.prefs.mode, multi: r?.mode === "multi" ? x.s.layout : x.s.prefs.multi };
}

const label = (p: ProfileBase, id: string | undefined) => roleOf(p, id)?.label ?? id ?? "";
/** A role's name in the page's tabs. */
export const roleLabel = (p: ProfileBase | null, id: string) => (p ? label(p, id) : id);

export interface OpenPage { item?: number; tab?: string; investigation?: ObjectRef[]; fromUrl?: boolean; view?: Partial<ViewState> }

/** Open the curated page (or arrive at it from a link). A link with opened panes needs Multiplexed to show them. */
export function openPage(x: Snapshot, o: OpenPage = {}): Outcome {
  const p = x.env.profile;
  if (!p) return null;
  const prev = x.s.page;
  const opened = o.investigation ?? [];
  const page: PageState = {
    profile: p.id,
    before: undefined,
    item: o.item ?? prev?.item ?? p.firstItem,
    tab: roleOf(p, o.tab)?.id ?? prev?.tab ?? p.home,
    mode: opened.length ? "multi" : prev?.mode ?? x.s.prefs.mode,
    canInvestigate: prev?.canInvestigate ?? true,
  };
  const prefs = keep(x, page.mode);
  const y = { ...x, s: { ...x.s, prefs } };
  const base = page.mode === "single" ? single(p, page.item, page.tab, x.ctx) : multi(y, p, page.item, page.tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? page.tab, x.ctx);
  if (opened.length) page.before = base.layout;
  return {
    op: o.fromUrl ? "arrive" : "mode", layout, view: { ...view, ...o.view }, msg: msg.pageOpened(p.name, page.mode),
    patch: { page, prefs, peekSource: undefined, resizeMode: null }, undo: [],
  };
}

/** Back to Data Studio: the person's own layout again. The page's mode and layout are kept for next time. */
export function leavePage(x: Snapshot): Outcome {
  const studio = preset(x, x.s.presetId) as Change;
  return { ...studio, patch: { ...studio.patch, page: null, prefs: keep(x) }, undo: [] };
}

/** Single or Multiplexed. Leaving Multiplexed keeps its layout exactly, opened panes included, for coming back. */
export function setMode(x: Snapshot, mode: ViewMode): Outcome {
  const p = x.env.profile, r = x.s.page;
  if (!p || !r || r.mode === mode) return null;
  if (mode === "single") {
    const tab = currentRole(x) ?? r.tab;
    const { layout, view } = single(p, r.item, tab, x.ctx);
    return { op: "mode", layout, view, msg: msg.modeSingle(label(p, tab)), patch: { page: { ...r, mode, tab }, prefs: keep(x, mode), peekSource: undefined }, undo: [] };
  }
  if (!r.canInvestigate) return refuse(msg.singleOnly);
  const { layout, view } = multi(x, p, r.item, r.tab, true);
  return { op: "mode", layout, view, msg: msg.modeMulti, patch: { page: { ...r, mode }, prefs: { ...x.s.prefs, mode } }, undo: [], focusDom: view.focused };
}

/** The view the person is working in, on screen: where a tab click puts another view. */
function slotFor({ s, m }: Snapshot): NodeId | undefined {
  return [s.view.focused, ...s.view.focusHistory, ...m.visible].find((id) => m.pane(id)?.role && m.visible.includes(id!));
}

/**
 * A tab click never reshapes the layout (layout stability, state/apply.ts). Single: that view replaces the one shown.
 * Multiplexed: on screen, it is focused; behind another tab, its tab is chosen; off screen, it takes the place of the
 * view you're in, at exactly that size, and that view goes back to the tabs. Placing a view beside is a drag or ⌥-click.
 */
export function openTab(x: Snapshot, role: string): Outcome {
  const p = x.env.profile, r = x.s.page;
  if (!p || !r || !roleOf(p, role)) return null;
  const patch = { page: { ...r, tab: role } };
  if (r.mode === "single") {
    if (r.tab === role) return null;
    const { layout, view } = single(p, r.item, role, x.ctx);
    return { op: "page", layout, view, msg: msg.viewing(label(p, role)), patch: { ...patch, peekSource: undefined } };
  }
  const view = unzoomed(x.s.view);
  if (x.m.visible.includes(role)) return { op: "focus", view: core.focus(view, role, x.ctx), patch, focusDom: role };
  if (!x.m.off.includes(role)) return { op: "reveal", layout: core.reveal(x.s.layout, role, x.ctx), view: core.focus(view, role, x.ctx), msg: msg.viewing(label(p, role)), patch, focusDom: role };
  const slot = slotFor(x);
  if (!slot) return null;
  const rep = core.replace(x.s.layout, view, slot, role, x.ctx);
  return {
    op: "page", layout: rep.layout, view: rep.view, patch, focusDom: role,
    msg: rep.reshaped ? msg.replacedNeedsRoom(label(p, role), label(p, slot)) : msg.replaced(label(p, role), label(p, slot)),
    ...(rep.reshaped ? { geometry: "reshape" as const } : {}),
  };
}

/**
 * Curated pages: a role view never folds into a tab group because of something placed (that would repeat page tabs
 * inside a pane). When placing a view leaves roles folded that were not before, the least recently used role views
 * (never `keep` or the focused one; supporting before primary) go back to the page tabs until none is folded. A view
 * that frees enough room on its own goes first. Pure.
 */
export function settleRoles(before: Layout, placed: Placed, keep: readonly NodeId[], ctx: LayoutContext): Placed & { sent: NodeId[] } {
  const role = (l: Layout, id: NodeId) => (core.tree.find(l.root, id) as PaneNode | undefined)?.role;
  const stacked = (l: Layout, v: ViewState) => new Set(core.resolve(l, v, ctx).stacks.filter((g) => g.kind === "fold").flatMap((g) => g.paneIds.filter((id) => id !== g.homeId)));
  const was = stacked(before, placed.view);
  const fresh = (l: Layout, v: ViewState) => [...stacked(l, v)].filter((id) => !was.has(id) && role(l, id));
  let { layout, view } = placed;
  const sent: NodeId[] = [];
  while (fresh(layout, view).length) {
    const boxes = core.resolve(layout, view, ctx).panes;
    const recency = (id: NodeId) => { const i = view.focusHistory.indexOf(id); return i < 0 ? Infinity : i; };
    const at = (id: NodeId) => boxes.findIndex((b) => b.id === id);
    const candidates = boxes
      .filter((b) => b.hidden !== "off" && role(layout, b.id) && !keep.includes(b.id) && b.id !== view.focused)
      .map((b) => core.tree.find(layout.root, b.id) as PaneNode)
      .sort((a, b) => Number(a.priority === "primary") - Number(b.priority === "primary") || recency(b.id) - recency(a.id) || at(b.id) - at(a.id));
    const hidden = candidates.map((c) => ({ c, r: core.hide(layout, view, c.id, ctx) })).filter((h) => h.r.ok);
    const tier = hidden.filter((h) => h.c.priority === hidden[0]?.c.priority);
    const pick = tier.find((h) => h.r.ok && !fresh(h.r.layout, h.r.view).length) ?? tier[0];
    if (!pick || !pick.r.ok) break;
    ({ layout, view } = pick.r);
    sent.push(pick.c.id);
  }
  return { layout, view, sent };
}

/** Put `role` at `zone` of `target`, then settle the roles. Pure: the ⌥ preview and the commit both run it. */
function placeRole(layout: Layout, view: ViewState, role: string, target: NodeId, zone: Edge | "centre", ctx: LayoutContext) {
  const d = core.drop(layout, view, role, target, zone, "tab", ctx);
  if (d.layout === layout) return null;
  const settled = settleRoles(layout, { layout: d.layout, view: core.focus(d.view, role, ctx) }, [role, target], ctx);
  return { ...settled, view: core.focus(settled.view, role, ctx) };
}

/** The view ⌥-click puts another beside: the focused pane if it is on screen, else the role in use on screen. */
function besideTarget(layout: Layout, view: ViewState, ctx: LayoutContext): NodeId | undefined {
  const boxes = core.resolve(layout, view, ctx).panes;
  const shown = (id?: NodeId) => !!id && boxes.some((b) => b.id === id && !b.hidden);
  return [view.focused, ...view.focusHistory].find(shown) ?? boxes.find((b) => !b.hidden && (core.tree.find(layout.root, b.id) as PaneNode).role)?.id;
}

/** What ⌥-click on a tab does, as layouts: where it starts (from Single, the multiplexed layout setMode shows), the
 *  view it goes beside, and the result. One function for the preview and the commit, so they cannot drift. */
function beside(x: Snapshot, role: string) {
  const p = x.env.profile, r = x.s.page;
  if (!p || !r || !r.canInvestigate || !roleOf(p, role)) return undefined;
  const base = r.mode === "single" ? multi(x, p, r.item, r.tab, true) : { layout: x.s.layout, view: unzoomed(x.s.view) };
  const target = besideTarget(base.layout, base.view, x.ctx);
  if (!target || target === role) return undefined;
  const placed = placeRole(base.layout, base.view, role, target, "right", x.ctx);
  return placed ? { base, target, placed } : undefined;
}

export interface BesidePreview {
  /** Where the view opens. */
  incoming: Rect;
  /** Other views whose rect changes, at their new rect. */
  moved: { id: NodeId; rect: Rect }[];
  /** Views that leave the screen (back to the tabs, or behind a tab). */
  leaving: NodeId[];
}

/** Where ⌥-click would put a view, and what else moves: the very placement the commit runs. Pure. */
export function besidePreview(x: Snapshot, role: string): BesidePreview | undefined {
  const b = beside(x, role);
  if (!b) return undefined;
  const shown = (l: Layout, v: ViewState) => new Map(core.resolve(l, v, x.ctx).panes.filter((p) => !p.hidden).map((p) => [p.id, p.rect]));
  const now = shown(x.s.layout, unzoomed(x.s.view)), next = shown(b.placed.layout, b.placed.view);
  const incoming = next.get(role);
  if (!incoming) return undefined;
  const same = (a: Rect, c: Rect) => [a.x - c.x, a.y - c.y, a.width - c.width, a.height - c.height].every((d) => Math.abs(d) < 0.5);
  const moved = [...next].filter(([id, rect]) => id !== role && !(now.has(id) && same(now.get(id)!, rect))).map(([id, rect]) => ({ id, rect }));
  return { incoming, moved, leaving: [...now.keys()].filter((id) => !next.has(id)) };
}

/** Drop a view from the tabs onto a pane's edge (or centre: as a tab of its group). From Single, this switches to
 *  Multiplexed first: dragging a tab out is asking for two views at once. Room is made by sending the least recently
 *  used views back to the tabs (settleRoles), never by folding views into tab groups. */
export function placeTab(x: Snapshot, role: string, target: NodeId, zone: Edge | "centre"): Outcome {
  const p = x.env.profile, r = x.s.page;
  if (!p || !r || !roleOf(p, role)) return null;
  const place = (y: Snapshot): Outcome => {
    if (role === target || !y.m.pane(target)) return openTab(y, role);
    const d = placeRole(y.s.layout, y.s.view, role, target, zone, y.ctx);
    if (!d) return openTab(y, role);
    const said = zone === "centre" ? msg.addedToTabsOf(label(p, role), y.m.title(target)) : msg.placed(label(p, role), zone, y.m.title(target));
    return {
      op: "drop", layout: d.layout, view: d.view, patch: { page: { ...y.s.page!, tab: role } }, focusDom: role,
      msg: d.sent.length ? `${said} · ${msg.sentToTabs(d.sent.map((id) => label(p, id)))}` : said,
    };
  };
  if (r.mode === "single") return r.canInvestigate ? [setMode(x, "multi"), place] : refuse(msg.singleOnly);
  return place(x);
}

/** ⌥-click a tab: that view beside the one you're in (the same placement besidePreview shows). */
export function openTabBeside(x: Snapshot, role: string): Outcome {
  const r = x.s.page;
  if (!r) return null;
  const target = (y: Snapshot) => besideTarget(y.s.layout, unzoomed(y.s.view), y.ctx) ?? y.s.page!.tab;
  if (r.mode === "single") return r.canInvestigate ? [setMode(x, "multi"), (y: Snapshot) => placeTab(y, role, target(y), "right")] : refuse(msg.singleOnly);
  return placeTab(x, role, target(x), "right");
}

/**
 * A link to an object that is already a view on this page goes to that view instead of opening it again: focused if on
 * screen, its tab chosen if behind another. Off screen, it is placed beside the pane the link is in: following a link
 * never takes away the pane you followed it from.
 */
/** Resolve one step of an outcome that may be a function of the snapshot. */
const apply1 = (o: Outcome, y: Snapshot): Outcome => (typeof o === "function" ? apply1(o(y), y) : o);

export function goToRole(x: Snapshot, role: string, from?: NodeId): Outcome {
  const p = x.env.profile;
  if (!p) return null;
  if (from && x.m.off.includes(role) && x.m.visible.includes(from)) {
    const t = label(p, role);
    const prefix = (o: Outcome): Outcome => (o && typeof o === "object" && !Array.isArray(o) && o.op !== "refused" && o.msg ? { ...o, msg: `${msg.alreadyView(t)} · ${o.msg}` } : o);
    return (y: Snapshot) => prefix(apply1(placeTab(y, role, from, "right"), y));
  }
  const o = openTab(x, role);
  if (!o || typeof o !== "object" || Array.isArray(o) || o.op === "refused") return o;
  const t = label(p, role);
  return { ...o, msg: o.op === "page" ? `${msg.alreadyView(t)} · ${o.msg}` : msg.alreadyOpen(t) };
}

/** Another item: every role shows it, in place, and the previous item's investigation closes. */
export function activate(x: Snapshot, item: number): Outcome {
  const p = x.env.profile, r = x.s.page;
  if (!p || !r || r.item === item) return null;
  const page = { ...r, item, before: undefined };
  const saved = x.s.prefs.multi;
  const prefs = { ...x.s.prefs, multi: saved && r.mode === "single" ? withoutOpened(saved, x.ctx) : saved };
  if (r.mode === "single") {
    const { layout, view } = single(p, item, r.tab, x.ctx);
    return { op: "activate", layout, view, msg: msg.activated(p.itemNoun, item, 0), patch: { page, prefs, peekSource: undefined }, undo: [] };
  }
  const dropped = investigation(x.m.panes).length;
  const view = unzoomed(x.s.view);
  const layout = core.refit(rebind(withoutOpened(x.s.layout, x.ctx), p, item), view, x.ctx);
  const focused = x.m.pane(view.focused)?.role ? view : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  return { op: "activate", layout, view: focused, msg: msg.activated(p.itemNoun, item, dropped), patch: { page, prefs, peekSource: undefined }, undo: [], ...(dropped ? { geometry: "reshape" as const } : {}) };
}

/** Close every pane opened by following links; the layout comes back as the person left it. Undo (⌘K ⌘Z) reopens them. */
export function backToPage(x: Snapshot): Outcome {
  const r = x.s.page;
  if (!r) return null;
  const name = x.env.profile?.name ?? "page";
  const opened = investigation(x.m.panes);
  if (!opened.length) return refuse(msg.notInvestigating);
  const view = unzoomed(x.s.view);
  const plain = withoutOpened(x.s.layout, x.ctx);
  // Exactly as before the investigation, unless the views were rearranged meanwhile (then: as they are now).
  const same = r.before && core.tree.shape(r.before.root) === core.tree.shape(plain.root) && String(r.before.overlay?.hidden ?? []) === String(plain.overlay?.hidden ?? []);
  const layout = same ? core.refit(r.before!, view, x.ctx) : plain;
  const focused = x.m.pane(view.focused)?.role ? view : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  const undo = { kind: "closeOthers" as const, before: { layout: x.s.layout, view: x.s.view } };
  return { op: "close", layout, view: focused, patch: { page: { ...r, before: undefined } }, msg: msg.backToPage(name, opened.length), toast: toasts.backToPage(name, opened.length), undo: pushUndo(x.s.undoStack, undo) };
}

/** Close a view in Multiplexed: it leaves the screen and waits in the tabs. Never the last one on screen. */
export function hideRole(x: Snapshot, id: NodeId): Outcome {
  const p = x.env.profile, node = x.m.pane(id);
  if (!p || x.s.page?.mode !== "multi" || !node?.role) return null;
  const r = core.hide(x.s.layout, unzoomed(x.s.view), id, x.ctx);
  if (!r.ok) return refuse(r.reason === "last" ? msg.lastView(label(p, node.role)) : undefined);
  return { op: "hide", layout: r.layout, view: r.view, msg: msg.roleHidden(label(p, node.role)), focusDom: r.view.focused };
}

/** Reset Multiplexed to the design, dropping this person's layout. The investigation stays. */
export function resetPage(x: Snapshot): Outcome {
  const p = x.env.profile, r = x.s.page;
  if (!p || r?.mode !== "multi") return null;
  const tab = currentRole(x) ?? r.tab;
  const opened = investigation(x.m.panes).map((o) => o.ref);
  const y = { ...x, s: { ...x.s, prefs: { ...x.s.prefs, multi: null } } };
  const base = multi(y, p, r.item, tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? tab, x.ctx);
  return { op: "preset", layout, view, msg: msg.pageReset, patch: { page: { ...r, before: opened.length ? base.layout : undefined }, prefs: { ...x.s.prefs, multi: null } }, undo: [] };
}

/** A role permission. The limited viewer (a loan officer) works in Single only, and links peek; the full one (a
 *  credit reviewer) may multiplex. The profile names both (`viewers`). */
export function setCanInvestigate(x: Snapshot, canInvestigate: boolean): Outcome {
  const { s } = x;
  if (!s.page || s.page.canInvestigate === canInvestigate) return null;
  const toSingle = !canInvestigate && s.page.mode === "multi" ? setMode(x, "single") : null;
  return [toSingle, (y: Snapshot) => ({ op: "permission", msg: msg.permission(viewerLabel(x.env.profile, canInvestigate), canInvestigate), patch: { page: { ...y.s.page!, canInvestigate } } })];
}
