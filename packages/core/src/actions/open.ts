import * as core from "../layout/engine";
import { treeSide } from "../layout/geometry/direction";
import type { Edge, NodeId, ObjectRef, PaneNode, ViewState } from "../layout/types";
import type { PaneKinds } from "../pane-kinds";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import type { Model } from "../state/model";
import { say } from "../state/messages";
import { follow, followLater, sameRef, setKept } from "./follow";
import { own } from "../own";
import { allows } from "./allow";
import { uses, type Step } from "./step";
import { peekSheet } from "./peek";

/** What a new split or a stack's "+" shows until the person chooses an object: the instance's launcher. */
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
export function openPaneFor(m: Model, ref: ObjectRef, except?: NodeId): PaneNode | undefined {
  if (m.env.kinds.identityOf(ref) === undefined) return undefined;
  return m.panes.find((p) => p.id !== except && m.env.kinds.sameObject(p.ref, ref));
}

/** The pane of `source`'s chain of links that shows `ref`'s object: `source`, a pane up its chain, or one it opened. */
function chainPaneFor({ m }: Snapshot, source: NodeId, ref: ObjectRef): NodeId | undefined {
  const { kinds } = m.env;
  if (kinds.identityOf(ref) === undefined) return undefined;
  const shows = (id: NodeId | undefined) => {
    const p = m.pane(id);
    return !!p && kinds.sameObject(p.ref, ref);
  };
  const seen = new Set<NodeId>();
  for (let up: NodeId | undefined = source; up && !seen.has(up); up = m.pane(up)?.linkedTo) {
    if (shows(up)) return up;
    seen.add(up);
  }
  return m.panes.find((p) => p.linkedTo === source && shows(p.id))?.id;
}

/** Where `openBeside` puts the new pane. */
export interface OpenBesideOptions {
  /** The side of the source the new pane opens on, as on screen: "right" is the right in either reading direction.
   *  Default: after the source in reading order (the right, or the left right to left). */
  edge?: Edge;
}

/**
 * Focus stays in the source. Opening the source's selected item (a list's row) links the new pane
 * to the selection: it follows it, or, when the list already has a following detail, it opens kept beside it for
 * comparison (layout/ops/follow.ts). The selected item is the selected object itself or, for another kind, what that
 * kind's `follow` shows for it (a chart for a watchlist's selected quote). Any other link opens a plain linked pane.
 * `edge` only says where a new pane goes: a link that replaces the source's earlier one, or shows a pane already open,
 * leaves that pane where it is. Where `allow` turns `open` off for the source, the link opens in the peek sheet instead,
 * in the free layout and on a curated page alike.
 */
export function openBeside(
  x: Snapshot,
  source: NodeId,
  ref: ObjectRef,
  opts: OpenBesideOptions = {},
): Outcome {
  const { s, m, ctx } = x;
  if (!allows(x, source, "open")) return peekSheet(x, ref, source);
  // `edge` is a screen side, as for move and split; the tree's own sides swap right to left. Default: after the source.
  const edge = opts.edge ? treeSide(opts.edge, ctx.dir) : "right";
  // A curated page decides how its links open (actions/page.ts `opening`): a peek, the pane already showing the
  // object, or where an opened pane goes and what opening one starts.
  const page = s.page ? x.env.page?.opening(x, source, ref, opts.edge && edge) : undefined;
  if (page && "instead" in page) return page.instead;
  const selected = own(s.selection, source)?.ref;
  const fromSelection = !!selected && sameRef(m.env.kinds.follow(ref.kind, selected), ref);
  // The list already has a following detail: opening its row keeps that detail in place when it shows the row (keep
  // it, browse on: the next open makes a new follower), or shows the row there now. Never a second copy of a row.
  const showing = fromSelection ? core.follower(s.layout, source, ref.kind) : undefined;
  if (showing)
    return sameRef(showing.ref, ref)
      ? setKept(x, showing.id, true)
      : [
          { op: "select", defer: followLater(source, null) },
          (y: Snapshot) => follow(y, source, selected!),
        ];
  // A detail of this list already shows the row (one kept earlier, with no follower now): show that one, focus stays.
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
  // A link never copies a pane of its own chain: the source itself, a pane it came from (up the chain), or a pane it
  // opened. That pane is shown instead and focus stays. Another chain may show the same object: the person may want
  // two customers' orders side by side.
  const inChain = !page ? chainPaneFor(x, source, ref) : undefined;
  if (inChain) {
    const revealed = core.reveal(s.layout, inChain, ctx);
    const msg = say(x).alreadyOpenBeside(m.title(inChain));
    // Already on screen, nothing changes but what is said.
    return revealed === s.layout
      ? { op: "focus", msg, result: inChain }
      : { op: "focusExisting", layout: revealed, view: s.view, msg, result: inChain };
  }
  // In a curated page nothing the person placed gives way for an opened pane: short of room, it opens as a tab.
  const r = core.open(s.layout, unzoomed(s.view), source, edge, ref, ctx, true, page?.place, {
    ...(page ? { yields: false } : {}),
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
  if (page && r.mode === "tab") ({ layout, view, opened, sent } = page.asTab(fromSelection));
  const openedKept =
    !!core.tree.panes(layout.root).find((p) => p.id === opened)?.kept && fromSelection;
  const said =
    openedKept && r.mode === "beside"
      ? say(x).openedKept(m.env.kinds.title(ref), m.title(source))
      : say(x).openedBeside(r.mode, m.env.kinds.title(ref), m.title(source));
  return {
    op: "open",
    layout,
    view,
    msg: sent.length ? say(x).both(said, say(x).sentToTabs(sent.map((id) => m.title(id)))) : said,
    patch: { recent: withRecent(m.env.kinds, s.recent, [ref]), ...page?.patch },
    result: opened,
  };
}

/** What Split needs of pane `id` (default: the focused one): a launcher to put beside it, and the free layout (a
 *  curated page's layout is its design, and links open panes there). The pane must allow `open`. */
const splitCheck = ({ s, m, env }: Snapshot, id = s.view.focused) =>
  !env.launcher || s.page
    ? refuse("unavailable")
    : !id || !m.pane(id)
      ? refuse("not-found")
      : undefined;

/** Split opens a launcher beside the pane, not a copy of it; focus moves in, because the person is about to choose.
 *  Without a direction: right for a wide pane, down for a tall one. */
export const split: Step<[NodeId?, ("right" | "bottom")?]> = {
  check: splitCheck,
  control: uses("open"),
  run(x, target = x.s.view.focused!, direction) {
    const { s, m, ctx } = x;
    const box = m.resolved.panes.find((b) => b.id === target);
    const dir = direction ?? (box && box.rect.height > box.rect.width ? "bottom" : "right");
    // `dir` is the screen's: "Split right" opens on the right in either reading direction.
    const r = core.split(
      s.layout,
      unzoomed(s.view),
      target,
      treeSide(dir, ctx.dir),
      launcherOf(x)!,
      ctx,
    );
    return {
      op: "split",
      layout: r.layout,
      view: core.focus(r.view, r.opened, ctx),
      msg: say(x).split(r.mode, dir, m.title(target)),
      result: r.opened,
    };
  },
};

/** "Split auto": the focused pane, right for a wide pane, down for a tall one. */
export const splitAuto: Step<[]> = {
  check: (x) => splitCheck(x),
  control: (x) => uses("open")(x),
  run: (x) => split.run(x),
};

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
export const newTab: Step<[NodeId?]> = {
  check: ({ s, m, env }, id = s.view.focused) =>
    !m.pane(id) ? refuse("not-found") : !env.launcher ? refuse("unavailable") : undefined,
  control: uses("open"),
  run(x, id = x.s.view.focused!) {
    const { s, m, ctx } = x;
    const r = core.addTab(s.layout, unzoomed(s.view), id, launcherOf(x)!, ctx);
    return {
      op: "newTab",
      layout: r.layout,
      view: r.view,
      msg: say(x).newTab(m.title(id)),
      result: r.opened,
    };
  },
};

/** `ref` as a new tab of pane `id`'s group (or a new group), shown and focused. Already open: that pane is shown. */
export const addTab: Step<[NodeId, ObjectRef]> = {
  check({ s, m, ctx }, id, ref) {
    if (s.page?.mode === "single") return refuse("single-view", say(m).singleNoLayout);
    if (!m.pane(id)) return refuse("not-found");
    return Object.hasOwn(ctx.fit.kinds, ref.kind) ? undefined : refuse("invalid");
  },
  control: uses("open"),
  run(x, id, ref) {
    const { s, m, ctx } = x;
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
  },
};

/** Seed Recent with what is already on screen (boot, link open), reading order first. */
export const noteOpen = ({ s, env }: Snapshot, refs: ObjectRef[]): Outcome => ({
  op: "patch",
  patch: { recent: withRecent(env.kinds, s.recent, [...refs].reverse()) },
});
