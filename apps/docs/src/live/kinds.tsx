/**
 * The demo's pane kinds: a shop's orders, one order, a customer, notes and an activity feed. Widths are set so panes
 * fold where real content would stop working: an order list needs room for its number, name and total.
 */
import { useEffect, type KeyboardEvent } from "react";
import { Activity as ActivityIcon, ListOrdered, Receipt, StickyNote, UserRound } from "lucide-react";
import { definePaneKind, useModel, useUi, type PaneComponentProps } from "@jali/react";
import { activity, customerById, money, notes, orderById, orders, ordersOf, totalOf, type OrderStatus } from "./data";

export const orderRef = (id: number) => ({ kind: "order", params: { id } });
export const customerRef = (id: number) => ({ kind: "customer", params: { id } });
export const notesRef = (customer: number) => ({ kind: "notes", params: { customer } });

type IconProps = { size?: number; strokeWidth?: number; "aria-hidden"?: boolean };

/**
 * A kind's icon in a small circle tinted with its pane's colour (`--live-id`, set on the pane, its tab, its shelf chip
 * and its map box), so the workspace and the map mark a pane the same way. Outside the live parts it falls back to
 * a neutral circle.
 */
function circled(Icon: (p: IconProps) => React.ReactNode) {
  return function CircledIcon({ size = 16, strokeWidth = 1.5 }: IconProps) {
    return (
      <span className="live-kind" style={{ width: size + 8, height: size + 8 }} aria-hidden>
        <Icon size={size - 2} strokeWidth={Math.max(strokeWidth, 1.75)} aria-hidden />
      </span>
    );
  };
}

const first = (name: string | undefined) => name?.split(" ")[0] ?? "customer";

function Status({ s }: { s: OrderStatus }) {
  return <span className="live-status-pill" data-status={s.toLowerCase()}>{s}</span>;
}

/** The order list. Its selection is what the order detail beside it follows. */
function OrdersPane({ node, select, openBeside }: PaneComponentProps) {
  const m = useModel();
  const follower = m.panes.find((p) => p.linkedTo === node.id && p.follows);
  const picked = useUi((s) => s.selection[node.id]?.ref.params.id);
  const current = Number(picked ?? follower?.ref.params.id ?? NaN);
  const index = orders.findIndex((o) => o.id === current);
  const choose = (i: number) => {
    const o = orders[Math.max(0, Math.min(orders.length - 1, i))];
    if (o) select(orderRef(o.id));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowDown" || e.key === "j") choose(index + 1);
    else if (e.key === "ArrowUp" || e.key === "k") choose(index < 0 ? 0 : index - 1);
    else if (e.key === "Enter" && e.altKey && orders[index]) openBeside(orderRef(orders[index].id));
    else return;
    e.preventDefault();
  };
  return (
    <div className="live-k live-orders">
      <div className="live-k-toolbar"><span>{orders.length} orders</span><span>This week</span></div>
      <ul role="listbox" aria-label="Orders" tabIndex={0} data-autofocus onKeyDown={onKey}
        aria-activedescendant={index >= 0 ? `${node.id}-o-${orders[index]!.id}` : undefined}>
        {orders.map((o) => {
          const c = customerById(o.customer);
          return (
            <li key={o.id} id={`${node.id}-o-${o.id}`} role="option" aria-selected={o.id === current}
              onClick={(e) => (e.altKey ? openBeside(orderRef(o.id)) : select(orderRef(o.id)))}>
              <span className="live-orders-id">{o.id}</span>
              <span className="live-orders-name">{c?.name}</span>
              <span className="live-orders-total">{money(totalOf(o))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OrderPane({ ref, openBeside, select }: PaneComponentProps) {
  const o = orderById(ref.params.id ?? 0);
  // The order's customer is this pane's selection, so a customer pane following it moves with the order.
  useEffect(() => { if (o) select(customerRef(o.customer)); }, [o?.customer]);
  if (!o) return <p className="live-k-empty">No order {ref.params.id}</p>;
  const c = customerById(o.customer);
  return (
    <div className="live-k live-order">
      <div className="live-k-head">
        <div><div className="live-k-eyebrow">Order</div><div className="live-k-big">#{o.id}</div></div>
        <Status s={o.status} />
      </div>
      <button type="button" className="live-k-link" onClick={() => openBeside(customerRef(o.customer))}>
        <UserRound size={13} strokeWidth={1.75} aria-hidden /> {c?.name}
      </button>
      <table className="live-k-table">
        <tbody>
          {o.lines.map((l) => (
            <tr key={l.item}><td>{l.item}</td><td className="n">×{l.qty}</td><td className="n">{money(l.qty * l.price)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total</td><td /><td className="n">{money(totalOf(o))}</td></tr></tfoot>
      </table>
      <div className="live-k-meta">Placed {o.placed}</div>
    </div>
  );
}

function CustomerPane({ ref, openBeside, select }: PaneComponentProps) {
  const c = customerById(ref.params.id ?? 0);
  // The customer's notes are this pane's selection: notes following it move with the customer.
  useEffect(() => { if (c) select(notesRef(c.id)); }, [c?.id]);
  if (!c) return <p className="live-k-empty">No customer {ref.params.id}</p>;
  const mine = ordersOf(c.id);
  const initials = c.name.split(" ").map((w) => w[0]).join("");
  return (
    <div className="live-k live-customer">
      <div className="live-k-head live-customer-head">
        <span className="live-avatar" aria-hidden>{initials}</span>
        <div><div className="live-k-title">{c.name}</div><div className="live-k-meta">{c.email}</div></div>
      </div>
      <dl className="live-k-dl">
        <div><dt>City</dt><dd>{c.city}</dd></div>
        <div><dt>Plan</dt><dd>{c.plan}</dd></div>
        <div><dt>Since</dt><dd>{c.since}</dd></div>
        <div><dt>Spent</dt><dd>{money(mine.reduce((t, o) => t + totalOf(o), 0))}</dd></div>
      </dl>
      <button type="button" className="live-k-link" onClick={() => openBeside(notesRef(c.id))}>
        <StickyNote size={13} strokeWidth={1.75} aria-hidden /> {(notes[c.id] ?? []).length} {(notes[c.id] ?? []).length === 1 ? "note" : "notes"}
      </button>
    </div>
  );
}

function NotesPane({ ref }: PaneComponentProps) {
  const list = notes[Number(ref.params.customer)] ?? [];
  return (
    <div className="live-k live-notes">
      {list.map((n, i) => (
        <article key={i}>
          <header><b>{n.who}</b><span>{n.when}</span></header>
          <p>{n.text}</p>
        </article>
      ))}
    </div>
  );
}

function ActivityPane() {
  return (
    <ol className="live-k live-activity">
      {activity.map((a, i) => (
        <li key={i} data-tone={a.tone}><span className="live-activity-dot" aria-hidden /><span>{a.text}</span><time>{a.when}</time></li>
      ))}
    </ol>
  );
}

export const demoKinds = [
  definePaneKind({
    kind: "orders", title: () => "Orders", ref: (params) => ({ kind: "orders", params }),
    minWidth: 200, comfortableWidth: 300, minHeight: 160, icon: circled(ListOrdered), Component: OrdersPane,
  }),
  definePaneKind({
    kind: "order", title: (r) => `Order ${r.params.id}`, ref: (params) => ({ kind: "order", params }),
    minWidth: 190, comfortableWidth: 260, maxWidth: 420, minHeight: 160, icon: circled(Receipt), Component: OrderPane,
  }),
  definePaneKind({
    kind: "customer", title: (r) => customerById(r.params.id ?? 0)?.name ?? `Customer ${r.params.id}`, ref: (params) => ({ kind: "customer", params }),
    minWidth: 170, comfortableWidth: 240, maxWidth: 380, minHeight: 160, icon: circled(UserRound), Component: CustomerPane,
  }),
  definePaneKind({
    kind: "notes", title: (r) => `Notes on ${first(customerById(r.params.customer ?? 0)?.name)}`, ref: (params) => ({ kind: "notes", params }),
    minWidth: 180, comfortableWidth: 240, maxWidth: 400, minHeight: 140, icon: circled(StickyNote), Component: NotesPane,
  }),
  definePaneKind({
    kind: "activity", title: () => "Activity", ref: (params) => ({ kind: "activity", params }),
    minWidth: 170, comfortableWidth: 220, maxWidth: 360, minHeight: 140, icon: circled(ActivityIcon), Component: ActivityPane,
  }),
];
