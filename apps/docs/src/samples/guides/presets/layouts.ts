import { column, pane, row, tabs, type PresetOptions } from "@jali/core";
import { customerKind, orderKind, orderList } from "../pane-kinds/orders";

export const presets: PresetOptions[] = [
  {
    id: "orders",
    label: "Orders",
    layout: orderList(),
  },
  {
    id: "triage",
    label: "Orders and detail",
    layout: row(
      pane(orderList(), { id: "orders", weight: 1.4 }),
      // Shows whichever order is selected in "orders", and follows the cursor.
      pane(orderKind({ id: 1 }), { id: "order", linkedTo: "orders", follows: true }),
    ),
  },
  {
    id: "customer-desk",
    label: "Customer desk",
    layout: row(
      pane(orderList(), { id: "orders", px: 480 }),
      column(customerKind({ id: 7 }), tabs(orderKind({ id: 12 }), orderKind({ id: 15 }))),
    ),
  },
];
