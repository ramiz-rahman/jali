/** What a pane's content reports to the instance: unsaved work, its ⌘K commands and its own state. */
export { mergeReports, type PaneReport, type PaneReportPatch } from "../state/reports";
import type { NodeId, ObjectRef } from "../layout/types";
import { each, refuse, type Change, type Outcome, type Snapshot } from "../state/apply";
import { DIRECT, DIRECT_SEQ, withMaps, withReport, type PaneReportPatch } from "../state/reports";
import { follow } from "./follow";
import { say } from "../state/messages";
import { own } from "../own";
import { objectKey, paneStateFor } from "../state/pane-state";

/**
 * One caller's report for pane `id` (`patch: null` when the caller unmounts). The reports and the maps made from them
 * change together (state/reports.ts). A following detail held on its object by unsaved work (actions/follow.ts)
 * catches up with its list's selection as soon as the work is gone: a separate part, so the report stands even if
 * the catch-up is refused.
 */
export function reportPane(
  { s, m }: Snapshot,
  id: NodeId,
  caller: string,
  seq: number,
  patch: PaneReportPatch | null,
): Outcome {
  const p = m.pane(id);
  if (!p) return null;
  const reports = withReport(s.paneReports, id, caller, seq, patch);
  if (reports === s.paneReports) return null;
  const next = withMaps(s, reports);
  const change: Change = { op: "patch", patch: next };
  const saved =
    own(s.unsaved, id) !== undefined && own(next.unsaved ?? s.unsaved, id) === undefined;
  const sel = saved && p.follows && p.linkedTo ? own(s.selection, p.linkedTo) : undefined;
  return sel ? each(change, (y: Snapshot) => follow(y, p.linkedTo!, sel.ref, id)) : change;
}

/** A report made directly, for an adapter or a test (`store.actions.setUnsaved(id, "a draft")`): kept as one more
 *  caller's, so it merges with what the pane's hooks report rather than overwriting it. */
const direct =
  <K extends keyof PaneReportPatch>(field: K) =>
  (x: Snapshot, id: NodeId, value: PaneReportPatch[K]): Outcome =>
    reportPane(x, id, DIRECT, DIRECT_SEQ, { [field]: value ?? null });

/** The pane's unsaved work (useUnsaved), or `null` once it is saved or discarded. */
export const setUnsaved = direct("unsaved");
/** The pane's commands for ⌘K (useCommands); `null` or none clears them. */
export const setPaneCommands = direct("commands");
/** The pane's title from its data (useTitle), in place of its kind's; `null` goes back to the kind's. */
export const setTitle = direct("title");
/** The pane's `data-*` attributes from its data (usePaneAttributes); `null` or none clears them. A name that is not
 *  `data-*`, or that Jali's own parts use, is dropped (state/reports.ts). */
export const setPaneAttributes = direct("attributes");
/** What the pane is doing (useActivity): working, needs you, failed, or idle. */
export const setActivity = direct("activity");

/** One value of a pane's own state. JSON only: it is saved with the person's settings. It belongs to the object the
 *  pane shows: state kept under the id for another object (one an undo could bring back) is replaced. `ref`: the
 *  object the writer saw the pane show. If the pane shows another one now (a setter kept from before `openHere`, a
 *  delayed callback), the value is dropped, never written into the new object's state. */
export function setPaneState(
  { s, m, env }: Snapshot,
  id: NodeId,
  key: string,
  value: unknown,
  ref?: ObjectRef,
): Outcome {
  const p = m.pane(id);
  if (!p) return null;
  const of = objectKey(env.kinds, p.ref);
  if (ref && objectKey(env.kinds, ref) !== of) return null;
  const mine = paneStateFor(s, env.kinds, id, p.ref);
  if (mine && Object.is(own(mine, key), value)) return null;
  // Another object's state under this id is one an undo could still bring back (the layout prunes it once none can):
  // it is held for it, not lost.
  const was = own(s.paneStateOf, id),
    other = was !== undefined && was !== of ? own(s.paneState, id) : undefined;
  return {
    op: "patch",
    patch: {
      paneState: { ...s.paneState, [id]: { ...mine, [key]: value } },
      ...(was === of ? {} : { paneStateOf: { ...s.paneStateOf, [id]: of } }),
      ...(other
        ? {
            paneStateHeld: {
              ...s.paneStateHeld,
              [id]: { ...own(s.paneStateHeld, id), [was!]: other },
            },
          }
        : {}),
    },
  };
}

/**
 * "Discard": the held action runs again against the state now. If it still loses only the work asked about, it is
 * made, and that work is forgotten in the same commit; if it would now lose other work, the question is asked again.
 * Nothing is forgotten when it no longer happens.
 */
export function discardAndContinue({ s }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    { op: "patch", patch: { confirm: null } },
    {
      op: "answer",
      intent: c.intent,
      agreed: { ...c.agreed, discard: [...(c.agreed.discard ?? []), ...c.asked] },
      settle: c.settle,
      action: c.action,
      input: c.input,
    },
  ];
}

/** "Keep editing": drop the held action. */
export function keepEditing({ s, env }: Snapshot): Outcome {
  const c = s.confirm;
  if (!c) return null;
  return [
    { op: "patch", patch: { confirm: null }, msg: say(env).keptEditing },
    { op: "answer", intent: () => refuse("kept"), agreed: {}, settle: c.settle },
  ];
}
