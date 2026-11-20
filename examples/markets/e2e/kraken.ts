/**
 * A stand-in for Kraken in the browser tests: the websocket and the REST API answer from here, so the tests never
 * depend on the network, and can play what a real feed rarely does (a bad frame, a feed that drops).
 *
 *   const kraken = await fakeKraken(page);   // before page.goto
 *   kraken.send({ channel: "ticker", type: "update", data: [...] });
 *   await kraken.drop();                     // the feed goes down; it answers again on the app's next try
 */
import type { Page, WebSocketRoute } from "@playwright/test";

const PAIRS = [
  ["BTC/USD", 63_760],
  ["ETH/USD", 3_120.5],
  ["SOL/USD", 142.31],
  ["XRP/USD", 0.61234],
  ["ADA/USD", 0.452301],
  ["DOGE/USD", 0.1623451],
  ["LTC/USD", 81.42],
  ["LINK/USD", 14.52341],
  ["AVAX/USD", 27.341],
  ["DOT/USD", 5.4321],
] as const;

export const ticker = (symbol: string, last: number) => ({
  symbol,
  bid: last * 0.9999,
  bid_qty: 1.5,
  ask: last,
  ask_qty: 0.25,
  last,
  volume: 4600.5,
  vwap: last * 0.998,
  low: last * 0.97,
  high: last * 1.02,
  change: -last * 0.01,
  change_pct: -1,
  timestamp: new Date().toISOString(),
});

export interface FakeKraken {
  /** Plays a message to every open socket. */
  send(message: unknown): void;
  /** Closes every open socket, as when the feed drops; `refuse` keeps new ones from opening until `accept()`. */
  drop(options?: { refuse?: boolean }): Promise<void>;
  accept(): void;
  /** Price history calls so far. */
  historyCalls(): number;
  /** Makes the history calls fail (true) or answer (false). */
  failHistory(fail: boolean): void;
}

export async function fakeKraken(
  page: Page,
  { quotes = true }: { quotes?: boolean } = {},
): Promise<FakeKraken> {
  const open = new Set<WebSocketRoute>();
  let refuse = false;
  let history = 0;
  let historyFails = false;

  await page.routeWebSocket("wss://ws.kraken.com/v2", (ws) => {
    if (refuse) return void ws.close({ code: 1006, reason: "unreachable" });
    open.add(ws);
    ws.onClose(() => open.delete(ws));
    ws.onMessage((raw) => {
      const m = JSON.parse(String(raw)) as {
        method: string;
        params: { channel: string; symbol: string[] };
      };
      if (m.method !== "subscribe") return;
      const { channel, symbol } = m.params;
      if (channel === "ticker" && quotes)
        ws.send(
          JSON.stringify({
            channel,
            type: "snapshot",
            data: PAIRS.filter(([p]) => symbol.includes(p)).map(([p, last]) => ticker(p, last)),
          }),
        );
      if (channel === "book")
        for (const s of symbol) {
          const last = PAIRS.find(([p]) => p === s)?.[1] ?? 1;
          const side = (dir: number) =>
            Array.from({ length: 10 }, (_, i) => ({
              price: last * (1 + dir * 0.0001 * (i + 1)),
              qty: 1 + i,
            }));
          ws.send(
            JSON.stringify({
              channel,
              type: "snapshot",
              data: [{ symbol: s, bids: side(-1), asks: side(1) }],
            }),
          );
        }
      if (channel === "trade")
        ws.send(
          JSON.stringify({
            channel,
            type: "snapshot",
            data: symbol.flatMap((s, k) =>
              [1, 2, 3].map((i) => ({
                symbol: s,
                side: i % 2 ? "buy" : "sell",
                price: (PAIRS.find(([p]) => p === s)?.[1] ?? 1) * (1 + i / 1e4),
                qty: 0.5,
                trade_id: k * 10 + i,
                timestamp: new Date(Date.now() - (3 - i) * 1000).toISOString(),
              })),
            ),
          }),
        );
    });
  });

  await page.route("https://api.kraken.com/0/public/OHLC**", async (route) => {
    history++;
    if (historyFails) return route.fulfill({ status: 503, json: { error: ["EService:Busy"] } });
    const url = new URL(route.request().url());
    const pair = url.searchParams.get("pair") ?? "";
    const interval = Number(url.searchParams.get("interval") ?? 5);
    const last = PAIRS.find(([p]) => p === pair)?.[1] ?? 1;
    const step = interval * 60;
    const now = Math.floor(Date.now() / 1000 / step) * step;
    const rows = Array.from({ length: 400 }, (_, i) => {
      const p = last * (1 + Math.sin(i / 20) / 50);
      return [now - (399 - i) * step, p, p * 1.002, p * 0.998, p, p, "3.5", 10].map((v, j) =>
        j === 0 || j === 7 ? v : String(v),
      );
    });
    await route.fulfill({ json: { error: [], result: { [pair]: rows } } });
  });

  return {
    send: (message) => open.forEach((ws) => ws.send(JSON.stringify(message))),
    async drop(options = {}) {
      refuse = !!options.refuse;
      await Promise.all([...open].map((ws) => ws.close({ code: 1006, reason: "dropped" })));
      open.clear();
    },
    accept: () => void (refuse = false),
    historyCalls: () => history,
    failHistory: (fail) => void (historyFails = fail),
  };
}
