/**
 * Copies where what an app hands Jali enters (the one action entry point, `setLayout`, `createJali`): refs, params
 * and layouts are plain data, so what Jali keeps is its own and a later edit by the app changes nothing it holds. What
 * is not plain data (a function, a DOM node, a class instance) passes as it is. Shared and cyclic parts stay shared
 * and cyclic, so validation still finds them. A structure nested past what any layout holds throws.
 */
const MAX_DEPTH = 1000;

export function copyIn<T>(value: T, depth = 0, seen = new Map<object, unknown>()): T {
  if (typeof value !== "object" || value === null) return value;
  const known = seen.get(value);
  if (known) return known as T;
  if (depth > MAX_DEPTH) throw new RangeError("Jali: too deeply nested");
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const v of value) out.push(copyIn(v, depth + 1, seen));
    return out as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value)) {
    const copy = copyIn(v, depth + 1, seen);
    // A key named `__proto__` is data here, never the prototype.
    if (k === "__proto__")
      Object.defineProperty(out, k, {
        value: copy,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else out[k] = copy;
  }
  return out as T;
}
