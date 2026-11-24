import { definePane } from "jali-layout/react";
import { customerById, orders, tickets } from "./data";

export const customer = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => customerById(id)?.name ?? `Customer ${id}`,
  width: { min: 300, max: 560 },
  height: { min: 200 },

  Component: ({ params }) => {
    const c = customerById(params.id);
    if (!c) return <p>Customer not found.</p>;
    return (
      <article>
        <h3>{c.name}</h3>
        <p>Plan: {c.plan}</p>
      </article>
    );
  },
});

export const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 300 },
  height: { min: 200 },

  Component: ({ params }) => (
    <article>
      <h3>Order {params.id}</h3>
    </article>
  ),
});

export const customerOrders = definePane("orders", {
  params: { customer: Number },
  title: ({ customer }) => `Orders of customer ${customer}`,
  width: { min: 360 },
  height: { min: 200 },

  Component: ({ params, openBeside }) => (
    <ul>
      {orders
        .filter((o) => o.customer === params.customer)
        .map((o) => (
          <li key={o.id}>
            <button onClick={() => openBeside(order({ id: o.id }))}>Order {o.id}</button>
          </li>
        ))}
    </ul>
  ),
});

export const customerTickets = definePane("customer-tickets", {
  params: { customer: Number },
  title: ({ customer }) => `Tickets of customer ${customer}`,
  width: { min: 320 },
  height: { min: 200 },

  Component: ({ params }) => (
    <ul>
      {tickets
        .filter((t) => t.customer === params.customer)
        .map((t) => (
          <li key={t.id}>
            #{t.id} {t.subject}
          </li>
        ))}
    </ul>
  ),
});

export const customerOverview = definePane("customer-overview", {
  params: { customer: Number },
  title: ({ customer }) => `Customer ${customer} overview`,
  width: { min: 360 },
  height: { min: 240 },

  Component: ({ params }) => <p>Everything about customer {params.customer} at a glance.</p>,
});
