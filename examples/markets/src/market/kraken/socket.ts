/**
 * Kraken's websocket: connecting, trying again with back-off when it drops, and the feed's state for the status line.
 * Quotes stream for every pair all the time. The book and trades stream only while someone follows them, and stop a
 * little after the last one goes, so switching desks doesn't churn.
 */
import { createStore, type Store } from "@jali-examples/shared/store";
import type { FeedState } from "../types";
import { parseFrame, type KrakenFrame } from "./frames";
import { DEPTH } from "./pairs";

/** The part of a WebSocket this uses. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
}

export type SocketClass = new (url: string) => SocketLike;

/** A stream that streams only while followed. */
export type Stream = "book" | "trade";

/** A stream nobody follows is kept this long before it is stopped. */
const LINGER_MS = 10_000;
const OPEN = 1;

export interface KrakenSocket {
  feed: Store<FeedState>;
  /** Stream `channel` for `pair` while anyone follows it; returns the unfollow. `onStop` runs when it stops. */
  follow(channel: Stream, pair: string, onStop: () => void): () => void;
  close(): void;
}

export function connectKraken({
  url,
  Socket,
  pairs,
  onFrame,
}: {
  url: string;
  /** None at all (an old runtime): the feed stays down and the simulated market runs on. */
  Socket: SocketClass | undefined;
  /** Kraken's names for every pair, whose tickers always stream. */
  pairs: readonly string[];
  onFrame: (frame: KrakenFrame) => void;
}): KrakenSocket {
  const feed = createStore<FeedState>("connecting");
  let socket: SocketLike | null = null;
  let closed = false;
  let retry = 0;
  /** Streams wanted now, by "channel:pair", with how many follow each; and timers that will stop the unfollowed. */
  const wanted = new Map<string, { channel: Stream; pair: string; count: number }>();
  const lingering = new Map<string, ReturnType<typeof setTimeout>>();

  const send = (method: "subscribe" | "unsubscribe", params: Record<string, unknown>) => {
    if (socket?.readyState === OPEN) socket.send(JSON.stringify({ method, params }));
  };
  const streamParams = (channel: Stream, pair: string) =>
    channel === "book"
      ? { channel, symbol: [pair], depth: DEPTH }
      : { channel, symbol: [pair], snapshot: true };

  /** Back off: 1s, 2s, 4s… up to 15s between tries. */
  const reconnect = () => setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++));

  function connect() {
    if (closed) return;
    let ws: SocketLike;
    try {
      if (!Socket) throw new Error("no WebSocket");
      ws = new Socket(url);
    } catch {
      feed.set("down");
      if (Socket) reconnect();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      retry = 0;
      feed.set("live");
      // Quotes on every change of the best bid or offer, not only on trades.
      send("subscribe", { channel: "ticker", symbol: [...pairs], event_trigger: "bbo" });
      for (const w of wanted.values()) send("subscribe", streamParams(w.channel, w.pair));
    };
    ws.onmessage = (e) => {
      const frame = parseFrame(e.data);
      if (frame) onFrame(frame);
    };
    ws.onclose = () => {
      if (socket !== ws || closed) return;
      socket = null;
      feed.set("down");
      reconnect();
    };
  }

  connect();

  return {
    feed,
    follow(channel, pair, onStop) {
      const key = `${channel}:${pair}`;
      clearTimeout(lingering.get(key));
      lingering.delete(key);
      const w = wanted.get(key);
      if (w) w.count++;
      else {
        wanted.set(key, { channel, pair, count: 1 });
        send("subscribe", streamParams(channel, pair));
      }
      return () => {
        const w = wanted.get(key);
        if (!w || --w.count > 0) return;
        lingering.set(
          key,
          setTimeout(() => {
            lingering.delete(key);
            if (wanted.get(key)?.count) return;
            wanted.delete(key);
            send("unsubscribe", streamParams(channel, pair));
            onStop();
          }, LINGER_MS),
        );
      };
    },
    close() {
      closed = true;
      lingering.forEach((t) => clearTimeout(t));
      socket?.close();
      socket = null;
    },
  };
}
