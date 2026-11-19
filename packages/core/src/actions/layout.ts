import * as core from "../layout";
import type { Layout, NodeId, ViewState } from "../layout/types";
import type { PaneActivity } from "../pane-kinds";
import { presetById } from "../profile";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import { toLayout, type LayoutInput } from "../layout/build";
import { say } from "../state/messages";
import type { Settings } from "../state/settings";
import { withRecent } from "./open";

export function preset({ s, ctx, env }: Snapshot, id: string | undefined): Outcome {
  const p = presetById(env, id);
  if (!p) return null;
  const built = p.build();
  const initial = core.tree.panes(built.root)[0]?.id;
  const layout = core.resetLayout(
    built,
    { focused: initial, focusHistory: initial ? [initial] : [] },
    ctx,
  );
  const panes = core.tree.panes(layout.root);
  const first = panes[0]?.id;
  const view: ViewState = first ? { focused: first, focusHistory: [first] } : { focusHistory: [] };
  const recent = withRecent(env.kinds, s.recent, panes.map((p) => p.ref).reverse());
  return {
    op: "preset",
    layout,
    view,
    msg: say(env).preset(p.label),
    patch: { presetId: id, peekSource: undefined, resizeMode: null, recent },
  };
}

export const resetLayout = (x: Snapshot) => preset(x, x.s.presetId);

/** A layout arriving from outside (link, reload, Back): keep focus where it still exists, and fit it to the window.
 *  `presetId`: the preset the link says the layout came from (a known one); without it the preset stays as it is. */
export function arrive(
  { s, ctx }: Snapshot,
  layout: Layout,
  arrived: Partial<ViewState>,
  presetId?: string,
): Outcome {
  const panes = core.tree.panes(layout.root);
  const ids = new Set(panes.map((p) => p.id));
  const history = s.view.focusHistory.filter((id) => ids.has(id));
  const focused =
    s.view.focused && ids.has(s.view.focused) ? s.view.focused : (history[0] ?? panes[0]?.id);
  const view: ViewState = { focusHistory: history, ...arrived };
  if (focused) view.focused = focused;
  return {
    op: "arrive",
    layout: core.refit(layout, view, ctx),
    view,
    patch:
      s.page || presetId
        ? { ...(s.page ? { page: null } : {}), ...(presetId ? { presetId } : {}) }
        : undefined,
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
  const recent = withRecent(env.kinds, s.recent, panes.map((p) => p.ref).reverse());
  const page = s.page
    ? {
        page: null,
        prefs: { mode: s.page.mode, split: s.page.mode === "split" ? s.layout : s.prefs.split },
      }
    : {};
  return {
    op: "setLayout",
    layout: core.refit(layout, view, ctx),
    view,
    patch: { peekSource: undefined, resizeMode: null, recent, ...page },
    // A page's undo steps restore its layouts: they go with it, as when leaving the page.
    ...(s.page ? { undo: [] } : {}),
  };
}

export function setActivity({ s, m }: Snapshot, id: NodeId, a: PaneActivity): Outcome {
  return !m.pane(id) || s.activity[id] === a
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
export const changeSettings = ({ s }: Snapshot, patch: Partial<Settings>): Outcome => ({
  op: "patch",
  patch: { settings: { ...s.settings, ...patch } },
});
