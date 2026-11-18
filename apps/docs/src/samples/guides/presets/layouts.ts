import type { Layout, LayoutNode, ObjectRef, PaneNode, Preset, Size, SplitNode, StackNode } from "@jali/core";

// Four small builders. A layout is plain data, so these are ordinary functions.
const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({
  id, type: "pane", size: { weight: 1 }, ref, ...extra,
});
const row = (id: string, children: LayoutNode[], size: Size = { weight: 1 }): SplitNode => ({
  id, type: "row", size, children,
});
const column = (id: string, children: LayoutNode[], size: Size = { weight: 1 }): SplitNode => ({
  id, type: "column", size, children,
});
const tabs = (id: string, children: PaneNode[], active = children[0]!.id): StackNode => ({
  id, type: "stack", size: { weight: 1 }, children, active,
});

const orders: ObjectRef = { kind: "orders", params: {} };
const order = (id: number): ObjectRef => ({ kind: "order", params: { id } });
const customer = (id: number): ObjectRef => ({ kind: "customer", params: { id } });

export const presets: Preset[] = [
  {
    id: "orders",
    label: "Orders",
    // `build` returns a fresh layout every time it is called.
    build: (): Layout => ({ version: 1, root: pane("orders", orders) }),
  },
  {
    id: "triage",
    label: "Orders and detail",
    build: () => ({
      version: 1,
      root: row("main", [
        pane("orders", orders, { size: { weight: 1.4 } }),
        // Shows whichever order is selected in "orders", and follows the cursor.
        pane("order", order(1), { linkedTo: "orders", follows: true }),
      ]),
    }),
  },
  {
    id: "customer-desk",
    label: "Customer desk",
    build: () => ({
      version: 1,
      root: row("main", [
        pane("orders", orders, { size: { px: 480 } }),
        column("side", [
          pane("customer", customer(7)),
          tabs("history", [pane("order-12", order(12)), pane("order-15", order(15))]),
        ]),
      ]),
    }),
  },
];
