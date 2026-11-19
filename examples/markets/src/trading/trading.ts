/**
 * A paper-trading book: positions, orders and fills against the simulated market. Market orders fill at the touch
 * (a buy at the ask, a sell at the bid); limit orders work until the market reaches them.
 */
import type { Instrument, MarketData, Quote } from "../market/types";
import { createStore, saved, type Store } from "../store";

export type Side = "buy" | "sell";

export interface Position {
  symbol: string;
  /** Positive long, negative short: shares, face value or units of the base currency. */
  qty: number;
  avgPrice: number;
  /** Profit taken on what has been closed, in USD. */
  realized: number;
}

export interface Order {
  id: number;
  symbol: string;
  side: Side;
  qty: number;
  type: "market" | "limit";
  limit?: number;
  status: "working" | "filled" | "cancelled";
  time: number;
}

export interface Fill {
  id: number;
  orderId: number;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  time: number;
}

export interface Book {
  positions: Position[];
  orders: Order[];
  fills: Fill[];
  nextId: number;
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  qty: number;
  type: "market" | "limit";
  limit?: number;
}

export type Trading = Store<Book> & {
  /** Place an order. Returns why it can't be placed, or the order. */
  submit(request: OrderRequest): Order | { error: string };
  cancel(orderId: number): void;
  /** Called for every fill, for a toast. */
  onFill(listener: (fill: Fill) => void): () => void;
  /** Start working limit orders against the market; returns a stop. */
  connect(): () => void;
};

/** What `qty` at `price` is worth, in the instrument's quote currency: a bond is priced per 100 of face value. */
export const notional = (inst: Instrument, qty: number, price: number) =>
  inst.coupon !== undefined ? (qty * price) / 100 : qty * price;

/** An amount in an instrument's quote currency, in USD. USD/JPY's P&L is in yen: divide by the rate. */
export const inUsd = (inst: Instrument, amount: number, price: number) =>
  inst.assetClass === "fx" && !inst.symbol.endsWith("USD") ? amount / price : amount;

/** Unrealised P&L in USD at the market's mid. */
export function unrealized(inst: Instrument, p: Position, q: Quote | undefined): number {
  if (!q || !p.qty) return 0;
  const mark = (q.bid + q.ask) / 2;
  return inUsd(inst, notional(inst, p.qty, mark - p.avgPrice), mark);
}

const START: Book = {
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

const KEY = "markets:book";

export function createTrading(market: MarketData, persist = true): Trading {
  const store = createStore<Book>(persist ? saved.read(KEY, START) : START);
  if (persist) store.subscribe(() => saved.write(KEY, store.get()));
  const fillListeners = new Set<(f: Fill) => void>();

  function fill(order: Order, price: number) {
    const inst = market.instrument(order.symbol)!;
    const signed = order.side === "buy" ? order.qty : -order.qty;
    store.set((book) => {
      const fillRow: Fill = {
        id: book.nextId,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        price,
        time: market.snapshot({ channel: "clock" }),
      };
      const old = book.positions.find((p) => p.symbol === order.symbol);
      const next = applyFill(inst, old, signed, price);
      const positions = old
        ? book.positions.map((p) => (p === old ? next : p))
        : [...book.positions, next];
      const orders = book.orders.map((o) =>
        o.id === order.id ? { ...o, status: "filled" as const } : o,
      );
      fillListeners.forEach((l) => l(fillRow));
      return {
        ...book,
        positions,
        orders,
        fills: [fillRow, ...book.fills].slice(0, 200),
        nextId: book.nextId + 1,
      };
    });
  }

  /** A limit order fills once the touch reaches it, at the touch. */
  function tryFill(order: Order) {
    const q = market.snapshot({ channel: "quote", symbol: order.symbol });
    if (order.type === "market") return fill(order, order.side === "buy" ? q.ask : q.bid);
    if (order.side === "buy" && q.ask <= order.limit!) fill(order, q.ask);
    if (order.side === "sell" && q.bid >= order.limit!) fill(order, q.bid);
  }

  return {
    ...store,
    submit(request) {
      const inst = market.instrument(request.symbol);
      if (!inst) return { error: `There is no instrument called ${request.symbol || "that"}.` };
      if (inst.assetClass === "index")
        return { error: "Indices can't be traded here: trade their members." };
      if (!(request.qty > 0) || !Number.isFinite(request.qty))
        return { error: "Enter a quantity above zero." };
      if (request.type === "limit" && !(request.limit! > 0))
        return { error: "Enter a limit price above zero." };
      const order: Order = {
        ...request,
        id: store.get().nextId,
        status: "working",
        time: market.snapshot({ channel: "clock" }),
      };
      store.set((b) => ({ ...b, orders: [order, ...b.orders], nextId: b.nextId + 1 }));
      tryFill(order);
      return store.get().orders.find((o) => o.id === order.id)!;
    },
    cancel(orderId) {
      store.set((b) => ({
        ...b,
        orders: b.orders.map((o) =>
          o.id === orderId && o.status === "working" ? { ...o, status: "cancelled" } : o,
        ),
      }));
    },
    onFill(listener) {
      fillListeners.add(listener);
      return () => fillListeners.delete(listener);
    },
    connect() {
      // Check working orders each tick of the market's clock.
      return market.subscribe({ channel: "clock" }, () => {
        for (const o of store.get().orders) if (o.status === "working") tryFill(o);
      });
    },
  };
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
