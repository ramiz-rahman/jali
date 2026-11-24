import type { Command } from "jali-layout";
import { orderKind } from "../pane-kinds/orders";

interface Customer {
  id: number;
  name: string;
  city: string;
}
declare const customers: Customer[];
declare function latestOrderOf(customer: Customer): number;

// "Open latest order for…": asks for a customer in Jali's chooser, then opens their latest order.
export const openLatestOrder: Command = {
  id: "orders.latest-for",
  title: "Open latest order for…",
  group: "Orders",
  run: (jali) =>
    jali.dialogs.choose({
      title: "Open latest order for…",
      items: customers,
      label: (c) => c.name,
      hint: (c) => c.city,
      placeholder: "Customer name or city",
      onChoose: (c) => {
        const focused = jali.get().view.focused;
        if (focused) jali.actions.openBeside(focused, orderKind({ id: latestOrderOf(c) }));
      },
    }),
};
