import { LayoutDashboard, LifeBuoy, ShoppingCart, UserRound } from "lucide-react";
import type { Layout, ObjectRef, PaneNode } from "@jali/core";
import type { RoleDef, WorkspaceProfile } from "@jali/react";
import { customers } from "./data";

// The page's views, in tab order. A role says whether its pane gives way first when room runs out.
const roles: RoleDef[] = [
  { id: "overview", label: "Overview", priority: "supporting", icon: LayoutDashboard },
  { id: "profile", label: "Customer", priority: "primary", icon: UserRound },
  { id: "orders", label: "Orders", priority: "supporting", icon: ShoppingCart },
  { id: "tickets", label: "Tickets", priority: "supporting", icon: LifeBuoy },
];

// What each view shows for one customer. Another customer swaps these in place.
const bind = (customer: number): Record<string, ObjectRef> => ({
  overview: { kind: "customer-overview", params: { customer } },
  profile: { kind: "customer", params: { id: customer } },
  orders: { kind: "orders", params: { customer } },
  tickets: { kind: "customer-tickets", params: { customer } },
});

// Multiplexed mode's designed layout: every role is in the tree, and those not shown at first are hidden.
const build = (customer: number): Layout => {
  const refs = bind(customer);
  const view = (r: RoleDef): PaneNode => ({ id: r.id, type: "pane", size: { weight: 1 }, ref: refs[r.id]!, role: r.id, priority: r.priority });
  return {
    version: 1,
    root: { id: "page", type: "row", size: { weight: 1 }, children: roles.map(view) },
    overlay: { tucks: [], folds: [], shown: {}, hidden: ["overview"] },
  };
};

// The list beside the page, and the header above its tabs.
function Rail({ item, activate }: { item: number; activate: (item: number) => void }) {
  return (
    <nav aria-label="Customers">
      {customers.map((c) => (
        <button key={c.id} aria-current={c.id === item} onClick={() => activate(c.id)}>{c.name}</button>
      ))}
    </nav>
  );
}
function Header({ item }: { item: number }) {
  return <header><h1>{customers.find((c) => c.id === item)?.name}</h1></header>;
}

export const customerPage: WorkspaceProfile = {
  id: "customer",
  name: "Customer",
  itemNoun: "customer",
  viewers: { full: "account manager", limited: "support agent" },
  roles,
  home: "overview",
  build,
  bind,
  firstItem: 7,
  Rail,
  Header,
};
