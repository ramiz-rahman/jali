/**
 * The book's tables: open positions, orders and fills. A row whose instrument this market doesn't have (kept by an
 * older build) is left out, as a watchlist leaves it out.
 */
import { useMemo } from "react";
import { useStore } from "@jali-examples/shared/store";
import { useMarket, useQuotes } from "../../market/react";
import type { Instrument, MarketData } from "../../market/types";
import { unrealized, type OrderStatus } from "../../model/ledger";
import { useServices } from "../../services";
import { Scroller } from "../../ui/atoms/Scroller";
import * as f from "../../ui/format";
import { Delta } from "../../ui/molecules/Delta";
import { Empty } from "../../ui/molecules/Empty";

const STATUS: Record<OrderStatus, string> = {
  working: "Working",
  filled: "Filled",
  cancelled: "Cancelled",
};
const ORDERS_SHOWN = 50;

/** Each row with its instrument, without those this market doesn't have. */
const known = <R extends { symbol: string }>(market: MarketData, rows: readonly R[]) =>
  rows.flatMap((row): { row: R; inst: Instrument }[] => {
    const inst = market.instrument(row.symbol);
    return inst ? [{ row, inst }] : [];
  });

export function Positions({
  paused,
  onOpen,
}: {
  paused: boolean;
  onOpen: (symbol: string) => void;
}) {
  const { trading } = useServices();
  const market = useMarket();
  const positions = useStore(trading, (b) => b.positions);
  const open = useMemo(
    () =>
      known(
        market,
        positions.filter((p) => p.qty !== 0),
      ),
    [market, positions],
  );
  const quotes = useQuotes(
    open.map(({ row }) => row.symbol),
    paused,
  );
  if (!open.length)
    return <Empty title="No open positions">Orders you send from the ticket show here.</Empty>;
  return (
    <Scroller className="table-scroll" label="Open positions">
      <table className="grid-table">
        <caption className="sr-only">Open positions</caption>
        <thead>
          <tr>
            <th scope="col">Instrument</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col" className="num">
              Average
            </th>
            <th scope="col" className="num">
              Last
            </th>
            <th scope="col" className="num">
              P&amp;L
            </th>
          </tr>
        </thead>
        <tbody>
          {open.map(({ row: p, inst }) => {
            const q = quotes.get(p.symbol);
            const pnl = unrealized(inst, p, q);
            return (
              <tr key={p.symbol} onClick={() => onOpen(p.symbol)}>
                <td>
                  <b>{p.symbol}</b>
                </td>
                <td className="num">
                  <Delta value={p.qty}>{f.size(Math.abs(p.qty))}</Delta>
                </td>
                <td className="num">{f.price(inst, p.avgPrice)}</td>
                <td className="num">{q ? f.price(inst, q.last) : ""}</td>
                <td className="num">
                  <Delta value={pnl}>{f.money(pnl)}</Delta>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroller>
  );
}

export function Orders() {
  const { trading, market } = useServices();
  const orders = useStore(trading, (b) => b.orders);
  if (!orders.length) return <Empty title="No orders yet">Send one from the ticket.</Empty>;
  return (
    <Scroller className="table-scroll" label="Orders">
      <table className="grid-table">
        <caption className="sr-only">Orders, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Order</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {known(market, orders.slice(0, ORDERS_SHOWN)).map(({ row: o, inst }) => (
            <tr key={o.id}>
              <td className="t-time">{f.time(o.time)}</td>
              <td>
                {f.SIDE[o.side].verb} {f.size(o.qty)} <b>{o.symbol}</b>
                {o.type === "limit" ? ` at ${f.price(inst, o.limit)}` : " at market"}
              </td>
              <td>{STATUS[o.status]}</td>
              <td>
                {o.status === "working" ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-small"
                    onClick={() => trading.cancel(o.id)}
                  >
                    Cancel
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

export function Fills() {
  const { trading, market } = useServices();
  const fills = useStore(trading, (b) => b.fills);
  if (!fills.length) return <Empty title="No fills yet" />;
  return (
    <Scroller className="table-scroll" label="Fills">
      <table className="grid-table">
        <caption className="sr-only">Fills, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Side</th>
            <th scope="col">Instrument</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col" className="num">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {known(market, fills).map(({ row: fl, inst }) => (
            <tr key={fl.id}>
              <td className="t-time">{f.time(fl.time)}</td>
              <td>
                <Delta value={fl.side === "buy" ? 1 : -1}>{f.SIDE[fl.side].verb}</Delta>
              </td>
              <td>
                <b>{fl.symbol}</b>
              </td>
              <td className="num">{f.size(fl.qty)}</td>
              <td className="num">{f.price(inst, fl.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}
