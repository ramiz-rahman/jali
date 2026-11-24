/**
 * The order list. Its selection is what the order detail beside it follows. A click, Enter or the menu's Open opens an
 * order (./open.ts); ⌥-click, ⌥↵ and the menu's Open beside open it beside whatever is there. The row's menu
 * (right-click, Shift+F10, the menu key) lists both, so the shortcut isn't the only way to find it.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { ListNumbersIcon } from "@phosphor-icons/react";
import { definePane, useJali, useJaliModel, useJaliState, type PaneProps } from "jali-layout/react";
import { customerById, money, orderById, orders, totalOf } from "../data";
import { followerOf, openOrder } from "../open";
import { Avatar } from "../ui/Avatar";
import { kindIcon } from "../ui/KindIcon";
import { altKeyLabel } from "../ui/keys";
import { RowMenu, type RowMenuItem } from "../ui/RowMenu";
import { customerKind } from "./CustomerPane";
import { orderKind } from "./OrderPane";

function OrdersPane({ node, select, openBeside }: PaneProps) {
  const m = useJaliModel();
  const { actions } = useJali();
  const listRef = useRef<HTMLUListElement>(null);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const follower = followerOf(m, node.id);
  const picked = useJaliState((s) => s.selection[node.id]?.ref.params.id);
  const current = Number(picked ?? follower?.ref.params.id ?? NaN);
  const index = orders.findIndex((o) => o.id === current);
  const open = (id: number) => openOrder(actions, m, node.id, id);
  const beside = (id: number) => openBeside(orderKind({ id }));
  const rowId = (id: number) => `${node.id}-o-${id}`;

  const move = (i: number) => {
    const o = orders[Math.max(0, Math.min(orders.length - 1, i))];
    if (o) select(orderKind({ id: o.id }));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    const o = orders[index];
    if (e.key === "ArrowDown" || e.key === "j") move(index + 1);
    else if (e.key === "ArrowUp" || e.key === "k") move(index < 0 ? 0 : index - 1);
    else if (e.key === "Enter" && o) (e.altKey ? beside : open)(o.id);
    else if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && o) {
      // From the keyboard: under the active row, at its start.
      const r = listRef.current?.querySelector(`[id="${rowId(o.id)}"]`)?.getBoundingClientRect();
      if (r) setMenu({ id: o.id, x: r.left + 8, y: r.bottom });
    } else return;
    e.preventDefault();
  };

  /** The row's menu: Open, Open beside when it differs (something follows), and the order's customer. */
  const menuFor = (id: number): RowMenuItem[][] => {
    const customer = customerById(orderById(id)?.customer ?? NaN);
    return [
      [
        { id: "open", title: "Open", keys: "↵", run: () => open(id) },
        ...(follower
          ? [
              {
                id: "beside",
                title: "Open beside",
                keys: `${altKeyLabel()}↵`,
                run: () => beside(id),
              },
            ]
          : []),
      ],
      ...(customer
        ? [
            [
              {
                id: "customer",
                title: `Open ${customer.name} beside`,
                run: () => openBeside(customerKind({ id: customer.id })),
              },
            ],
          ]
        : []),
    ];
  };

  return (
    <div className="live-k live-orders">
      <div className="live-k-toolbar">
        <span>{orders.length} orders</span>
        <span>This week</span>
      </div>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Orders"
        aria-description="Right-click or press Shift+F10 on an order for more ways to open it"
        tabIndex={0}
        data-autofocus
        onKeyDown={onKey}
        aria-activedescendant={index >= 0 ? rowId(orders[index]!.id) : undefined}
      >
        {orders.map((o) => {
          const c = customerById(o.customer);
          return (
            <li
              key={o.id}
              id={rowId(o.id)}
              role="option"
              aria-selected={o.id === current}
              data-menu-open={menu?.id === o.id || undefined}
              onClick={(e) => (e.altKey ? beside : open)(o.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ id: o.id, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="live-orders-id">{o.id}</span>
              <span className="live-orders-name">
                {c && <Avatar customer={c} size={24} />}
                <span>{c?.name}</span>
              </span>
              <span className="live-orders-total">{money(totalOf(o))}</span>
            </li>
          );
        })}
      </ul>
      {menu && listRef.current ? (
        <RowMenu
          at={menu}
          from={listRef.current}
          label={`Order ${menu.id}`}
          groups={menuFor(menu.id)}
          onClose={(refocus) => {
            setMenu(null);
            if (refocus) listRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

export const ordersKind = definePane("orders", {
  title: "Orders",
  icon: kindIcon(ListNumbersIcon),
  width: { min: 200, comfortable: 300, max: 520 },
  Component: OrdersPane,
});
