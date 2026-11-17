import * as core from "../../layout-core";
import type { Layout, NodeId, ViewState } from "../../layout-core/types";
import type { PaneActivity } from "../pane-kinds";
import { presetById, type PresetId } from "../presets";
import type { Outcome, Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import { withRecent } from "./open";

export function preset({ s, ctx }: Snapshot, id: PresetId): Outcome {
  const p = presetById(id);
  const built = p.build();
  const initial = core.tree.panes(built.root)[0]?.id;
  const layout = core.resetLayout(built, { focused: initial, focusHistory: initial ? [initial] : [] }, ctx);
  const panes = core.tree.panes(layout.root);
  const first = panes[0]?.id;
  const view: ViewState = first ? { focused: first, focusHistory: [first] } : { focusHistory: [] };
  const recent = withRecent(s.recent, panes.map((p) => p.ref).reverse());
  return { op: "preset", layout, view, msg: msg.preset(p.label), patch: { presetId: id, peekSource: undefined, resizeMode: null, recent } };
}

export const resetLayout = (x: Snapshot) => preset(x, x.s.presetId);

/** A layout arriving from outside (link, reload, Back): keep focus where it still exists, and fit it to the window. */
export function arrive({ s, ctx }: Snapshot, layout: Layout, arrived: Partial<ViewState>): Outcome {
  const panes = core.tree.panes(layout.root);
  const ids = new Set(panes.map((p) => p.id));
  const history = s.view.focusHistory.filter((id) => ids.has(id));
  const focused = s.view.focused && ids.has(s.view.focused) ? s.view.focused : history[0] ?? panes[0]?.id;
  const view: ViewState = { focusHistory: history, ...arrived };
  if (focused) view.focused = focused;
  return { op: "arrive", layout: core.refit(layout, view, ctx), view };
}

export function setActivity({ s }: Snapshot, id: NodeId, a: PaneActivity): Outcome {
  return s.activity[id] === a ? null : { op: "patch", patch: { activity: { ...s.activity, [id]: a } } };
}
