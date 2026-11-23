/**
 * A paper-trading book against the market: market orders fill at the touch (a buy at the ask, a sell at the bid);
 * limit orders work until the market reaches them. Only real prices are traded on: a market order is refused while
 * the instrument has no live bid and ask (a live feed before its first quote). The records and their arithmetic are
 * ledger.ts; what is kept on this device is read back through ledger-kept.ts.
 */
import { createKeptStore, positive, type Store } from "@jali-examples/shared/store";
import { facts } from "../market/classes";
import type { MarketData } from "../market/types";
import { recordFill, touch, type Fill, type Ledger, type Order, type OrderRequest } from "./ledger";
import { KEPT_LEDGER } from "./ledger-kept";

export type Trading = Store<Ledger> & {
  /** Place an order. Returns the order, or why it can't be placed. */
  submit(request: OrderRequest): Order | { error: string };
  cancel(orderId: number): void;
  /** Called after every fill, for a toast. */
  onFill(listener: (fill: Fill) => void): () => void;
  /** Start working limit orders against the market; returns a stop. */
  connect(): () => void;
};

export function createTrading(market: MarketData, persist = true): Trading {
  const store = createKeptStore(KEPT_LEDGER, persist);
  const fillListeners = new Set<(f: Fill) => void>();
  const clock = () => market.snapshot({ channel: "clock" });
  const touchOf = (symbol: string) => touch(market.snapshot({ channel: "quote", symbol }));

  /** A market order fills at the touch; a limit order once the touch reaches it, at the touch. Without a live bid and
   *  ask, nothing fills: it waits. */
  function tryFill(order: Order) {
    const inst = market.instrument(order.symbol);
    const t = touchOf(order.symbol);
    if (!inst || !t) return;
    const at = order.side === "buy" ? t.ask : t.bid;
    if (order.type === "limit" && (order.side === "buy" ? at > order.limit : at < order.limit))
      return;
    const done = recordFill(store.get(), inst, order, at, clock());
    if (!done) return;
    store.set(done.ledger);
    fillListeners.forEach((l) => l(done.fill));
  }

  return {
    ...store,
    submit(request) {
      const inst = market.instrument(request.symbol);
      if (!inst) return { error: `There is no instrument called ${request.symbol || "that"}.` };
      if (!facts(inst).tradable)
        return { error: "Indices can't be traded here: trade their members." };
      if (!(request.qty > 0) || !Number.isFinite(request.qty))
        return { error: "Enter a quantity above zero." };
      const limit = positive(request.limit);
      if (request.type === "limit" && limit === undefined)
        return { error: "Enter a limit price above zero." };
      if (request.type === "market" && !touchOf(request.symbol))
        return {
          error: `${request.symbol}'s price is not known yet, so a market order can't be filled. Wait for its quote, or send a limit order.`,
        };
      const { symbol, side, qty } = request;
      const base = {
        id: store.get().nextId,
        symbol,
        side,
        qty,
        status: "working" as const,
        time: clock(),
      };
      const order: Order =
        limit !== undefined && request.type === "limit"
          ? { ...base, type: "limit", limit }
          : { ...base, type: "market" };
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
