/** Large workspaces for measuring fitting: `fit-scale.test.ts`. */
import type { FitOptions, KindRegistry, Layout, LayoutNode, PaneNode } from "../types";

export const scaleKinds: KindRegistry = {
  column: { kind: "column", minWidth: 200, minHeight: 120, title: () => "column" },
  list: { kind: "list", minWidth: 240, minHeight: 160, title: () => "list" },
  record: { kind: "record", minWidth: 380, minHeight: 200, title: () => "record" },
};
export const scaleFit = (width = 1400, height = 900): FitOptions => ({
  width,
  height,
  gap: 6,
  kinds: scaleKinds,
});
const pane = (id: string, kind: string, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref: { kind, params: { id } },
  ...extra,
});

/** One row of `n` panes 200 px wide at their narrowest. */
export const flat = (n: number): Layout => ({
  version: 1,
  root: {
    id: "root",
    type: "row",
    size: { weight: 1 },
    children: Array.from({ length: n }, (_, i) => pane(`p${i}`, "column")),
  },
});
/** Groups of a list and the records opened from it (a chain each), in rows of three groups, stacked in a column. */
export function nested(n: number): Layout {
  const groups: LayoutNode[] = [];
  for (let i = 0; i < n; i += 4) {
    const members = Array.from({ length: Math.min(4, n - i) }, (_, j) =>
      j === 0 ? pane(`p${i}`, "list") : pane(`p${i + j}`, "record", { linkedTo: `p${i + j - 1}` }),
    );
    groups.push({ id: `g${i}`, type: "row", size: { weight: 1 }, children: members });
  }
  const rows: LayoutNode[] = [];
  for (let i = 0; i < groups.length; i += 3)
    rows.push({ id: `r${i}`, type: "row", size: { weight: 1 }, children: groups.slice(i, i + 3) });
  return {
    version: 1,
    root:
      rows.length === 1
        ? rows[0]!
        : { id: "root", type: "column", size: { weight: 1 }, children: rows },
  };
}
