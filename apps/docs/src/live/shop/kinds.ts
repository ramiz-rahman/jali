/**
 * The shop's pane kinds: a list of orders, one order, a customer, notes on them, and an activity feed. Each is
 * defined beside its component in ./panes; widths are set so panes fold where real content would stop working.
 */
import { ordersKind } from "./panes/OrdersPane";
import { orderKind } from "./panes/OrderPane";
import { customerKind } from "./panes/CustomerPane";
import { notesKind } from "./panes/NotesPane";
import { activityKind } from "./panes/ActivityPane";

export { ordersKind, orderKind, customerKind, notesKind, activityKind };

/** In order: a kind's place here is its identity colour (tree/colours.ts), the same in the workspace and the map. */
export const shopKinds = [ordersKind, orderKind, customerKind, notesKind, activityKind];
