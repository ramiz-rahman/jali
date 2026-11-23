/**
 * Renaming a pane in place: double-click or F2 on a tab or a lone pane's title opens a field there. Jali keeps no
 * name: the app's `rename.run` saves it, and the pane shows it the way it shows any title (`useTitle`, or the kind's
 * `title` from params).
 */
import type { NodeId, ObjectRef } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";
import type { Step } from "./step";

/** `createJali({ rename })`: which panes can be renamed, and how to save a new name. */
export interface Rename {
  /** Whether `pane` can be renamed. Default: every pane. */
  can?(pane: { id: NodeId; ref: ObjectRef }): boolean;
  /**
   * Save `text` as `pane`'s name. Return `false` (or throw, or reject) to keep the field open with the text, so the
   * person can change it; a promise keeps the field busy until it settles.
   */
  run(pane: { id: NodeId; ref: ObjectRef }, text: string): void | false | Promise<void | false>;
}

/** Whether pane `id` can be renamed now. */
function canRename({ m, env }: Snapshot, id: NodeId | undefined): boolean {
  const p = m.pane(id);
  return !!p && !!env.rename && (env.rename.can?.({ id: p.id, ref: p.ref }) ?? true);
}

/** Open the rename field on pane `id`'s tab or title (default: the focused pane). */
export const startRename: Step<[NodeId?]> = {
  check: (x, id = x.s.view.focused) =>
    !id || !x.m.pane(id)
      ? refuse("not-found")
      : canRename(x, id)
        ? undefined
        : refuse("unavailable"),
  run: ({ s }, id = s.view.focused!) =>
    s.renaming === id ? null : { op: "patch", patch: { renaming: id } },
};

/** Close pane `id`'s rename field, saved or not. Only its own: a save that settles after another pane's field opened
 *  closes nothing. */
export const endRename = ({ s }: Snapshot, id: NodeId): Outcome =>
  s.renaming === id ? { op: "patch", patch: { renaming: null } } : null;
