import { describe, expect, it } from "vitest";
import { createSimulator } from "../market/sim";
import type { MarketData, Quote } from "../market/types";
import { KEPT_LEDGER } from "./ledger-kept";
import { createTrading } from "./trading";

/** The simulated market, with one instrument's quote replaced by `quote`, or by none: its price not known yet. */
function marketWith(symbol: string, quote: Partial<Quote> | null): MarketData {
  const base = createSimulator({ seed: 3 });
  return {
    ...base,
    instruments: base.instruments,
    instrument: (s) => base.instrument(s),
    snapshot: ((topic) =>
      topic.channel === "quote" && topic.symbol === symbol
        ? quote && { ...(base.snapshot(topic) as Quote), ...quote }
        : base.snapshot(topic)) as MarketData["snapshot"],
    subscribe: (topic, onData) => base.subscribe(topic, onData),
  };
}

describe("the paper book trades only on real prices", () => {
  it("refuses a market order while the price is not known yet", () => {
    const trading = createTrading(marketWith("LMNA", null), false);
    const r = trading.submit({ symbol: "LMNA", side: "buy", qty: 10, type: "market" });
    expect(r).toEqual({ error: expect.stringMatching(/not known yet/) });
    expect(trading.get().fills).toEqual([]);
  });

  it("refuses a market order without a bid and ask above zero", () => {
    for (const touch of [{ bid: 0, ask: 0 }, { bid: Number.NaN, ask: 10 }, { ask: Infinity }]) {
      const trading = createTrading(marketWith("LMNA", touch), false);
      const r = trading.submit({ symbol: "LMNA", side: "sell", qty: 10, type: "market" });
      expect(r).toHaveProperty("error");
    }
  });

  it("keeps a limit order working, unfilled, until there is a price", () => {
    const trading = createTrading(marketWith("LMNA", null), false);
    const r = trading.submit({ symbol: "LMNA", side: "buy", qty: 10, type: "limit", limit: 500 });
    expect(r).toMatchObject({ status: "working" });
    expect(trading.get().fills).toEqual([]);
  });

  it("refuses a limit that isn't a finite price above zero", () => {
    const trading = createTrading(createSimulator({ seed: 3 }), false);
    for (const limit of [Number.NaN, Infinity, 0, -1, undefined])
      expect(
        trading.submit({ symbol: "LMNA", side: "buy", qty: 10, type: "limit", limit }),
      ).toHaveProperty("error");
  });

  it("fills a market order at the touch when there is one", () => {
    const trading = createTrading(marketWith("LMNA", { bid: 99, ask: 101 }), false);
    trading.submit({ symbol: "LMNA", side: "buy", qty: 10, type: "market" });
    expect(trading.get().fills[0]).toMatchObject({ price: 101, qty: 10 });
  });
});

describe("the kept paper book", () => {
  const good = KEPT_LEDGER.fallback;

  it("falls back to the demo's book for anything that isn't a book", () => {
    for (const v of [null, 42, "book", [], {}, { positions: {} }])
      expect(KEPT_LEDGER.parse(v, 1)).toBeUndefined();
    expect(KEPT_LEDGER.parse(good, 2)).toBeUndefined();
  });

  it("drops a position, order or fill that doesn't read, and keeps the rest", () => {
    const book = KEPT_LEDGER.parse(
      {
        positions: [
          { symbol: "LMNA", qty: 10, avgPrice: 100, realized: 0 },
          { symbol: "HRBK", qty: null, avgPrice: 50, realized: 0 },
          { symbol: "KSTR", qty: 1, avgPrice: "NaN", realized: 0 },
        ],
        orders: [
          { id: 4, symbol: "LMNA", side: "buy", qty: 1, type: "limit", status: "working", time: 1 },
          { id: 5, symbol: "LMNA", side: "buy", qty: 1, type: "market", status: "filled", time: 1 },
        ],
        fills: [{ id: 6, orderId: 5, symbol: "LMNA", side: "buy", qty: 1, price: null, time: 1 }],
        nextId: 2,
      },
      0,
    );
    expect(book?.positions.map((p) => p.symbol)).toEqual(["LMNA"]);
    // A limit order without its limit is dropped.
    expect(book?.orders.map((o) => o.id)).toEqual([5]);
    expect(book?.fills).toEqual([]);
    // Past every id kept, whatever nextId said.
    expect(book?.nextId).toBe(6);
  });

  it("keeps only the first order and fill of each id, so one tick fills an order once", () => {
    const working = { symbol: "LMNA", side: "buy", qty: 10, type: "market", status: "working" };
    const fill = { orderId: 1, symbol: "LMNA", side: "buy", qty: 1, price: 100, time: 1 };
    localStorage.setItem(
      KEPT_LEDGER.key,
      JSON.stringify({
        v: 1,
        data: {
          positions: [],
          orders: [
            { ...working, id: 7, time: 1 },
            { ...working, id: 7, time: 2 },
          ],
          fills: [
            { ...fill, id: 3 },
            { ...fill, id: 3, qty: 2 },
          ],
          nextId: 8,
        },
      }),
    );
    try {
      // The market's clock, ticked by hand.
      const base = marketWith("LMNA", { bid: 99, ask: 101 });
      let tick = () => {};
      const market: MarketData = {
        ...base,
        subscribe: (topic, onData) => {
          if (topic.channel !== "clock") return base.subscribe(topic, onData);
          tick = () => (onData as (v: number) => void)(0);
          return () => {};
        },
      };
      const trading = createTrading(market);
      expect(trading.get().orders.map((o) => o.time)).toEqual([1]);
      expect(trading.get().fills.map((f) => f.qty)).toEqual([1]);
      trading.connect();
      tick();
      expect(trading.get().fills.filter((f) => f.orderId === 7)).toHaveLength(1);
      expect(trading.get().positions[0]).toMatchObject({ symbol: "LMNA", qty: 10 });
    } finally {
      localStorage.removeItem(KEPT_LEDGER.key);
    }
  });
});
