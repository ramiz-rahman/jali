import type { Size } from "../types";

/** One child of a split, measured along the split's axis. */
export interface Share {
  size: Size;
  /** Never shrunk below this (the fit step folds a pane rather than squeeze it). */
  min: number;
  /** Spare space brings the child here first. Default: `min`. */
  comfortable?: number;
  /** The most the child usefully uses; past it, spare space goes to siblings that can still use it. Default: unbounded. */
  max?: number;
}

/**
 * How a split's children share its length.
 * - `"flex"` (a split nobody has sized): every child starts at its minimum; spare space then brings children up to
 *   their comfortable length (evenly: comfort is a need, so weight does not favour anyone yet), then up to their max,
 *   then past it, both in proportion to weight. So every pane reaches comfort before any grows past it, a record stops
 *   at its measure while a table beside it takes the rest, and the split never leaves a void.
 * - `"weights"` (the person sized a child): proportions are exact; only minimums bound them.
 * Fixed `px` children keep their length in both modes (shrunk toward their minimum when room runs out), and grow only
 * when no weighted child can take the space. Pure and deterministic.
 */
export function shares(items: Share[], available: number, mode: "flex" | "weights" = "flex"): number[] {
  const minimum = items.reduce((sum, item) => sum + item.min, 0);
  const budget = Math.max(available, minimum);
  const values = items.map(item => item.min);
  const fixed = items.flatMap((item, i) => "px" in item.size ? [i] : []);
  const weighted = items.flatMap((item, i) => "weight" in item.size ? [i] : []);
  for (const i of fixed) values[i] = Math.max((items[i]!.size as { px: number }).px, items[i]!.min);
  // A saved px preference cannot crowd out another child's minimum after a viewport shrink.
  const excess = Math.max(0, values.reduce((sum, v) => sum + v, 0) - budget);
  const slack = fixed.reduce((sum, i) => sum + values[i]! - items[i]!.min, 0);
  if (excess && slack) for (const i of fixed) values[i] = values[i]! - excess * (values[i]! - items[i]!.min) / slack;
  const weightOf = (i: number) => (items[i]!.size as { weight: number }).weight;
  const comfortable = (i: number) => Math.max(items[i]!.min, items[i]!.comfortable ?? items[i]!.min);
  const useful = (i: number) => Math.max(comfortable(i), items[i]!.max ?? Infinity);
  const spare = () => budget - values.reduce((sum, v) => sum + v, 0);
  if (mode === "flex") {
    fill(values, weighted, comfortable, () => 1, spare());
    fill(values, weighted, useful, weightOf, spare());
  }
  fill(values, weighted, () => Infinity, weightOf, spare());
  // Never leave a void: with no weighted child to take it, fixed children grow in proportion to their length.
  const proportional = (i: number) => Math.max(values[i]!, 1);
  const lengths = fixed.map(i => values[i]!);
  fill(values, fixed, i => Math.max(lengths[fixed.indexOf(i)]!, useful(i)), proportional, spare());
  fill(values, fixed, () => Infinity, proportional, spare());
  return values;
}

/**
 * Water-fill `spare` into `members`: each ends at `clamp(level * weight, current, cap)` for one common level, so
 * shares follow weight while no child shrinks or passes its cap. Mutates `values`.
 */
function fill(values: number[], members: readonly number[], cap: (i: number) => number, weight: (i: number) => number, spare: number): void {
  if (spare <= 1e-9) return;
  const floor = new Map(members.map(i => [i, values[i]!]));
  let pending = members.filter(i => values[i]! < cap(i) - 1e-9 && weight(i) > 0);
  let total = spare + pending.reduce((sum, i) => sum + values[i]!, 0);
  while (pending.length) {
    const sum = pending.reduce((s, i) => s + weight(i), 0);
    const raw = new Map(pending.map(i => [i, total * weight(i) / sum]));
    const bounded = pending.reduce((s, i) => s + Math.min(cap(i), Math.max(floor.get(i)!, raw.get(i)!)), 0);
    const low = bounded > total + 1e-7;
    const freeze = pending.filter(i => low ? raw.get(i)! < floor.get(i)! : raw.get(i)! > cap(i));
    if (!freeze.length) {
      for (const i of pending) values[i] = Math.min(cap(i), Math.max(floor.get(i)!, raw.get(i)!));
      return;
    }
    for (const i of freeze) {
      values[i] = low ? floor.get(i)! : cap(i);
      total -= values[i]!;
    }
    pending = pending.filter(i => !freeze.includes(i));
  }
}
