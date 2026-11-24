import { useEffect, useState, type KeyboardEvent } from "react";
import { definePane, useLauncher, type PaneProps } from "jali-layout/react";
import { oneOf, optional } from "jali-layout";
import { ClipboardTextIcon, FileTextIcon, NoteIcon, PlusIcon } from "@phosphor-icons/react";

// Your data. Jali never fetches anything: a pane is told which object to show, and shows it.
interface Order {
  id: number;
  customer: string;
  total: string;
  status: string;
}
const ORDERS: Order[] = [
  { id: 1, customer: "Ada Okafor", total: "$120.00", status: "Paid" },
  { id: 2, customer: "Lin Park", total: "$48.50", status: "Shipped" },
  { id: 3, customer: "Sam Reyes", total: "$310.00", status: "Refunded" },
];

/** The list. J/K move the cursor, Space peeks, Alt+Enter opens the order beside the list. */
function OrderList({ select, peek, openBeside, paused }: PaneProps) {
  const [at, setAt] = useState(0);
  const [checkedAt, setCheckedAt] = useState(() => new Date());

  // Live work stops while the pane is hidden (behind a tab, tucked, folded or behind a maximised pane).
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCheckedAt(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [paused]);

  const move = (to: number) => {
    const next = Math.max(0, Math.min(ORDERS.length - 1, to));
    setAt(next);
    select(orderKind({ id: ORDERS[next]!.id })); // a following detail shows it once the cursor rests
  };

  // Content first: claim the keys you use with preventDefault, and let the rest reach Jali.
  const onKeyDown = (e: KeyboardEvent) => {
    const order = orderKind({ id: ORDERS[at]!.id });
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "j" || e.key === "ArrowDown") move(at + 1);
    else if (e.key === "k" || e.key === "ArrowUp") move(at - 1);
    else if (e.key === " ") peek(order);
    else if (e.key === "Enter" && e.altKey) openBeside(order);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <ul role="listbox" aria-label="Orders" tabIndex={0} onKeyDown={onKeyDown}>
        {ORDERS.map((o, i) => (
          <li key={o.id} role="option" aria-selected={i === at} onClick={() => move(i)}>
            Order {o.id} · {o.customer} · {o.total}
          </li>
        ))}
      </ul>
      <p>Checked at {checkedAt.toLocaleTimeString()}</p>
    </div>
  );
}

// What an order pane shows: its id, read back as a number, so "1" in a link and 1 in code are the same order, and,
// optionally, which tab of the order is open. Declared first, so the component below is typed from it.
const orderParams = { id: Number, tab: optional(oneOf("summary", "history")) };

/** One order, read from its typed params: { id: number; tab?: "summary" | "history" }. */
function OrderDetail({ params }: PaneProps<typeof orderParams>) {
  const order = ORDERS.find((o) => o.id === params.id);
  if (!order) return <p>Order {params.id} was not found.</p>;
  if (params.tab === "history")
    return (
      <p>
        Order {order.id} was placed by {order.customer}.
      </p>
    );
  return (
    <dl>
      <dt>Customer</dt>
      <dd>{order.customer}</dd>
      <dt>Total</dt>
      <dd>{order.total}</dd>
      <dt>Status</dt>
      <dd>{order.status}</dd>
    </dl>
  );
}

export const orderList = definePane("orders", {
  title: "Orders",
  icon: ClipboardTextIcon,
  width: {
    min: 440, // narrower than this, the pane folds into a tab
    comfortable: 560, // spare room brings it up to here first
  },
  height: { min: 240 },
  holdWhileResizing: true, // a long list: keep it as it is during a divider drag, reflow on release
  Component: OrderList,
});

export const orderKind = definePane("order", {
  params: orderParams,
  title: ({ id, tab }) => (tab === "history" ? `Order ${id} history` : `Order ${id}`),
  icon: FileTextIcon,
  width: { min: 360, comfortable: 440, max: 600 }, // past max, spare room goes to the neighbours first
  height: { min: 200 },
  shows: "order", // another kind that shows orders counts as the same object
  identity: ({ id }) => id, // the open tab doesn't make it another order
  Component: OrderDetail,
});

export const customerKind = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`,
  width: { min: 360, max: 600 },
  height: { min: 200 },
  Component: ({ params }) => <h3>Customer {params.id}</h3>, // no icon: Jali draws a plain square
});

/** A scratch pad: every one is new, so it is never matched against an open pane, and stays out of Recent. */
export const scratchNote = definePane("scratch", {
  title: "Scratch note",
  icon: NoteIcon,
  width: { min: 280 },
  scratch: true,
  Component: () => <textarea aria-label="Scratch note" />,
});

/** What Split and "New tab here" open until the person chooses: the `launcher`. */
export const launcher = definePane("launcher", {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 320 },
  height: { min: 200 },
  scratch: true,
  Component: function Launcher({ openHere, dismiss }) {
    const { recent, titleOf } = useLauncher();
    return (
      <nav aria-label="Open in this pane">
        <button onClick={() => openHere(orderList())}>All orders</button>
        {recent.map((ref) => (
          <button key={JSON.stringify(ref)} onClick={() => openHere(ref)}>
            {titleOf(ref)}
          </button>
        ))}
        <button onClick={dismiss}>Cancel</button>
      </nav>
    );
  },
});

export const orderKinds = [orderList, orderKind, customerKind, scratchNote];
