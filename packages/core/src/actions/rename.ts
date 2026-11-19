/**
 * Renaming a pane in place: double-click or F2 on a tab or a lone pane's title opens a field there. Jali keeps no
 * name: the app's `rename.run` saves it, and the pane shows it the way it shows any title (`useTitle`, or the kind's
 * `title` from params).
 */
import type { NodeId, ObjectRef } from "../layout/types";
import { refuse, type Outcome, type Snapshot } from "../state/apply";

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
export function canRename({ m, env }: Snapshot, id: NodeId | undefined): boolean {
  const p = m.pane(id);
  return !!p && !!env.rename && (env.rename.can?.({ id: p.id, ref: p.ref }) ?? true);
}

/** Open the rename field on pane `id`'s tab or title (default: the focused pane). */
export function startRename(x: Snapshot, id = x.s.view.focused): Outcome {
  if (!id || !x.m.pane(id)) return refuse("not-found");
  if (!canRename(x, id)) return refuse("unavailable");
  return x.s.renaming === id ? null : { op: "patch", patch: { renaming: id } };
}

/** Close the rename field, saved or not. */
export const endRename = ({ s }: Snapshot): Outcome =>
  s.renaming ? { op: "patch", patch: { renaming: null } } : null;

export const checkRename = (x: Snapshot) =>
  canRename(x, x.s.view.focused) ? undefined : refuse("unavailable");
