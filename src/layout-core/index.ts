import type { FitOptions, Layout, LayoutCore, LayoutCoreOptions } from "./types";
import { createOps } from "./ops";
import { resolve } from "./resolve";
import { encode, decode } from "./codec";
import { validate } from "./validate";

export type * from "./types";
export { snapToCentre } from "./focus";

export function createLayoutCore(options: LayoutCoreOptions = {}): LayoutCore {
  const paneCap = options.paneCap ?? 10;
  if (!Number.isInteger(paneCap) || paneCap < 1) throw new RangeError("paneCap must be a positive integer");
  const fits = new WeakMap<Layout, FitOptions>();
  const remember = (layout: Layout, fit: FitOptions) => { fits.set(layout, { ...fit }); };
  return {
    ...createOps(paneCap, remember, layout => fits.get(layout)),
    resolve(layout, view, fit) { const result = resolve(layout, view, fit, paneCap); remember(layout, fit); return result; },
    encode, decode, validate,
  };
}
