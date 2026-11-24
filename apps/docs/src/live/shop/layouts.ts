/**
 * The shop's layouts: what each live part on a page starts from. One entry per layout, its label and how it is built,
 * so adding one is one edit. Layout ids are the contract with pages: <TreeView layout="chain" />.
 */
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "jali";

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

interface ShopLayout {
  /** What the figure is called when the page gives it no caption. */
  label: string;
  build(): LayoutNode;
}

const layouts = {
  two: {
    label: "Two panes side by side",
    build: () => split("row", "root", [customer(), notes({ linkedTo: "customer", follows: true })]),
  },
  // Each pane follows the one before it: pick an order, and its detail and its customer both move.
  chain: {
    label: "A list, its detail, and a related record",
    build: () =>
      split("row", "root", [orders(), order(), customer({ linkedTo: "order", follows: true })]),
  },
  // The hero's start: the shape of a mail app. The order and its customer share the list's right, one above the other.
  desk: {
    label: "A list beside its detail, with the detail's customer under it",
    build: () =>
      split("row", "root", [
        orders(),
        split("column", "work", [order(), customer({ linkedTo: "order", follows: true })], 1.4),
      ]),
  },
  nested: {
    label: "A row with a column inside it",
    build: () => split("row", "root", [orders(), split("column", "side", [order(), activity()])]),
  },
  stack: {
    label: "Tabs: a stack of three panes",
    build: () =>
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
  },
  // One tab group across the whole figure, so every tab shows: for the Tabs guide (reorder, pin, the menu).
  strip: {
    label: "One group of four tabs, the first pinned",
    build: () => ({
      id: "tabs",
      type: "stack",
      size: { weight: 1 },
      origin: "user",
      active: "order",
      children: [
        customer({ pinned: true }),
        pane("order", ref("order", { id: 1048 })),
        notes(),
        activity(),
      ],
    }),
  },
  crowded: {
    label: "More panes than fit, so some fold",
    build: () =>
      split("row", "root", [
        orders(),
        order(),
        customer({ linkedTo: "order", follows: true }),
        notes({ linkedTo: "customer", follows: true }),
        activity(),
      ]),
  },
  // The list stays put; six orders, each at its comfortable width, in a row that scrolls: for the scrolling rows guide.
  board: {
    label: "A list beside a row of six orders that scrolls sideways",
    build: () =>
      split("row", "root", [
        orders({ size: { px: 240 } }),
        {
          ...split(
            "row",
            "board",
            [1041, 1042, 1043, 1044, 1045, 1046].map((id) =>
              pane(`order-${id}`, ref("order", { id })),
            ),
          ),
          scroll: "x",
        } as LayoutNode,
      ]),
  },
} satisfies Record<string, ShopLayout>;

export type DemoLayoutId = keyof typeof layouts;

/** Each layout's label, for a figure the page gives no caption. */
export const demoLayouts = Object.fromEntries(
  Object.entries(layouts).map(([id, l]) => [id, l.label]),
) as Record<DemoLayoutId, string>;

/** A fresh layout tree for a workspace to start from. */
export const buildDemoLayout = (id: DemoLayoutId): Layout => ({
  version: 1,
  root: layouts[id].build(),
});
