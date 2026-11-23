import { column, pane, row, tabs } from "jali";
import { orderKind, ordersKind } from "./kinds";

// A child is a ref, a pane(ref, options), or another row, column or tabs. Options come first when there are any.
export const desk = row(
  pane(ordersKind(), { id: "orders", px: 320 }), // a fixed 320px
  column(
    { weight: 2 }, // twice the share of its siblings
    pane(orderKind({ id: 1041 }), { id: "order", linkedTo: "orders", follows: true }),
    tabs(orderKind({ id: 1042 }), orderKind({ id: 1043 })), // two tabs, the first shown
  ),
);
