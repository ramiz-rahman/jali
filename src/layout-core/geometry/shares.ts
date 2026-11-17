import type { Size } from "../types";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export interface Share { size: Size; min: number; max?: number }

/** Fixed pixels first; weighted children freeze at their bounds and re-share the remainder. */
export function shares(items: Share[], available: number): number[] {
  const values = items.map(() => 0);
  const minimum = items.reduce((sum, item) => sum + item.min, 0);
  const budget = Math.max(available, minimum);
  const fixed = items.flatMap((item, i) => "px" in item.size ? [i] : []);
  const weighted = items.flatMap((item, i) => "weight" in item.size ? [i] : []);
  for (const i of fixed) values[i] = clamp((items[i]!.size as { px: number }).px, items[i]!.min, items[i]!.max ?? Infinity);
  const fixedTotal = fixed.reduce((sum, i) => sum + values[i]!, 0);
  const weightedMin = weighted.reduce((sum, i) => sum + items[i]!.min, 0);
  // A saved px preference cannot crowd out another child's hard minimum after a viewport shrink.
  const excess = Math.max(0, fixedTotal + weightedMin - budget);
  const slack = fixed.reduce((sum, i) => sum + values[i]! - items[i]!.min, 0);
  if (excess && slack) for (const i of fixed) values[i] = values[i]! - excess * (values[i]! - items[i]!.min) / slack;
  let remaining = budget - fixed.reduce((sum, i) => sum + values[i]!, 0);
  let pending = weighted;
  while (pending.length) {
    const weight = pending.reduce((sum, i) => sum + (items[i]!.size as { weight: number }).weight, 0);
    const raw = new Map(pending.map(i => [i, remaining * (items[i]!.size as { weight: number }).weight / weight]));
    const boundedTotal = pending.reduce((sum, i) => sum + clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity), 0);
    const freezeMin = boundedTotal > remaining + 1e-7;
    const freeze = pending.filter(i => freezeMin ? raw.get(i)! < items[i]!.min : raw.get(i)! > (items[i]!.max ?? Infinity));
    if (!freeze.length) {
      for (const i of pending) values[i] = clamp(raw.get(i)!, items[i]!.min, items[i]!.max ?? Infinity);
      break;
    }
    for (const i of freeze) {
      values[i] = freezeMin ? items[i]!.min : (items[i]!.max ?? Infinity);
      remaining -= values[i]!;
    }
    pending = pending.filter(i => !freeze.includes(i));
  }
  // Never leave a void: hand leftover space to children that can grow (fixed-px preferences included), in proportion, up to their max.
  let leftover = budget - values.reduce((sum, v) => sum + v, 0);
  let growable = items.map((_, i) => i).filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
  while (leftover > 1e-6 && growable.length) {
    const base = growable.reduce((sum, i) => sum + Math.max(values[i]!, 1), 0);
    let given = 0;
    for (const i of growable) {
      const add = Math.min(leftover * Math.max(values[i]!, 1) / base, (items[i]!.max ?? Infinity) - values[i]!);
      values[i] = values[i]! + add; given += add;
    }
    leftover -= given;
    growable = growable.filter(i => values[i]! < (items[i]!.max ?? Infinity) - 1e-7);
    if (given < 1e-9) break;
  }
  return values;
}
