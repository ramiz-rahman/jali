import { LayoutIcon, LifebuoyIcon, ShoppingCartIcon, UserIcon } from "@phosphor-icons/react";
import { pane, row } from "@jali/core";
import { definePage, type PageView } from "@jali/react";
import { customer, customerOrders, customerOverview, customerTickets } from "./customer";
import { customers } from "./data";

// The page's views, in tab order. A view says whether its pane gives way first when room runs out.
const roles: PageView[] = [
  { id: "overview", label: "Overview", priority: "supporting", icon: LayoutIcon },
  { id: "profile", label: "Customer", priority: "primary", icon: UserIcon },
  { id: "orders", label: "Orders", priority: "supporting", icon: ShoppingCartIcon },
  { id: "tickets", label: "Tickets", priority: "supporting", icon: LifebuoyIcon },
];

// What each view shows for one customer. Another customer swaps these in place.
const bind = (id: number) => ({
  overview: customerOverview({ customer: id }),
  profile: customer({ id }),
  orders: customerOrders({ customer: id }),
  tickets: customerTickets({ customer: id }),
});

// Split view's designed layout: every view is in it, and Overview starts hidden.
const build = (id: number) => {
  const refs = bind(id);
  return row(
    { id: "page" },
    ...roles.map((r) =>
      pane(refs[r.id as keyof typeof refs], {
        id: r.id,
        role: r.id,
        priority: r.priority,
        hidden: r.id === "overview",
      }),
    ),
  );
};

// The list beside the page, and the header above its tabs.
function Rail({ item, activate }: { item: number; activate: (item: number) => void }) {
  return (
    <nav aria-label="Customers">
      {customers.map((c) => (
        <button key={c.id} aria-current={c.id === item} onClick={() => activate(c.id)}>
          {c.name}
        </button>
      ))}
    </nav>
  );
}
function Header({ item }: { item: number }) {
  return (
    <header>
      <h1>{customers.find((c) => c.id === item)?.name}</h1>
    </header>
  );
}

export const customerPage = definePage({
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
});
