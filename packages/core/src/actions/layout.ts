import * as core from "../layout/engine";
import type { Layout, ViewState } from "../layout/types";
import { keepOwnParams } from "../pane-kinds";
import { presetById } from "../env";
import { refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import type { Step } from "./step";
import { toLayout, type LayoutInput } from "../layout/build";
import { messagesOf, say } from "../state/messages";
import { settingsWith, type Settings } from "../state/settings";
import { withRecent } from "./open";
import { agreeWithSelection, agreeOnArrival } from "./follow";

/**
 * Into the free layout: the one way a change leaves a curated page, whatever chose the layout (a preset, Reset layout,
 * `setLayout`, `page.leave`, a link or Back to a free layout). The page closes, keeping what its engine keeps for
 * next time (its mode and Split view layout), and its undo steps go with it, since they put back the page's layouts.
 * With no page open, `change` is as it is.
 */
export function intoFreeLayout(x: Snapshot, change: Change): Change {
  if (!x.s.page) return change;
  return {
    ...change,
    patch: { ...change.patch, page: null, ...x.env.page?.leaving(x) },
    undo: [],
  };
}

/** Switch to a preset: the layout the app saved for it (`PresetOptions.saved`), if it has one this instance can
 *  still read, else its own. `own`: always its own (Reset layout). */
export function preset(x: Snapshot, id: string | undefined, own = false): Outcome {
  const { s, ctx, env } = x;
  const p = presetById(env, id);
  if (!p) return null;
  const saved = own ? undefined : p.saved?.();
  // A preset's own layout is checked too: one that names a kind this instance no longer has can't be shown.
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
  return intoFreeLayout(x, {
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
  });
}

export const resetLayout = (x: Snapshot) => preset(x, x.s.presetId, true);

/** `input` as a layout this instance can show (a copy), or undefined: it names a kind it doesn't have, has two panes
 *  with one id, is malformed, or building it threw. */
export function readLayout(
  input: LayoutInput | (() => LayoutInput),
  env: Pick<Snapshot["env"], "kinds">,
  params?: boolean,
): Layout | undefined {
  try {
    const layout = structuredClone(toLayout(typeof input === "function" ? input() : input));
    // The app's own layout: one larger than a link opens, and grows no further (layout/codec/limits.ts).
    return core.validate(layout, env.kinds.registry(), { params, limits: false }).ok
      ? layout
      : undefined;
  } catch {
    return undefined;
  }
}

/** A layout arriving from outside (link, reload, Back): keep focus where it still exists, and fit it to the window.
 *  The lists' selections agree with what their followers show, which stay as the layout has them (`agreeOnArrival`).
 *  `presetId`: the preset the link says the layout came from (a known one); without it the preset stays as it is. */
export function arrive(
  x: Snapshot,
  from: Layout,
  arrived: Partial<ViewState>,
  presetId?: string,
): Outcome {
  const { s, ctx, env } = x;
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
    ...(presetId ? { presetId } : {}),
    ...(selection !== s.selection ? { selection } : {}),
  };
  return intoFreeLayout(x, {
    op: "arrive",
    layout: fitted,
    view,
    patch: Object.keys(patch).length ? patch : undefined,
  });
}

/**
 * `jali.setLayout`: a layout from the app (one it saved for this person, say). It replaces the free layout's
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
  // Malformed is "invalid"; larger than a link holds is "blocked", by the budget every change meets (state/apply.ts).
  if (!core.validate(layout, env.kinds.registry(), { limits: false }).ok) return refuse("invalid");
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
  return intoFreeLayout(x, {
    op: "setLayout",
    layout: agreed.layout,
    view,
    patch: {
      peekSource: undefined,
      resizeMode: null,
      recent,
      ...(agreed.selection !== s.selection ? { selection: agreed.selection } : {}),
    },
  });
}

/** The command palette (⌘K) and the settings panel. */
/** Refused as `"unavailable"` where the instance has no such dialog (its feature: `palette()`, `settings()`). */
const without = (x: Snapshot, id: "palette" | "settings") =>
  x.env.features?.some((f) => f.id === id) ? undefined : refuse("unavailable");
export const openPalette = (x: Snapshot): Outcome =>
  without(x, "palette") ?? { op: "patch", patch: { paletteOpen: true, chooser: null } };
export const closePalette = (): Outcome => ({ op: "patch", patch: { paletteOpen: false } });
export const openSettings = (x: Snapshot): Outcome =>
  without(x, "settings") ?? { op: "patch", patch: { settingsOpen: true } };
export const closeSettings = (): Outcome => ({ op: "patch", patch: { settingsOpen: false } });

/** Change the person's settings (theme, pane cap, ...): saved on this device, and the layout refits to a new cap. */
/** The person's settings with `patch` over them; `"invalid"` when any value is one the setting can't take (a
 *  `paneCap` that isn't a whole number from 1 to 64, a `centreDrop` other than "swap" or "tab", ...). Keys that
 *  aren't settings are left out. */
export function changeSettings({ s }: Snapshot, patch: Partial<Settings>): Outcome {
  const settings = settingsWith(s.settings, patch);
  return settings ? { op: "patch", patch: { settings } } : refuse("invalid");
}

/** The panes auto layout arranges: every one in the layout but those a curated page hides. */
const arranged = ({ s }: Snapshot) => {
  const hidden = new Set(s.layout.overlay?.hidden ?? []);
  return core.tree.panes(s.layout.root).filter((p) => !hidden.has(p.id));
};

/**
 * `jali.actions.autoLayout()`: arrange every pane in the free layout from the room there is and the kinds' size
 * hints (`layout.arrange`). The same panes, so their state survives; tucked and folded panes are placed too, and the
 * fit runs after. Like a preset, the address gets a new entry, so Back returns to the arrangement before.
 */
export const autoLayout: Step<[]> = {
  check(x) {
    // On a phone one pane shows at a time: there is nothing to arrange, and a tree arranged for a phone's width would
    // be a poor one when the window is wide again.
    if (x.s.page || x.m.onePane) return refuse("unavailable");
    return arranged(x).length < 2 ? refuse("nothing-to-do") : undefined;
  },
  // It moves every pane: a pane the app doesn't let move keeps the layout as it is.
  control: (x) => arranged(x).map((p) => ["move", p.id] as const),
  run(x) {
    const { s, ctx, env } = x;
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
  },
};

/** ⌘K "Toggle centre drop": the setting and what is said of it, one change. */
export const toggleCentreDrop: Step<[]> = {
  run(x) {
    const centreDrop = x.s.settings.centreDrop === "swap" ? "tab" : "swap";
    return {
      op: "patch",
      patch: { settings: { ...x.s.settings, centreDrop } },
      msg: messagesOf(x).announcements.centreDrop(centreDrop),
    };
  },
};
