import { useEffect, useState, type KeyboardEvent } from "react";
import { definePaneKind, type PaneComponentProps } from "@jali/react";
import type { ObjectRef } from "@jali/core";
import { ClipboardList, FileText, Plus, StickyNote } from "lucide-react";

// Your data. Jali never fetches anything: a pane is told which object to show, and shows it.
interface Order { id: number; customer: string; total: string; status: string }
const ORDERS: Order[] = [
  { id: 1, customer: "Ada Okafor", total: "$120.00", status: "Paid" },
  { id: 2, customer: "Lin Park", total: "$48.50", status: "Shipped" },
  { id: 3, customer: "Sam Reyes", total: "$310.00", status: "Refunded" },
];

// Refs: the one place your app says "this object". Plain data, so they fit in a link.
export const orderRef = (id: number): ObjectRef => ({ kind: "order", params: { id } });
export const ordersRef = (): ObjectRef => ({ kind: "orders", params: {} });

/** The list. J/K move the cursor, Space peeks, Alt+Enter opens the order beside the list. */
function OrderList({ select, peek, openBeside, paused }: PaneComponentProps) {
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
    select(orderRef(ORDERS[next]!.id)); // a following detail shows it once the cursor rests
  };

  // Content first: claim the keys you use with preventDefault, and let the rest reach the workspace.
  const onKeyDown = (e: KeyboardEvent) => {
    const order = ORDERS[at]!;
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "j" || e.key === "ArrowDown") move(at + 1);
    else if (e.key === "k" || e.key === "ArrowUp") move(at - 1);
    else if (e.key === " ") peek(orderRef(order.id));
    else if (e.key === "Enter" && e.altKey) openBeside(orderRef(order.id));
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

/** One order. `ref` is a plain prop (React 19): read the id from it. */
function OrderDetail({ ref }: PaneComponentProps) {
  const order = ORDERS.find((o) => o.id === Number(ref.params.id));
  if (!order) return <p>Order {String(ref.params.id)} was not found.</p>;
  return (
    <dl>
      <dt>Customer</dt><dd>{order.customer}</dd>
      <dt>Total</dt><dd>{order.total}</dd>
      <dt>Status</dt><dd>{order.status}</dd>
    </dl>
  );
}

export const orderList = definePaneKind({
  kind: "orders",
  title: () => "Orders",
  ref: (params) => ({ kind: "orders", params }),
  minWidth: 440,          // narrower than this, the pane folds into a tab
  comfortableWidth: 560,  // spare room brings it up to here first
  minHeight: 240,
  heavy: true,            // a long list: hold its content during a divider drag, reflow on release
  icon: ClipboardList,
  Component: OrderList,
});

export const orderKind = definePaneKind({
  kind: "order",
  title: (ref) => `Order ${ref.params.id}`,
  ref: (params) => ({ kind: "order", params }),
  identity: (ref) => Number(ref.params.id), // "1" and 1 are the same order
  object: "order",                           // another kind that shows orders counts as the same object
  minWidth: 360,
  comfortableWidth: 440,
  maxWidth: 600,                             // past this, spare room goes to the neighbours first
  minHeight: 200,
  icon: FileText,
  Component: OrderDetail,
});

export const customerKind = definePaneKind({
  kind: "customer",
  title: (ref) => `Customer ${ref.params.id}`,
  ref: (params) => ({ kind: "customer", params }),
  minWidth: 360,
  maxWidth: 600,
  minHeight: 200,
  Component: ({ ref }) => <h3>Customer {String(ref.params.id)}</h3>, // no icon: Jali draws a plain square
});

/** A scratch pad: every one is new, so it is never matched against an open pane. */
export const scratchNote = definePaneKind({
  kind: "scratch",
  title: () => "Scratch note",
  ref: (params) => ({ kind: "scratch", params }),
  identity: () => undefined,
  recordable: false, // not listed in Recent
  minWidth: 280,
  minHeight: 160,
  icon: StickyNote,
  Component: () => <textarea aria-label="Scratch note" />,
});

/**
 * What Split and New tab open. Jali opens `{ kind: "launcher" }` there, so a workspace that splits needs a kind with
 * this name. It is transient: it stands in until the person chooses, and it gets Recent and what is open.
 */
export const launcher = definePaneKind({
  kind: "launcher",
  title: () => "New pane",
  ref: (params) => ({ kind: "launcher", params }),
  transient: true,
  recordable: false,
  identity: () => undefined,
  minWidth: 320,
  minHeight: 200,
  icon: Plus,
  Component: ({ openHere, dismiss, recent = [], titleFor }) => (
    <nav aria-label="Open in this pane">
      <button onClick={() => openHere(ordersRef())}>All orders</button>
      {recent.map((r) => (
        <button key={JSON.stringify(r)} onClick={() => openHere(r)}>{titleFor?.(r) ?? r.kind}</button>
      ))}
      <button onClick={dismiss}>Cancel</button>
    </nav>
  ),
});

export const orderKinds = [orderList, orderKind, customerKind, scratchNote, launcher];
