/** One order: its amount and where it is, its customer, and its lines. */
import { useEffect } from "react";
import { CaretRightIcon, ReceiptIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali-layout/react";
import { customerById, money, orderById, totalOf, type OrderStatus } from "../data";
import { Avatar } from "../ui/Avatar";
import { kindIcon } from "../ui/KindIcon";
import { customerKind } from "./CustomerPane";

/** The order's state, said as the first word of the line under its amount: no badge, just the word. */
function Status({ s }: { s: OrderStatus }) {
  return (
    <span className="live-k-status" data-status={s.toLowerCase()}>
      {s}
    </span>
  );
}

function OrderPane({ params, openBeside, select }: PaneProps<{ id: number }>) {
  const o = orderById(params.id);
  // The order's customer is this pane's selection, so a customer pane following it moves with the order.
  useEffect(() => {
    if (o) select(customerKind({ id: o.customer }));
  }, [o?.customer]);
  if (!o) return <p className="live-k-empty">No order {params.id}</p>;
  const c = customerById(o.customer);
  const items = o.lines.reduce((t, l) => t + l.qty, 0);
  // The header already says "Order 1048": the content opens on what it can't say, the amount and where the order is.
  return (
    <div className="live-k live-order">
      <div className="live-k-amount">{money(totalOf(o))}</div>
      <div className="live-k-sub">
        <Status s={o.status} /> · {o.placed} · {items} {items === 1 ? "item" : "items"}
      </div>
      {c && (
        <button
          type="button"
          className="live-k-person"
          onClick={() => openBeside(customerKind({ id: c.id }))}
        >
          <Avatar customer={c} size={28} />
          <span className="live-k-row-title">{c.name}</span>
          <span className="live-k-row-sub">{c.area}</span>
          <CaretRightIcon size={14} aria-hidden className="live-k-row-caret" />
        </button>
      )}
      <div className="live-k-section">
        <h3 className="live-k-label">Items</h3>
        <ul className="live-k-lines">
          {o.lines.map((l) => (
            <li key={l.item}>
              <span className="live-k-line-item">{l.item}</span>
              <span className="live-k-line-qty">
                {l.qty} × {money(l.price)}
              </span>
              <span className="live-k-num">{money(l.qty * l.price)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const orderKind = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  icon: kindIcon(ReceiptIcon),
  width: { min: 190, comfortable: 260, max: 640 },
  Component: OrderPane,
});
