import * as core from "../../layout-core";
import type { NodeId, ObjectRef, PaneNode } from "../../layout-core/types";
import { identityOf, isRecordable, isTransient, paneTitle, sameObject, sameRecent } from "../pane-kinds";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { peek } from "./peek";
import { investigation, placeAfterArrangement } from "./review";
import type { WorkspaceModel } from "../state/model";
import { msg } from "../state/messages";

/** What a new split or a stack's "+" shows until the person chooses an object. */
export const LAUNCHER: ObjectRef = { kind: "launcher", params: {} };
export const RECENT_MAX = 8;
const unzoomed = core.tree.unzoom;

/** Recent with `refs` added, newest first, without repeats or kinds that are not recordable. */
export function withRecent(recent: ObjectRef[], refs: ObjectRef[]): ObjectRef[] {
  let out = recent;
  for (const ref of refs) if (isRecordable(ref)) out = [ref, ...out.filter((r) => !sameRecent(r, ref))];
  return out.slice(0, RECENT_MAX);
}

/** The pane already showing `ref`, other than `except`. Scratch kinds (no identity) never count. */
export function openPaneFor(m: WorkspaceModel, ref: ObjectRef, except?: NodeId): PaneNode | undefined {
  if (identityOf(ref) === undefined) return undefined;
  return m.panes.find((p) => p.id !== except && sameObject(p.ref, ref));
}

/** Founder decision 2: focus stays in the source. */
export function openBeside(x: Snapshot, source: NodeId, ref: ObjectRef): Outcome {
  const { s, m, ctx } = x;
  // A curated page: in Single mode, or for a role that may not investigate, a link peeks. Opened panes gather after the layout.
  if (s.review && !s.review.canInvestigate) return { ...(peek(x, ref, source) as Change), msg: msg.peekOnly(paneTitle(ref)) };
  if (s.review?.mode === "single") return { ...(peek(x, ref, source) as Change), msg: msg.peekSingle(paneTitle(ref)) };
  const place = s.review && m.pane(source)?.role ? placeAfterArrangement(s.layout) : undefined;
  // The first opened pane starts an investigation: remember the layout it started from.
  const review = s.review && !investigation(m.panes).length ? { review: { ...s.review, before: s.layout } } : {};
  const r = core.openBeside(s.layout, unzoomed(s.view), source, ref, ctx, place);
  const view = { ...r.view, focused: source, focusHistory: r.view.focusHistory.length ? r.view.focusHistory : [source] };
  return { op: "open", layout: r.layout, view, msg: msg.openedBeside(r.mode, paneTitle(ref), m.title(source)), patch: { recent: withRecent(s.recent, [ref]), ...review }, result: r.opened };
}

/** Split opens a launcher beside the pane, not a copy of it; focus moves in, because the person is about to choose. */
export function split({ s, m, ctx }: Snapshot, dir: "right" | "bottom", target = s.view.focused): Outcome {
  const p = m.pane(target);
  if (!p) return null;
  const r = core.split(s.layout, unzoomed(s.view), p.id, dir, LAUNCHER, ctx);
  return { op: "split", layout: r.layout, view: core.focus(r.view, r.opened, ctx), msg: msg.split(r.mode, dir, m.title(p.id)), result: r.opened };
}

/** "Split auto": right for a wide pane, down for a tall one. */
export function splitAuto(x: Snapshot): Outcome {
  const b = x.m.resolved.panes.find((p) => p.id === x.s.view.focused);
  return split(x, b && b.rect.height > b.rect.width ? "bottom" : "right");
}

/**
 * Show `ref` in pane `id`, in place (same node, new ref). If the object is already open elsewhere, focus that pane
 * instead and quietly drop a transient pane: one object, one pane.
 */
export function openHere({ s, m, ctx }: Snapshot, id: NodeId, ref: ObjectRef): Outcome {
  const p = m.pane(id);
  if (!p) return null;
  const patch = { recent: withRecent(s.recent, [ref]) };
  const dup = openPaneFor(m, ref, id);
  if (dup) {
    let layout = s.layout, view = unzoomed(s.view);
    if (isTransient(p.ref) && m.panes.length > 1) ({ layout, view } = core.close(layout, view, id, ctx));
    layout = core.reveal(layout, dup.id, ctx);
    return { op: "focusExisting", layout, view: core.focus(view, dup.id, ctx), msg: msg.alreadyOpen(paneTitle(dup.ref)), patch, result: dup.id };
  }
  const layout = core.setRef(s.layout, s.view, id, ref, ctx);
  return { op: "openHere", layout, view: core.focus(s.view, id, ctx), msg: msg.opened(paneTitle(ref)), patch, result: id };
}

/** Esc on an untouched launcher: close it without an undo toast; focus returns to where it came from. */
export function dismiss({ s, m, ctx }: Snapshot, id: NodeId): Outcome {
  if (!m.pane(id)) return null;
  if (m.panes.length <= 1) return refuse(msg.lastPaneStays);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return { op: "dismiss", layout: r.layout, view: r.view, msg: msg.launcherClosed(m.title(r.view.focused)) };
}

/** "+" on a tab strip and ⌘K "New tab here": a launcher as a new tab of the pane's stack (or a new stack). */
export function newTab({ s, m, ctx }: Snapshot, id = s.view.focused): Outcome {
  const p = m.pane(id);
  if (!p) return null;
  const r = core.addTab(s.layout, unzoomed(s.view), p.id, LAUNCHER, ctx);
  return { op: "newTab", layout: r.layout, view: r.view, msg: msg.newTab(m.title(p.id)), result: r.opened };
}

/** Seed Recent with what is already on screen (boot, link open), reading order first. */
export const noteOpen = ({ s }: Snapshot, refs: ObjectRef[]): Outcome => ({ op: "patch", patch: { recent: withRecent(s.recent, [...refs].reverse()) } });
