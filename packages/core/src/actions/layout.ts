import * as core from "../layout";
import type { Layout, NodeId, ViewState } from "../layout/types";
import { keepOwnParams, type PaneActivity } from "../pane-kinds";
import { presetById } from "../profile";
import { refuse, type Outcome, type RefusalStep, type Snapshot } from "../state/apply";
import { notAllowed } from "./allow";
import { toLayout, type LayoutInput } from "../layout/build";
import { say } from "../state/messages";
import { settingsWith, type Settings } from "../state/settings";
import { withRecent } from "./open";
import { agreeWithSelection, agreeOnArrival } from "./follow";
import { own } from "../own";

/** Switch to a preset: the layout the app saved for it (`PresetOptions.saved`), if it has one this workspace can
 *  still read, else its own. `own`: always its own (Reset layout). */
export function preset({ s, ctx, env }: Snapshot, id: string | undefined, own = false): Outcome {
  const p = presetById(env, id);
  if (!p) return null;
  const saved = own ? undefined : p.saved?.();
  // A preset's own layout is checked too: one that names a kind this workspace no longer has can't be shown.
  const built = (saved && readLayout(saved, env)) || readLayout(p.build, env);
  if (!built) return refuse("invalid");
  const initial = core.tree.panes(built.root)[0]?.id;
  const fitted = core.resetLayout(
    built,
    { focused: initial, focusHistory: initial ? [initial] : [] },
    ctx,
  );
  const first = core.tree.panes(fitted.root)[0]?.id;
  const view: ViewState = first ? { focused: first, focusHistory: [first] } : { focusHistory: [] };
  // A list that stays (the same id) keeps its selection: it and its new followers agree, the layout's word first.
  const { layout, selection } = agreeWithSelection({ s, ctx, env }, fitted, view);
  const panes = core.tree.panes(layout.root);
  const recent = withRecent(env.kinds, s.recent, panes.map((p) => p.ref).reverse());
  return {
    op: "preset",
    layout,
    view,
    msg: say(env).preset(p.label),
    patch: {
      presetId: id,
      peekSource: undefined,
      resizeMode: null,
      recent,
      ...(selection !== s.selection ? { selection } : {}),
    },
  };
}

export const resetLayout = (x: Snapshot) => preset(x, x.s.presetId, true);

/** `input` as a layout this workspace can show (a copy), or undefined: it names a kind it doesn't have, has two panes
 *  with one id, is malformed, or building it threw. */
export function readLayout(
  input: LayoutInput | (() => LayoutInput),
  env: Pick<Snapshot["env"], "kinds">,
): Layout | undefined {
  try {
    const layout = structuredClone(toLayout(typeof input === "function" ? input() : input));
    return core.validate(layout, env.kinds.registry()).ok ? layout : undefined;
  } catch {
    return undefined;
  }
}

/** A layout arriving from outside (link, reload, Back): keep focus where it still exists, and fit it to the window.
 *  The lists' selections agree with what their followers show, which stay as the layout has them (`agreeOnArrival`).
 *  `presetId`: the preset the link says the layout came from (a known one); without it the preset stays as it is. */
export function arrive(
  { s, ctx, env }: Snapshot,
  from: Layout,
  arrived: Partial<ViewState>,
  presetId?: string,
): Outcome {
  // What the address doesn't hold (`appOnly` and `link: false` params) stays on a pane that is still open, or comes
  // from the preset the link names.
  const layout = keepOwnParams(env.kinds.registry(), from, [
    s.layout,
    presetId ? presetById(env, presetId)?.build() : undefined,
  ]);
  const panes = core.tree.panes(layout.root);
  const ids = new Set(panes.map((p) => p.id));
  const history = s.view.focusHistory.filter((id) => ids.has(id));
  const kept = s.view.focused && ids.has(s.view.focused) ? s.view.focused : history[0];
  const view: ViewState = { focusHistory: history, ...arrived };
  if (kept) view.focused = kept;
  const fitted = core.refit(layout, view, ctx);
  // Nothing focused that the layout still has (a reload, a link opened afresh): the first pane on screen, as the link
  // shows it, not the first in the tree, which may be behind a tab. Fitted without a focus, so a reload at the same
  // size shows what the link's writer saw.
  if (!kept) {
    const first = core.resolve(fitted, view, ctx).panes.find((b) => !b.hidden)?.id ?? panes[0]?.id;
    if (first) view.focused = first;
  }
  // The lists' selections agree with the followers the layout brings (or start on them); the layout stays as it came.
  const selection = agreeOnArrival(env, layout, s.selection, s.selectionOf);
  const patch = {
    ...(s.page ? { page: null } : {}),
    ...(presetId ? { presetId } : {}),
    ...(selection !== s.selection ? { selection } : {}),
  };
  return {
    op: "arrive",
    layout: fitted,
    view,
    patch: Object.keys(patch).length ? patch : undefined,
  };
}

/**
 * `jali.setLayout`: a layout from the app (one it saved for this person, say). It replaces the free workspace's
 * layout like a preset does (the address gets a new entry, so Back returns), fitted to the room; focus stays where it
 * still exists. A curated page that is open closes, keeping its mode and layout for next time. Silent: the app chose it.
 */
export function restoreLayout(x: Snapshot, input: LayoutInput): Outcome {
  const { s, ctx, env } = x;
  let layout: Layout;
  try {
    layout = structuredClone(toLayout(input));
  } catch {
    return refuse("invalid");
  }
  if (!core.validate(layout, env.kinds.registry()).ok) return refuse("invalid");
  const panes = core.tree.panes(layout.root);
  const ids = new Set(panes.map((p) => p.id));
  const history = s.view.focusHistory.filter((id) => ids.has(id));
  const focused =
    s.view.focused && ids.has(s.view.focused) ? s.view.focused : (history[0] ?? panes[0]?.id);
  const view: ViewState = focused
    ? { focused, focusHistory: history.length ? history : [focused] }
    : { focusHistory: history };
  // A list that stays keeps its selection: it and its followers agree, the layout's word first (as for a preset).
  const agreed = agreeWithSelection({ s, ctx, env }, core.refit(layout, view, ctx), view);
  const recent = withRecent(
    env.kinds,
    s.recent,
    core.tree
      .panes(agreed.layout.root)
      .map((p) => p.ref)
      .reverse(),
  );
  const page = s.page
    ? {
        page: null,
        prefs: { mode: s.page.mode, split: s.page.mode === "split" ? s.layout : s.prefs.split },
      }
    : {};
  return {
    op: "setLayout",
    layout: agreed.layout,
    view,
    patch: {
      peekSource: undefined,
      resizeMode: null,
      recent,
      ...page,
      ...(agreed.selection !== s.selection ? { selection: agreed.selection } : {}),
    },
    // A page's undo steps restore its layouts: they go with it, as when leaving the page.
    ...(s.page ? { undo: [] } : {}),
  };
}

export function setActivity({ s, m }: Snapshot, id: NodeId, a: PaneActivity): Outcome {
  return !m.pane(id) || own(s.activity, id) === a
    ? null
    : { op: "patch", patch: { activity: { ...s.activity, [id]: a } } };
}

/** The command palette (⌘K) and the settings panel. */
export const openPalette = (): Outcome => ({
  op: "patch",
  patch: { paletteOpen: true, chooser: null },
});
export const closePalette = (): Outcome => ({ op: "patch", patch: { paletteOpen: false } });
export const openSettings = (): Outcome => ({ op: "patch", patch: { settingsOpen: true } });
export const closeSettings = (): Outcome => ({ op: "patch", patch: { settingsOpen: false } });

/** Change the person's settings (theme, pane cap, ...): saved on this device, and the layout refits to a new cap. */
/** The person's settings with `patch` over them; `"invalid"` when any value is one the setting can't take (a
 *  `paneCap` that isn't a whole number from 1 to 64, a `centreDrop` other than "swap" or "tab", ...). Keys that
 *  aren't settings are left out. */
export function changeSettings({ s }: Snapshot, patch: Partial<Settings>): Outcome {
  const settings = settingsWith(s.settings, patch);
  return settings ? { op: "patch", patch: { settings } } : refuse("invalid");
}

/**
 * `jali.actions.autoLayout()`: arrange every pane in the free workspace from the room there is and the kinds' size
 * hints (`layout.arrange`). The same panes, so their state survives; tucked and folded panes are placed too, and the
 * fit runs after. Like a preset, the address gets a new entry, so Back returns to the arrangement before.
 */
export function autoLayout(x: Snapshot): Outcome {
  const { s, ctx, env } = x;
  const cannot = checkAutoLayout(x);
  if (cannot) return cannot;
  const layout = core.arrange(s.layout, ctx, { focused: s.view.focused });
  // Already arranged so: no new layout, and no history entry.
  if (layout === s.layout) return refuse("nothing-to-do");
  const view: ViewState = { ...s.view, zoomed: undefined };
  return {
    op: "setLayout",
    layout: core.refit(layout, view, ctx),
    view,
    msg: say(env).arranged(core.tree.panes(layout.root).length),
    // The same panes: a peek keeps following the pane it came from.
    patch: { resizeMode: null },
  };
}

/** Why auto layout can't run now, for the action and its command alike; undefined when it can. */
export function checkAutoLayout(x: Snapshot): RefusalStep | undefined {
  const { s, m } = x;
  if (s.page) return refuse("unavailable");
  // On a phone one pane shows at a time: there is nothing to arrange, and a tree arranged for a phone's width would
  // be a poor one when the window is wide again.
  if (m.single) return refuse("unavailable");
  const hidden = new Set(s.layout.overlay?.hidden ?? []);
  const panes = core.tree.panes(s.layout.root).filter((p) => !hidden.has(p.id));
  if (panes.length < 2) return refuse("nothing-to-do");
  // It moves every pane: a pane the app doesn't let move keeps the layout as it is.
  for (const p of panes) {
    const denied = notAllowed(x, p.id, "move");
    if (denied) return denied;
  }
  return undefined;
}
