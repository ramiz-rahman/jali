/**
 * Curated pages (ui/profile.ts). Single mode shows one view, chosen from the tabs. Multiplexed mode lays the views out
 * freely, starting from the profile's design; each view exists once, and closing one sends it back to the tabs.
 * Panes opened by following links form an investigation after the layout that "Back to review" clears.
 */
import * as core from "../../layout-core";
import type { Edge, Layout, LayoutContext, NodeId, ObjectRef, PaneNode, Rect, ViewState } from "../../layout-core/types";
import { getProfile, roleOf, type ViewMode, type WorkspaceProfile } from "../profile";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { msg, toasts } from "../state/messages";
import type { ReviewPrefs } from "../state/review-prefs";
import type { ReviewState } from "../state/store";
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
function rebind(layout: Layout, p: WorkspaceProfile, item: number): Layout {
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
function usable(layout: Layout | null, p: WorkspaceProfile): layout is Layout {
  if (!layout) return false;
  const roles = core.tree.panes(layout.root).flatMap((n) => (n.role ? [n.role] : []));
  return roles.length === p.roles.length && p.roles.every((r) => roles.includes(r.id));
}

/** Single mode: one pane, the chosen view. */
function single(p: WorkspaceProfile, item: number, tab: string, ctx: LayoutContext): Placed {
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
function multi(x: Snapshot, p: WorkspaceProfile, item: number, tab: string, keepOpened: boolean): Placed {
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
function keep(x: Snapshot, mode?: ViewMode): ReviewPrefs {
  const r = x.s.review;
  return { mode: mode ?? r?.mode ?? x.s.prefs.mode, multi: r?.mode === "multi" ? x.s.layout : x.s.prefs.multi };
}

const label = (p: WorkspaceProfile, id: string | undefined) => roleOf(p, id)?.label ?? id ?? "";

export interface EnterReview { item?: number; tab?: string; investigation?: ObjectRef[]; fromUrl?: boolean; view?: Partial<ViewState> }

/** Open the curated page (or arrive at it from a link). A link with opened panes needs Multiplexed to show them. */
export function enterReview(x: Snapshot, o: EnterReview = {}): Outcome {
  const p = getProfile();
  if (!p) return null;
  const prev = x.s.review;
  const opened = o.investigation ?? [];
  const review: ReviewState = {
    before: undefined,
    item: o.item ?? prev?.item ?? p.firstItem,
    tab: roleOf(p, o.tab)?.id ?? prev?.tab ?? p.home,
    mode: opened.length ? "multi" : prev?.mode ?? x.s.prefs.mode,
    canInvestigate: prev?.canInvestigate ?? true,
  };
  const prefs = keep(x, review.mode);
  const y = { ...x, s: { ...x.s, prefs } };
  const base = review.mode === "single" ? single(p, review.item, review.tab, x.ctx) : multi(y, p, review.item, review.tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? review.tab, x.ctx);
  if (opened.length) review.before = base.layout;
  return {
    op: o.fromUrl ? "arrive" : "mode", layout, view: { ...view, ...o.view }, msg: msg.reviewOpened(p.name, review.mode),
    patch: { review, prefs, peekSource: undefined, resizeMode: null }, undo: [],
  };
}

/** Back to Data Studio: the person's own layout again. The page's mode and layout are kept for next time. */
export function leaveReview(x: Snapshot): Outcome {
  const studio = preset(x, x.s.presetId) as Change;
  return { ...studio, patch: { ...studio.patch, review: null, prefs: keep(x) }, undo: [] };
}

/** Single or Multiplexed. Leaving Multiplexed keeps its layout exactly, opened panes included, for coming back. */
export function setMode(x: Snapshot, mode: ViewMode): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || !r || r.mode === mode) return null;
  if (mode === "single") {
    const tab = currentRole(x) ?? r.tab;
    const { layout, view } = single(p, r.item, tab, x.ctx);
    return { op: "mode", layout, view, msg: msg.modeSingle(label(p, tab)), patch: { review: { ...r, mode, tab }, prefs: keep(x, mode), peekSource: undefined }, undo: [] };
  }
  if (!r.canInvestigate) return refuse(msg.singleOnly);
  const { layout, view } = multi(x, p, r.item, r.tab, true);
  return { op: "mode", layout, view, msg: msg.modeMulti, patch: { review: { ...r, mode }, prefs: { ...x.s.prefs, mode } }, undo: [], focusDom: view.focused };
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
  const p = getProfile(), r = x.s.review;
  if (!p || !r || !roleOf(p, role)) return null;
  const patch = { review: { ...r, tab: role } };
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

/** Where ⌥-click would put a view: its rect in the layout that results, for the preview. Pure. */
export function besidePreview(x: Snapshot, role: string): Rect | undefined {
  const p = getProfile(), r = x.s.review;
  if (!p || !r || !r.canInvestigate || !roleOf(p, role)) return undefined;
  const base = r.mode === "single" ? multi(x, p, r.item, r.tab, true) : { layout: x.s.layout, view: unzoomed(x.s.view) };
  const target = r.mode === "single" ? base.view.focused : x.m.pane(x.s.view.focused) ? x.s.view.focused : r.tab;
  if (!target || target === role) return undefined;
  const d = core.drop(base.layout, base.view, role, target, "right", "tab", x.ctx);
  return core.resolve(d.layout, d.view, x.ctx).panes.find((b) => b.id === role && !b.hidden)?.rect;
}

/** Drop a view from the tabs onto a pane's edge (or centre: as a tab of its group). From Single, this switches to
 *  Multiplexed first: dragging a tab out is asking for two views at once. */
export function placeTab(x: Snapshot, role: string, target: NodeId, zone: Edge | "centre"): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || !r || !roleOf(p, role)) return null;
  const place = (y: Snapshot): Outcome => {
    if (role === target || !y.m.pane(target)) return openTab(y, role);
    const d = core.drop(y.s.layout, y.s.view, role, target, zone, "tab", y.ctx);
    if (d.layout === y.s.layout) return openTab(y, role);
    return { op: "drop", layout: d.layout, view: core.focus(d.view, role, y.ctx), msg: zone === "centre" ? msg.addedToTabsOf(label(p, role), y.m.title(target)) : msg.placed(label(p, role), zone, y.m.title(target)), patch: { review: { ...y.s.review!, tab: role } }, focusDom: role };
  };
  if (r.mode === "single") return r.canInvestigate ? [setMode(x, "multi"), place] : refuse(msg.singleOnly);
  return place(x);
}

/** ⌥-click a tab: that view beside the one you're in. */
export function openTabBeside(x: Snapshot, role: string): Outcome {
  const r = x.s.review;
  if (!r) return null;
  const target = r.mode === "single" ? r.tab : x.m.pane(x.s.view.focused) ? x.s.view.focused! : r.tab;
  return placeTab(x, role, target, "right");
}

/** Another item: every role shows it, in place, and the previous item's investigation closes. */
export function activate(x: Snapshot, item: number): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || !r || r.item === item) return null;
  const review = { ...r, item, before: undefined };
  const saved = x.s.prefs.multi;
  const prefs = { ...x.s.prefs, multi: saved && r.mode === "single" ? withoutOpened(saved, x.ctx) : saved };
  if (r.mode === "single") {
    const { layout, view } = single(p, item, r.tab, x.ctx);
    return { op: "activate", layout, view, msg: msg.activated(p.itemNoun, item, 0), patch: { review, prefs, peekSource: undefined }, undo: [] };
  }
  const dropped = investigation(x.m.panes).length;
  const view = unzoomed(x.s.view);
  const layout = core.refit(rebind(withoutOpened(x.s.layout, x.ctx), p, item), view, x.ctx);
  const focused = x.m.pane(view.focused)?.role ? view : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  return { op: "activate", layout, view: focused, msg: msg.activated(p.itemNoun, item, dropped), patch: { review, prefs, peekSource: undefined }, undo: [], ...(dropped ? { geometry: "reshape" as const } : {}) };
}

/** Close every pane opened by following links; the layout comes back as the person left it. ⌘Z reopens them. */
export function backToReview(x: Snapshot): Outcome {
  const r = x.s.review;
  if (!r) return null;
  const opened = investigation(x.m.panes);
  if (!opened.length) return refuse(msg.notInvestigating);
  const view = unzoomed(x.s.view);
  const plain = withoutOpened(x.s.layout, x.ctx);
  // Exactly as before the investigation, unless the views were rearranged meanwhile (then: as they are now).
  const same = r.before && core.tree.shape(r.before.root) === core.tree.shape(plain.root) && String(r.before.overlay?.hidden ?? []) === String(plain.overlay?.hidden ?? []);
  const layout = same ? core.refit(r.before!, view, x.ctx) : plain;
  const focused = x.m.pane(view.focused)?.role ? view : core.focus(view, currentRole(x) ?? r.tab, x.ctx);
  const undo = { kind: "closeOthers" as const, before: { layout: x.s.layout, view: x.s.view } };
  return { op: "close", layout, view: focused, patch: { review: { ...r, before: undefined } }, msg: msg.backToReview(opened.length), toast: toasts.backToReview(opened.length), undo: pushUndo(x.s.undoStack, undo) };
}

/** Close a view in Multiplexed: it leaves the screen and waits in the tabs. Never the last one on screen. */
export function hideRole(x: Snapshot, id: NodeId): Outcome {
  const p = getProfile(), node = x.m.pane(id);
  if (!p || x.s.review?.mode !== "multi" || !node?.role) return null;
  const r = core.hide(x.s.layout, unzoomed(x.s.view), id, x.ctx);
  if (!r.ok) return refuse(r.reason === "last" ? msg.lastView(label(p, node.role)) : undefined);
  return { op: "hide", layout: r.layout, view: r.view, msg: msg.roleHidden(label(p, node.role)), focusDom: r.view.focused };
}

/** Reset Multiplexed to the design, dropping this person's layout. The investigation stays. */
export function resetReview(x: Snapshot): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || r?.mode !== "multi") return null;
  const tab = currentRole(x) ?? r.tab;
  const opened = investigation(x.m.panes).map((o) => o.ref);
  const y = { ...x, s: { ...x.s, prefs: { ...x.s.prefs, multi: null } } };
  const base = multi(y, p, r.item, tab, false);
  const { layout, view } = reopen(base, opened, base.view.focused ?? tab, x.ctx);
  return { op: "preset", layout, view, msg: msg.reviewReset, patch: { review: { ...r, before: opened.length ? base.layout : undefined }, prefs: { ...x.s.prefs, multi: null } }, undo: [] };
}

/** A role permission. A loan officer works in Single only, and links peek; a credit reviewer may multiplex. */
export function setCanInvestigate(x: Snapshot, canInvestigate: boolean): Outcome {
  const { s } = x;
  if (!s.review || s.review.canInvestigate === canInvestigate) return null;
  const toSingle = !canInvestigate && s.review.mode === "multi" ? setMode(x, "single") : null;
  return [toSingle, (y: Snapshot) => ({ op: "permission", msg: msg.permission(canInvestigate), patch: { review: { ...y.s.review!, canInvestigate } } })];
}
