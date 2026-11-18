import type { FitOptions, LayoutContext } from "../types";
import { slots, type Projected } from "./overlay";
export const tooSmall = (root: Projected, fit: FitOptions) => root.bounds.width > fit.width + 1e-7 || root.bounds.height > fit.height + 1e-7;
export const misfit = (root: Projected, fit: FitOptions, paneCap: number) => tooSmall(root, fit) || slots(root).length > paneCap;

export function checkContext({ fit, paneCap }: LayoutContext): void {
  if (![fit.width, fit.height, fit.gap].every(Number.isFinite) || fit.width < 0 || fit.height < 0 || fit.gap < 0) throw new RangeError("Fit dimensions and gap must be finite and non-negative");
  if (!Number.isInteger(paneCap) || paneCap < 1) throw new RangeError("paneCap must be a positive integer");
}
