/**
 * A paper-trading book: positions, orders and fills against the simulated market. Market orders fill at the touch
 * (a buy at the ask, a sell at the bid); limit orders work until the market reaches them.
 *
 * Only real prices are traded on: an order fills at a finite price above zero, and a market order is refused while
 * the instrument has no live bid and ask (a live feed before its first quote). The book kept on this device is read
 * back through `KEPT_BOOK`, which drops anything that isn't a finite number where one belongs.
 */
import {
  arrayOf,
  createKeptStore,
  finite,
  isRecord,
  type Kept,
  type Store,
} from "@jali-examples/shared/store";
import type { Instrument, MarketData, Quote } from "../market/types";

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

/** A quote's bid and ask, when they are real prices: both finite and above zero, and not a placeholder. */
export function touch(q: Quote | undefined): { bid: number; ask: number } | undefined {
  if (!q || q.pending) return undefined;
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  return ok(q.bid) && ok(q.ask) ? { bid: q.bid, ask: q.ask } : undefined;
}

/** Unrealised P&L in USD at the market's mid; 0 while there is no live price. */
export function unrealized(inst: Instrument, p: Position, q: Quote | undefined): number {
  if (!touch(q) || !q || !p.qty) return 0;
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

const SIDES: readonly string[] = ["buy", "sell"];
const STATUSES: readonly string[] = ["working", "filled", "cancelled"];
const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const above0 = (v: unknown) => {
  const n = finite(v);
  return n !== undefined && n > 0 ? n : undefined;
};
const wholeId = (v: unknown) => {
  const n = finite(v);
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
};

function position(v: unknown): Position | undefined {
  if (!isRecord(v)) return undefined;
  const symbol = text(v.symbol);
  const qty = finite(v.qty);
  const avgPrice = finite(v.avgPrice);
  const realized = finite(v.realized);
  return symbol &&
    qty !== undefined &&
    avgPrice !== undefined &&
    avgPrice >= 0 &&
    realized !== undefined
    ? { symbol, qty, avgPrice, realized }
    : undefined;
}
function order(v: unknown): Order | undefined {
  if (!isRecord(v)) return undefined;
  const o = {
    id: wholeId(v.id),
    symbol: text(v.symbol),
    side: SIDES.includes(v.side as string) ? (v.side as Side) : undefined,
    qty: above0(v.qty),
    type: v.type === "market" || v.type === "limit" ? v.type : undefined,
    status: STATUSES.includes(v.status as string) ? (v.status as Order["status"]) : undefined,
    time: finite(v.time),
  };
  if (Object.values(o).some((x) => x === undefined)) return undefined;
  const limit = above0(v.limit);
  if (o.type === "limit" && limit === undefined) return undefined;
  return { ...(o as Omit<Order, "limit">), ...(o.type === "limit" ? { limit } : {}) };
}
function fillOf(v: unknown): Fill | undefined {
  if (!isRecord(v)) return undefined;
  const f = {
    id: wholeId(v.id),
    orderId: wholeId(v.orderId),
    symbol: text(v.symbol),
    side: SIDES.includes(v.side as string) ? (v.side as Side) : undefined,
    qty: above0(v.qty),
    price: above0(v.price),
    time: finite(v.time),
  };
  return Object.values(f).some((x) => x === undefined) ? undefined : (f as Fill);
}

/** The rows, without any whose id an earlier row has: the first of each id is kept. */
function firstOfEachId<T extends { id: number }>(rows: T[] | undefined): T[] | undefined {
  const seen = new Set<number>();
  return rows?.filter((r) => !seen.has(r.id) && !!seen.add(r.id));
}

/**
 * The paper book as kept on this device (version 1; 0 is the same shape, from before versions). A position, order or
 * fill that doesn't read (a NaN price from an older build, a missing field) is dropped and the rest kept, and so is
 * a second order or fill with an id already read (two working orders of one id would both fill on one tick); the next
 * id is past every id in the book. Anything that isn't a book at all is the demo's starting book.
 */
export const KEPT_BOOK: Kept<Book> = {
  key: "markets:book",
  version: 1,
  fallback: START,
  parse(value, version) {
    if (version > 1 || !isRecord(value)) return undefined;
    const positions = arrayOf(value.positions, position);
    const orders = firstOfEachId(arrayOf(value.orders, order));
    const fills = firstOfEachId(arrayOf(value.fills, fillOf));
    if (!positions || !orders || !fills) return undefined;
    const ids = [...orders.map((o) => o.id), ...fills.map((f) => f.id)];
    const nextId = Math.max(wholeId(value.nextId) ?? 1, ...ids.map((id) => id + 1));
    return { positions, orders, fills, nextId };
  },
};

export function createTrading(market: MarketData, persist = true): Trading {
  const store = createKeptStore(KEPT_BOOK, persist);
  const fillListeners = new Set<(f: Fill) => void>();

  /** Fills `order` at `price`: never at a price that isn't real, and never into a position that wouldn't be. */
  function fill(order: Order, price: number) {
    const inst = market.instrument(order.symbol);
    if (!inst || !Number.isFinite(price) || price <= 0) return;
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
      if (![next.qty, next.avgPrice, next.realized].every(Number.isFinite)) return book;
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

  /** A market order fills at the touch; a limit order once the touch reaches it, at the touch. Without a live bid and
   *  ask, nothing fills: it waits. */
  function tryFill(order: Order) {
    const t = touch(market.snapshot({ channel: "quote", symbol: order.symbol }));
    if (!t) return;
    const at = order.side === "buy" ? t.ask : t.bid;
    if (order.type === "market") return fill(order, at);
    const limit = order.limit ?? NaN;
    if (order.side === "buy" ? at <= limit : at >= limit) fill(order, at);
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
      if (request.type === "limit" && !(Number.isFinite(request.limit) && (request.limit ?? 0) > 0))
        return { error: "Enter a limit price above zero." };
      if (
        request.type === "market" &&
        !touch(market.snapshot({ channel: "quote", symbol: request.symbol }))
      )
        return {
          error: `${request.symbol}'s price is not known yet, so a market order can't be filled. Wait for its quote, or send a limit order.`,
        };
      const order: Order = {
        ...request,
        id: store.get().nextId,
        status: "working",
        time: market.snapshot({ channel: "clock" }),
      };
      store.set((b) => ({ ...b, orders: [order, ...b.orders], nextId: b.nextId + 1 }));
      tryFill(order);
      return store.get().orders.find((o) => o.id === order.id) ?? order;
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
