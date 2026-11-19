import { describe, expect, it, vi } from "vitest";
import { createKrakenMarket, type SocketLike } from "./kraken";
import { createSimulator } from "./simulator";

/** A websocket that opens at once and records what is sent; `push` plays a message from Kraken. */
class FakeSocket implements SocketLike {
  static last: FakeSocket;
  readyState = 0;
  sent: { method: string; params: Record<string, unknown> }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  push(channel: string, type: string, data: unknown[]) {
    this.onmessage?.({ data: JSON.stringify({ channel, type, data }) });
  }
}

const NOW = Date.parse("2026-11-19T12:00:00Z");
const ticker = (symbol: string, last: number, change = -100) => ({
  symbol,
  bid: last - 0.1,
  bid_qty: 1.5,
  ask: last,
  ask_qty: 0.25,
  last,
  volume: 4600.5,
  vwap: last - 50,
  low: last - 500,
  high: last + 300,
  change,
  change_pct: (change / (last - change)) * 100,
  timestamp: "2026-11-19T11:59:59Z",
});

async function setup(fetch = vi.fn()) {
  const base = createSimulator({ seed: 3 });
  const market = createKrakenMarket(base, {
    WebSocket: FakeSocket,
    fetch,
    now: () => NOW,
  });
  await Promise.resolve(); // the socket opens
  return { base, market, ws: FakeSocket.last, fetch };
}

describe("the Kraken market", () => {
  it("adds the crypto pairs to the simulated market, and answers everything else from it", async () => {
    const { base, market } = await setup();
    expect(market.instrument("BTCUSD")).toMatchObject({ assetClass: "crypto", source: "Kraken" });
    expect(market.instrument("LMNA")).toBe(base.instrument("LMNA"));
    expect(market.instruments.length).toBe(base.instruments.length + 10);
    expect(market.snapshot({ channel: "quote", symbol: "LMNA" })).toEqual(
      base.snapshot({ channel: "quote", symbol: "LMNA" }),
    );
  });

  it("asks for every pair's ticker on connecting, on each change of the best bid or offer", async () => {
    const { ws } = await setup();
    expect(ws.url).toBe("wss://ws.kraken.com/v2");
    expect(ws.sent[0]).toMatchObject({
      method: "subscribe",
      params: { channel: "ticker", event_trigger: "bbo" },
    });
    expect(ws.sent[0]!.params.symbol).toContain("BTC/USD");
  });

  it("reads a quote from the ticker, with the price a day ago as the previous close", async () => {
    const { market, ws } = await setup();
    const seen = vi.fn();
    market.subscribe({ channel: "quote", symbol: "BTCUSD" }, seen);
    ws.push("ticker", "snapshot", [ticker("BTC/USD", 63760, -720)]);
    ws.push("ticker", "update", [ticker("BTC/USD", 63770, -710)]);
    const q = market.snapshot({ channel: "quote", symbol: "BTCUSD" });
    expect(q).toMatchObject({ last: 63770, prevClose: 64480, bid: 63769.9, askSize: 0.25 });
    expect(q.tickDir).toBe(1);
    expect(market.instrument("BTCUSD")!.prevClose).toBe(64480);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("is ready once every pair has a quote, and says so when that takes too long", async () => {
    const { market, ws } = await setup();
    vi.useFakeTimers();
    const late = market.ready(1000);
    vi.advanceTimersByTime(1000);
    await expect(late).resolves.toBe(false);
    vi.useRealTimers();
    const ready = market.ready();
    const pairs = (ws.sent[0]!.params.symbol as string[]).map((s, i) => ticker(s, 10 + i));
    ws.push("ticker", "snapshot", pairs);
    await expect(ready).resolves.toBe(true);
  });

  it("streams a book only while a pane follows it, and keeps it to ten levels a side", async () => {
    const { market, ws } = await setup();
    vi.useFakeTimers();
    const stop = market.subscribe({ channel: "book", symbol: "ETHUSD" }, () => {});
    expect(ws.sent.at(-1)).toEqual({
      method: "subscribe",
      params: { channel: "book", symbol: ["ETH/USD"], depth: 10 },
    });
    const side = (from: number, dir: number) =>
      Array.from({ length: 10 }, (_, i) => ({ price: from + dir * i, qty: 1 + i }));
    ws.push("book", "snapshot", [{ symbol: "ETH/USD", bids: side(99, -1), asks: side(100, 1) }]);
    // A better bid pushes the tenth off; a size of zero removes a level.
    ws.push("book", "update", [
      { symbol: "ETH/USD", bids: [{ price: 99.5, qty: 2 }], asks: [{ price: 100, qty: 0 }] },
    ]);
    const b = market.snapshot({ channel: "book", symbol: "ETHUSD" });
    expect(b.bids).toHaveLength(10);
    expect(b.bids[0]).toEqual({ price: 99.5, size: 2, orders: 0 });
    expect(b.bids.at(-1)!.price).toBe(91);
    expect(b.asks[0]!.price).toBe(101);
    expect(b.asks).toHaveLength(9);

    stop();
    expect(ws.sent.at(-1)!.method).toBe("subscribe"); // not at once: a desk switch may follow it again
    vi.advanceTimersByTime(10_000);
    expect(ws.sent.at(-1)).toEqual({
      method: "unsubscribe",
      params: { channel: "book", symbol: ["ETH/USD"], depth: 10 },
    });
    vi.useRealTimers();
  });

  it("shows trades newest first", async () => {
    const { market, ws } = await setup();
    market.subscribe({ channel: "trades", symbol: "SOLUSD" }, () => {});
    const trade = (id: number, second: number) => ({
      symbol: "SOL/USD",
      side: id % 2 ? "buy" : "sell",
      price: 140 + id / 100,
      qty: 0.5,
      trade_id: id,
      timestamp: `2026-11-19T11:59:${String(second).padStart(2, "0")}Z`,
    });
    ws.push("trade", "snapshot", [trade(1, 1), trade(2, 2), trade(3, 3)]);
    ws.push("trade", "update", [trade(4, 4)]);
    const trades = market.snapshot({ channel: "trades", symbol: "SOLUSD" });
    expect(trades.map((t) => t.id)).toEqual([4, 3, 2, 1]);
    expect(trades[0]).toMatchObject({ symbol: "SOLUSD", side: "sell", size: 0.5 });
  });

  it("loads price history from the REST API when a chart first asks, and keeps its last bar live", async () => {
    const minute = 60_000;
    const rows = Array.from({ length: 400 }, (_, i) => {
      const t = (NOW - (399 - i) * 5 * minute) / 1000;
      return [t, "100", "102", "99", "101", "100.5", "3.5", 10];
    });
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ error: [], result: { "BTC/USD": rows } }),
    }));
    const { market, ws } = await setup(fetch);
    const seen = vi.fn();
    market.subscribe({ channel: "bars", symbol: "BTCUSD", range: "1D" }, seen);
    expect(market.snapshot({ channel: "bars", symbol: "BTCUSD", range: "1D" })).toEqual([]);
    await vi.waitFor(() => expect(seen).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "https://api.kraken.com/0/public/OHLC?pair=BTC%2FUSD&interval=5",
    );
    const bars = market.snapshot({ channel: "bars", symbol: "BTCUSD", range: "1D" });
    // The last 24 hours of 5-minute bars.
    expect(bars.length).toBeGreaterThanOrEqual(288);
    expect(bars.length).toBeLessThanOrEqual(289);
    expect(bars[0]).toMatchObject({ open: 100, high: 102, low: 99, close: 101, volume: 3.5 });

    ws.push("ticker", "snapshot", [ticker("BTC/USD", 105)]);
    const after = market.snapshot({ channel: "bars", symbol: "BTCUSD", range: "1D" });
    expect(after.at(-1)).toMatchObject({ close: 105, high: 105 });
  });

  it("has no news of its own for a coin", async () => {
    const { market } = await setup();
    expect(market.snapshot({ channel: "news", symbol: "BTCUSD" })).toEqual([]);
  });
});
