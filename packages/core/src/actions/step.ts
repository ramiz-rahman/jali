/**
 * A step is an action as three parts: the app's `allow` controls it uses, on which panes (`control`), what else it
 * needs first (`check`), and what it does (`run`). The store asks `allow` for each control, then the check, then runs
 * it, in that order, every time: a control the app turned off is the answer before any other. Whatever offers the
 * action (a command, a header button, a menu, a tab, a drop target) asks the same gate (`can`, actions/index.ts), so
 * nothing offers what the action then refuses. A refusal only known after the work is done (the room there is, the
 * length of a link) is the run's to give, and comes back typed when it runs.
 */
import type { NodeId } from "../layout/types";
import type { Outcome, RefusalStep, Snapshot } from "../state/apply";
import { notAllowed, type PaneControl } from "./allow";
import type { Arg } from "./args";

/** An `allow` control a step uses, and the pane it uses it on (none: nothing to ask). */
export type ControlUse = readonly [PaneControl, NodeId | undefined];

/** A step. `args`, on a public action, check what it was given before anything else (actions/args.ts). */
export interface Step<A extends unknown[] = any[]> {
  // Methods, so a step of particular arguments is a step of any (the table holds them all).
  args?: readonly Arg<unknown>[];
  check?(x: Snapshot, ...a: A): RefusalStep | undefined;
  control?(x: Snapshot, ...a: A): readonly ControlUse[];
  run(x: Snapshot, ...a: A): Outcome;
}

/** What a step takes after the snapshot. */
export type StepArgsOf<S> = S extends { run(x: Snapshot, ...a: infer A): Outcome } ? A : never;

/** Why `step` can't run with `a` now (its arguments, `allow` for its controls, then its check); undefined when it can.
 *  A control on a pane that isn't there asks nothing: the check says it isn't. */
export function refusalOf(x: Snapshot, step: Step, a: readonly unknown[]): RefusalStep | undefined {
  const args = step.args ?? [];
  for (let i = 0; i < args.length; i++) {
    const problem = args[i]!(x, a[i]);
    if (problem) return problem;
  }
  for (const [control, pane] of step.control?.(x, ...a) ?? []) {
    const denied = notAllowed(x, pane, control);
    if (denied) return denied;
  }
  return step.check?.(x, ...a);
}

/** `step`, gated: for a step that is part of another (undo puts back a tuck, ⌥-click places a view). */
export const through = <A extends unknown[]>(x: Snapshot, step: Step<A>, ...a: A): Outcome =>
  refusalOf(x, step, a) ?? step.run(x, ...a);

/** `step` taking other arguments, `f` turning them into its own: each part sees what the step itself would. */
export const mapped = <A extends unknown[], B extends unknown[]>(
  step: Step<A>,
  f: (...b: B) => A,
): Step<B> => ({
  check: (x, ...b) => step.check?.(x, ...f(...b)),
  control: (x, ...b) => step.control?.(x, ...f(...b)) ?? [],
  run: (x, ...b) => step.run(x, ...f(...b)),
});

/** The one control a step uses on its pane (default: the focused one). */
export const uses =
  (control: PaneControl) =>
  (x: Snapshot, id: NodeId | undefined = x.s.view.focused): readonly ControlUse[] => [
    [control, id],
  ];
