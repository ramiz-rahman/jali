import { use } from "react";
import { definePane, useTitle, type PaneProps } from "jali-layout/react";

interface Customer {
  id: number;
  name: string;
  email: string;
}

// Your data layer. Keep one promise per customer, so a re-render reads the same one.
const requests = new Map<number, Promise<Customer>>();
function fetchCustomer(id: number): Promise<Customer> {
  if (!requests.has(id))
    requests.set(
      id,
      fetch(`/api/customers/${id}`).then((r) => {
        if (!r.ok) throw new Error(`Customer ${id} could not be loaded (${r.status})`);
        return r.json() as Promise<Customer>;
      }),
    );
  return requests.get(id)!;
}

function CustomerDetail({ params }: PaneProps<{ id: number }>) {
  const customer = use(fetchCustomer(params.id)); // suspends: the pane shows `Loading` until it resolves
  useTitle(customer.name); // "Ada Okafor" in the header, tab and ⌘K, rather than "Customer 7"
  return (
    <dl>
      <dt>Email</dt>
      <dd>{customer.email}</dd>
    </dl>
  );
}

export const customerKind = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`, // until the data names it, and in the peek sheet
  Loading: ({ params }) => <p>Loading customer {params.id}…</p>,
  Component: CustomerDetail,
});
