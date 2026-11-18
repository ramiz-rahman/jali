/**
 * Demo layouts for the live parts. Layout ids are the contract with pages: <TreeView layout="chain" />.
 * `demoLayouts` names each one; `buildDemoLayout` makes a fresh layout tree for a workspace to start from.
 */
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "@jali/core";

export type DemoLayoutId = "two" | "chain" | "nested" | "stack" | "crowded";
export const demoLayouts: Record<DemoLayoutId, string> = {
  two: "Two panes side by side",
  chain: "A list, its detail, and a related record",
  nested: "A row with a column inside it",
  stack: "Tabs: a stack of three panes",
  crowded: "More panes than fit, so some fold",
};

const ref = (kind: string, params: ObjectRef["params"] = {}): ObjectRef => ({ kind, params });
const pane = (id: string, r: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref: r,
  ...extra,
});
const split = (
  type: "row" | "column",
  id: string,
  children: LayoutNode[],
  weight = 1,
): LayoutNode => ({ id, type, size: { weight }, children });

const orders = (extra?: Partial<PaneNode>) =>
  pane("orders", ref("orders"), { size: { weight: 1.3 }, ...extra });
const order = (extra?: Partial<PaneNode>) =>
  pane("order", ref("order", { id: 1048 }), { linkedTo: "orders", follows: true, ...extra });
const customer = (extra?: Partial<PaneNode>) => pane("customer", ref("customer", { id: 7 }), extra);
const notes = (extra?: Partial<PaneNode>) => pane("notes", ref("notes", { customer: 7 }), extra);
const activity = (extra?: Partial<PaneNode>) => pane("activity", ref("activity"), extra);

const builders: Record<DemoLayoutId, () => LayoutNode> = {
  two: () => split("row", "root", [customer(), notes({ linkedTo: "customer", follows: true })]),
  // Each pane follows the one before it: pick an order, and its detail and its customer both move.
  chain: () =>
    split("row", "root", [orders(), order(), customer({ linkedTo: "order", follows: true })]),
  nested: () => split("row", "root", [orders(), split("column", "side", [order(), activity()])]),
  stack: () =>
    split("row", "root", [
      customer(),
      {
        id: "tabs",
        type: "stack",
        size: { weight: 1.4 },
        origin: "user",
        active: "order",
        children: [pane("order", ref("order", { id: 1048 })), notes(), activity()],
      },
    ]),
  crowded: () =>
    split("row", "root", [
      orders(),
      order(),
      customer({ linkedTo: "order", follows: true }),
      notes({ linkedTo: "customer", follows: true }),
      activity(),
    ]),
};

export function buildDemoLayout(id: DemoLayoutId): Layout {
  return { version: 1, root: (builders[id] ?? builders.two)() };
}
