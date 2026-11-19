import * as core from "../layout";
import type { Layout, NodeId, ViewState } from "../layout/types";
import type { PaneActivity } from "../pane-kinds";
import { presetById } from "../profile";
import type { Outcome, Snapshot } from "../state/apply";
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

/** A layout arriving from outside (link, reload, Back): keep focus where it still exists, and fit it to the window. */
export function arrive({ s, ctx }: Snapshot, layout: Layout, arrived: Partial<ViewState>): Outcome {
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
    patch: s.page ? { page: null } : undefined,
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
