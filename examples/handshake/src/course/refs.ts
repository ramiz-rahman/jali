/**
 * Turns a step's target into the ref the lesson pane selects. A pane's ref is already one; a packet named by its
 * mark is looked up through the packets area's `captureMark`, and a mark that does not exist is reported, not
 * guessed, so the pane can say so.
 */
import type { ObjectRef } from "jali";
import type { Target } from "./types";

export type Resolved = { ok: true; ref: ObjectRef } | { ok: false; why: string };

/** `markOf` is the packets area's `captureMark`; it is passed in so this module (and its tests) need no captures. */
export function resolveTarget(
  target: Target,
  markOf: (capture: string, mark: string) => number | undefined,
): Resolved {
  if (!("mark" in target)) return { ok: true, ref: target };
  const n = markOf(target.capture, target.mark);
  return n === undefined
    ? { ok: false, why: `The capture “${target.capture}” has no packet marked “${target.mark}”.` }
    : { ok: true, ref: { kind: "packet", params: { capture: target.capture, n } } };
}
