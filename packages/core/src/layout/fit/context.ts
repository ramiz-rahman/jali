import type { FitOptions, LayoutContext } from "../types";
import { slots, type Projected } from "./overlay";
export const tooSmall = (root: Projected, fit: FitOptions) => root.bounds.width > fit.width + 1e-7 || root.bounds.height > fit.height + 1e-7;
export const misfit = (root: Projected, fit: FitOptions, paneCap: number) => tooSmall(root, fit) || slots(root).length > paneCap;

/** The context to fit in. A negative width or height (a container measured while it collapses) counts as zero; a
 *  non-finite size, a negative gap or a bad pane cap throws. */
export function checkContext(ctx: LayoutContext): LayoutContext {
  const { fit, paneCap } = ctx;
  if (![fit.width, fit.height, fit.gap].every(Number.isFinite) || fit.gap < 0) throw new RangeError("Fit dimensions and gap must be finite, and the gap non-negative");
  if (!Number.isInteger(paneCap) || paneCap < 1) throw new RangeError("paneCap must be a positive integer");
  return fit.width >= 0 && fit.height >= 0 ? ctx : { ...ctx, fit: { ...fit, width: Math.max(0, fit.width), height: Math.max(0, fit.height) } };
}
