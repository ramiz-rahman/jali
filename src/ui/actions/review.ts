/**
 * Curated workspaces (ui/profile.ts). The arrangement comes from the product, the person's adjustments sit on top,
 * and panes opened by following links form an investigation at the right that "Back to review" clears.
 */
import * as core from "../../layout-core";
import type { Layout, NodeId, ObjectRef, PaneNode, ViewState } from "../../layout-core/types";
import { getProfile, roleOf, type WorkspaceProfile } from "../profile";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { adjustKey, adjustmentsOf, withAdjustments, type AdjustmentBook } from "../state/adjustments";
import { msg, toasts } from "../state/messages";
import type { ReviewState } from "../state/store";
import { pushUndo } from "../state/undo";
import { preset } from "./layout";

/** Panes the person opened while investigating: everything without a role. */
export const investigation = (panes: PaneNode[]) => panes.filter((p) => !p.role);

/** Opened panes go after the whole arrangement, so the investigation stays one region at the right. */
export function placeAfterArrangement(layout: Layout): core.Placement {
  const root = layout.root;
  return { target: root.type === "row" ? root.children.at(-1)!.id : root.id, edge: "right" };
}

interface Arranged { layout: Layout; view: ViewState }

/** The arrangement for an item, with the person's adjustments (unless `fresh`), then the investigation reopened. */
function arranged(x: Snapshot, p: WorkspaceProfile, r: ReviewState, book: AdjustmentBook, opened: ObjectRef[], fresh = false): Arranged {
  const { ctx } = x;
  const def = p.arrangements.find((a) => a.id === r.arrangement) ?? p.arrangements[0]!;
  let view: ViewState = { focused: p.anchor, focusHistory: [p.anchor] };
  const base = core.resetLayout(p.build(r.item), view, ctx);
  const adjust = (!fresh && book[adjustKey(p.id, def.id)]) || { sizes: {}, hidden: def.hidden };
  let layout = core.refit(withAdjustments(base, adjust, p), view, ctx);
  for (const ref of opened) {
    const o = core.openBeside(layout, view, p.anchor, ref, ctx, placeAfterArrangement(layout));
    layout = o.layout;
    view = o.view;
  }
  return { layout, view };
}

/** The adjustment book with the arrangement on screen written in (it lives in the layout while shown). */
function bookNow({ s }: Snapshot, p: WorkspaceProfile): AdjustmentBook {
  if (!s.review) return s.adjust;
  return { ...s.adjust, [adjustKey(p.id, s.review.arrangement)]: adjustmentsOf(s.layout, p, s.review.item) };
}

export interface EnterReview { arrangement?: string; item?: number; investigation?: ObjectRef[]; fromUrl?: boolean; fresh?: boolean; view?: Partial<ViewState> }

/** Open the curated workspace (or rebuild it: another arrangement, a reset, or a link arriving). */
export function enterReview(x: Snapshot, o: EnterReview = {}): Outcome {
  const p = getProfile();
  if (!p) return null;
  const prev = x.s.review;
  const review: ReviewState = {
    arrangement: [o.arrangement, prev?.arrangement].find((a) => p.arrangements.some((d) => d.id === a)) ?? p.arrangements[0]!.id,
    item: o.item ?? prev?.item ?? p.firstItem,
    canInvestigate: prev?.canInvestigate ?? true,
  };
  const book = bookNow(x, p);
  const { layout, view } = arranged(x, p, review, book, o.investigation ?? [], o.fresh);
  const label = p.arrangements.find((a) => a.id === review.arrangement)?.label ?? review.arrangement;
  return {
    op: o.fromUrl ? "arrive" : "arrange", layout, view: { ...view, ...o.view },
    msg: o.fresh ? msg.arrangementReset(label) : msg.arrangement(p.name, label),
    patch: { review, adjust: book, peekSource: undefined, resizeMode: null, undoStack: [] },
  };
}

/** Back to Data Studio: the person's own layout again. */
export function leaveReview(x: Snapshot): Outcome {
  const p = getProfile();
  const studio = preset(x, x.s.presetId) as Change;
  return { ...studio, patch: { ...studio.patch, review: null, ...(p ? { adjust: bookNow(x, p) } : {}) } };
}

export const arrange = (x: Snapshot, arrangement: string): Outcome =>
  x.s.review?.arrangement === arrangement ? null : enterReview(x, { arrangement, investigation: investigation(x.m.panes).map((p) => p.ref) });

/** Reset: the designed arrangement, without this person's sizes and hidden panes. The investigation stays. */
export const resetArrangement = (x: Snapshot): Outcome => enterReview(x, { fresh: true, investigation: investigation(x.m.panes).map((p) => p.ref) });

/** Another item: every role shows it, and the investigation of the previous one closes. Focus stays put. */
export function activate(x: Snapshot, item: number): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || !r || r.item === item) return null;
  const next = { ...r, item };
  const { layout } = arranged(x, p, next, bookNow(x, p), []);
  const keep = x.s.view.focused && !investigation(x.m.panes).some((q) => q.id === x.s.view.focused) ? x.s.view.focused : p.anchor;
  const view = core.focus(core.tree.unzoom(x.s.view), keep, x.ctx);
  const dropped = investigation(x.m.panes).length;
  return { op: "activate", layout, view, msg: msg.activated(p.itemNoun, item, dropped), patch: { review: next, peekSource: undefined } };
}

/** Close every pane opened while investigating; the arrangement comes back as the person left it. ⌘Z reopens them. */
export function backToReview(x: Snapshot): Outcome {
  const p = getProfile(), r = x.s.review;
  if (!p || !r) return null;
  const opened = investigation(x.m.panes);
  if (!opened.length) return refuse(msg.notInvestigating);
  const { layout, view } = arranged(x, p, r, bookNow(x, p), []);
  const undo = { kind: "closeOthers" as const, before: { layout: x.s.layout, view: x.s.view } };
  return { op: "close", layout, view, msg: msg.backToReview(opened.length), toast: toasts.backToReview(opened.length), undo: pushUndo(x.s.undoStack, undo) };
}

const labelOf = (p: WorkspaceProfile, id: NodeId) => roleOf(p, id)?.label ?? id;

/** Hide a supporting pane: it leaves the screen and waits as a toggle in the top bar. The primary pane always stays. */
export function hideRole(x: Snapshot, id: NodeId): Outcome {
  const p = getProfile(), node = x.m.pane(id);
  if (!p || !x.s.review || !node?.role) return null;
  if (node.priority === "primary") return refuse(msg.primaryStays(labelOf(p, node.role)));
  const r = core.hide(x.s.layout, core.tree.unzoom(x.s.view), id, x.ctx);
  if (!r.ok) return refuse(r.reason === "last" ? msg.onlyOnScreen(labelOf(p, node.role)) : undefined);
  return { op: "hide", layout: r.layout, view: r.view, msg: msg.roleHidden(labelOf(p, node.role)), focusDom: r.view.focused };
}

export function showRole(x: Snapshot, id: NodeId): Outcome {
  const p = getProfile();
  if (!p || !x.s.review) return null;
  const r = core.show(x.s.layout, x.s.view, id, x.ctx);
  if (!r.ok) return null;
  return { op: "show", layout: r.layout, view: r.view, msg: msg.roleShown(labelOf(p, id)), focusDom: id };
}

export const toggleRole = (x: Snapshot, id: NodeId): Outcome => (x.m.off.includes(id) ? showRole(x, id) : hideRole(x, id));

export function setCanInvestigate({ s }: Snapshot, canInvestigate: boolean): Outcome {
  if (!s.review || s.review.canInvestigate === canInvestigate) return null;
  return { op: "permission", msg: msg.permission(canInvestigate), patch: { review: { ...s.review, canInvestigate } } };
}
