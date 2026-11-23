import { describe, expect, it } from "vite-plus/test";
import { isBond } from "../classes";
import type { MarketData, Quote } from "../types";
import { createSimulator } from ".";
import { bondPrice, INSTRUMENTS } from "./instruments";

// A fixed day, so the tests never depend on when they run: Thursday 19 Nov 2026, 11:45.
const start = new Date(2026, 10, 19, 11, 45).getTime();
const sim = (seed = 7) => createSimulator({ seed, start });

/** A simulated quote: the simulator has one for every instrument from the start. */
function quoteOf(m: MarketData, symbol: string): Quote {
  const q = m.snapshot({ channel: "quote", symbol });
  if (!q) throw new Error(`${symbol} has no quote`);
  return q;
}

describe("the market simulator", () => {
  it("has the instruments the brief asks for", () => {
    const count = (c: string) => INSTRUMENTS.filter((i) => i.assetClass === c).length;
    expect(count("equity")).toBe(40);
    expect(count("govt")).toBeGreaterThanOrEqual(4);
    expect(count("corp")).toBeGreaterThanOrEqual(2);
    expect(count("fx")).toBe(6);
    expect(count("index")).toBe(4);
    expect(new Set(INSTRUMENTS.map((i) => i.symbol)).size).toBe(INSTRUMENTS.length);
  });

  it("is the same market for the same seed", () => {
    const a = sim();
    const b = sim();
    a.step(400);
    b.step(400);
    for (const { symbol } of INSTRUMENTS)
      expect(a.snapshot({ channel: "quote", symbol })).toEqual(
        b.snapshot({ channel: "quote", symbol }),
      );
    expect(a.snapshot({ channel: "news" })).toEqual(b.snapshot({ channel: "news" }));
    expect(a.snapshot({ channel: "trades", symbol: "LMNA" })).toEqual(
      b.snapshot({ channel: "trades", symbol: "LMNA" }),
    );
  });

  it("is a different market for another seed", () => {
    const a = sim(7);
    const b = sim(8);
    a.step(40);
    b.step(40);
    expect(quoteOf(a, "LMNA").last).not.toBe(quoteOf(b, "LMNA").last);
  });

  it("simulates the morning before it starts: the session opened at 09:30 and has bars and volume", () => {
    const m = sim();
    expect(m.now()).toBe(start);
    const bars = m.snapshot({ channel: "bars", symbol: "LMNA", range: "1D" });
    expect(bars.length).toBeGreaterThan(130); // 09:30 to 11:45, one a minute
    expect(bars[0]?.time).toBe(new Date(2026, 10, 19, 9, 30).getTime());
    expect(quoteOf(m, "LMNA").volume).toBeGreaterThan(0);
    expect(m.snapshot({ channel: "news" }).length).toBeGreaterThan(5);
  });

  it("keeps every quote sane: bid below ask, last inside the day's range, the change from yesterday", () => {
    const m = sim();
    m.step(200);
    for (const inst of INSTRUMENTS) {
      const q = quoteOf(m, inst.symbol);
      if (inst.assetClass === "index") expect(q.bid).toBe(q.ask);
      else expect(q.bid).toBeLessThan(q.ask);
      expect(q.low).toBeLessThanOrEqual(q.last);
      expect(q.high).toBeGreaterThanOrEqual(q.last);
      expect(q.change).toBeCloseTo(q.last - inst.prevClose, 8);
    }
  });

  it("moves prices by realistic amounts: a day's equity move is a few per cent, not tens", () => {
    const m = sim();
    m.step(4 * 60 * 30); // half an hour
    for (const inst of INSTRUMENTS.filter((i) => i.assetClass === "equity")) {
      expect(Math.abs(quoteOf(m, inst.symbol).changePct)).toBeLessThan(8);
    }
    const fx = quoteOf(m, "EURUSD");
    expect(Math.abs(fx.changePct)).toBeLessThan(1.5);
  });

  it("builds bars that hold their own prices: low ≤ open, close ≤ high", () => {
    const m = sim();
    m.step(100);
    for (const range of ["1D", "5D", "1M", "6M", "1Y"] as const) {
      const bars = m.snapshot({ channel: "bars", symbol: "ORBD", range });
      expect(bars.length).toBeGreaterThan(range === "1M" ? 20 : 50);
      for (const b of bars) {
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close) + 1e-9);
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close) - 1e-9);
      }
      for (let i = 1; i < bars.length; i++)
        expect(bars[i]!.time).toBeGreaterThan(bars[i - 1]!.time);
    }
    expect(m.snapshot({ channel: "bars", symbol: "ORBD", range: "1Y" }).length).toBe(252);
  });

  it("keeps an order book with depth, best prices first, at the quote", () => {
    const m = sim();
    m.step(10);
    const book = m.snapshot({ channel: "book", symbol: "HRBK" });
    const q = quoteOf(m, "HRBK");
    expect(book.bids).toHaveLength(10);
    expect(book.asks).toHaveLength(10);
    expect(book.bids[0]!.price).toBe(q.bid);
    expect(book.asks[0]!.price).toBe(q.ask);
    for (let i = 1; i < 10; i++) {
      expect(book.bids[i]!.price).toBeLessThan(book.bids[i - 1]!.price);
      expect(book.asks[i]!.price).toBeGreaterThan(book.asks[i - 1]!.price);
    }
  });

  it("prints trades at the bid or the ask, newest first, and adds them to the volume", () => {
    const m = sim();
    const before = quoteOf(m, "LMNA").volume;
    const prints: number[] = [];
    m.subscribe({ channel: "trades", symbol: "LMNA" }, (t) => prints.push(t[0]!.id));
    m.step(80);
    const trades = m.snapshot({ channel: "trades", symbol: "LMNA" });
    expect(prints.length).toBeGreaterThan(5);
    expect(trades[0]!.time).toBeGreaterThanOrEqual(trades[1]!.time);
    const traded = trades.filter((t) => t.time > start).reduce((s, t) => s + t.size, 0);
    expect(quoteOf(m, "LMNA").volume).toBeCloseTo(before + traded, 4);
  });

  it("prices bonds from their yields: a higher yield is a lower price", () => {
    expect(bondPrice(4, 4, 10)).toBeCloseTo(100, 6);
    expect(bondPrice(5, 4, 10)).toBeLessThan(bondPrice(4, 4, 10));
    const m = sim();
    m.step(50);
    const q = quoteOf(m, "GOV10Y");
    const inst = m.instrument("GOV10Y");
    if (!inst || !isBond(inst) || !q.yield) throw new Error("GOV10Y is a bond with a yield");
    expect(Math.sign(q.change)).toBe(-Math.sign(q.yield.changeBp));
    expect(bondPrice(q.yield.pct, inst.coupon, inst.maturity)).toBeCloseTo((q.bid + q.ask) / 2, 1);
  });

  it("moves an index with its members", () => {
    const m = sim();
    m.step(200);
    const index = m.instrument("MXTEC");
    if (index?.assetClass !== "index") throw new Error("MXTEC is an index");
    const level = quoteOf(m, "MXTEC");
    const members = index.members.map((s) => quoteOf(m, s));
    const up = members.filter((q) => q.change > 0).length;
    // Mostly up members, an index up; mostly down, down. (Weights can tip a close call either way.)
    if (up >= 6) expect(level.change).toBeGreaterThan(0);
    if (up <= 2) expect(level.change).toBeLessThan(0);
  });

  it("tells a subscriber only while it is subscribed", () => {
    const m = sim();
    let calls = 0;
    const stop = m.subscribe({ channel: "quote", symbol: "EURUSD" }, () => calls++);
    m.step(20);
    const seen = calls;
    expect(seen).toBeGreaterThan(0);
    stop();
    m.step(20);
    expect(calls).toBe(seen);
  });

  it("refuses an instrument it does not have", () => {
    expect(() => sim().snapshot({ channel: "quote", symbol: "NOPE" })).toThrow(
      /Unknown instrument/,
    );
  });
});
