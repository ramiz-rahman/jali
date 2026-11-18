import { definePaneKind } from "@jali/react";
import { customerById, orders, tickets } from "./data";

export const customer = definePaneKind({
  kind: "customer",
  title: (ref) => customerById(Number(ref.params.id))?.name ?? `Customer ${ref.params.id}`,
  ref: (params) => ({ kind: "customer", params }),
  minWidth: 300,
  maxWidth: 560,
  minHeight: 200,
  Component: ({ ref }) => {
    const c = customerById(Number(ref.params.id));
    return c ? <article><h3>{c.name}</h3><p>Plan: {c.plan}</p></article> : <p>Customer not found.</p>;
  },
});

export const customerOrders = definePaneKind({
  kind: "orders",
  title: (ref) => `Orders of customer ${ref.params.customer}`,
  ref: (params) => ({ kind: "orders", params }),
  minWidth: 360,
  minHeight: 200,
  Component: ({ ref, openBeside }) => (
    <ul>
      {orders.filter((o) => o.customer === Number(ref.params.customer)).map((o) => (
        <li key={o.id}><button onClick={() => openBeside({ kind: "order", params: { id: o.id } })}>Order {o.id}</button></li>
      ))}
    </ul>
  ),
});

export const order = definePaneKind({
  kind: "order",
  title: (ref) => `Order ${ref.params.id}`,
  ref: (params) => ({ kind: "order", params }),
  minWidth: 300,
  minHeight: 200,
  Component: ({ ref }) => <article><h3>Order {ref.params.id}</h3></article>,
});

export const customerTickets = definePaneKind({
  kind: "customer-tickets",
  title: (ref) => `Tickets of customer ${ref.params.customer}`,
  ref: (params) => ({ kind: "customer-tickets", params }),
  minWidth: 320,
  minHeight: 200,
  Component: ({ ref }) => (
    <ul>{tickets.filter((t) => t.customer === Number(ref.params.customer)).map((t) => <li key={t.id}>#{t.id} {t.subject}</li>)}</ul>
  ),
});

export const customerOverview = definePaneKind({
  kind: "customer-overview",
  title: (ref) => `Customer ${ref.params.customer} overview`,
  ref: (params) => ({ kind: "customer-overview", params }),
  minWidth: 360,
  minHeight: 240,
  Component: ({ ref }) => <p>Everything about customer {ref.params.customer} at a glance.</p>,
});
