/**
 * The paper book's records and its arithmetic: positions, orders and fills, what a fill does to a position, and
 * profit in dollars. Pure: the store that keeps the ledger and works orders against the market is trading.ts.
 */
import { isBond } from "../market/classes";
import type { Instrument, Quote, Side } from "../market/types";

export interface Position {
  symbol: string;
  /** Positive long, negative short: shares, face value or units of the base currency. */
  qty: number;
  avgPrice: number;
  /** Profit taken on what has been closed, in USD. */
  realized: number;
}

export type OrderType = "market" | "limit";
export type OrderStatus = "working" | "filled" | "cancelled";

interface OrderBase {
  id: number;
  symbol: string;
  side: Side;
  qty: number;
  status: OrderStatus;
  time: number;
}

/** A market order fills at the touch; a limit order only at its limit or better. */
export type Order = OrderBase & ({ type: "market" } | { type: "limit"; limit: number });

export interface Fill {
  id: number;
  orderId: number;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  time: number;
}

export interface Ledger {
  positions: Position[];
  /** Newest first, as are the fills. */
  orders: Order[];
  fills: Fill[];
  nextId: number;
}

/** An order as asked for, before it is checked (trading.ts `submit`): the ticket's quantity and limit as typed. */
export interface OrderRequest {
  symbol: string;
  side: Side;
  qty: number;
  type: OrderType;
  limit?: number;
}

/** The demo's book before anyone trades: a few positions, long and short. */
export const START: Ledger = {
  positions: [
    { symbol: "LMNA", qty: 1_200, avgPrice: 175.2, realized: 0 },
    { symbol: "HRBK", qty: 5_000, avgPrice: 50.9, realized: 0 },
    { symbol: "KSTR", qty: 300, avgPrice: 151.4, realized: 0 },
    { symbol: "PTRX", qty: -800, avgPrice: 73.1, realized: 0 },
    { symbol: "SLRK", qty: -3_000, avgPrice: 19.8, realized: 0 },
    { symbol: "GOV10Y", qty: 2_000_000, avgPrice: 99.1, realized: 0 },
    { symbol: "EURUSD", qty: 1_000_000, avgPrice: 1.0791, realized: 0 },
  ],
  orders: [],
  fills: [],
  nextId: 1,
};

const FILLS_KEPT = 200;

/** What `qty` at `price` is worth, in the instrument's quote currency: a bond is priced per 100 of face value. */
export const notional = (inst: Instrument, qty: number, price: number) =>
  isBond(inst) ? (qty * price) / 100 : qty * price;

/** An amount in an instrument's quote currency, in USD. A pair bought with dollars (USD/JPY) is priced in the other
 *  currency, yen per dollar: divide by the rate. */
export const inUsd = (inst: Instrument, amount: number, price: number) =>
  inst.assetClass === "fx" && inst.base === "USD" ? amount / price : amount;

/** A quote's bid and ask, when they are real prices: both finite and above zero. */
export function touch(q: Quote | null | undefined): { bid: number; ask: number } | undefined {
  if (!q) return undefined;
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  return ok(q.bid) && ok(q.ask) ? { bid: q.bid, ask: q.ask } : undefined;
}

/** Unrealised P&L in USD at the market's mid; 0 while there is no live price. */
export function unrealized(inst: Instrument, p: Position, q: Quote | undefined): number {
  const t = touch(q);
  if (!t || !p.qty) return 0;
  const mark = (t.bid + t.ask) / 2;
  return inUsd(inst, notional(inst, p.qty, mark - p.avgPrice), mark);
}

/** The book's totals in USD: open and realised P&L, and gross exposure at the last prices known. */
export function totals(
  positions: readonly Position[],
  quotes: ReadonlyMap<string, Quote>,
  instrument: (symbol: string) => Instrument | undefined,
) {
  let open = 0;
  let realized = 0;
  let gross = 0;
  for (const p of positions) {
    const inst = instrument(p.symbol);
    if (!inst) continue;
    const q = quotes.get(p.symbol);
    open += unrealized(inst, p, q);
    realized += p.realized;
    if (q) gross += Math.abs(inUsd(inst, notional(inst, p.qty, q.last), q.last));
  }
  return { open, realized, gross };
}

/** A position after a fill: adding keeps an average price; reducing or flipping takes profit at the fill price. */
export function applyFill(
  inst: Instrument,
  old: Position | undefined,
  signed: number,
  price: number,
): Position {
  const p = old ?? { symbol: inst.symbol, qty: 0, avgPrice: price, realized: 0 };
  const qty = p.qty + signed;
  if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed))
    return { ...p, qty, avgPrice: (p.avgPrice * p.qty + price * signed) / qty };
  const closed = Math.min(Math.abs(signed), Math.abs(p.qty)) * Math.sign(p.qty);
  const realized = p.realized + inUsd(inst, notional(inst, closed, price - p.avgPrice), price);
  return {
    ...p,
    qty,
    realized,
    avgPrice: qty === 0 ? 0 : Math.sign(qty) === Math.sign(p.qty) ? p.avgPrice : price,
  };
}

/** The ledger with `order` filled at `price`, and the fill; none when the price or the position it would leave
 *  isn't a real number. */
export function recordFill(
  ledger: Ledger,
  inst: Instrument,
  order: Order,
  price: number,
  time: number,
): { ledger: Ledger; fill: Fill } | undefined {
  if (!Number.isFinite(price) || price <= 0) return undefined;
  const old = ledger.positions.find((p) => p.symbol === order.symbol);
  const next = applyFill(inst, old, order.side === "buy" ? order.qty : -order.qty, price);
  if (![next.qty, next.avgPrice, next.realized].every(Number.isFinite)) return undefined;
  const fill: Fill = {
    id: ledger.nextId,
    orderId: order.id,
    symbol: order.symbol,
    side: order.side,
    qty: order.qty,
    price,
    time,
  };
  return {
    fill,
    ledger: {
      positions: old
        ? ledger.positions.map((p) => (p === old ? next : p))
        : [...ledger.positions, next],
      orders: ledger.orders.map((o) => (o.id === order.id ? { ...o, status: "filled" } : o)),
      fills: [fill, ...ledger.fills].slice(0, FILLS_KEPT),
      nextId: ledger.nextId + 1,
    },
  };
}
