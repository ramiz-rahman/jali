/**
 * Each layout as the top bar's layout keys draw it: its plan, small, as rectangles on a 22 × 16 grid. Drawn by hand
 * to read at 29 × 21 pixels, so they say where the panes sit, not their exact weights (workspace/presets.ts).
 */
import type { PlanRect } from "../ui/atoms/glyphs";
import type { PresetId } from "../workspace/presets";

const PLANS: Record<PresetId, readonly PlanRect[]> = {
  edit: [
    [1, 1, 4, 14],
    [7, 1, 9, 9],
    [7, 12, 9, 3],
    [18, 1, 3, 14],
  ],
  mix: [
    [1, 1, 4, 14],
    [7, 1, 10, 5],
    [7, 8, 10, 7],
    [19, 1, 2, 14],
  ],
  review: [
    [1, 1, 4, 10],
    [7, 1, 7, 10],
    [16, 1, 5, 5],
    [16, 7, 5, 4],
    [1, 13, 20, 2],
  ],
  compare: [
    [1, 1, 4, 14],
    [7, 1, 6, 9],
    [7, 12, 6, 3],
    [15, 1, 3, 14],
    [19, 1, 2, 14],
  ],
};

/** The plan of layout `id`; Edit's for an id that isn't one (a layout the person no longer has). */
export const planOf = (id: string | undefined): readonly PlanRect[] =>
  id && Object.hasOwn(PLANS, id) ? PLANS[id as PresetId] : PLANS.edit;
