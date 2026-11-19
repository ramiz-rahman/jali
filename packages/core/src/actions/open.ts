import * as core from "../layout";
import { treeSide } from "../layout/geometry/direction";
import type { NodeId, ObjectRef, PaneNode, ViewState } from "../layout/types";
import type { PaneKinds } from "../pane-kinds";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { peekSheet } from "./peek";
import { goToRole, investigation, placeAfterArrangement, roleLabel, settleRoles } from "./page";
import type { JaliModel } from "../state/model";
import { say } from "../state/messages";
import { follow, followLater, sameRef, setPinned } from "./follow";

/** What a new split or a stack's "+" shows until the person chooses an object: the workspace's launcher. */
const launcherOf = (x: Snapshot): ObjectRef | undefined =>
  x.env.launcher ? { kind: x.env.launcher, params: {} } : undefined;
export const RECENT_MAX = 8;
const unzoomed = core.tree.unzoom;

/** Recent with `refs` added, newest first, without repeats or kinds that are not recordable. */
export function withRecent(kinds: PaneKinds, recent: ObjectRef[], refs: ObjectRef[]): ObjectRef[] {
  let out = recent;
  for (const ref of refs)
    if (kinds.isRecordable(ref)) out = [ref, ...out.filter((r) => !kinds.sameRecent(r, ref))];
  return out.slice(0, RECENT_MAX);
}

/** The pane already showing `ref`, other than `except`. Scratch kinds (no identity) never count. */
export function openPaneFor(m: JaliModel, ref: ObjectRef, except?: NodeId): PaneNode | undefined {
  if (m.env.kinds.identityOf(ref) === undefined) return undefined;
  return m.panes.find((p) => p.id !== except && m.env.kinds.sameObject(p.ref, ref));
}

/**
 * Focus stays in the source. Opening the source's selected item (a list's row) links the new pane
 * to the selection: it follows it, or, when the list already has a following detail, it opens pinned beside it for
 * comparison (layout/ops/follow.ts). The selected item is the selected object itself or, for another kind, what that
 * kind's `follow` shows for it (a chart for a watchlist's selected quote). Any other link opens a plain linked pane.
 */
export function openBeside(x: Snapshot, source: NodeId, ref: ObjectRef): Outcome {
  const { s, m, ctx } = x;
  // A curated page: in Single mode, or for a role that may not investigate, a link peeks. Opened panes gather after the layout.
  if (s.page && !s.page.canInvestigate)
    return { ...peekSheet(x, ref, source), msg: say(x).peekOnly(m.env.kinds.title(ref)) };
  if (s.page?.mode === "single")
    return { ...peekSheet(x, ref, source), msg: say(x).peekSingle(m.env.kinds.title(ref)) };
  if (s.page) {
    // One object, one pane: a link to what is already on the page goes there (a view, whatever kind shows it).
    const dup = openPaneFor(m, ref);
    if (dup?.role) return goToRole(x, dup.role, source);
    if (dup)
      return {
        op: "focusExisting",
        layout: core.reveal(s.layout, dup.id, ctx),
        view: core.focus(unzoomed(s.view), dup.id, ctx),
        msg: say(x).alreadyOpen(m.title(dup.id)),
        result: dup.id,
      };
  }
  const place = s.page && m.pane(source)?.role ? placeAfterArrangement(s.layout) : undefined;
  // The first opened pane starts an investigation: remember the layout it started from.
  const page =
    s.page && !investigation(m.panes).length ? { page: { ...s.page, before: s.layout } } : {};
  // In a curated page nothing the person placed gives way for an opened pane: short of room, it opens as a tab.
  const selected = s.selection[source]?.ref;
  const fromSelection = !!selected && sameRef(m.env.kinds.follow(ref.kind, selected), ref);
  // The list already has a following detail: opening its row pins that detail in place when it shows the row (keep
  // it, browse on: the next open makes a new follower), or shows the row there now. Never a second copy of a row.
  const showing = fromSelection ? core.follower(s.layout, source, ref.kind) : undefined;
  if (showing)
    return sameRef(showing.ref, ref)
      ? setPinned(x, showing.id, true)
      : [
          { op: "select", defer: followLater(source, null) },
          (y: Snapshot) => follow(y, source, selected!),
        ];
  // A detail of this list already shows the row (one pinned earlier, with no follower now): show that one, focus stays.
  const kept = fromSelection
    ? m.panes.find((p) => p.linkedTo === source && sameRef(p.ref, ref))
    : undefined;
  if (kept)
    return {
      op: "focusExisting",
      layout: core.reveal(s.layout, kept.id, ctx),
      view: s.view,
      msg: say(x).alreadyOpenBeside(m.title(kept.id)),
      result: kept.id,
    };
  const r = core.openBeside(s.layout, unzoomed(s.view), source, ref, ctx, place, {
    ...(s.page ? { yields: false } : {}),
    ...(fromSelection ? { fromSelection } : {}),
  });
  let layout = r.layout,
    opened = r.opened,
    sent: NodeId[] = [];
  let view: ViewState = {
    ...r.view,
    focused: source,
    focusHistory: r.view.focusHistory.length ? r.view.focusHistory : [source],
  };
  if (s.page && r.mode === "tab") {
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
    ({ layout, view, sent } = settleRoles(
      s.layout,
      { layout: linked, view: t.view },
      [source, t.opened],
      ctx,
    ));
    opened = t.opened;
  }
  const pinned =
    !!core.tree.panes(layout.root).find((p) => p.id === opened)?.pinned && fromSelection;
  const said =
    pinned && r.mode === "beside"
      ? say(x).openedPinned(m.env.kinds.title(ref), m.title(source))
      : say(x).openedBeside(r.mode, m.env.kinds.title(ref), m.title(source));
  return {
    op: "open",
    layout,
    view,
    msg: sent.length
      ? say(x).both(said, say(x).sentToTabs(sent.map((id) => roleLabel(x.env.profile, id))))
      : said,
    patch: { recent: withRecent(m.env.kinds, s.recent, [ref]), ...page },
    result: opened,
  };
}

/** Split opens a launcher beside the pane, not a copy of it; focus moves in, because the person is about to choose. */
export function split(x: Snapshot, dir: "right" | "bottom", target = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const p = m.pane(target);
  const launcher = launcherOf(x);
  if (!p) return refuse("not-found");
  if (!launcher) return refuse("unavailable");
  // `dir` is the screen's: "Split right" opens on the right in either reading direction.
  const r = core.split(s.layout, unzoomed(s.view), p.id, treeSide(dir, ctx.dir), launcher, ctx);
  return {
    op: "split",
    layout: r.layout,
    view: core.focus(r.view, r.opened, ctx),
    msg: say(x).split(r.mode, dir, m.title(p.id)),
    result: r.opened,
  };
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
  const patch = { recent: withRecent(m.env.kinds, s.recent, [ref]) };
  const dup = openPaneFor(m, ref, id);
  if (dup) {
    let layout = s.layout,
      view = unzoomed(s.view);
    if (m.env.kinds.isTransient(p.ref) && m.panes.length > 1)
      ({ layout, view } = core.close(layout, view, id, ctx));
    layout = core.reveal(layout, dup.id, ctx);
    return {
      op: "focusExisting",
      layout,
      view: core.focus(view, dup.id, ctx),
      msg: say(m).alreadyOpen(m.env.kinds.title(dup.ref)),
      patch,
      result: dup.id,
    };
  }
  // Choosing in a launcher fills a placeholder: the chosen object settles to its own measure (a reshape), not the
  // placeholder's slot. Replacing a real object keeps the slot (a swap).
  if (m.env.kinds.isTransient(p.ref)) {
    const layout = core.setRef(s.layout, s.view, id, ref, ctx, { hold: false });
    return {
      op: "openHere",
      geometry: "reshape",
      layout,
      view: core.focus(s.view, id, ctx),
      msg: say(m).opened(m.env.kinds.title(ref)),
      patch,
      result: id,
    };
  }
  const layout = core.setRef(s.layout, s.view, id, ref, ctx);
  return {
    op: "openHere",
    layout,
    view: core.focus(s.view, id, ctx),
    msg: say(m).opened(m.env.kinds.title(ref)),
    patch,
    result: id,
  };
}

/** Esc on an untouched launcher: close it without an undo toast; focus returns to where it came from. */
export function dismiss({ s, m, ctx }: Snapshot, id: NodeId): Outcome {
  if (!m.pane(id)) return null;
  if (m.panes.length <= 1) return refuse("last-pane", say(m).lastPaneStays);
  const r = core.close(s.layout, unzoomed(s.view), id, ctx);
  return {
    op: "dismiss",
    layout: r.layout,
    view: r.view,
    msg: say(m).launcherClosed(m.title(r.view.focused)),
  };
}

/** "+" on a tab strip and ⌘K "New tab here": a launcher as a new tab of the pane's stack (or a new stack). */
export function newTab(x: Snapshot, id = x.s.view.focused): Outcome {
  const { s, m, ctx } = x;
  const p = m.pane(id);
  const launcher = launcherOf(x);
  if (!p) return refuse("not-found");
  if (!launcher) return refuse("unavailable");
  const r = core.addTab(s.layout, unzoomed(s.view), p.id, launcher, ctx);
  return {
    op: "newTab",
    layout: r.layout,
    view: r.view,
    msg: say(x).newTab(m.title(p.id)),
    result: r.opened,
  };
}

/** `ref` as a new tab of pane `id`'s group (or a new group), shown and focused. Already open: that pane is shown. */
export function addTab(x: Snapshot, id: NodeId, ref: ObjectRef): Outcome {
  const { s, m, ctx } = x;
  if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
  if (!m.pane(id)) return refuse("not-found");
  if (!ctx.fit.kinds[ref.kind]) return refuse("invalid");
  const dup = openPaneFor(m, ref);
  if (dup)
    return {
      op: "focusExisting",
      layout: core.reveal(s.layout, dup.id, ctx),
      view: core.focus(unzoomed(s.view), dup.id, ctx),
      msg: say(m).alreadyOpen(m.title(dup.id)),
      result: dup.id,
    };
  const r = core.addTab(s.layout, unzoomed(s.view), id, ref, ctx);
  return {
    op: "newTab",
    layout: r.layout,
    view: r.view,
    msg: say(m).opened(m.env.kinds.title(ref)),
    patch: { recent: withRecent(m.env.kinds, s.recent, [ref]) },
    result: r.opened,
  };
}

/** Seed Recent with what is already on screen (boot, link open), reading order first. */
export const noteOpen = ({ s, env }: Snapshot, refs: ObjectRef[]): Outcome => ({
  op: "patch",
  patch: { recent: withRecent(env.kinds, s.recent, [...refs].reverse()) },
});
